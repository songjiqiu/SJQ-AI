import { describe, expect, it } from "vitest";

import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import type { AnalyzeDeckRequest, SlideElement } from "@/lib/ai-deck/schema";
import { bindSlideElementColorsToVisualSpec } from "@/lib/ai-deck/visual-element-colors";
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

describe("visual element colors", () => {
  it("binds text and asset colors to the unified visual spec palette", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const elements: SlideElement[] = [
      {
        bounds: { height: 0.7, width: 4.6, x: 0.8, y: 0.8 },
        content: "资产标题",
        editable: true,
        hierarchyLevel: 1,
        id: "color-title",
        requiresImageGeneration: false,
        role: "标题",
        semanticType: "title",
        styleNotes: "用于验证文本色绑定。",
        textStyle: {
          align: "left",
          color: "#112233",
          fontSize: 30,
          fontWeight: "bold",
          lineHeight: 1.2,
          maxLines: 2
        },
        type: "text",
        zIndex: 10
      },
      {
        assetStyle: {
          fillColor: "#EAF2FF",
          strokeColor: "#AA1100",
          strokeWidth: 2
        },
        bounds: { height: 1.2, width: 2.4, x: 0.9, y: 2.0 },
        editable: true,
        hierarchyLevel: 3,
        id: "color-card",
        requiresImageGeneration: false,
        role: "卡片",
        semanticType: "card",
        styleNotes: "用于验证卡片色绑定。",
        type: "shape",
        zIndex: 11
      },
      {
        assetStyle: {
          activeColor: "#AA1100",
          inactiveColor: "#94A3B8",
          strokeColor: "#AA1100",
          strokeWidth: 2
        },
        bounds: { height: 0.4, width: 0.4, x: 3.6, y: 1.6 },
        editable: true,
        hierarchyLevel: 4,
        id: "color-icon",
        requiresImageGeneration: false,
        role: "图标",
        semanticType: "icon",
        styleNotes: "用于验证图标色绑定。",
        type: "icon",
        zIndex: 12
      }
    ];
    const bound = bindSlideElementColorsToVisualSpec(
      {
        ...slide,
        elements
      },
      analyzed.unifiedVisualSpec
    );
    const palette = new Set(extractPaletteHexColors(analyzed.unifiedVisualSpec.colorPalette));
    const serialized = JSON.stringify(bound.elements);

    expect(serialized).not.toContain("#112233");
    expect(serialized).not.toContain("#AA1100");
    expect(serialized).not.toContain("#EAF2FF");
    expect(serialized).not.toContain("#94A3B8");

    for (const element of bound.elements) {
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
});
