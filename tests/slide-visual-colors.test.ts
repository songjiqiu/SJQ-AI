import { describe, expect, it } from "vitest";

import { resolveSlideVisualColors } from "@/lib/ai-deck/visual-colors";
import type { UnifiedVisualSpec } from "@/lib/ai-deck/schema";
import { buildColorPaletteFromHexes } from "@/lib/ai-deck/visual-spec-defaults";

function buildColorSpec(
  overrides: {
    colorPalette?: UnifiedVisualSpec["colorPalette"];
    colorRoles?: Partial<UnifiedVisualSpec["colorRoles"]>;
  } = {}
): Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles"> {
  return {
    colorPalette:
      overrides.colorPalette ??
      buildColorPaletteFromHexes(
        [
          "#111111",
          "#555555",
          "#444444",
          "#111111",
          "#444444",
          "#222222",
          "#333333",
          "#555555",
          "#666666",
          "#222222",
          "#333333",
          "#444444",
          "#777777",
          "#111111"
        ],
        "zh-CN"
      ),
    colorRoles: {
      accent: "强调色 #AA1100 / #111111",
      background: "背景 #FAF8F0 / #222222",
      bodyText: "正文 #223344 / #333333 / #444444",
      borderDivider: "边框 #778899 / #222222",
      chart: "图表 #556677 与 #111111 / #444444",
      contrastRequirement: "正文色和背景色对比度不得低于 4.5:1。",
      decorative: "装饰 #778899 / #444444",
      highlight: "高亮 #C9A96E / #111111",
      surface: "卡片 #E8D5B7 / #222222",
      titleText: "标题 #123456 / #333333 / #111111",
      ...overrides.colorRoles
    }
  };
}

describe("slide visual colors", () => {
  it("extracts only palette HEX values from color role descriptions", () => {
    expect(resolveSlideVisualColors(buildColorSpec())).toMatchObject({
      accent: "#111111",
      background: "#222222",
      bodyText: "#333333",
      chart: "#111111",
      chartSeries: ["#111111", "#444444"],
      decorative: "#444444",
      highlight: "#111111",
      surface: "#222222",
      titleText: "#333333"
    });
  });

  it("falls back to the palette when role HEX colors are outside the palette", () => {
    expect(
      resolveSlideVisualColors(
        buildColorSpec({
          colorRoles: {
            accent: "强调色 #AA1100",
            background: "背景 #FAF8F0",
            bodyText: "正文 #223344",
            borderDivider: "边框 #778899",
            chart: "图表 #556677 与 #8899AA",
            decorative: "装饰 #778899",
            highlight: "高亮 #C9A96E",
            surface: "卡片 #E8D5B7",
            titleText: "标题 #123456"
          }
        })
      )
    ).toMatchObject({
      accent: "#EF4444",
      background: "#16A085",
      bodyText: "#3B82F6",
      borderDivider: "#16A085",
      chart: "#222222",
      chartSeries: ["#222222", "#333333", "#666666", "#777777", "#246BFE", "#5B8DFF"],
      decorative: "#555555",
      highlight: "#EF4444",
      surface: "#16A085",
      titleText: "#3B82F6"
    });
  });

  it("falls back to the palette when role descriptions do not contain HEX colors", () => {
    expect(
      resolveSlideVisualColors(
        buildColorSpec({
          colorPalette: buildColorPaletteFromHexes(
            [
              "#010203",
              "#0F766E",
              "#2563EB",
              "#010203",
              "#0F766E",
              "#2563EB",
              "#F59E0B",
              "#EF4444",
              "#8B5CF6",
              "#F0EEE9",
              "#111827",
              "#64748B",
              "#94A3B8",
              "#22C55E"
            ],
            "zh-CN"
          ),
          colorRoles: {
            accent: "强调色用于关键信息。",
            background: "背景用于大面积柔和底色。",
            bodyText: "正文用于主要信息。",
            borderDivider: "边框和分隔线。",
            chart: "图表主次序列。",
            decorative: "装饰用于线条。",
            highlight: "高亮用于聚焦。",
            surface: "卡片和信息分区。",
            titleText: "标题和结论句。"
          }
        })
      )
    ).toMatchObject({
      accent: "#16A085",
      background: "#94A3B8",
      bodyText: "#22C55E",
      chart: "#F59E0B",
      chartSeries: ["#F59E0B", "#EF4444", "#8B5CF6", "#F0EEE9", "#111827", "#64748B"],
      decorative: "#0F766E",
      highlight: "#16A085",
      surface: "#94A3B8",
      titleText: "#22C55E"
    });
  });

  it("uses safe defaults when neither role descriptions nor palette contain HEX colors", () => {
    expect(
      resolveSlideVisualColors(
        buildColorSpec({
          colorPalette: ["star-map", "soft", "text", "accent"] as unknown as UnifiedVisualSpec["colorPalette"],
          colorRoles: {
            accent: "强调色",
            background: "背景",
            bodyText: "正文",
            borderDivider: "边框",
            chart: "图表",
            decorative: "装饰",
            highlight: "高亮",
            surface: "卡片",
            titleText: "标题"
          }
        })
      )
    ).toMatchObject({
      accent: "#246BFE",
      background: "#F6F8FB",
      bodyText: "#334155",
      chart: "#246BFE",
      chartSeries: ["#246BFE", "#D9E7FF"],
      decorative: "#16A085",
      highlight: "#D9E7FF",
      surface: "#DBE8FF",
      titleText: "#17202A"
    });
  });
});
