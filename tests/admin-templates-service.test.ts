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
  updatePptTemplate
} from "@/lib/admin/templates/service";

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
