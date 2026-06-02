import {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind
} from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const db = vi.hoisted(() => ({
  prisma: {
    templateElementAsset: {
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

import {
  TemplateElementAssetNotFoundError,
  createTemplateElementAsset,
  deleteTemplateElementAsset,
  listTemplateElementAssets,
  searchTemplateElementAssetsForAi,
  updateTemplateElementAsset
} from "@/lib/admin/template-assets/service";

function makeAsset(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-06-02T00:00:00.000Z");

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
    createdAt: now,
    description: "线性图标",
    id: "asset-1",
    isEnabled: true,
    kind: TemplateElementAssetKind.ICON,
    keywords: ["idea"],
    name: "概念图标",
    pageTypes: ["title-body-points"],
    preview: {
      iconName: "idea"
    },
    primaryCategory: "status-feedback",
    resource: {},
    reviewStatus: TemplateAssetReviewStatus.APPROVED,
    semanticTags: ["idea", "concept"],
    secondaryCategory: "result-status",
    setKey: "common",
    setKind: TemplateAssetSetKind.COMMON,
    setName: "通用套装",
    sortOrder: 1,
    source: TemplateAssetSource.MANUAL,
    style: {
      strokeColor: "#2563eb",
      strokeWidth: 2
    },
    styleTags: ["minimal"],
    synonyms: ["concept"],
    tags: ["图标"],
    updatedAt: now,
    usageScenarios: ["feature"],
    variantKey: "warning",
    ...overrides
  };
}

describe("admin template element asset service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates semantic assets with JSON fields", async () => {
    db.prisma.templateElementAsset.create.mockImplementation(async ({ data }) =>
      makeAsset({
        ...data,
        id: "asset-created"
      })
    );

    const asset = await createTemplateElementAsset({
      kind: TemplateElementAssetKind.SHAPE,
      name: "圆角容器",
      preview: {
        shape: "roundedRect"
      },
      primaryCategory: "content-container",
      semanticTags: ["container"],
      secondaryCategory: "text-container",
      style: {
        fillColor: "#dbeafe"
      },
      tags: ["图形"],
      usageScenarios: ["card"],
      variantKey: "body-container"
    });

    expect(db.prisma.templateElementAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiModifyPermissions: expect.objectContaining({
            allowRecolor: true,
            allowStretch: true
          }),
          kind: TemplateElementAssetKind.SHAPE,
          name: "圆角容器",
          primaryCategory: "content-container",
          preview: {
            shape: "roundedRect"
          },
          secondaryCategory: "text-container",
          setKey: "common",
          setKind: TemplateAssetSetKind.COMMON,
          variantKey: "body-container"
        })
      })
    );
    expect(asset.kind).toBe(TemplateElementAssetKind.SHAPE);
    expect(asset.semanticTags).toEqual(["container"]);
  });

  it("lists assets by kind and filters keyword across serialized arrays", async () => {
    db.prisma.templateElementAsset.findMany.mockResolvedValue([
      makeAsset({
        name: "流程箭头",
        semanticTags: ["connector"],
        usageScenarios: ["process"]
      }),
      makeAsset({
        id: "asset-2",
        name: "章节徽标",
        semanticTags: ["badge"],
        usageScenarios: ["chapter"]
      })
    ]);

    const assets = await listTemplateElementAssets({
      includeDisabled: false,
      kind: TemplateElementAssetKind.LINE,
      primaryCategory: "process-line",
      query: "process",
      secondaryCategory: "business-process",
      variantKey: "step-flow-line"
    });

    expect(db.prisma.templateElementAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          kind: TemplateElementAssetKind.LINE,
          primaryCategory: "process-line",
          secondaryCategory: "business-process",
          variantKey: "step-flow-line"
        })
      })
    );
    expect(assets).toHaveLength(1);
    expect(assets[0]?.name).toBe("流程箭头");
  });

  it("updates enabled status, sort order, and JSON config", async () => {
    db.prisma.templateElementAsset.findUnique.mockResolvedValue(makeAsset());
    db.prisma.templateElementAsset.update.mockResolvedValue(
      makeAsset({
        isEnabled: false,
        sortOrder: 8,
        style: {
          strokeColor: "#111827",
          strokeWidth: 3
        }
      })
    );

    const asset = await updateTemplateElementAsset("asset-1", {
      isEnabled: false,
      primaryCategory: null,
      secondaryCategory: null,
      sortOrder: 8,
      style: {
        strokeColor: "#111827",
        strokeWidth: 3
      },
      variantKey: null
    });

    expect(db.prisma.templateElementAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isEnabled: false,
          primaryCategory: null,
          secondaryCategory: null,
          sortOrder: 8,
          style: {
            strokeColor: "#111827",
            strokeWidth: 3
          },
          variantKey: null
        }),
        where: {
          id: "asset-1"
        }
      })
    );
    expect(asset.isEnabled).toBe(false);
    expect(asset.style.strokeWidth).toBe(3);
  });

  it("defaults AI-generated assets to pending review", async () => {
    db.prisma.templateElementAsset.create.mockImplementation(async ({ data }) =>
      makeAsset({
        ...data,
        id: "asset-ai"
      })
    );

    const asset = await createTemplateElementAsset({
      kind: TemplateElementAssetKind.ICON,
      name: "AI 生成图标",
      preview: {
        iconName: "ai"
      },
      semanticTags: ["ai", "生成"],
      source: TemplateAssetSource.AI_GENERATED,
      style: {
        strokeColor: "#2563eb"
      }
    });

    expect(db.prisma.templateElementAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: TemplateAssetReviewStatus.PENDING_REVIEW,
          source: TemplateAssetSource.AI_GENERATED
        })
      })
    );
    expect(asset.reviewStatus).toBe(TemplateAssetReviewStatus.PENDING_REVIEW);
  });

  it("requires semantic tags when creating assets", async () => {
    await expect(
      createTemplateElementAsset({
        kind: TemplateElementAssetKind.ICON,
        name: "无语义图标",
        preview: {
          iconName: "empty"
        },
        semanticTags: [],
        style: {
          strokeColor: "#2563eb"
        }
      })
    ).rejects.toBeInstanceOf(ZodError);
    expect(db.prisma.templateElementAsset.create).not.toHaveBeenCalled();
  });

  it("searches approved enabled AI assets with template-set fallback to common set", async () => {
    db.prisma.templateElementAsset.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeAsset({
          id: "common-asset",
          name: "通用增长图标",
          semanticTags: ["growth", "metric"],
          sortOrder: 5
        }),
        makeAsset({
          id: "disabled-asset",
          isEnabled: false,
          name: "停用图标",
          semanticTags: ["growth"]
        })
      ]);

    const results = await searchTemplateElementAssetsForAi({
      backgroundMode: "light",
      kind: TemplateElementAssetKind.ICON,
      pageType: "title-body-points",
      semanticTags: ["growth"],
      setKey: "business-general",
      styleTags: ["minimal"]
    });

    expect(db.prisma.templateElementAsset.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          reviewStatus: TemplateAssetReviewStatus.APPROVED,
          setKey: "business-general",
          setKind: TemplateAssetSetKind.TEMPLATE
        })
      })
    );
    expect(db.prisma.templateElementAsset.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          isEnabled: true,
          reviewStatus: TemplateAssetReviewStatus.APPROVED,
          setKey: "common",
          setKind: TemplateAssetSetKind.COMMON
        })
      })
    );
    expect(results[0]?.id).toBe("common-asset");
    expect(results[0]?.matchScore).toBeGreaterThan(0);
  });

  it("serializes legacy assets without category fields as uncategorized", async () => {
    db.prisma.templateElementAsset.findMany.mockResolvedValue([
      makeAsset({
        primaryCategory: null,
        secondaryCategory: null,
        variantKey: null
      })
    ]);

    const assets = await listTemplateElementAssets({
      kind: TemplateElementAssetKind.ICON
    });

    expect(assets[0]?.primaryCategory).toBeNull();
    expect(assets[0]?.secondaryCategory).toBeNull();
    expect(assets[0]?.variantKey).toBeNull();
  });

  it("rejects invalid kind and empty JSON objects before persisting", async () => {
    await expect(
      createTemplateElementAsset({
        kind: "BAD" as never,
        name: "坏资产",
        preview: {},
        style: {},
        tags: []
      } as never)
    ).rejects.toBeInstanceOf(ZodError);
    expect(db.prisma.templateElementAsset.create).not.toHaveBeenCalled();
  });

  it("throws not found when deleting a missing asset", async () => {
    db.prisma.templateElementAsset.deleteMany.mockResolvedValue({
      count: 0
    });

    await expect(deleteTemplateElementAsset("missing")).rejects.toBeInstanceOf(
      TemplateElementAssetNotFoundError
    );
  });
});
