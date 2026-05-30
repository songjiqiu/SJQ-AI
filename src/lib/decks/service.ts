import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  analyzeDeck,
  composeDeckFromOutline,
  type AnalyzeDeckOptions
} from "@/lib/ai-deck/analyzer";
import {
  createImageLayerGenerator,
  type ImageLayerGenerator
} from "@/lib/ai-deck/image-generator";
import {
  buildContentReview,
  buildConsistencyReport,
  buildSlideMotionPlan
} from "@/lib/ai-deck/postprocess";
import {
  analyzeDeckRequestSchema,
  generatedDeckResultSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type GeneratedDeckResult,
  type GeneratedImageLayer,
  type GeneratedSlideResult,
  type SlideContent,
  type UnifiedVisualSpec
} from "@/lib/ai-deck/schema";
import { prisma } from "@/lib/db/prisma";
import { getDeckOutlineDraftForUser } from "@/lib/deck-outline/service";

import { createDeckPptxBuffer, type PptxImageAsset } from "./pptx";
import { writeDeckFile } from "./storage";

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

export type GenerateDeckOptions = {
  analyzerOptions?: AnalyzeDeckOptions;
  imageGenerator?: ImageLayerGenerator;
};

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
    input,
    userId
  });
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
    input,
    userId
  });
}

async function persistGeneratedDeckForUser({
  analyzedDeck,
  generator,
  input,
  userId
}: {
  analyzedDeck: AnalyzedDeckResult;
  generator: ImageLayerGenerator;
  input: AnalyzeDeckRequest;
  userId: string;
}) {
  let projectId: string | null = null;

  try {
    const contentReview = buildContentReview(input, analyzedDeck);
    const consistencyReport = buildConsistencyReport(input, analyzedDeck);
    const project = await prisma.deckProject.create({
      data: {
        userId,
        mode: analyzedDeck.mode,
        status: "GENERATING",
        title: analyzedDeck.deckTitle,
        summary: analyzedDeck.deckSummary,
        input: toInputJson(input),
        unifiedVisualSpec: toInputJson(analyzedDeck.unifiedVisualSpec),
        contentReview: toInputJson(contentReview),
        consistencyReport: toInputJson(consistencyReport)
      }
    });
    const generatedSlides: GeneratedSlideResult[] = [];
    const pptxImageAssets: PptxImageAsset[] = [];

    projectId = project.id;

    for (const slide of analyzedDeck.slides) {
      const motionPlan = buildSlideMotionPlan(slide);
      const deckSlide = await prisma.deckSlide.create({
        data: {
          projectId: project.id,
          slideId: slide.slideId,
          index: slide.index,
          content: toInputJson(slide.content),
          elements: toInputJson(slide.elements),
          imageLayerRequests: toInputJson(slide.imageLayerRequests),
          generatedImageLayers: toInputJson([]),
          motionPlan: toInputJson(motionPlan),
          canvas: toInputJson(slide.canvas)
        }
      });
      const generatedImageLayers: GeneratedImageLayer[] = [];

      for (const request of slide.imageLayerRequests) {
        const generated = await generator.generateLayer({
          request,
          slide,
          unifiedVisualSpec: analyzedDeck.unifiedVisualSpec
        });
        const assetId = randomUUID();
        const stored = await writeDeckFile({
          bytes: generated.bytes,
          filename: generated.filename,
          projectId: project.id
        });
        const publicUrl = `/api/decks/${project.id}/assets/${assetId}`;

        await prisma.deckAsset.create({
          data: {
            id: assetId,
            projectId: project.id,
            slideId: deckSlide.id,
            elementId: request.elementId,
            requestId: request.id,
            kind: "IMAGE_LAYER",
            provider: generated.provider,
            mimeType: generated.mimeType,
            filename: stored.filename,
            relativePath: stored.relativePath,
            publicUrl,
            sizeBytes: stored.sizeBytes,
            metadata: toInputJson(generated.metadata)
          }
        });
        generatedImageLayers.push({
          id: `${request.id}-layer`,
          requestId: request.id,
          elementId: request.elementId,
          assetId,
          provider: generated.provider,
          mimeType: generated.mimeType,
          url: publicUrl,
          prompt: request.prompt,
          width: generated.width,
          height: generated.height,
          transparentBackground: request.transparentBackground,
          visualNotes: request.visualNotes
        });
        pptxImageAssets.push({
          assetId,
          bytes: generated.bytes,
          mimeType: generated.mimeType
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

    const pptxBuffer = await createDeckPptxBuffer({
      deckSummary: analyzedDeck.deckSummary,
      deckTitle: analyzedDeck.deckTitle,
      imageAssets: pptxImageAssets,
      slides: generatedSlides,
      unifiedVisualSpec: analyzedDeck.unifiedVisualSpec
    });
    const pptxAssetId = randomUUID();
    const pptxStored = await writeDeckFile({
      bytes: pptxBuffer,
      filename: `${safeFilename(analyzedDeck.deckTitle)}-${pptxAssetId}.pptx`,
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

    return serializeDeckProject(readyProject);
  } catch (error) {
    if (projectId) {
      await prisma.deckProject.updateMany({
        where: {
          id: projectId,
          userId
        },
        data: {
          generationError:
            error instanceof Error ? error.message.slice(0, 1000) : "生成失败",
          status: "FAILED"
        }
      });
    }

    throw error;
  }
}

export async function listDeckProjects(userId: string) {
  const projects = await prisma.deckProject.findMany({
    where: {
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

  return serializeDeckProject(project);
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
