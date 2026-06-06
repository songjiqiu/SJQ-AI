import {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const db = vi.hoisted(() => {
  const prisma = {
    $transaction: vi.fn(),
    templateAsset: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    templateContainerAsset: {
      create: vi.fn(),
      upsert: vi.fn()
    },
    templateIconAsset: {
      create: vi.fn(),
      upsert: vi.fn()
    },
    templateLineAsset: {
      create: vi.fn(),
      upsert: vi.fn()
    },
    templateNavigationAsset: {
      create: vi.fn(),
      upsert: vi.fn()
    },
    templateShapeAsset: {
      create: vi.fn(),
      upsert: vi.fn()
    },
    templateTextStyleAsset: {
      create: vi.fn(),
      upsert: vi.fn()
    }
  };

  prisma.$transaction.mockImplementation((callback) => callback(prisma));

  return {
    prisma
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

import {
  TemplateElementAssetNotFoundError,
  createTemplateAssetByKind,
  deleteTemplateAssetByKind,
  listTemplateAssetsByKind,
  searchTemplateIconAssetsForAi,
  updateTemplateAssetByKind
} from "@/lib/admin/template-assets/service";

function makeAsset(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-06-02T00:00:00.000Z");
  const kind =
    (overrides.kind as TemplateElementAssetKind | undefined) ??
    TemplateElementAssetKind.ICON;

  return {
    aiModifyPermissions: {
      allowAutoLayout: false,
      allowMove: true,
      allowRecolor: true,
      allowResize: true,
      allowStretch: false,
      allowTextShrink: false
    },
    backgroundModes: ["light", "dark"],
    colorTags: ["blue"],
    container: null,
    createdAt: now,
    description: "测试资产",
    icon:
      kind === TemplateElementAssetKind.ICON
        ? {
            assetId: "asset-1",
            cornerRadius: 12,
            fillMode: "none",
            iconName: "idea",
            iconStyle: "line",
            id: "icon-detail-1",
            strokeColor: "#2563eb",
            strokeWidth: 2
          }
        : null,
    id: "asset-1",
    isEnabled: true,
    keywords: ["idea", "growth"],
    kind,
    line:
      kind === TemplateElementAssetKind.LINE
        ? {
            assetId: "asset-1",
            cap: "round",
            connectorType: "straight",
            dash: "solid",
            direction: "horizontal",
            endArrowType: "triangle",
            id: "line-detail-1",
            startArrowType: "none",
            strokeColor: "#2563eb",
            strokeWidth: 2
          }
        : null,
    name: "概念图标",
    navigation: null,
    pageTypes: ["title-body-points"],
    preview: {
      iconName: "idea"
    },
    primaryCategory: "status-feedback",
    reviewStatus: TemplateAssetReviewStatus.APPROVED,
    secondaryCategory: "result-status",
    semanticTags: ["idea", "growth"],
    setKey: "common",
    setKind: TemplateAssetSetKind.COMMON,
    setName: "通用套装",
    shape:
      kind === TemplateElementAssetKind.SHAPE
        ? {
            assetId: "asset-1",
            cornerRadius: 8,
            fillColor: "#dbeafe",
            id: "shape-detail-1",
            opacity: 1,
            shadow: false,
            shapeType: "roundedRect",
            strokeColor: "#2563eb",
            strokeWidth: 1
          }
        : null,
    sortOrder: 1,
    source: TemplateAssetSource.MANUAL,
    styleTags: ["minimal"],
    synonyms: ["concept"],
    tags: ["图标"],
    textStyle: null,
    updatedAt: now,
    usageScenarios: ["feature"],
    variantKey: "warning",
    ...overrides
  };
}

describe("admin template asset service", () => {
  afterEach(() => {
    vi.resetAllMocks();
    db.prisma.$transaction.mockImplementation((callback) => callback(db.prisma));
  });

  it("creates assets in the public table and typed detail table", async () => {
    db.prisma.templateAsset.create.mockResolvedValue(
      makeAsset({
        id: "shape-created",
        kind: TemplateElementAssetKind.SHAPE
      })
    );
    db.prisma.templateAsset.findUniqueOrThrow.mockResolvedValue(
      makeAsset({
        id: "shape-created",
        kind: TemplateElementAssetKind.SHAPE,
        name: "圆角图形"
      })
    );

    const asset = await createTemplateAssetByKind(
      TemplateElementAssetKind.SHAPE,
      {
        detail: {
          cornerRadius: 8,
          fillColor: "#dbeafe",
          shapeType: "roundedRect",
          strokeColor: "#2563eb",
          strokeWidth: 1
        },
        name: "圆角图形",
        primaryCategory: "basic-geometry",
        semanticTags: ["container"],
        secondaryCategory: "rect-geometry",
        tags: ["图形"],
        usageScenarios: ["card"],
        variantKey: "rounded-rect"
      }
    );

    expect(db.prisma.templateAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiModifyPermissions: expect.objectContaining({
            allowRecolor: true,
            allowStretch: true
          }),
          kind: TemplateElementAssetKind.SHAPE,
          name: "圆角图形",
          primaryCategory: "basic-geometry",
          secondaryCategory: "rect-geometry",
          setKey: "common",
          setKind: TemplateAssetSetKind.COMMON,
          variantKey: "rounded-rect"
        })
      })
    );
    expect(db.prisma.templateShapeAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assetId: "shape-created",
        fillColor: "#dbeafe",
        shapeType: "roundedRect"
      })
    });
    expect(asset.kind).toBe(TemplateElementAssetKind.SHAPE);
    expect(asset.style).toEqual(
      expect.objectContaining({
        fillColor: "#dbeafe",
        shapeType: "roundedRect"
      })
    );
  });

  it("lists assets from the public table and filters serialized metadata", async () => {
    db.prisma.templateAsset.findMany.mockResolvedValue([
      makeAsset({
        kind: TemplateElementAssetKind.LINE,
        name: "流程箭头",
        semanticTags: ["connector"],
        usageScenarios: ["process"]
      }),
      makeAsset({
        id: "line-2",
        kind: TemplateElementAssetKind.LINE,
        name: "章节分割线",
        semanticTags: ["divider"],
        usageScenarios: ["chapter"]
      })
    ]);

    const assets = await listTemplateAssetsByKind(TemplateElementAssetKind.LINE, {
      includeDisabled: false,
      primaryCategory: "basic-line",
      query: "process",
      secondaryCategory: "straight-line",
      variantKey: "straight-line"
    });

    expect(db.prisma.templateAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          line: true
        }),
        where: expect.objectContaining({
          isEnabled: true,
          kind: TemplateElementAssetKind.LINE,
          primaryCategory: "basic-line",
          secondaryCategory: "straight-line",
          variantKey: "straight-line"
        })
      })
    );
    expect(assets).toHaveLength(1);
    expect(assets[0]?.name).toBe("流程箭头");
  });

  it("updates public fields and upserts the typed detail", async () => {
    db.prisma.templateAsset.findFirst.mockResolvedValue(makeAsset());
    db.prisma.templateAsset.update.mockResolvedValue(makeAsset());
    db.prisma.templateAsset.findUniqueOrThrow.mockResolvedValue(
      makeAsset({
        icon: {
          assetId: "asset-1",
          cornerRadius: 4,
          fillMode: "none",
          iconName: "idea",
          iconStyle: "line",
          id: "icon-detail-1",
          strokeColor: "#111827",
          strokeWidth: 3
        },
        isEnabled: false,
        sortOrder: 8
      })
    );

    const asset = await updateTemplateAssetByKind(
      TemplateElementAssetKind.ICON,
      "asset-1",
      {
        detail: {
          cornerRadius: 4,
          iconName: "idea",
          iconStyle: "line",
          strokeColor: "#111827",
          strokeWidth: 3
        },
        isEnabled: false,
        sortOrder: 8
      }
    );

    expect(db.prisma.templateAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isEnabled: false,
          sortOrder: 8
        }),
        where: {
          id: "asset-1"
        }
      })
    );
    expect(db.prisma.templateIconAsset.upsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        assetId: "asset-1",
        strokeColor: "#111827",
        strokeWidth: 3
      }),
      update: expect.objectContaining({
        strokeColor: "#111827",
        strokeWidth: 3
      }),
      where: {
        assetId: "asset-1"
      }
    });
    expect(asset.isEnabled).toBe(false);
    expect(asset.style.strokeWidth).toBe(3);
  });

  it("defaults AI-generated candidate assets to pending review", async () => {
    db.prisma.templateAsset.create.mockResolvedValue(makeAsset({ id: "asset-ai" }));
    db.prisma.templateAsset.findUniqueOrThrow.mockResolvedValue(
      makeAsset({
        id: "asset-ai",
        reviewStatus: TemplateAssetReviewStatus.PENDING_REVIEW,
        source: TemplateAssetSource.AI_GENERATED
      })
    );

    const asset = await createTemplateAssetByKind(TemplateElementAssetKind.ICON, {
      detail: {
        iconName: "ai",
        iconStyle: "line",
        strokeColor: "#2563eb"
      },
      name: "AI 生成图标",
      semanticTags: ["ai", "生成"],
      source: TemplateAssetSource.AI_GENERATED
    });

    expect(db.prisma.templateAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: TemplateAssetReviewStatus.PENDING_REVIEW,
          source: TemplateAssetSource.AI_GENERATED
        })
      })
    );
    expect(asset.reviewStatus).toBe(TemplateAssetReviewStatus.PENDING_REVIEW);
  });

  it("requires semantic tags before persisting", async () => {
    await expect(
      createTemplateAssetByKind(TemplateElementAssetKind.ICON, {
        detail: {
          iconName: "empty"
        },
        name: "无语义图标",
        semanticTags: []
      })
    ).rejects.toBeInstanceOf(ZodError);
    expect(db.prisma.templateAsset.create).not.toHaveBeenCalled();
  });

  it("searches approved enabled template assets before common fallback", async () => {
    db.prisma.templateAsset.findMany
      .mockResolvedValueOnce([
        makeAsset({
          id: "template-asset",
          name: "模板增长图标",
          setKey: "business-general",
          setKind: TemplateAssetSetKind.TEMPLATE,
          sortOrder: 5
        })
      ])
      .mockResolvedValueOnce([
        makeAsset({
          id: "common-asset",
          name: "通用增长图标",
          sortOrder: 1
        })
      ]);

    const results = await searchTemplateIconAssetsForAi({
      backgroundMode: "light",
      pageType: "title-body-points",
      semanticTags: ["growth"],
      setKey: "business-general",
      styleTags: ["minimal"]
    });

    expect(db.prisma.templateAsset.findMany).toHaveBeenCalledTimes(1);
    expect(db.prisma.templateAsset.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          kind: TemplateElementAssetKind.ICON,
          reviewStatus: TemplateAssetReviewStatus.APPROVED,
          setKey: "business-general",
          setKind: TemplateAssetSetKind.TEMPLATE
        })
      })
    );
    expect(results[0]?.id).toBe("template-asset");
    expect(results[0]?.matchScore).toBeGreaterThan(0);
  });

  it("falls back to common approved enabled assets when template set has no match", async () => {
    db.prisma.templateAsset.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeAsset({
          id: "common-asset",
          name: "通用增长图标",
          sortOrder: 5
        })
      ]);

    const results = await searchTemplateIconAssetsForAi({
      backgroundMode: "light",
      pageType: "title-body-points",
      semanticTags: ["growth"],
      setKey: "business-general"
    });

    expect(db.prisma.templateAsset.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          kind: TemplateElementAssetKind.ICON,
          reviewStatus: TemplateAssetReviewStatus.APPROVED,
          setKey: "common",
          setKind: TemplateAssetSetKind.COMMON
        })
      })
    );
    expect(results[0]?.id).toBe("common-asset");
  });

  it("deletes from the public table and relies on detail cascade", async () => {
    db.prisma.templateAsset.deleteMany.mockResolvedValue({
      count: 1
    });

    await deleteTemplateAssetByKind(TemplateElementAssetKind.ICON, "asset-1");

    expect(db.prisma.templateAsset.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "asset-1",
        kind: TemplateElementAssetKind.ICON
      }
    });
    expect(db.prisma.templateIconAsset.upsert).not.toHaveBeenCalled();
  });

  it("throws not found when deleting a missing typed asset", async () => {
    db.prisma.templateAsset.deleteMany.mockResolvedValue({
      count: 0
    });

    await expect(
      deleteTemplateAssetByKind(TemplateElementAssetKind.ICON, "missing")
    ).rejects.toBeInstanceOf(TemplateElementAssetNotFoundError);
  });
});
