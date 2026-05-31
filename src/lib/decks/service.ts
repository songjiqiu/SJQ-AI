import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  analyzeDeck,
  composeDeckFromOutline,
  composeSingleSlideFromOutline,
  type AnalyzeDeckOptions
} from "@/lib/ai-deck/analyzer";
import {
  createImageLayerGenerator,
  type ImageLayerGenerator
} from "@/lib/ai-deck/image-generator";
import {
  buildContentReview,
  buildConsistencyReport,
  buildSlideMotionPlan,
  normalizeSlideCompositionPlan
} from "@/lib/ai-deck/postprocess";
import {
  createImageQualityReviewer,
  materializeImageLayer,
  type ImageQualityReviewer
} from "@/lib/ai-deck/image-assets";
import {
  analyzeDeckRequestSchema,
  generatedDeckResultSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type GeneratedDeckResult,
  type GeneratedImageLayer,
  type GeneratedSlideResult,
  type SlideCompositionPlan,
  type SlideContent,
  type UnifiedVisualSpec
} from "@/lib/ai-deck/schema";
import { prisma } from "@/lib/db/prisma";
import { getDeckOutlineDraftForUser } from "@/lib/deck-outline/service";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";

import { createDeckPptxBuffer, type PptxImageAsset } from "./pptx";
import {
  deleteDeckStorageDirectory,
  readStorageFile,
  writeDeckFile
} from "./storage";

export const generateDeckFromOutlineDraftSchema = z
  .object({
    outlineDraftId: z.string().min(3).max(120)
  })
  .strict();

export type DeckProjectListItem = {
  id: string;
  createdAt: string;
  deckTitle: string;
  deckSummary: string;
  mode: "ai-json" | "mock";
  pptxUrl?: string;
  reviewScore: number;
  consistencyScore: number;
  slideCount: number;
  status: "GENERATING" | "READY" | "FAILED";
};

export type DeckGenerationProgress = {
  current: number;
  message: string;
  stage:
    | "queued"
    | "composing"
    | "images"
    | "review"
    | "pptx"
    | "ready"
    | "failed";
  total: number;
};

export type DeckGenerationStatusDetails = {
  current: number;
  error: string | null;
  projectId: string;
  stage: DeckGenerationProgress["stage"];
  total: number;
};

export type DeckGenerationTask = {
  details?: DeckGenerationStatusDetails;
  error?: string | null;
  id: string;
  previewUrl?: string;
  progress: DeckGenerationProgress;
  reused?: boolean;
  status: "GENERATING" | "READY" | "FAILED";
};

export type GenerateDeckOptions = {
  analyzerOptions?: AnalyzeDeckOptions;
  existingProjectId?: string;
  imageGenerator?: ImageLayerGenerator;
  imageQualityReviewer?: ImageQualityReviewer;
};

const activeDeckGenerationTaskMs = 30 * 60 * 1000;
const deckGenerationTimeoutMessage = "生成任务超时，请重新生成。";
const deckGenerationReadyMessage = "预览 PPT 已生成。";

export class DeckProjectNotFoundError extends Error {
  constructor() {
    super("Deck project not found");
    this.name = "DeckProjectNotFoundError";
  }
}

export async function generateDeckFromOutlineDraftForUser(
  userId: string,
  outlineDraftId: string,
  options: GenerateDeckOptions = {}
): Promise<GeneratedDeckResult> {
  const draft = await getDeckOutlineDraftForUser(userId, outlineDraftId);
  const input = analyzeDeckRequestSchema.parse(draft.input);
  const slides = draft.slides as SlideContent[];
  const unifiedVisualSpec = draft.unifiedVisualSpec as UnifiedVisualSpec;
  const compositionSlides = await composeDeckFromOutline(
    input,
    slides,
    unifiedVisualSpec,
    options.analyzerOptions
  );
  const analyzedDeck = {
    mode: draft.mode,
    deckTitle: draft.deckTitle,
    deckSummary: draft.deckSummary,
    unifiedVisualSpec,
    slides: compositionSlides
  } satisfies AnalyzedDeckResult;

  return persistGeneratedDeckForUser({
    analyzedDeck,
    generator: options.imageGenerator ?? createImageLayerGenerator(),
    existingProjectId: options.existingProjectId,
    imageQualityReviewer: options.imageQualityReviewer,
    input,
    userId
  });
}

export async function createDeckGenerationTaskForUser(
  userId: string,
  outlineDraftId: string
): Promise<DeckGenerationTask> {
  const draft = await getDeckOutlineDraftForUser(userId, outlineDraftId);
  const input = analyzeDeckRequestSchema.parse(draft.input);
  const reusableTask = await findReusableDeckGenerationTaskForUser(
    userId,
    draft.id
  );

  if (reusableTask) {
    return reusableTask;
  }

  const initialProgress: DeckGenerationProgress = {
    current: 0,
    message: "已创建生成任务。",
    stage: "queued",
    total: input.pageCount
  };
  const project = await prisma.deckProject.create({
    data: {
      userId,
      mode: draft.mode,
      status: "GENERATING",
      title: draft.deckTitle,
      summary: draft.deckSummary,
      input: toInputJson(input),
      sourceOutlineDraftId: draft.id,
      unifiedVisualSpec: toInputJson(draft.unifiedVisualSpec),
      contentReview: toInputJson(emptyContentReview()),
      consistencyReport: toInputJson(emptyConsistencyReport()),
      generationProgress: toInputJson(initialProgress)
    }
  });

  return {
    id: project.id,
    progress: initialProgress,
    status: project.status
  };
}

export function startDeckGenerationTaskForUser(
  userId: string,
  projectId: string,
  options: GenerateDeckOptions = {}
) {
  void runDeckGenerationTaskForUser(userId, projectId, options).catch(
    async (error) => {
      // Final safety net for background runner failures before callers can observe them.
      await recordDeckGenerationFailureForUser({
        error,
        projectId,
        userId
      }).catch(() => undefined);
    }
  );
}

export async function runDeckGenerationTaskForUser(
  userId: string,
  projectId: string,
  options: GenerateDeckOptions = {}
) {
  let total = 0;

  try {
    const project = await prisma.deckProject.findFirst({
      where: {
        id: projectId,
        userId
      }
    });

    total = parsePageCount(project?.input);

    if (!project?.sourceOutlineDraftId) {
      throw new DeckProjectNotFoundError();
    }

    await updateGenerationProgress(projectId, userId, {
      current: 0,
      message: "正在生成页面图层 JSON。",
      stage: "composing",
      total
    });

    return await generateDeckFromOutlineDraftForUser(
      userId,
      project.sourceOutlineDraftId,
      {
        ...options,
        existingProjectId: projectId
      }
    );
  } catch (error) {
    await recordDeckGenerationFailureForUser({
      error,
      fallbackTotal: total,
      projectId,
      userId
    }).catch(() => undefined);
    throw error;
  }
}

type DeckProjectWithSlides = Prisma.DeckProjectGetPayload<{
  include: {
    assets: true;
    slides: {
      orderBy: {
        index: "asc";
      };
    };
  };
}>;

export async function generateDeckForUser(
  userId: string,
  rawInput: unknown,
  options: GenerateDeckOptions = {}
): Promise<GeneratedDeckResult> {
  const input = analyzeDeckRequestSchema.parse(rawInput);
  const generator = options.imageGenerator ?? createImageLayerGenerator();

  const analyzedDeck = await analyzeDeck(input, options.analyzerOptions);

  return persistGeneratedDeckForUser({
    analyzedDeck,
    generator,
    existingProjectId: options.existingProjectId,
    imageQualityReviewer: options.imageQualityReviewer,
    input,
    userId
  });
}

async function persistGeneratedDeckForUser({
  analyzedDeck,
  existingProjectId,
  generator,
  imageQualityReviewer,
  input,
  userId
}: {
  analyzedDeck: AnalyzedDeckResult;
  existingProjectId?: string;
  generator: ImageLayerGenerator;
  imageQualityReviewer?: ImageQualityReviewer;
  input: AnalyzeDeckRequest;
  userId: string;
}) {
  let projectId: string | null = null;

  try {
    const normalizedDeck = {
      ...analyzedDeck,
      slides: analyzedDeck.slides.map((slide) => normalizeSlideCompositionPlan(slide))
    } satisfies AnalyzedDeckResult;
    const contentReview = buildContentReview(input, normalizedDeck);
    const consistencyReport = buildConsistencyReport(input, normalizedDeck);
    const project = existingProjectId
      ? await prisma.deckProject.update({
          where: {
            id: existingProjectId
          },
          data: {
            mode: normalizedDeck.mode,
            status: "GENERATING",
            title: normalizedDeck.deckTitle,
            summary: normalizedDeck.deckSummary,
            input: toInputJson(input),
            unifiedVisualSpec: toInputJson(normalizedDeck.unifiedVisualSpec),
            contentReview: toInputJson(contentReview),
            consistencyReport: toInputJson(consistencyReport)
          }
        })
      : await prisma.deckProject.create({
          data: {
            userId,
            mode: normalizedDeck.mode,
            status: "GENERATING",
            title: normalizedDeck.deckTitle,
            summary: normalizedDeck.deckSummary,
            input: toInputJson(input),
            unifiedVisualSpec: toInputJson(normalizedDeck.unifiedVisualSpec),
            contentReview: toInputJson(contentReview),
            consistencyReport: toInputJson(consistencyReport)
          }
        });
    const generatedSlides: GeneratedSlideResult[] = [];
    const pptxImageAssets: PptxImageAsset[] = [];

    projectId = project.id;

    for (const slide of normalizedDeck.slides) {
      await updateGenerationProgress(project.id, userId, {
        current: slide.index,
        message: `正在生成第 ${slide.index} 页图片素材。`,
        stage: "images",
        total: normalizedDeck.slides.length
      });
      const motionPlan = buildSlideMotionPlan(slide);
      const deckSlide = await prisma.deckSlide.create({
        data: {
          projectId: project.id,
          slideId: slide.slideId,
          index: slide.index,
          content: toInputJson(slide.content),
          pageDesign: toInputJson({
            contentHierarchy: slide.contentHierarchy,
            designPlan: slide.designPlan,
            expressionIntent: slide.expressionIntent,
            layoutDiagnostics: slide.layoutDiagnostics
          }),
          elements: toInputJson(slide.elements),
          imageLayerRequests: toInputJson(slide.imageLayerRequests),
          generatedImageLayers: toInputJson([]),
          motionPlan: toInputJson(motionPlan),
          canvas: toInputJson(slide.canvas)
        }
      });
      const generatedImageLayers: GeneratedImageLayer[] = [];

      for (const request of slide.imageLayerRequests) {
        const materialized = await materializeImageLayer({
          generator,
          projectId: project.id,
          request,
          slide,
          qualityReviewer:
            imageQualityReviewer ?? createImageQualityReviewer(undefined),
          unifiedVisualSpec: normalizedDeck.unifiedVisualSpec,
          userId
        });
        await prisma.deckAsset.update({
          where: {
            id: materialized.assetId
          },
          data: {
            slideId: deckSlide.id
          }
        });
        generatedImageLayers.push(materialized.generatedImageLayer);
        pptxImageAssets.push({
          assetId: materialized.assetId,
          bytes: materialized.bytes,
          mimeType: materialized.mimeType
        });
      }

      await prisma.deckSlide.update({
        where: {
          id: deckSlide.id
        },
        data: {
          generatedImageLayers: toInputJson(generatedImageLayers)
        }
      });
      generatedSlides.push({
        ...slide,
        generatedImageLayers,
        motionPlan
      });
    }

    await updateGenerationProgress(project.id, userId, {
      current: normalizedDeck.slides.length,
      message: "正在合成 PPTX 文件。",
      stage: "pptx",
      total: normalizedDeck.slides.length
    });

    const pptxBuffer = await createDeckPptxBuffer({
      deckSummary: normalizedDeck.deckSummary,
      deckTitle: normalizedDeck.deckTitle,
      imageAssets: pptxImageAssets,
      slides: generatedSlides,
      unifiedVisualSpec: normalizedDeck.unifiedVisualSpec
    });
    const pptxAssetId = randomUUID();
    const pptxStored = await writeDeckFile({
      bytes: pptxBuffer,
      filename: `${safeFilename(normalizedDeck.deckTitle)}-${pptxAssetId}.pptx`,
      projectId: project.id
    });
    const pptxUrl = `/api/decks/${project.id}/pptx`;

    await prisma.deckAsset.create({
      data: {
        id: pptxAssetId,
        projectId: project.id,
        kind: "PPTX",
        provider: "pptxgenjs",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename: pptxStored.filename,
        relativePath: pptxStored.relativePath,
        publicUrl: pptxUrl,
        sizeBytes: pptxStored.sizeBytes,
        metadata: toInputJson({
          slideCount: generatedSlides.length,
          motionMetadataIncluded: true
        })
      }
    });

    const readyProject = await prisma.deckProject.update({
      where: {
        id: project.id
      },
      data: {
        generationError: null,
        pptxAssetId,
        generationProgress: toInputJson({
          current: normalizedDeck.slides.length,
          message: deckGenerationReadyMessage,
          stage: "ready",
          total: normalizedDeck.slides.length
        } satisfies DeckGenerationProgress),
        status: "READY"
      },
      include: {
        assets: true,
        slides: {
          orderBy: {
            index: "asc"
          }
        }
      }
    });

    return serializeDeckProject(readyProject);
  } catch (error) {
    if (projectId) {
      await recordDeckGenerationFailureForUser({
        error,
        fallbackTotal: input.pageCount,
        projectId,
        userId
      }).catch(() => undefined);
    }

    throw error;
  }
}

export async function listDeckProjects(userId: string) {
  const projects = await prisma.deckProject.findMany({
    where: {
      userId,
      status: "READY",
      assets: {
        some: {
          kind: "PPTX"
        }
      }
    },
    include: {
      _count: {
        select: {
          slides: true
        }
      },
      assets: {
        where: {
          kind: "PPTX"
        },
        take: 1
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  return projects.map((project): DeckProjectListItem => {
    const contentReview = project.contentReview as { score?: number };
    const consistencyReport = project.consistencyReport as { score?: number };
    const pptxAsset = project.assets[0];

    return {
      id: project.id,
      createdAt: project.createdAt.toISOString(),
      deckTitle: project.title,
      deckSummary: project.summary,
      mode: parseMode(project.mode),
      pptxUrl: pptxAsset?.publicUrl,
      reviewScore: contentReview.score ?? 0,
      consistencyScore: consistencyReport.score ?? 0,
      slideCount: project._count.slides,
      status: project.status
    };
  });
}

export async function getDeckProjectForUser(userId: string, projectId: string) {
  const project = await prisma.deckProject.findFirst({
    where: {
      id: projectId,
      userId
    },
    include: {
      assets: true,
      slides: {
        orderBy: {
          index: "asc"
        }
      }
    }
  });

  if (!project) {
    throw new DeckProjectNotFoundError();
  }

  const readyProject = await normalizeReadyDeckProjectForPreview(
    project,
    userId
  );

  if (
    readyProject.status !== "READY" ||
    !readyProject.assets.some((asset) => asset.kind === "PPTX")
  ) {
    throw new DeckProjectNotFoundError();
  }

  return serializeDeckProject(readyProject);
}

export async function deleteDeckProjectForUser(
  userId: string,
  projectId: string
) {
  const project = await prisma.deckProject.findFirst({
    where: {
      id: projectId,
      userId
    },
    select: {
      id: true,
      status: true
    }
  });

  if (!project) {
    throw new DeckProjectNotFoundError();
  }

  if (project.status === "GENERATING") {
    throw new ActiveGenerationExistsError();
  }

  await prisma.deckProject.delete({
    where: {
      id: project.id
    }
  });

  try {
    await deleteDeckStorageDirectory(project.id);
  } catch {
    // 数据库记录删除成功后，本地文件清理失败不阻断用户侧删除结果。
  }
}

export async function getDeckGenerationStatusForUser(
  userId: string,
  projectId: string
): Promise<DeckGenerationTask> {
  const project = await prisma.deckProject.findFirst({
    where: {
      id: projectId,
      userId
    },
    include: {
      _count: {
        select: {
          slides: true
        }
      },
      assets: {
        where: {
          kind: "PPTX"
        },
        take: 1
      }
    }
  });

  if (!project) {
    throw new DeckProjectNotFoundError();
  }

  if (isCompletedDeckProject(project)) {
    const readyProgress = buildReadyGenerationProgress(project);

    if (project.status !== "READY") {
      await markDeckProjectReadyForUser(userId, project.id, readyProgress);
    }

    return {
      details: {
        current: readyProgress.current,
        error: null,
        projectId: project.id,
        stage: "ready",
        total: readyProgress.total
      },
      error: null,
      id: project.id,
      previewUrl: `/workbench/preview/${project.id}`,
      progress: readyProgress,
      status: "READY"
    };
  }

  const progress = parseGenerationProgress(
    project.generationProgress,
    parsePageCount(project.input)
  );
  const storedError = project.generationError?.trim();
  const error =
    storedError || (project.status === "FAILED" ? progress.message : null);

  return {
    details: {
      current: progress.current,
      error,
      projectId: project.id,
      stage: progress.stage,
      total: progress.total
    },
    id: project.id,
    error,
    previewUrl:
      project.status === "READY" ? `/workbench/preview/${project.id}` : undefined,
    progress,
    status: project.status
  };
}

export const updateDeckSlideSchema = z
  .object({
    content: z.unknown().optional(),
    elements: z.array(z.unknown()).optional()
  })
  .strict();

export async function updateDeckSlideForUser({
  projectId,
  rawInput,
  slideId,
  userId
}: {
  projectId: string;
  rawInput: unknown;
  slideId: string;
  userId: string;
}) {
  const input = updateDeckSlideSchema.parse(rawInput);
  const project = await getRawDeckProjectForUser(userId, projectId);
  const target = project.slides.find((slide) => slide.slideId === slideId || slide.id === slideId);

  if (!target) {
    throw new DeckProjectNotFoundError();
  }

  const currentPlan = slideFromStored(target);
  const nextPlan = normalizeSlideCompositionPlan({
    ...currentPlan,
    content: input.content ? (input.content as SlideCompositionPlan["content"]) : currentPlan.content,
    elements: input.elements ? (input.elements as SlideCompositionPlan["elements"]) : currentPlan.elements
  });

  await prisma.deckSlide.update({
    where: {
      id: target.id
    },
    data: {
      content: toInputJson(nextPlan.content),
      elements: toInputJson(nextPlan.elements),
      pageDesign: toInputJson({
        contentHierarchy: nextPlan.contentHierarchy,
        designPlan: nextPlan.designPlan,
        expressionIntent: nextPlan.expressionIntent,
        layoutDiagnostics: nextPlan.layoutDiagnostics
      })
    }
  });

  await rebuildDeckPptxForProject(userId, projectId);

  return getDeckProjectForUser(userId, projectId);
}

export async function regenerateDeckSlideForUser({
  analyzerOptions,
  imageGenerator,
  imageQualityReviewer,
  projectId,
  slideId,
  userId
}: {
  analyzerOptions?: AnalyzeDeckOptions;
  imageGenerator?: ImageLayerGenerator;
  imageQualityReviewer?: ImageQualityReviewer;
  projectId: string;
  slideId: string;
  userId: string;
}) {
  const project = await getRawDeckProjectForUser(userId, projectId);
  const input = analyzeDeckRequestSchema.parse(project.input);
  const unifiedVisualSpec = project.unifiedVisualSpec as UnifiedVisualSpec;
  const target = project.slides.find((slide) => slide.slideId === slideId || slide.id === slideId);

  if (!target) {
    throw new DeckProjectNotFoundError();
  }

  const nextPlan = await composeSingleSlideFromOutline(
    input,
    target.content as SlideContent,
    unifiedVisualSpec,
    analyzerOptions
  );
  const normalized = normalizeSlideCompositionPlan({
    ...nextPlan,
    index: target.index,
    slideId: target.slideId
  });
  const generator = imageGenerator ?? createImageLayerGenerator();
  const generatedImageLayers: GeneratedImageLayer[] = [];
  const motionPlan = buildSlideMotionPlan(normalized);

  await prisma.deckAsset.deleteMany({
    where: {
      kind: "IMAGE_LAYER",
      projectId,
      slideId: target.id
    }
  });

  for (const request of normalized.imageLayerRequests) {
    const materialized = await materializeImageLayer({
      generator,
      projectId,
      qualityReviewer:
        imageQualityReviewer ?? createImageQualityReviewer(analyzerOptions?.env),
      request,
      slide: normalized,
      unifiedVisualSpec,
      userId
    });

    await prisma.deckAsset.update({
      where: {
        id: materialized.assetId
      },
      data: {
        slideId: target.id
      }
    });
    generatedImageLayers.push(materialized.generatedImageLayer);
  }

  await prisma.deckSlide.update({
    where: {
      id: target.id
    },
    data: {
      canvas: toInputJson(normalized.canvas),
      content: toInputJson(normalized.content),
      elements: toInputJson(normalized.elements),
      generatedImageLayers: toInputJson(generatedImageLayers),
      imageLayerRequests: toInputJson(normalized.imageLayerRequests),
      motionPlan: toInputJson(motionPlan),
      pageDesign: toInputJson({
        contentHierarchy: normalized.contentHierarchy,
        designPlan: normalized.designPlan,
        expressionIntent: normalized.expressionIntent,
        layoutDiagnostics: normalized.layoutDiagnostics
      })
    }
  });

  await rebuildDeckPptxForProject(userId, projectId);

  return getDeckProjectForUser(userId, projectId);
}

export async function getDeckAssetForUser({
  assetId,
  projectId,
  userId
}: {
  assetId: string;
  projectId: string;
  userId: string;
}) {
  const asset = await prisma.deckAsset.findFirst({
    where: {
      id: assetId,
      kind: "IMAGE_LAYER",
      projectId,
      project: {
        userId
      }
    }
  });

  if (!asset) {
    throw new DeckProjectNotFoundError();
  }

  return asset;
}

export async function getDeckPptxAssetForUser({
  projectId,
  userId
}: {
  projectId: string;
  userId: string;
}) {
  const asset = await prisma.deckAsset.findFirst({
    where: {
      kind: "PPTX",
      projectId,
      project: {
        userId
      }
    }
  });

  if (!asset) {
    throw new DeckProjectNotFoundError();
  }

  return asset;
}

function serializeDeckProject(project: DeckProjectWithSlides): GeneratedDeckResult {
  const pptxAsset = project.assets.find((asset) => asset.kind === "PPTX");

  return generatedDeckResultSchema.parse({
    id: project.id,
    mode: parseMode(project.mode),
    status: project.status,
    deckTitle: project.title,
    deckSummary: project.summary,
    input: project.input,
    unifiedVisualSpec: project.unifiedVisualSpec,
    contentReview: project.contentReview,
    consistencyReport: project.consistencyReport,
    slides: project.slides.map((slide) => ({
      slideId: slide.slideId,
      index: slide.index,
      content: slide.content,
      ...pageDesignFromStored(slide),
      elements: slide.elements,
      imageLayerRequests: slide.imageLayerRequests,
      generatedImageLayers: slide.generatedImageLayers,
      motionPlan: slide.motionPlan,
      canvas: slide.canvas
    })),
    pptxUrl: pptxAsset?.publicUrl,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  });
}

function parseMode(mode: string): "ai-json" | "mock" {
  return mode === "ai-json" ? "ai-json" : "mock";
}

async function updateGenerationProgress(
  projectId: string,
  userId: string,
  progress: DeckGenerationProgress
) {
  await prisma.deckProject.updateMany({
    where: {
      id: projectId,
      userId
    },
    data: {
      generationProgress: toInputJson(progress)
    }
  });
}

async function findReusableDeckGenerationTaskForUser(
  userId: string,
  outlineDraftId: string
): Promise<DeckGenerationTask | null> {
  const task = await prisma.deckProject.findFirst({
    where: {
      sourceOutlineDraftId: outlineDraftId,
      status: "GENERATING",
      userId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!task) {
    return null;
  }

  const createdAt =
    task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
  const isActive = Date.now() - createdAt.getTime() <= activeDeckGenerationTaskMs;
  const progress = parseGenerationProgress(
    task.generationProgress,
    parsePageCount(task.input)
  );

  if (isActive) {
    return {
      id: task.id,
      progress,
      reused: true,
      status: "GENERATING"
    };
  }

  await recordDeckGenerationFailureForUser({
    error: new Error(deckGenerationTimeoutMessage),
    projectId: task.id,
    userId
  });

  return null;
}

async function markDeckProjectReadyForUser(
  userId: string,
  projectId: string,
  progress: DeckGenerationProgress
) {
  await prisma.deckProject.updateMany({
    where: {
      id: projectId,
      userId
    },
    data: {
      generationError: null,
      generationProgress: toInputJson(progress),
      status: "READY"
    }
  });
}

async function recordDeckGenerationFailureForUser({
  error,
  fallbackTotal = 0,
  projectId,
  userId
}: {
  error: unknown;
  fallbackTotal?: number;
  projectId: string;
  userId: string;
}) {
  const project = await prisma.deckProject.findFirst({
    where: {
      id: projectId,
      userId
    },
    select: {
      _count: {
        select: {
          slides: true
        }
      },
      assets: {
        where: {
          kind: "PPTX"
        },
        take: 1
      },
      generationProgress: true,
      input: true,
      status: true
    }
  });

  if (!project) {
    return;
  }

  if (isCompletedDeckProject(project)) {
    await markDeckProjectReadyForUser(
      userId,
      projectId,
      buildReadyGenerationProgress(project)
    );
    return;
  }

  const total = parsePageCount(project.input) || fallbackTotal;
  const currentProgress = parseGenerationProgress(
    project.generationProgress,
    total
  );
  const message = formatDeckGenerationFailureMessage(error);

  await prisma.deckProject.updateMany({
    where: {
      id: projectId,
      userId
    },
    data: {
      generationError: message.slice(0, 1000),
      generationProgress: toInputJson({
        current: currentProgress.current,
        message: message.slice(0, 240),
        stage: "failed",
        total: currentProgress.total || total
      } satisfies DeckGenerationProgress),
      status: "FAILED"
    }
  });
}

function formatDeckGenerationFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return sanitizeDeckGenerationFailureMessage(message || "生成失败");
}

async function normalizeReadyDeckProjectForPreview<T extends DeckProjectWithSlides>(
  project: T,
  userId: string
): Promise<T> {
  if (!isCompletedDeckProject(project)) {
    return project;
  }

  if (project.status === "READY") {
    return project;
  }

  await markDeckProjectReadyForUser(
    userId,
    project.id,
    buildReadyGenerationProgress(project)
  );

  return {
    ...project,
    generationError: null,
    generationProgress: buildReadyGenerationProgress(project),
    status: "READY"
  };
}

function isCompletedDeckProject(project: {
  _count?: {
    slides?: number;
  };
  assets?: Array<{
    kind?: string;
  }>;
  input: unknown;
  pptxAssetId?: string | null;
  slides?: unknown[];
  status?: string;
}) {
  if (project.status === "READY") {
    return true;
  }

  const pptxCount = project.assets?.filter((asset) => asset.kind === "PPTX")
    .length;
  const hasPptx = Boolean(project.pptxAssetId) || Boolean(pptxCount);
  const expectedSlideCount = parsePageCount(project.input);
  const storedSlideCount = project._count?.slides ?? project.slides?.length ?? 0;

  return (
    hasPptx &&
    storedSlideCount > 0 &&
    (expectedSlideCount <= 0 || storedSlideCount >= expectedSlideCount)
  );
}

function buildReadyGenerationProgress(project: {
  _count?: {
    slides?: number;
  };
  generationProgress?: unknown;
  input: unknown;
  slides?: unknown[];
}): DeckGenerationProgress {
  const total =
    project._count?.slides ?? project.slides?.length ?? parsePageCount(project.input);
  const current = total || parsePageCount(project.input);

  return {
    current,
    message: deckGenerationReadyMessage,
    stage: "ready",
    total: current
  };
}

function sanitizeDeckGenerationFailureMessage(message: string) {
  return message
    .replace(
      /(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;]+/gi,
      "$1$2[REDACTED]"
    )
    .replace(/(api[-_]?key\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(password\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(
      /((?:mysql|mariadb|postgres|postgresql):\/\/[^:\s/?#]+:)[^@\s/?#]+(@)/gi,
      "$1***$2"
    );
}

function parseGenerationProgress(
  value: unknown,
  total: number
): DeckGenerationProgress {
  if (isRecord(value)) {
    return {
      current: typeof value.current === "number" ? value.current : 0,
      message: typeof value.message === "string" ? value.message : "正在生成。",
      stage: parseProgressStage(value.stage),
      total: typeof value.total === "number" ? value.total : total
    };
  }

  return {
    current: 0,
    message: "正在生成。",
    stage: "queued",
    total
  };
}

function parseProgressStage(value: unknown): DeckGenerationProgress["stage"] {
  return value === "queued" ||
    value === "composing" ||
    value === "images" ||
    value === "review" ||
    value === "pptx" ||
    value === "ready" ||
    value === "failed"
    ? value
    : "queued";
}

function parsePageCount(value: unknown) {
  return isRecord(value) && typeof value.pageCount === "number"
    ? value.pageCount
    : 0;
}

function emptyContentReview() {
  return {
    riskLevel: "low",
    score: 0,
    suggestions: [],
    summary: "内容审核等待生成完成。",
    warnings: []
  };
}

function emptyConsistencyReport() {
  return {
    checks: [
      {
        message: "等待生成完成。",
        name: "生成状态",
        score: 0
      },
      {
        message: "等待跨页一致性检查。",
        name: "一致性检查",
        score: 0
      }
    ],
    score: 0,
    suggestions: [],
    summary: "一致性检查等待生成完成。"
  };
}

async function getRawDeckProjectForUser(userId: string, projectId: string) {
  const project = await prisma.deckProject.findFirst({
    where: {
      id: projectId,
      userId
    },
    include: {
      assets: true,
      slides: {
        orderBy: {
          index: "asc"
        }
      }
    }
  });

  if (!project) {
    throw new DeckProjectNotFoundError();
  }

  return project;
}

function slideFromStored(
  slide: DeckProjectWithSlides["slides"][number]
): SlideCompositionPlan {
  return normalizeSlideCompositionPlan({
    slideId: slide.slideId,
    index: slide.index,
    content: slide.content as SlideCompositionPlan["content"],
    ...pageDesignFromStored(slide),
    elements: slide.elements as SlideCompositionPlan["elements"],
    imageLayerRequests: slide.imageLayerRequests as SlideCompositionPlan["imageLayerRequests"],
    canvas: slide.canvas as SlideCompositionPlan["canvas"]
  });
}

function pageDesignFromStored(slide: DeckProjectWithSlides["slides"][number]) {
  const pageDesign = isRecord(slide.pageDesign) ? slide.pageDesign : {};
  const content = slide.content as SlideContent;

  return {
    contentHierarchy:
      isRecord(pageDesign.contentHierarchy)
        ? pageDesign.contentHierarchy
        : {
            primaryMessage: content.bodyPoints[0] ?? content.title,
            levels: [
              {
                label: content.title,
                level: 1,
                summary: content.speakerGoal
              }
            ]
          },
    designPlan:
      isRecord(pageDesign.designPlan)
        ? pageDesign.designPlan
        : {
            expressionIntent: content.speakerGoal,
            layoutTemplate: "title-body-hero",
            readingOrder: [slide.slideId],
            visualStrategy: content.visualIntent
          },
    expressionIntent:
      typeof pageDesign.expressionIntent === "string"
        ? pageDesign.expressionIntent
        : content.speakerGoal,
    layoutDiagnostics:
      isRecord(pageDesign.layoutDiagnostics)
        ? pageDesign.layoutDiagnostics
        : {
            density: 0,
            hasOverflow: false,
            needsUserConfirmation: false,
            overflowFixes: [],
            warnings: []
          }
  } as Pick<
    SlideCompositionPlan,
    "contentHierarchy" | "designPlan" | "expressionIntent" | "layoutDiagnostics"
  >;
}

async function rebuildDeckPptxForProject(userId: string, projectId: string) {
  const project = await getRawDeckProjectForUser(userId, projectId);
  const slides = project.slides.map((slide) => ({
    ...slideFromStored(slide),
    generatedImageLayers: slide.generatedImageLayers as GeneratedImageLayer[],
    motionPlan: slide.motionPlan as GeneratedSlideResult["motionPlan"]
  }));
  const imageAssets: PptxImageAsset[] = [];

  for (const layer of slides.flatMap((slide) => slide.generatedImageLayers)) {
    const asset = project.assets.find((item) => item.id === layer.assetId);

    if (!asset) {
      continue;
    }

    const file = await readStorageFile(asset.relativePath);

    if (file) {
      imageAssets.push({
        assetId: asset.id,
        bytes: file.bytes,
        mimeType: asset.mimeType
      });
    }
  }

  const pptxBuffer = await createDeckPptxBuffer({
    deckSummary: project.summary,
    deckTitle: project.title,
    imageAssets,
    slides,
    unifiedVisualSpec: project.unifiedVisualSpec as UnifiedVisualSpec
  });
  const pptxAssetId = randomUUID();
  const pptxStored = await writeDeckFile({
    bytes: pptxBuffer,
    filename: `${safeFilename(project.title)}-${pptxAssetId}.pptx`,
    projectId
  });
  const pptxUrl = `/api/decks/${projectId}/pptx`;

  await prisma.deckAsset.deleteMany({
    where: {
      kind: "PPTX",
      projectId
    }
  });
  await prisma.deckAsset.create({
    data: {
      id: pptxAssetId,
      projectId,
      kind: "PPTX",
      provider: "pptxgenjs",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      filename: pptxStored.filename,
      relativePath: pptxStored.relativePath,
      publicUrl: pptxUrl,
      sizeBytes: pptxStored.sizeBytes,
      metadata: toInputJson({
        regeneratedAt: new Date().toISOString(),
        slideCount: slides.length
      })
    }
  });
  await prisma.deckProject.update({
    where: {
      id: projectId
    },
    data: {
      consistencyReport: toInputJson(
        buildConsistencyReport(
          analyzeDeckRequestSchema.parse(project.input),
          {
            deckSummary: project.summary,
            deckTitle: project.title,
            mode: parseMode(project.mode),
            slides,
            unifiedVisualSpec: project.unifiedVisualSpec as UnifiedVisualSpec
          }
        )
      ),
      pptxAssetId
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeFilename(value: string) {
  const sanitized = value
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return sanitized || "deck";
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type { AnalyzeDeckRequest };
