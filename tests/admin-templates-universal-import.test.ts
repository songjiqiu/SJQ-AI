import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const createdTemplates: Array<Record<string, unknown>> = [];
  const tx = {
    pptTemplate: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = {
          ...data,
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          id: `template-${createdTemplates.length + 1}`,
          updatedAt: new Date("2026-06-01T00:00:00.000Z")
        };

        createdTemplates.push(record);
        return record;
      }),
      deleteMany: vi.fn(async () => ({
        count: 17
      })),
      findMany: vi.fn(async () => createdTemplates)
    }
  };

  return {
    createdTemplates,
    prisma: {
      $transaction: vi.fn((callback) => callback(tx))
    },
    tx
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

import { pptTemplateCategoryIds } from "@/lib/admin/templates/categories";
import { importUniversalPptTemplatesV1 } from "@/lib/admin/templates/service";

describe("universal PPT template import service", () => {
  afterEach(() => {
    db.createdTemplates.length = 0;
    vi.clearAllMocks();
  });

  it("replaces fixed-category templates with the universal v1 package", async () => {
    const result = await importUniversalPptTemplatesV1();

    expect(db.tx.pptTemplate.deleteMany).toHaveBeenCalledWith({
      where: {
        category: {
          in: [...pptTemplateCategoryIds]
        }
      }
    });
    expect(db.tx.pptTemplate.create).toHaveBeenCalledTimes(45);
    expect(result).toMatchObject({
      createdCount: 45,
      deletedCount: 17
    });
    expect(result.templates).toHaveLength(45);
    expect(result.templates[0]?.slide.slideId).toMatch(/^uv1-/);
  });
});
