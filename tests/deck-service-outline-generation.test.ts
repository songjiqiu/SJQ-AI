import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockImageLayerGenerator } from "@/lib/ai-deck/image-generator";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";

const input: AnalyzeDeckRequest = {
  sourceText:
    "为新能源初创公司准备融资路演，重点说明市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 3,
  deckType: "business-report",
  style: "strategic",
  palette: "star-map",
  locale: "zh-CN"
};
const analyzed = buildMockAnalyzedDeck(input);
const editedSlides = analyzed.slides.map((slide, index) => ({
  ...slide.content,
  title: index === 0 ? "编辑后的开场标题" : slide.content.title
}));

const prisma = vi.hoisted(() => ({
  deckAsset: {
    create: vi.fn(),
    update: vi.fn()
  },
  deckProject: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  reusableImageAsset: {
    findFirst: vi.fn(),
    upsert: vi.fn()
  },
  deckSlide: {
    create: vi.fn(),
    update: vi.fn()
  },
  deckOutlineDraft: {
    findFirst: vi.fn()
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma
}));

vi.mock("@/lib/decks/storage", () => ({
  deleteDeckStorageDirectory: vi.fn(),
  writeReusableAssetFile: vi.fn(async ({ filename, userId }) => ({
    filename,
    relativePath: `assets/${userId}/${filename}`,
    sizeBytes: 128
  })),
  writeDeckFile: vi.fn(async ({ filename, projectId }) => ({
    filename,
    relativePath: `decks/${projectId}/${filename}`,
    sizeBytes: 128
  }))
}));

import {
  createDeckGenerationTaskForUser,
  deleteDeckProjectForUser,
  generateDeckFromOutlineDraftForUser,
  getDeckGenerationStatusForUser,
  listDeckProjects,
  runDeckGenerationTaskForUser
} from "@/lib/decks/service";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";
import { deleteDeckStorageDirectory } from "@/lib/decks/storage";

describe("generateDeckFromOutlineDraftForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prisma.deckOutlineDraft.findFirst.mockResolvedValue({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      fileSummaries: [],
      id: "draft-1",
      input,
      intentAnalysis: null,
      mode: "mock",
      slides: editedSlides,
      summary: "编辑后的摘要用于服务测试。",
      title: "编辑后的路演标题",
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      userId: "user-1"
    });
    prisma.deckProject.create.mockImplementation(async ({ data }) => ({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      id: "deck-1",
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      ...data
    }));
    prisma.deckProject.delete.mockResolvedValue({});
    prisma.deckSlide.create.mockImplementation(async ({ data }) => ({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      id: `deck-slide-${data.index}`,
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      ...data
    }));
    prisma.deckSlide.update.mockResolvedValue({});
    prisma.deckAsset.create.mockResolvedValue({});
    prisma.deckAsset.update.mockResolvedValue({});
    prisma.deckProject.findFirst.mockResolvedValue({
      generationProgress: {
        current: 0,
        message: "已创建生成任务。",
        stage: "queued",
        total: input.pageCount
      },
      id: "deck-1",
      input,
      sourceOutlineDraftId: "draft-1",
      userId: "user-1"
    });
    prisma.deckProject.update.mockImplementation(async ({ data }) => ({
      assets: [
        {
          kind: "PPTX",
          publicUrl: "/api/decks/deck-1/pptx"
        }
      ],
      contentReview: {
        riskLevel: "low",
        score: 96,
        suggestions: [],
        summary: "内容风险较低，可进入预览和导出。",
        warnings: []
      },
      consistencyReport: {
        checks: [
          { message: "页数正确", name: "页数契约", score: 100 },
          { message: "配色稳定", name: "配色约束", score: 96 }
        ],
        score: 95,
        suggestions: [],
        summary: "跨页视觉、页数和层级保持稳定。"
      },
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      id: "deck-1",
      input,
      mode: "mock",
      pptxAssetId: data.pptxAssetId,
      slides: prisma.deckSlide.create.mock.calls.map(([call]) => ({
        canvas: call.data.canvas,
        content: call.data.content,
        elements: call.data.elements,
        generatedImageLayers:
          prisma.deckSlide.update.mock.calls[call.data.index - 1][0].data
            .generatedImageLayers,
        imageLayerRequests: call.data.imageLayerRequests,
        index: call.data.index,
        motionPlan: call.data.motionPlan,
        slideId: call.data.slideId
      })),
      status: data.status,
      summary: "编辑后的摘要用于服务测试。",
      title: "编辑后的路演标题",
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      updatedAt: new Date("2026-05-30T00:00:00.000Z")
    }));
    prisma.reusableImageAsset.findFirst.mockResolvedValue(null);
    prisma.reusableImageAsset.upsert.mockResolvedValue({
      id: "reusable-1",
      status: "APPROVED"
    });
  });

  it("generates a full deck from the saved edited outline", async () => {
    const result = await generateDeckFromOutlineDraftForUser(
      "user-1",
      "draft-1",
      {
        analyzerOptions: {
          env: {
            OPENAI_API_KEY: ""
          }
        },
        imageGenerator: new MockImageLayerGenerator()
      }
    );

    expect(result.deckTitle).toBe("编辑后的路演标题");
    expect(result.slides[0].content.title).toBe("编辑后的开场标题");
    expect(result.pptxUrl).toBe("/api/decks/deck-1/pptx");
    expect(prisma.deckOutlineDraft.findFirst).toHaveBeenCalledWith({
      where: {
        id: "draft-1",
        userId: "user-1"
      }
    });
    expect(prisma.deckProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "编辑后的路演标题"
        })
      })
    );
  });

  it("marks async generation as failed when slide layer AI generation fails", async () => {
    const failingClient = {
      chat: {
        completions: {
          create: vi.fn(async () => {
            throw new Error(
              "AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed"
            );
          })
        }
      }
    };

    await expect(
      runDeckGenerationTaskForUser("user-1", "deck-1", {
        analyzerOptions: {
          client: failingClient,
          env: {
            AI_TEXT_MODEL: "test-model",
            OPENAI_API_KEY: "test-key"
          }
        },
        imageGenerator: new MockImageLayerGenerator()
      })
    ).rejects.toThrow(/AI JSON output failed validation/);

    expect(prisma.deckProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          generationError: expect.stringContaining(
            "AI JSON output failed validation"
          ),
          generationProgress: expect.objectContaining({
            current: 0,
            message: expect.stringContaining("AI JSON output failed validation"),
            stage: "failed",
            total: input.pageCount
          }),
          status: "FAILED"
        }),
        where: {
          id: "deck-1",
          userId: "user-1"
        }
      })
    );
  });

  it("reuses a recent active async generation task for the same outline", async () => {
    prisma.deckProject.findFirst.mockResolvedValueOnce({
      createdAt: new Date(),
      generationProgress: {
        current: 1,
        message: "正在生成第 1 页图片素材。",
        stage: "images",
        total: input.pageCount
      },
      id: "deck-active",
      input,
      sourceOutlineDraftId: "draft-1",
      status: "GENERATING",
      userId: "user-1"
    });

    const task = await createDeckGenerationTaskForUser("user-1", "draft-1");

    expect(task).toMatchObject({
      id: "deck-active",
      reused: true,
      status: "GENERATING"
    });
    expect(prisma.deckProject.create).not.toHaveBeenCalled();
    expect(prisma.deckProject.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED"
        })
      })
    );
  });

  it("marks a stale async generation task as failed before creating a new task", async () => {
    prisma.deckProject.findFirst
      .mockResolvedValueOnce({
        createdAt: new Date(Date.now() - 31 * 60 * 1000),
        generationProgress: {
          current: 1,
          message: "正在生成第 1 页图片素材。",
          stage: "images",
          total: input.pageCount
        },
        id: "deck-stale",
        input,
        sourceOutlineDraftId: "draft-1",
        status: "GENERATING",
        userId: "user-1"
      })
      .mockResolvedValueOnce({
        _count: {
          slides: 0
        },
        assets: [],
        generationProgress: {
          current: 1,
          message: "正在生成第 1 页图片素材。",
          stage: "images",
          total: input.pageCount
        },
        id: "deck-stale",
        input,
        status: "GENERATING"
      });

    const task = await createDeckGenerationTaskForUser("user-1", "draft-1");

    expect(task).toMatchObject({
      id: "deck-1",
      status: "GENERATING"
    });
    expect(prisma.deckProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          generationError: "生成任务超时，请重新生成。",
          status: "FAILED"
        }),
        where: {
          id: "deck-stale",
          userId: "user-1"
        }
      })
    );
    expect(prisma.deckProject.create).toHaveBeenCalled();
  });

  it("lists only completed deck history with a PPTX asset", async () => {
    prisma.deckProject.findMany.mockResolvedValue([
      {
        _count: {
          slides: 3
        },
        assets: [
          {
            kind: "PPTX",
            publicUrl: "/api/decks/deck-ready/pptx"
          }
        ],
        contentReview: {
          score: 96
        },
        consistencyReport: {
          score: 95
        },
        createdAt: new Date("2026-05-30T00:00:00.000Z"),
        id: "deck-ready",
        mode: "mock",
        status: "READY",
        summary: "摘要",
        title: "已完成演示"
      }
    ]);

    const projects = await listDeckProjects("user-1");

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: "deck-ready",
      pptxUrl: "/api/decks/deck-ready/pptx",
      status: "READY"
    });
    expect(prisma.deckProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assets: {
            some: {
              kind: "PPTX"
            }
          },
          status: "READY",
          userId: "user-1"
        })
      })
    );
  });

  it("repairs status to ready when a project already has slides and a PPTX asset", async () => {
    prisma.deckProject.findFirst.mockResolvedValue({
      _count: {
        slides: input.pageCount
      },
      assets: [
        {
          kind: "PPTX",
          publicUrl: "/api/decks/deck-1/pptx"
        }
      ],
      generationError: "late failure",
      generationProgress: {
        current: input.pageCount,
        message: "late failure",
        stage: "failed",
        total: input.pageCount
      },
      id: "deck-1",
      input,
      pptxAssetId: "pptx-1",
      status: "FAILED",
      userId: "user-1"
    });

    const status = await getDeckGenerationStatusForUser("user-1", "deck-1");

    expect(status).toMatchObject({
      error: null,
      previewUrl: "/workbench/preview/deck-1",
      status: "READY"
    });
    expect(prisma.deckProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          generationError: null,
          status: "READY"
        }),
        where: {
          id: "deck-1",
          userId: "user-1"
        }
      })
    );
  });

  it("deletes finished deck history and clears local project files", async () => {
    prisma.deckProject.findFirst.mockResolvedValue({
      id: "deck-ready",
      status: "READY"
    });

    await expect(
      deleteDeckProjectForUser("user-1", "deck-ready")
    ).resolves.toBeUndefined();

    expect(prisma.deckProject.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        status: true
      },
      where: {
        id: "deck-ready",
        userId: "user-1"
      }
    });
    expect(prisma.deckProject.delete).toHaveBeenCalledWith({
      where: {
        id: "deck-ready"
      }
    });
    expect(deleteDeckStorageDirectory).toHaveBeenCalledWith("deck-ready");
  });

  it("blocks deleting deck history while it is generating", async () => {
    prisma.deckProject.findFirst.mockResolvedValue({
      id: "deck-active",
      status: "GENERATING"
    });

    await expect(
      deleteDeckProjectForUser("user-1", "deck-active")
    ).rejects.toBeInstanceOf(ActiveGenerationExistsError);

    expect(prisma.deckProject.delete).not.toHaveBeenCalled();
    expect(deleteDeckStorageDirectory).not.toHaveBeenCalled();
  });
});
