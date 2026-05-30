import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockImageLayerGenerator } from "@/lib/ai-deck/image-generator";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";

const input: AnalyzeDeckRequest = {
  sourceText:
    "为新能源初创公司准备融资路演，重点说明市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
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
    create: vi.fn()
  },
  deckProject: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
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
  writeDeckFile: vi.fn(async ({ filename, projectId }) => ({
    filename,
    relativePath: `decks/${projectId}/${filename}`,
    sizeBytes: 128
  }))
}));

import { generateDeckFromOutlineDraftForUser } from "@/lib/decks/service";

describe("generateDeckFromOutlineDraftForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prisma.deckOutlineDraft.findFirst.mockResolvedValue({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      fileSummaries: [],
      id: "draft-1",
      input,
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
    prisma.deckSlide.create.mockImplementation(async ({ data }) => ({
      createdAt: new Date("2026-05-30T00:00:00.000Z"),
      id: `deck-slide-${data.index}`,
      updatedAt: new Date("2026-05-30T00:00:00.000Z"),
      ...data
    }));
    prisma.deckSlide.update.mockResolvedValue({});
    prisma.deckAsset.create.mockResolvedValue({});
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
});
