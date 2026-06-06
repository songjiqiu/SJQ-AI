import {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assetService = vi.hoisted(() => ({
  searchTemplateContainerAssetsForAi: vi.fn(),
  searchTemplateIconAssetsForAi: vi.fn(),
  searchTemplateLineAssetsForAi: vi.fn(),
  searchTemplateNavigationAssetsForAi: vi.fn(),
  searchTemplateShapeAssetsForAi: vi.fn(),
  searchTemplateTextStyleAssetsForAi: vi.fn()
}));

vi.mock("@/lib/admin/template-assets/service", () => ({
  searchTemplateContainerAssetsForAi:
    assetService.searchTemplateContainerAssetsForAi,
  searchTemplateIconAssetsForAi: assetService.searchTemplateIconAssetsForAi,
  searchTemplateLineAssetsForAi: assetService.searchTemplateLineAssetsForAi,
  searchTemplateNavigationAssetsForAi:
    assetService.searchTemplateNavigationAssetsForAi,
  searchTemplateShapeAssetsForAi: assetService.searchTemplateShapeAssetsForAi,
  searchTemplateTextStyleAssetsForAi:
    assetService.searchTemplateTextStyleAssetsForAi
}));

import {
  applySemanticAssetsToSlide,
  enhanceSlideWithSemanticAssets
} from "@/lib/ai-deck/semantic-assets";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import type { TemplateElementAssetAiResult } from "@/lib/admin/template-assets/types";
import {
  slideCompositionPlanSchema,
  type AnalyzeDeckRequest,
  type SlideCompositionPlan,
  type SlideElement
} from "@/lib/ai-deck/schema";
import { extractPaletteHexColors } from "@/lib/ai-deck/visual-colors";

const input: AnalyzeDeckRequest = {
  audience: "投资人",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  deckType: "business-report",
  goal: "获得试点合作意向",
  locale: "zh-CN",
  pageCount: 6,
  palette: "star-map",
  sourceText: "市场机会、产品优势、合作路径和执行计划。"
};

function makeAsset(
  kind: TemplateElementAssetKind,
  overrides: Partial<TemplateElementAssetAiResult> = {}
) {
  return {
    ...baseAsset(kind),
    ...overrides
  };
}

function baseAsset(kind: TemplateElementAssetKind): TemplateElementAssetAiResult {
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
    createdAt: "2026-06-02T00:00:00.000Z",
    description: "测试资产",
    detail: buildDetail(kind),
    id: `asset-${kind.toLowerCase()}`,
    isEnabled: true,
    kind,
    keywords: ["title", "body", "line", "navigation", "metric"],
    matchScore: 88,
    name: `测试${kind}资产`,
    pageTypes: ["cover-title", "title-body-points"],
    preview: {},
    primaryCategory: "test",
    resource: {
      semanticKey: kind.toLowerCase()
    },
    reviewStatus: TemplateAssetReviewStatus.APPROVED,
    secondaryCategory: "test-secondary",
    semanticTags: ["title", "body", "metric"],
    setKey: "common",
    setKind: TemplateAssetSetKind.COMMON,
    setName: "通用套装",
    sortOrder: 1,
    source: TemplateAssetSource.MANUAL,
    style: {
      fillColor: "#EAF2FF",
      strokeColor: "#AA1100",
      strokeWidth: 2
    },
    styleTags: ["minimal"],
    synonyms: [],
    tags: ["测试"],
    updatedAt: "2026-06-02T00:00:00.000Z",
    usageScenarios: ["test"],
    usageSuggestion: "用于测试。",
    variantKey: kind.toLowerCase()
  };
}

function buildDetail(kind: TemplateElementAssetKind) {
  if (kind === TemplateElementAssetKind.ICON) {
    return {
      cornerRadius: 12,
      fillMode: "none",
      iconName: "metric",
      iconStyle: "line",
      strokeColor: "#AA1100",
      strokeWidth: 2
    };
  }

  if (kind === TemplateElementAssetKind.SHAPE) {
    return {
      cornerRadius: 8,
      fillColor: "#EAF2FF",
      opacity: 1,
      shadow: false,
      shapeType: "roundedRect",
      strokeColor: "#AA1100",
      strokeWidth: 2
    };
  }

  if (kind === TemplateElementAssetKind.LINE) {
    return {
      cap: "round",
      connectorType: "straight",
      dash: "solid",
      direction: "horizontal",
      endArrowType: "none",
      startArrowType: "none",
      strokeColor: "#AA1100",
      strokeWidth: 2
    };
  }

  if (kind === TemplateElementAssetKind.TEXT_STYLE) {
    return {
      color: "#111827",
      fontFamily: "Microsoft YaHei",
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: 0,
      lineHeight: 1.2,
      maxLines: 2,
      textRole: "title"
    };
  }

  if (kind === TemplateElementAssetKind.CONTAINER) {
    return {
      allowedContentTypes: ["text"],
      autoLayout: false,
      containerRole: "body",
      fillColor: "#EAF2FF",
      gap: 12,
      padding: 16,
      recommendedHeight: 160,
      recommendedWidth: 320,
      strokeColor: "#AA1100",
      strokeWidth: 1
    };
  }

  return {
    activeColor: "#AA1100",
    displayMode: "label",
    fixedPosition: "bottom",
    inactiveColor: "#94A3B8",
    navigationRole: "page-number",
    showOnCover: false,
    showOnEnding: false
  };
}

function buildSlide() {
  const analyzed = buildMockAnalyzedDeck(input);

  return {
    slide: analyzed.slides[0],
    unifiedVisualSpec: analyzed.unifiedVisualSpec
  };
}

describe("semantic asset enhancement", () => {
  beforeEach(() => {
    for (const search of Object.values(assetService)) {
      search.mockReset();
      search.mockResolvedValue([]);
    }
  });

  it("binds semantic assets to text, shapes, lines, icons, containers, and navigation", () => {
    const { slide, unifiedVisualSpec } = buildSlide();
    const slideWithRoom: SlideCompositionPlan = {
      ...slide,
      pageIntent: {
        ...slide.pageIntent,
        pageRole: "data"
      },
      elements: [
        ...slide.elements,
        {
          bounds: { height: 0.12, width: 2.1, x: 1, y: 6.2 },
          editable: true,
          hierarchyLevel: 4,
          id: "slide-1-test-line",
          requiresImageGeneration: false,
          role: "标题强调线",
          semanticType: "accentShape",
          styleNotes: "测试线条。",
          type: "shape",
          zIndex: 18
        } satisfies SlideElement
      ].slice(0, 8)
    };
    const enhanced = applySemanticAssetsToSlide({
      assets: {
        CONTAINER: [
          makeAsset(TemplateElementAssetKind.CONTAINER, {
            name: "正文容器",
            style: {
              containerRole: "body-text-area",
              fillColor: "#EAF2FF",
              strokeColor: "#AA1100",
              strokeWidth: 1
            }
          })
        ],
        ICON: [
          makeAsset(TemplateElementAssetKind.ICON, {
            name: "指标图标",
            preview: { iconName: "metric" },
            style: { strokeColor: "#16A085", strokeWidth: 2 }
          })
        ],
        LINE: [
          makeAsset(TemplateElementAssetKind.LINE, {
            name: "强调线",
            preview: { lineType: "divider" },
            style: { dash: "dashed", strokeColor: "#AA1100", strokeWidth: 3 }
          })
        ],
        NAVIGATION: [
          makeAsset(TemplateElementAssetKind.NAVIGATION, {
            name: "页码导航",
            style: { activeColor: "#AA1100", displayMode: "progress" }
          })
        ],
        SHAPE: [
          makeAsset(TemplateElementAssetKind.SHAPE, {
            name: "基础图形",
            style: {
              fillColor: "#F8FAFC",
              shapeType: "roundedRect",
              strokeColor: "#2563EB"
            }
          })
        ],
        TEXT_STYLE: [
          makeAsset(TemplateElementAssetKind.TEXT_STYLE, {
            name: "标题文本样式",
            resource: { semanticKey: "cover-title", textRole: "cover-title" },
            style: {
              color: "#111827",
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.18,
              maxLines: 2,
              textRole: "cover-title"
            }
          })
        ]
      },
      input,
      slide: slideWithRoom,
      unifiedVisualSpec
    });
    const palette = new Set(extractPaletteHexColors(unifiedVisualSpec.colorPalette));

    expect(slideCompositionPlanSchema.parse(enhanced)).toBeTruthy();
    expect(enhanced.elements.length).toBeLessThanOrEqual(24);
    expect(
      enhanced.elements.some(
        (element) => element.assetBinding?.kind === "TEXT_STYLE"
      )
    ).toBe(true);
    expect(
      enhanced.elements.some((element) => element.assetBinding?.kind === "LINE")
    ).toBe(true);
    expect(
      enhanced.elements.some((element) => element.assetBinding?.kind === "ICON")
    ).toBe(true);
    expect(
      enhanced.elements.some(
        (element) => element.assetBinding?.kind === "NAVIGATION"
      )
    ).toBe(true);
    expect(enhanced.layoutDiagnostics.warnings.join(" ")).toContain(
      "已应用语义元素资产"
    );
    expect(JSON.stringify(enhanced.elements)).not.toContain("#AA1100");
    expect(JSON.stringify(enhanced.elements)).not.toContain("#EAF2FF");
    expect(JSON.stringify(enhanced.elements)).not.toContain("#111827");
    for (const element of enhanced.elements) {
      if (element.textStyle?.color) {
        expect(palette.has(element.textStyle.color)).toBe(true);
      }

      for (const color of [
        element.assetStyle?.activeColor,
        element.assetStyle?.fillColor,
        element.assetStyle?.inactiveColor,
        element.assetStyle?.strokeColor
      ]) {
        if (color) {
          expect(palette.has(color)).toBe(true);
        }
      }
    }
  });

  it("keeps the slide unchanged when no semantic assets match", () => {
    const { slide } = buildSlide();
    const enhanced = applySemanticAssetsToSlide({
      assets: {},
      input,
      slide
    });

    expect(enhanced).toBe(slide);
  });

  it("does not exceed the element limit when adding supplemental assets", () => {
    const { slide } = buildSlide();
    const crowdedSlide: SlideCompositionPlan = {
      ...slide,
      elements: [
        ...slide.elements,
        ...Array.from({ length: 24 }).map((_, index) => ({
          bounds: { height: 0.2, width: 0.4, x: 0.6 + index * 0.1, y: 6.4 },
          editable: true,
          hierarchyLevel: 4,
          id: `slide-1-extra-${index}`,
          requiresImageGeneration: false,
          role: `附加元素 ${index}`,
          semanticType: "accentShape" as const,
          styleNotes: "用于填满元素上限。",
          type: "shape" as const,
          zIndex: 20 + index
        }))
      ].slice(0, 24)
    };
    const enhanced = applySemanticAssetsToSlide({
      assets: {
        ICON: [makeAsset(TemplateElementAssetKind.ICON)],
        NAVIGATION: [makeAsset(TemplateElementAssetKind.NAVIGATION)]
      },
      input,
      slide: crowdedSlide
    });

    expect(enhanced.elements).toHaveLength(24);
  });

  it("does not block generation when asset lookup fails", async () => {
    const { slide, unifiedVisualSpec } = buildSlide();

    assetService.searchTemplateTextStyleAssetsForAi.mockRejectedValueOnce(
      Object.assign(new Error("missing table"), {
        code: "P2021",
        meta: { modelName: "TemplateAsset" }
      })
    );

    const enhanced = await enhanceSlideWithSemanticAssets({
      input,
      slide,
      unifiedVisualSpec
    });

    expect(enhanced.elements).toEqual(slide.elements);
    expect(enhanced.layoutDiagnostics.warnings.join(" ")).toContain(
      "语义元素资产未应用"
    );
  });
});
