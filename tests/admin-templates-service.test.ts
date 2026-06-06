import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const db = vi.hoisted(() => ({
  prisma: {
    pptTemplate: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

import { pptTemplateCategoryIds } from "@/lib/admin/templates/categories";
import { buildDefaultTemplateSlide } from "@/lib/admin/templates/defaults";
import {
  PptTemplateNotFoundError,
  createPptTemplate,
  deletePptTemplate,
  listPptTemplates,
  selectPptTemplateForSlide,
  updatePptTemplate
} from "@/lib/admin/templates/service";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";

function makeTemplate(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-06-01T00:00:00.000Z");

  return {
    category: "cover-title",
    createdAt: now,
    customCategoryKey: null,
    customCategoryName: null,
    description: "默认封面模板",
    id: "template-1",
    isEnabled: true,
    name: "封面模板",
    slide: buildDefaultTemplateSlide("cover-title"),
    sortOrder: 1,
    tags: ["封面"],
    updatedAt: now,
    ...overrides
  };
}

describe("admin PPT template service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the fixed category list complete", () => {
    expect(pptTemplateCategoryIds).toEqual([
      "chapter",
      "cover-title",
      "title-body-points",
      "big-image-background",
      "left-image-right-text",
      "left-text-right-image",
      "left-text-right-chart",
      "big-chart",
      "two-column-compare",
      "quote",
      "time-axis",
      "process-steps",
      "key-metrics",
      "quadrant-matrix",
      "ending"
    ]);
  });

  it("creates templates from the category default slide", async () => {
    db.prisma.pptTemplate.create.mockImplementation(async ({ data }) =>
      makeTemplate({
        ...data,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        id: "template-created",
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      })
    );

    const template = await createPptTemplate({
      category: "time-axis",
      description: "时间轴模板",
      isEnabled: true,
      name: "时间轴模板",
      sortOrder: 2,
      tags: ["时间轴"]
    });

    expect(db.prisma.pptTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "time-axis",
          name: "时间轴模板",
          slide: expect.objectContaining({
            designPlan: expect.objectContaining({
              layoutTemplate: "time-axis"
            })
          })
        })
      })
    );
    expect(template.category).toBe("time-axis");
    expect(template.slide.designPlan.layoutTemplate).toBe("time-axis");
  });

  it("normalizes legacy categories while serializing templates", async () => {
    db.prisma.pptTemplate.findMany.mockResolvedValue([
      makeTemplate({
        category: "cover",
        slide: buildDefaultTemplateSlide("cover-title")
      }),
      makeTemplate({
        category: "timeline",
        id: "template-2",
        slide: {
          ...buildDefaultTemplateSlide("time-axis"),
          designPlan: {
            ...buildDefaultTemplateSlide("time-axis").designPlan,
            layoutTemplate: "timeline"
          }
        }
      })
    ]);

    const templates = await listPptTemplates();

    expect(templates.map((template) => template.category)).toEqual([
      "cover-title",
      "time-axis"
    ]);
    expect(templates[1]?.slide.designPlan.layoutTemplate).toBe("time-axis");
  });

  it("rejects invalid slide JSON before persisting", async () => {
    await expect(
      createPptTemplate({
        category: "cover-title",
        isEnabled: true,
        name: "坏模板",
        slide: {
          slideId: "bad"
        } as never,
        sortOrder: 0,
        tags: []
      })
    ).rejects.toBeInstanceOf(ZodError);
    expect(db.prisma.pptTemplate.create).not.toHaveBeenCalled();
  });

  it("lists and serializes templates", async () => {
    db.prisma.pptTemplate.findMany.mockResolvedValue([makeTemplate()]);

    const templates = await listPptTemplates({
      category: "cover-title",
      includeDisabled: false
    });

    expect(db.prisma.pptTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          category: {
            in: ["cover-title", "cover"]
          },
          isEnabled: true
        }
      })
    );
    expect(templates[0]).toMatchObject({
      category: "cover-title",
      id: "template-1",
      name: "封面模板",
      tags: ["封面"]
    });
  });

  it("loads incompatible legacy slide JSON from the category default", async () => {
    db.prisma.pptTemplate.findMany.mockResolvedValue([
      makeTemplate({
        slide: {
          content: {
            contentLayers: {
              primary: "旧版主内容"
            }
          },
          slideId: "legacy-template"
        }
      })
    ]);

    const templates = await listPptTemplates();

    expect(templates[0]?.slide.slideId).toBe("template-cover-title");
    expect(templates[0]?.slide.designPlan.layoutTemplate).toBe("cover-title");
    expect(templates[0]?.compatibilityWarning).toContain(
      "incompatible with the current schema"
    );
  });

  it("selects an enabled template by layout candidate, style, and sort order", async () => {
    const input: AnalyzeDeckRequest = {
      audience: "管理层",
      coreMessage: "用数据说明增长机会。",
      deckType: "business-report",
      goal: "说明季度经营判断",
      locale: "zh-CN",
      pageCount: 6,
      palette: "star-map",
      sourceText: "季度经营分析包含增长机会、关键指标和行动建议。"
    };
    const mock = buildMockAnalyzedDeck(input);
    const semanticPlan = {
      slideId: mock.slides[0].slideId,
      index: mock.slides[0].index,
      content: mock.slides[0].content,
      pageIntent: mock.slides[0].pageIntent,
      contentHierarchy: mock.slides[0].contentHierarchy,
      layoutSelection: mock.slides[0].layoutSelection,
      constraints: mock.slides[0].constraints,
      expressionIntent: mock.slides[0].expressionIntent,
      designPlan: mock.slides[0].designPlan,
      layoutDiagnostics: mock.slides[0].layoutDiagnostics,
      semanticElements: mock.slides[0].semanticElements
    };

    db.prisma.pptTemplate.findMany.mockResolvedValue([
      makeTemplate({
        id: "ai-template",
        name: "AI 科技封面",
        sortOrder: 1,
        tags: ["AI 科技感"],
        slide: buildDefaultTemplateSlide("cover-title")
      }),
      makeTemplate({
        id: "business-template",
        name: "中国商务封面",
        sortOrder: 9,
        tags: ["中国商务通用"],
        slide: buildDefaultTemplateSlide("cover-title")
      }),
      makeTemplate({
        category: "title-body-points",
        id: "body-template",
        name: "中国商务正文",
        sortOrder: 0,
        tags: ["中国商务通用"],
        slide: buildDefaultTemplateSlide("title-body-points")
      })
    ]);

    const selected = await selectPptTemplateForSlide({
      input,
      semanticPlan,
      unifiedVisualSpec: mock.unifiedVisualSpec
    });

    expect(selected?.id).toBe("business-template");
    expect(db.prisma.pptTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true
        }
      })
    );
  });

  it("updates enabled status and sort order", async () => {
    db.prisma.pptTemplate.findUnique.mockResolvedValue({
      category: "cover"
    });
    db.prisma.pptTemplate.update.mockResolvedValue(
      makeTemplate({
        category: "cover-title",
        isEnabled: false,
        sortOrder: 8
      })
    );

    const template = await updatePptTemplate("template-1", {
      isEnabled: false,
      sortOrder: 8
    });

    expect(db.prisma.pptTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "cover-title",
          isEnabled: false,
          sortOrder: 8
        }),
        where: {
          id: "template-1"
        }
      })
    );
    expect(template.isEnabled).toBe(false);
    expect(template.sortOrder).toBe(8);
  });

  it("throws not found when deleting a missing template", async () => {
    db.prisma.pptTemplate.deleteMany.mockResolvedValue({
      count: 0
    });

    await expect(deletePptTemplate("missing")).rejects.toBeInstanceOf(
      PptTemplateNotFoundError
    );
  });
});
