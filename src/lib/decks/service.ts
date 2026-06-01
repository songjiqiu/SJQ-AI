import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  analyzeDeck,
  composeDeckFromOutline,
  composeDeckSlidesFromOutline,
  composeSingleSlideFromOutline,
  normalizeSlideContent,
  normalizeUnifiedVisualSpec,
  type AnalyzeDeckOptions
} from "@/lib/ai-deck/analyzer";
import {
  createImageLayerGenerator,
  type ImageLayerGenerator
} from "@/lib/ai-deck/image-generator";
import {
  buildSlideDesignQualityScore,
  buildContentReview,
  buildConsistencyReport,
  buildSlideMotionPlan,
  normalizeSlideCompositionPlan
} from "@/lib/ai-deck/postprocess";
import {
  buildDefaultDesignConstraints,
  buildDefaultLayoutSelection
} from "@/lib/ai-deck/semantic-layout";
import {
  createImageQualityReviewer,
  materializeImageLayer,
  type ImageQualityReviewer
} from "@/lib/ai-deck/image-assets";
import {
  analyzeDeckRequestSchema,
  slideDesignConstraintsSchema,
  slideDesignQualityScoreSchema,
  slideLayoutSelectionSchema,
  slidePageIntentSchema,
  slideContentHierarchySchema,
  slideLayoutDiagnosticsSchema,
  slidePageDesignSchema,
  generatedImageLayerSchema,
  generatedDeckResultSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type GeneratedDeckResult,
  type GeneratedImageLayer,
  type GeneratedSlideResult,
  type SemanticSlideElement,
  type SlideCompositionPlan,
  type SlideContent,
  type SlideDesignConstraints,
  type SlideDesignQualityScore,
  type SlideLayoutSelection,
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

function toSlidePageDesignJson(slide: SlideCompositionPlan) {
  return {
    constraints: slide.constraints,
    contentHierarchy: slide.contentHierarchy,
    designPlan: slide.designPlan,
    designQualityScore: slide.designQualityScore,
    expressionIntent: slide.expressionIntent,
    layoutDiagnostics: slide.layoutDiagnostics,
    layoutSelection: slide.layoutSelection,
    pageIntent: slide.pageIntent,
    semanticElements: slide.semanticElements
  };
}

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
  previewReady: boolean;
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
const deckGenerationConcurrency = 3;
const previewReadyMinSlides = 3;
const previewReadyMaxSlides = 5;

export class DeckProjectNotFoundError extends Error {
  constructor() {
    super("Deck project not found");
    this.name = "DeckProjectNotFoundError";
  }
}

export class DeckSlideFileValidationError extends Error {
  constructor() {
    super("Deck slide element file must be an image");
    this.name = "DeckSlideFileValidationError";
  }
}

export async function generateDeckFromOutlineDraftForUser(
  userId: string,
  outlineDraftId: string,
  options: GenerateDeckOptions = {}
): Promise<GeneratedDeckResult> {
  const draft = await getDeckOutlineDraftForUser(userId, outlineDraftId);
  const input = analyzeDeckRequestSchema.parse(draft.input);
  const slides = draft.slides.map((slide, index) =>
    normalizeSlideContent(slide, input, {
      slideCount: draft.slides.length || input.pageCount,
      nextTitle: draft.slides[index + 1]?.title,
      previousTitle: draft.slides[index - 1]?.title
    })
  );
  const unifiedVisualSpec = normalizeUnifiedVisualSpec(
    draft.unifiedVisualSpec,
    input
  );
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
    previewReady: false,
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

    return await generatePreviewDeckFromOutlineDraftForUser({
      options,
      outlineDraftId: project.sourceOutlineDraftId,
      projectId,
      userId
    });
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

type DeckSlideWithProjectInput = DeckProjectWithSlides["slides"][number] & {
  projectInput?: AnalyzeDeckRequest;
};

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

async function generatePreviewDeckFromOutlineDraftForUser({
  options,
  outlineDraftId,
  projectId,
  userId
}: {
  options: GenerateDeckOptions;
  outlineDraftId: string;
  projectId: string;
  userId: string;
}) {
  const draft = await getDeckOutlineDraftForUser(userId, outlineDraftId);
  const input = analyzeDeckRequestSchema.parse(draft.input);
  const outlineSlides = draft.slides.map((slide, index) =>
    normalizeSlideContent(slide, input, {
      slideCount: draft.slides.length || input.pageCount,
      nextTitle: draft.slides[index + 1]?.title,
      previousTitle: draft.slides[index - 1]?.title
    })
  );
  const unifiedVisualSpec = normalizeUnifiedVisualSpec(
    draft.unifiedVisualSpec,
    input
  );
  const generator = options.imageGenerator ?? createImageLayerGenerator();
  const qualityReviewer =
    options.imageQualityReviewer ?? createImageQualityReviewer(undefined);
  const placeholderGenerator = createImageLayerGenerator({
    AI_IMAGE_MODEL: "mock-svg"
  });
  await prisma.deckProject.update({
    where: {
      id: projectId
    },
    data: {
      generationError: null,
      input: toInputJson(input),
      mode: draft.mode,
      status: "GENERATING",
      summary: draft.deckSummary,
      title: draft.deckTitle,
      unifiedVisualSpec: toInputJson(unifiedVisualSpec)
    }
  });

  const compositionSlides = sortSlideCompositionPlansByIndex(
    (await composeDeckSlidesFromOutline(
      input,
      outlineSlides,
      unifiedVisualSpec,
      options.analyzerOptions
    )).map((slide) => normalizeSlideCompositionPlan(slide))
  );
  const previewSlideCount = getPreviewReadySlideCount(outlineSlides.length);
  const reportPreviewProgress = createGenerationProgressReporter({
    buildMessage: (current, total) =>
      `正在生成页面 JSON 和预览占位图，已完成 ${current}/${total} 页。`,
    initialCurrent: 0,
    projectId,
    stage: "composing",
    total: outlineSlides.length,
    userId
  });
  const previewSlides = await storePreviewSlidesWithPlaceholders({
    placeholderGenerator,
    projectId,
    reportProgress: reportPreviewProgress,
    slides: compositionSlides.slice(0, previewSlideCount),
    unifiedVisualSpec,
    userId
  });

  await updateDeckProjectReviewFromSlides({
    deckSummary: draft.deckSummary,
    deckTitle: draft.deckTitle,
    input,
    mode: draft.mode,
    projectId,
    slides: previewSlides,
    unifiedVisualSpec
  });

  const remainingSlides = await storePreviewSlidesWithPlaceholders({
    placeholderGenerator,
    projectId,
    reportProgress: reportPreviewProgress,
    slides: compositionSlides.slice(previewSlideCount),
    unifiedVisualSpec,
    userId
  });
  const generatedSlides = sortGeneratedSlidesByIndex([
    ...previewSlides,
    ...remainingSlides
  ]);

  await updateDeckProjectReviewFromSlides({
    deckSummary: draft.deckSummary,
    deckTitle: draft.deckTitle,
    input,
    mode: draft.mode,
    projectId,
    slides: generatedSlides,
    unifiedVisualSpec
  });

  const finalSlides = await replacePreviewPlaceholdersWithGeneratedImages({
    generator,
    imageQualityReviewer: qualityReviewer,
    projectId,
    slides: generatedSlides,
    unifiedVisualSpec,
    userId
  });

  await updateGenerationProgress(projectId, userId, {
    current: finalSlides.length,
    message: "正在合成 PPTX 文件。",
    stage: "pptx",
    total: finalSlides.length
  });

  const readyProject = await finalizeGeneratedDeckProject({
    input,
    projectId,
    slides: await readGeneratedSlidesForPptx(projectId, finalSlides, input),
    unifiedVisualSpec,
    userId
  });

  return serializeDeckProject(readyProject);
}

async function storePreviewSlidesWithPlaceholders({
  placeholderGenerator,
  projectId,
  reportProgress,
  slides,
  unifiedVisualSpec,
  userId
}: {
  placeholderGenerator: ImageLayerGenerator;
  projectId: string;
  reportProgress: () => Promise<number>;
  slides: SlideCompositionPlan[];
  unifiedVisualSpec: UnifiedVisualSpec;
  userId: string;
}) {
  const generatedSlides = await mapWithConcurrency(
    slides,
    deckGenerationConcurrency,
    async (slide) => {
      const generatedSlide = await createPreviewSlideWithPlaceholders({
        placeholderGenerator,
        projectId,
        slide,
        unifiedVisualSpec,
        userId
      });

      await reportProgress();

      return generatedSlide;
    }
  );

  return sortGeneratedSlidesByIndex(generatedSlides);
}

async function createPreviewSlideWithPlaceholders({
  placeholderGenerator,
  projectId,
  slide,
  unifiedVisualSpec,
  userId
}: {
  placeholderGenerator: ImageLayerGenerator;
  projectId: string;
  slide: SlideCompositionPlan;
  unifiedVisualSpec: UnifiedVisualSpec;
  userId: string;
}) {
  const motionPlan = buildSlideMotionPlan(slide);
  const deckSlide = await prisma.deckSlide.create({
    data: {
      projectId,
      slideId: slide.slideId,
      index: slide.index,
      content: toInputJson(slide.content),
      pageDesign: toInputJson(toSlidePageDesignJson(slide)),
      elements: toInputJson(slide.elements),
      imageLayerRequests: toInputJson(slide.imageLayerRequests),
      generatedImageLayers: toInputJson([]),
      motionPlan: toInputJson(motionPlan),
      canvas: toInputJson(slide.canvas)
    }
  });
  const placeholderLayers = await mapWithConcurrency(
    slide.imageLayerRequests,
    deckGenerationConcurrency,
    async (request) => {
      const materialized = await materializeImageLayer({
        generator: placeholderGenerator,
        projectId,
        request,
        slide,
        qualityReviewer: undefined,
        unifiedVisualSpec,
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

      return {
        ...materialized.generatedImageLayer,
        provider: `${materialized.generatedImageLayer.provider}-preview-placeholder`,
        qualityReview: {
          method: "rules-only-fallback",
          passed: true,
          score: 80,
          summary: "预览阶段使用占位图，真实图片正在后台生成。",
          warnings: ["placeholder-preview"]
        }
      } satisfies GeneratedImageLayer;
    }
  );

  await prisma.deckSlide.update({
    where: {
      id: deckSlide.id
    },
    data: {
      generatedImageLayers: toInputJson(placeholderLayers)
    }
  });

  return {
    ...slide,
    generatedImageLayers: placeholderLayers,
    motionPlan
  } satisfies GeneratedSlideResult;
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
          pageDesign: toInputJson(toSlidePageDesignJson(slide)),
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

async function replacePreviewPlaceholdersWithGeneratedImages({
  generator,
  imageQualityReviewer,
  projectId,
  slides,
  unifiedVisualSpec,
  userId
}: {
  generator: ImageLayerGenerator;
  imageQualityReviewer?: ImageQualityReviewer;
  projectId: string;
  slides: GeneratedSlideResult[];
  unifiedVisualSpec: UnifiedVisualSpec;
  userId: string;
}) {
  const reportProgress = createGenerationProgressReporter({
    buildMessage: (current, total) =>
      `正在精修图片素材，已完成 ${current}/${total} 页。`,
    initialCurrent: 0,
    projectId,
    stage: "images",
    total: slides.length,
    userId
  });
  const updatedSlides = await mapWithConcurrency(
    slides,
    deckGenerationConcurrency,
    async (slide) => {
      const updated = slide.imageLayerRequests.length
        ? await replaceSlidePreviewPlaceholdersWithGeneratedImages({
            generator,
            imageQualityReviewer,
            projectId,
            slide,
            unifiedVisualSpec,
            userId
          })
        : slide;

      await reportProgress();

      return updated;
    }
  );

  return sortGeneratedSlidesByIndex(updatedSlides);
}

async function replaceSlidePreviewPlaceholdersWithGeneratedImages({
  generator,
  imageQualityReviewer,
  projectId,
  slide,
  unifiedVisualSpec,
  userId
}: {
  generator: ImageLayerGenerator;
  imageQualityReviewer?: ImageQualityReviewer;
  projectId: string;
  slide: GeneratedSlideResult;
  unifiedVisualSpec: UnifiedVisualSpec;
  userId: string;
}) {
  const deckSlide = await prisma.deckSlide.findFirst({
    where: {
      index: slide.index,
      projectId
    }
  });

  if (!deckSlide) {
    return slide;
  }

  const generatedImageLayers = await mapWithConcurrency(
    slide.imageLayerRequests,
    deckGenerationConcurrency,
    async (request) => {
      const materialized = await materializeImageLayer({
        generator,
        projectId,
        request,
        slide,
        qualityReviewer: imageQualityReviewer,
        unifiedVisualSpec,
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

      return materialized.generatedImageLayer;
    }
  );

  await prisma.deckSlide.update({
    where: {
      id: deckSlide.id
    },
    data: {
      generatedImageLayers: toInputJson(generatedImageLayers)
    }
  });

  return {
    ...slide,
    generatedImageLayers
  } satisfies GeneratedSlideResult;
}

async function readGeneratedSlidesForPptx(
  projectId: string,
  fallbackSlides: GeneratedSlideResult[],
  input: AnalyzeDeckRequest
) {
  const storedSlides = await prisma.deckSlide.findMany({
    where: {
      projectId
    },
    orderBy: {
      index: "asc"
    }
  });

  if (storedSlides.length === 0) {
    return fallbackSlides;
  }

  return storedSlides.map((slide) => ({
    ...slideFromStored({
      ...slide,
      projectInput: input
    }),
    generatedImageLayers: slide.generatedImageLayers as GeneratedImageLayer[],
    motionPlan: slide.motionPlan as GeneratedSlideResult["motionPlan"]
  }));
}

async function finalizeGeneratedDeckProject({
  input,
  projectId,
  slides,
  unifiedVisualSpec,
  userId
}: {
  input: AnalyzeDeckRequest;
  projectId: string;
  slides: GeneratedSlideResult[];
  unifiedVisualSpec: UnifiedVisualSpec;
  userId: string;
}) {
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
    unifiedVisualSpec
  });
  const pptxAssetId = randomUUID();
  const pptxStored = await writeDeckFile({
    bytes: pptxBuffer,
    filename: `${safeFilename(project.title)}-${pptxAssetId}.pptx`,
    projectId
  });
  const pptxUrl = `/api/decks/${projectId}/pptx`;
  const deckForReview = {
    deckSummary: project.summary,
    deckTitle: project.title,
    mode: parseMode(project.mode),
    slides,
    unifiedVisualSpec
  } satisfies AnalyzedDeckResult;

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
        slideCount: slides.length,
        motionMetadataIncluded: true
      })
    }
  });

  return prisma.deckProject.update({
    where: {
      id: projectId
    },
    data: {
      consistencyReport: toInputJson(buildConsistencyReport(input, deckForReview)),
      contentReview: toInputJson(buildContentReview(input, deckForReview)),
      generationError: null,
      generationProgress: toInputJson({
        current: slides.length,
        message: deckGenerationReadyMessage,
        stage: "ready",
        total: slides.length
      } satisfies DeckGenerationProgress),
      pptxAssetId,
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
}

async function updateDeckProjectReviewFromSlides({
  deckSummary,
  deckTitle,
  input,
  mode,
  projectId,
  slides,
  unifiedVisualSpec
}: {
  deckSummary: string;
  deckTitle: string;
  input: AnalyzeDeckRequest;
  mode: string;
  projectId: string;
  slides: GeneratedSlideResult[];
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  if (slides.length === 0) {
    return;
  }

  const deck = {
    deckSummary,
    deckTitle,
    mode: parseMode(mode),
    slides: sortGeneratedSlidesByIndex(slides),
    unifiedVisualSpec
  } satisfies AnalyzedDeckResult;

  await prisma.deckProject.update({
    where: {
      id: projectId
    },
    data: {
      contentReview: toInputJson(buildContentReview(input, deck)),
      consistencyReport: toInputJson(buildConsistencyReport(input, deck))
    }
  });
}

function createGenerationProgressReporter({
  buildMessage,
  initialCurrent,
  projectId,
  stage,
  total,
  userId
}: {
  buildMessage: (current: number, total: number) => string;
  initialCurrent: number;
  projectId: string;
  stage: DeckGenerationProgress["stage"];
  total: number;
  userId: string;
}) {
  let current = initialCurrent;
  let updateQueue = Promise.resolve();

  return async () => {
    current += 1;

    const nextProgress = {
      current,
      message: buildMessage(current, total),
      stage,
      total
    } satisfies DeckGenerationProgress;

    updateQueue = updateQueue.then(() =>
      updateGenerationProgress(projectId, userId, nextProgress)
    );

    await updateQueue;

    return current;
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;

        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );

  return results;
}

function sortSlideCompositionPlansByIndex(slides: SlideCompositionPlan[]) {
  return [...slides].sort((current, next) => current.index - next.index);
}

function sortGeneratedSlidesByIndex(slides: GeneratedSlideResult[]) {
  return [...slides].sort((current, next) => current.index - next.index);
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

  if (isPreviewableDeckProject(project)) {
    return serializeDeckProject(project);
  }

  const readyProject = await normalizeReadyDeckProjectForPreview(project, userId);

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
      previewReady: true,
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
  const previewReady = isPreviewableDeckProject(project);

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
    previewReady,
    previewUrl:
      project.status === "READY" || previewReady
        ? `/workbench/preview/${project.id}`
        : undefined,
    progress,
    status: project.status
  };
}

export const updateDeckSlideSchema = z
  .object({
    content: z.unknown().optional(),
    elements: z.array(z.unknown()).optional(),
    generatedImageLayers: z.array(generatedImageLayerSchema).optional(),
    imageLayerRequests: z.array(z.unknown()).optional()
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

  const projectInput = analyzeDeckRequestSchema.parse(project.input);
  const currentPlan = slideFromStored({
    ...target,
    projectInput
  });
  const nextPlan = normalizeSlideCompositionPlan({
    ...currentPlan,
    content: input.content
      ? normalizeSlideContent(input.content, projectInput, {
          slideCount: project.slides.length || projectInput.pageCount
        })
      : currentPlan.content,
    elements: input.elements ? (input.elements as SlideCompositionPlan["elements"]) : currentPlan.elements,
    imageLayerRequests: input.imageLayerRequests
      ? (input.imageLayerRequests as SlideCompositionPlan["imageLayerRequests"])
      : currentPlan.imageLayerRequests
  });
  const generatedImageLayers = input.generatedImageLayers
    ? (input.generatedImageLayers as GeneratedImageLayer[])
    : (target.generatedImageLayers as GeneratedImageLayer[]);

  await prisma.deckSlide.update({
    where: {
      id: target.id
    },
    data: {
      content: toInputJson(nextPlan.content),
      elements: toInputJson(nextPlan.elements),
      generatedImageLayers: toInputJson(generatedImageLayers),
      imageLayerRequests: toInputJson(nextPlan.imageLayerRequests),
      pageDesign: toInputJson(toSlidePageDesignJson(nextPlan))
    }
  });

  await rebuildDeckPptxForProject(userId, projectId);

  return getDeckProjectForUser(userId, projectId);
}

export async function uploadDeckSlideElementFileForUser({
  bytes,
  elementId,
  filename,
  mimeType,
  projectId,
  slideId,
  userId
}: {
  bytes: Buffer;
  elementId: string;
  filename: string;
  mimeType: string;
  projectId: string;
  slideId: string;
  userId: string;
}) {
  if (!mimeType.startsWith("image/")) {
    throw new DeckSlideFileValidationError();
  }

  const project = await getRawDeckProjectForUser(userId, projectId);
  const target = project.slides.find((slide) => slide.slideId === slideId || slide.id === slideId);

  if (!target) {
    throw new DeckProjectNotFoundError();
  }

  const currentPlan = slideFromStored({
    ...target,
    projectInput: analyzeDeckRequestSchema.parse(project.input)
  });
  const element = currentPlan.elements.find((item) => item.id === elementId);

  if (!element || !isFileElementType(element.type)) {
    throw new DeckProjectNotFoundError();
  }

  const requestId = element.imageRequestId ?? `${element.id}-upload`;
  const assetId = randomUUID();
  const stored = await writeDeckFile({
    bytes,
    filename: `${safeFilename(filename)}-${assetId}.${extensionFromMime(mimeType)}`,
    projectId
  });
  const publicUrl = `/api/decks/${projectId}/assets/${assetId}`;

  await prisma.deckAsset.create({
    data: {
      id: assetId,
      projectId,
      slideId: target.id,
      elementId: element.id,
      requestId,
      kind: "IMAGE_LAYER",
      provider: "user-upload",
      mimeType,
      filename: stored.filename,
      relativePath: stored.relativePath,
      publicUrl,
      sizeBytes: stored.sizeBytes,
      metadata: toInputJson({
        originalFilename: filename,
        uploadedAt: new Date().toISOString()
      })
    }
  });

  return {
    id: `${requestId}-uploaded-layer`,
    requestId,
    elementId: element.id,
    assetId,
    provider: "user-upload",
    mimeType,
    url: publicUrl,
    prompt: `User uploaded replacement file: ${filename}`,
    width: 1,
    height: 1,
    transparentBackground: mimeType.includes("png"),
    visualNotes: filename
  } satisfies GeneratedImageLayer;
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
  const unifiedVisualSpec = normalizeUnifiedVisualSpec(
    project.unifiedVisualSpec,
    input
  );
  const target = project.slides.find((slide) => slide.slideId === slideId || slide.id === slideId);

  if (!target) {
    throw new DeckProjectNotFoundError();
  }

  const nextPlan = await composeSingleSlideFromOutline(
    input,
    normalizeSlideContent(target.content, input, {
      slideCount: project.slides.length || input.pageCount
    }),
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
      pageDesign: toInputJson(toSlidePageDesignJson(normalized))
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
  const input = analyzeDeckRequestSchema.parse(project.input);

  return generatedDeckResultSchema.parse({
    id: project.id,
    mode: parseMode(project.mode),
    status: project.status,
    deckTitle: project.title,
    deckSummary: project.summary,
    input,
    unifiedVisualSpec: normalizeUnifiedVisualSpec(project.unifiedVisualSpec, input),
    contentReview: project.contentReview,
    consistencyReport: project.consistencyReport,
    slides: project.slides.map((slide) => {
      const content = normalizeSlideContent(slide.content, input, {
        slideCount: project.slides.length || input.pageCount,
        nextTitle: project.slides.find((item) => item.index === slide.index + 1)
          ?.content && isRecord(project.slides.find((item) => item.index === slide.index + 1)?.content)
          ? String((project.slides.find((item) => item.index === slide.index + 1)?.content as Record<string, unknown>).title ?? "")
          : undefined,
        previousTitle: project.slides.find((item) => item.index === slide.index - 1)
          ?.content && isRecord(project.slides.find((item) => item.index === slide.index - 1)?.content)
          ? String((project.slides.find((item) => item.index === slide.index - 1)?.content as Record<string, unknown>).title ?? "")
          : undefined
      });

      return {
      slideId: slide.slideId,
      index: slide.index,
      content,
      ...pageDesignFromStored({
        ...slide,
        content
      }),
      elements: slide.elements,
      imageLayerRequests: slide.imageLayerRequests,
      generatedImageLayers: slide.generatedImageLayers,
      motionPlan: slide.motionPlan,
      canvas: slide.canvas
      };
    }),
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
    const previewReady = await hasPreviewableStoredSlides(userId, task.id);

    return {
      id: task.id,
      previewReady,
      previewUrl: previewReady ? `/workbench/preview/${task.id}` : undefined,
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

async function hasPreviewableStoredSlides(userId: string, projectId: string) {
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
      }
    }
  });

  return project ? isPreviewableDeckProject(project) : false;
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

function isPreviewableDeckProject(project: {
  _count?: {
    slides?: number;
  };
  input: unknown;
  slides?: unknown[];
  status?: string;
}) {
  if (project.status === "READY") {
    return true;
  }

  if (project.status !== "GENERATING") {
    return false;
  }

  const expectedSlideCount = parsePageCount(project.input);
  const storedSlideCount = project._count?.slides ?? project.slides?.length ?? 0;

  return storedSlideCount >= getPreviewReadySlideCount(expectedSlideCount);
}

function getPreviewReadySlideCount(total: number) {
  return Math.min(previewReadyMaxSlides, Math.max(previewReadyMinSlides, total));
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
  slide: DeckSlideWithProjectInput
): SlideCompositionPlan {
  return normalizeSlideCompositionPlan({
    slideId: slide.slideId,
    index: slide.index,
    content: normalizeStoredSlideContent(slide),
    ...pageDesignFromStored(slide),
    elements: slide.elements as SlideCompositionPlan["elements"],
    imageLayerRequests: slide.imageLayerRequests as SlideCompositionPlan["imageLayerRequests"],
    canvas: slide.canvas as SlideCompositionPlan["canvas"]
  });
}

function normalizeStoredSlideContent(
  slide: DeckSlideWithProjectInput
): SlideContent {
  if (slide.projectInput) {
    return normalizeSlideContent(slide.content, slide.projectInput, {
      slideCount: slide.projectInput.pageCount
    });
  }

  return slide.content as SlideContent;
}

function isFileElementType(type: SlideCompositionPlan["elements"][number]["type"]) {
  return type === "generatedImage" || type === "icon";
}

function pageDesignFromStored(slide: DeckProjectWithSlides["slides"][number]) {
  const pageDesign = isRecord(slide.pageDesign) ? slide.pageDesign : {};
  const content = slide.content as SlideContent;
  const pageIntent =
    isRecord(pageDesign.pageIntent) &&
    slidePageIntentSchema.safeParse(pageDesign.pageIntent).success
      ? slidePageIntentSchema.parse(pageDesign.pageIntent)
      : buildStoredFallbackPageIntent(slide, content);
  const contentHierarchy =
    isRecord(pageDesign.contentHierarchy) &&
    slideContentHierarchySchema.safeParse(
      ensureStoredContentHierarchyTiers(pageDesign.contentHierarchy, content)
    ).success
      ? slideContentHierarchySchema.parse(
          ensureStoredContentHierarchyTiers(pageDesign.contentHierarchy, content)
        )
      : buildStoredFallbackContentHierarchy(content);
  const fallbackLayoutSelection = buildStoredFallbackLayoutSelection(
    slide,
    content,
    pageIntent
  );
  const layoutSelection =
    isRecord(pageDesign.layoutSelection) &&
    slideLayoutSelectionSchema.safeParse(pageDesign.layoutSelection).success
      ? slideLayoutSelectionSchema.parse(pageDesign.layoutSelection)
      : fallbackLayoutSelection;
  const fallbackConstraints = buildStoredFallbackDesignConstraints(
    content,
    pageIntent
  );
  const constraints =
    isRecord(pageDesign.constraints) &&
    slideDesignConstraintsSchema.safeParse(pageDesign.constraints).success
      ? slideDesignConstraintsSchema.parse(pageDesign.constraints)
      : fallbackConstraints;
  const designPlan =
    isRecord(pageDesign.designPlan) &&
    slidePageDesignSchema.safeParse(pageDesign.designPlan).success
      ? slidePageDesignSchema.parse(pageDesign.designPlan)
    : {
        expressionIntent: content.speakerGoal,
        layoutTemplate: layoutSelection.selectedLayoutType,
        readingOrder: [slide.slideId],
        visualStrategy: content.visualIntent
      };
  const layoutDiagnostics =
    isRecord(pageDesign.layoutDiagnostics) &&
    slideLayoutDiagnosticsSchema.safeParse(pageDesign.layoutDiagnostics).success
      ? slideLayoutDiagnosticsSchema.parse(pageDesign.layoutDiagnostics)
    : {
        density: 0,
        hasOverflow: false,
        needsUserConfirmation: false,
        overflowFixes: [],
        warnings: []
      };
  const semanticElements = Array.isArray(pageDesign.semanticElements)
    ? pageDesign.semanticElements
    : buildStoredFallbackSemanticElements(slide, content);
  const partialPlan = {
    slideId: slide.slideId,
    index: slide.index,
    content,
    pageIntent,
    contentHierarchy,
    layoutSelection,
    constraints,
    designQualityScore: isRecord(pageDesign.designQualityScore)
      ? pageDesign.designQualityScore
      : emptyStoredDesignQualityScore(),
    expressionIntent:
      typeof pageDesign.expressionIntent === "string"
        ? pageDesign.expressionIntent
        : content.speakerGoal,
    designPlan,
    layoutDiagnostics,
    semanticElements,
    elements: slide.elements,
    imageLayerRequests: slide.imageLayerRequests,
    canvas: slide.canvas
  } as SlideCompositionPlan;
  const storedQuality =
    isRecord(pageDesign.designQualityScore) &&
    slideDesignQualityScoreSchema.safeParse(pageDesign.designQualityScore).success
      ? slideDesignQualityScoreSchema.parse(pageDesign.designQualityScore)
      : null;

  return {
    constraints,
    contentHierarchy,
    designPlan,
    designQualityScore: storedQuality ?? buildSlideDesignQualityScore(partialPlan),
    expressionIntent: partialPlan.expressionIntent,
    layoutDiagnostics,
    layoutSelection,
    pageIntent,
    semanticElements
  } as Pick<
    SlideCompositionPlan,
    | "constraints"
    | "contentHierarchy"
    | "designPlan"
    | "designQualityScore"
    | "expressionIntent"
    | "layoutDiagnostics"
    | "layoutSelection"
    | "pageIntent"
    | "semanticElements"
  >;
}

function buildStoredFallbackPageIntent(
  slide: DeckProjectWithSlides["slides"][number],
  content: SlideContent
): SlideCompositionPlan["pageIntent"] {
  const corpus = `${content.title} ${content.subtitle ?? ""} ${content.bodyPoints.join(" ")} ${content.coreStatement} ${content.visualIntent}`;
  const pageRole =
    slide.index === 1
      ? "cover"
      : /数据|指标|趋势|%|data|metric/i.test(corpus)
        ? "data"
        : /对比|比较|差异|compare|vs/i.test(corpus)
          ? "comparison"
          : /流程|步骤|阶段|process|step/i.test(corpus)
            ? "process"
            : /总结|结论|summary|conclusion/i.test(corpus)
              ? "summary"
              : "content";

  return {
    audienceTakeaway: content.viewerObjective?.description ?? content.speakerGoal,
    contentDensity:
      content.bodyPoints.length >= 5 || content.bodyPoints.join("").length > 220
        ? "high"
        : content.bodyPoints.length <= 2
          ? "low"
          : "medium",
    coreMessage: content.coreStatement || content.bodyPoints[0] || content.title,
    pageRole,
    primaryGoal:
      pageRole === "comparison"
        ? "compare"
        : pageRole === "summary"
          ? "summarize"
          : pageRole === "process" || pageRole === "data"
            ? "explain"
            : pageRole === "cover"
              ? "spark-interest"
              : "inform"
  };
}

function buildStoredFallbackContentHierarchy(
  content: SlideContent
): SlideCompositionPlan["contentHierarchy"] {
  const supporting = content.contentLayers?.supporting ?? content.bodyPoints;

  return {
    primaryMessage: content.coreStatement || content.bodyPoints[0] || content.title,
    levels: [
      {
        label: content.title,
        level: 1,
        summary: content.coreStatement || content.speakerGoal
      },
      ...supporting.slice(0, 5).map((point, index) => ({
        label: `要点 ${index + 1}`,
        level: 2,
        summary: point
      }))
    ],
    tiers: [
      {
        label: "一级信息",
        level: 1,
        items: [
          {
            content: content.title,
            role: "主标题"
          },
          {
            content: content.coreStatement || content.bodyPoints[0] || content.title,
            role: "核心结论"
          }
        ]
      },
      {
        label: "二级信息",
        level: 2,
        items: supporting.slice(0, 5).map((point, index) => ({
          content: point,
          role: `要点 ${index + 1}`
        }))
      },
      {
        label: "三级信息",
        level: 3,
        items: [
          ...(content.subtitle
            ? [
                {
                  content: content.subtitle,
                  role: "副标题"
                }
              ]
            : []),
          {
            content: content.sourceRequirement?.note ?? content.speakerGoal,
            role: "来源/讲解要求"
          }
        ].slice(0, 4)
      }
    ]
  };
}

function ensureStoredContentHierarchyTiers(
  hierarchy: Record<string, unknown>,
  content: SlideContent
) {
  if (Array.isArray(hierarchy.tiers) && hierarchy.tiers.length === 3) {
    return hierarchy;
  }

  const fallback = buildStoredFallbackContentHierarchy(content);

  return {
    ...hierarchy,
    primaryMessage:
      typeof hierarchy.primaryMessage === "string"
        ? hierarchy.primaryMessage
        : fallback.primaryMessage,
    levels: Array.isArray(hierarchy.levels) ? hierarchy.levels : fallback.levels,
    tiers: fallback.tiers
  };
}

function buildStoredFallbackLayoutSelection(
  slide: DeckProjectWithSlides["slides"][number],
  content: SlideContent,
  pageIntent: SlideCompositionPlan["pageIntent"]
): SlideLayoutSelection {
  return buildDefaultLayoutSelection({
    input: buildStoredFallbackInput(slide, content),
    pageIntent,
    slide: content
  });
}

function buildStoredFallbackDesignConstraints(
  content: SlideContent,
  pageIntent: SlideCompositionPlan["pageIntent"]
): SlideDesignConstraints {
  return buildDefaultDesignConstraints({
    input: buildStoredFallbackInput({ index: content.index, slideId: content.slideId }, content),
    pageIntent,
    slide: content
  });
}

function buildStoredFallbackInput(
  slide: Pick<DeckProjectWithSlides["slides"][number], "index" | "slideId">,
  content: SlideContent
): AnalyzeDeckRequest {
  return {
    audience: "通用受众",
    coreMessage: content.coreStatement || content.bodyPoints[0] || content.title,
    deckType: "business-report",
    goal: content.speakerGoal,
    locale: "zh-CN",
    pageCount: Math.max(3, slide.index),
    palette: "star-map",
    sourceText: content.bodyPoints.join("\n")
  };
}

function emptyStoredDesignQualityScore(): SlideDesignQualityScore {
  const summary = "等待服务端质量评分。";

  return {
    dimensions: {
      contentDensity: { score: 0, summary },
      expressionCompleteness: { score: 0, summary },
      informationHierarchy: { score: 0, summary },
      renderability: { score: 0, summary },
      visualConsistency: { score: 0, summary }
    },
    issues: [],
    repairStatus: "not-needed",
    suggestions: [],
    totalScore: 0
  };
}

function buildStoredFallbackSemanticElements(
  slide: DeckProjectWithSlides["slides"][number],
  content: SlideContent
): SemanticSlideElement[] {
  const elements: SemanticSlideElement[] = [
    {
      category: "text",
      constraints: ["历史数据兼容生成的主标题语义"],
      content: content.title,
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slide.slideId}-semantic-title`,
      priority: 1,
      role: "主标题",
      semanticType: "title"
    },
    {
      category: "text",
      constraints: ["历史数据兼容生成的核心信息语义"],
      content: content.coreStatement || content.bodyPoints[0] || content.title,
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slide.slideId}-semantic-key-message`,
      priority: 2,
      role: "核心信息",
      semanticType: "subtitle"
    },
    {
      category: "visual",
      constraints: ["历史数据兼容生成的视觉语义"],
      content: content.visualIntent,
      elementType: "generatedImage",
      hierarchyLevel: 2,
      id: `${slide.slideId}-semantic-visual`,
      priority: 3,
      role: "主视觉",
      semanticType: "heroVisual"
    },
    ...content.bodyPoints.slice(0, 5).map((point, index): SemanticSlideElement => ({
      category: "text",
      constraints: ["历史数据兼容生成的正文语义"],
      content: point,
      elementType: "text",
      hierarchyLevel: 2,
      id: `${slide.slideId}-semantic-point-${index + 1}`,
      priority: Math.min(5, 3 + index),
      role: `正文要点 ${index + 1}`,
      semanticType: "body"
    }))
  ];

  return elements.slice(0, 14);
}

async function rebuildDeckPptxForProject(userId: string, projectId: string) {
  const project = await getRawDeckProjectForUser(userId, projectId);
  const input = analyzeDeckRequestSchema.parse(project.input);
  const unifiedVisualSpec = normalizeUnifiedVisualSpec(
    project.unifiedVisualSpec,
    input
  );
  const slides = project.slides.map((slide) => ({
    ...slideFromStored({
      ...slide,
      projectInput: input
    }),
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
    unifiedVisualSpec
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
          input,
          {
            deckSummary: project.summary,
            deckTitle: project.title,
            mode: parseMode(project.mode),
            slides,
            unifiedVisualSpec
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

function extensionFromMime(mimeType: string) {
  if (mimeType.includes("svg")) {
    return "svg";
  }

  if (mimeType.includes("jpeg")) {
    return "jpg";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  return "png";
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export type { AnalyzeDeckRequest };
