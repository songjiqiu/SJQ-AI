import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

import {
  MockImageLayerGenerator,
  OpenAIImageLayerGenerator
} from "@/lib/ai-deck/image-generator";
import {
  buildContentReview,
  buildConsistencyReport,
  buildSlideMotionPlan
} from "@/lib/ai-deck/postprocess";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import { buildColorPaletteFromHexes } from "@/lib/ai-deck/visual-spec-defaults";
import type { AnalyzeDeckRequest, GeneratedSlideResult } from "@/lib/ai-deck/schema";
import { createDeckPptxBuffer } from "@/lib/decks/pptx";

const input: AnalyzeDeckRequest = {
  sourceText: "这是一段用于测试完整生成管线的长文本，包含市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 6,
  deckType: "business-report",
  palette: "star-map",
  locale: "zh-CN"
};

describe("deck generation pipeline helpers", () => {
  it("generates mock image layers and builds a PPTX buffer", async () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const generator = new MockImageLayerGenerator();
    const imageAssets = [];
    const slides: GeneratedSlideResult[] = [];

    for (const slide of analyzed.slides) {
      const generatedImageLayers = [];

      for (const request of slide.imageLayerRequests) {
        const generated = await generator.generateLayer({
          request,
          slide,
          unifiedVisualSpec: analyzed.unifiedVisualSpec
        });
        const assetId = `${request.id}-asset`;

        imageAssets.push({
          assetId,
          bytes: generated.bytes,
          mimeType: generated.mimeType
        });
        generatedImageLayers.push({
          id: `${request.id}-layer`,
          requestId: request.id,
          elementId: request.elementId,
          assetId,
          provider: generated.provider,
          mimeType: generated.mimeType,
          url: `/api/decks/deck-1/assets/${assetId}`,
          prompt: request.prompt,
          width: generated.width,
          height: generated.height,
          transparentBackground: request.transparentBackground,
          visualNotes: request.visualNotes
        });
      }

      slides.push({
        ...slide,
        generatedImageLayers,
        motionPlan: buildSlideMotionPlan(slide)
      });
    }

    const review = buildContentReview(input, analyzed);
    const consistency = buildConsistencyReport(input, analyzed);
    const pptx = await createDeckPptxBuffer({
      deckSummary: analyzed.deckSummary,
      deckTitle: analyzed.deckTitle,
      imageAssets,
      slides,
      unifiedVisualSpec: analyzed.unifiedVisualSpec
    });

    expect(review.score).toBeGreaterThan(0);
    expect(consistency.score).toBeGreaterThan(0);
    expect(slides.some((slide) => slide.generatedImageLayers.length > 0)).toBe(
      true
    );
    expect(pptx.length).toBeGreaterThan(1000);
  });

  it("does not export decorative shape roles as visible PPT text", async () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const pptx = await createDeckPptxBuffer({
      deckSummary: analyzed.deckSummary,
      deckTitle: analyzed.deckTitle,
      imageAssets: [],
      slides: [
        {
          ...slide,
          elements: [
            ...slide.elements,
            {
              bounds: {
                height: 4.8,
                width: 5.2,
                x: 0.7,
                y: 0.7
              },
              editable: true,
              hierarchyLevel: 4,
              id: "decorative-mask",
              requiresImageGeneration: false,
              role: "左侧文字遮罩",
              semanticType: "accentShape",
              styleNotes: "装饰遮罩，不应导出角色文字。",
              type: "shape",
              zIndex: 2
            },
            {
              bounds: {
                height: 0.08,
                width: 1.8,
                x: 1.0,
                y: 4.7
              },
              editable: true,
              hierarchyLevel: 4,
              id: "title-emphasis-line",
              requiresImageGeneration: false,
              role: "标题强调线",
              semanticType: "accentShape",
              styleNotes: "标题强调线，不应导出角色文字。",
              type: "shape",
              zIndex: 3
            }
          ],
          generatedImageLayers: [],
          motionPlan: buildSlideMotionPlan(slide)
        }
      ],
      unifiedVisualSpec: analyzed.unifiedVisualSpec
    });
    const zip = await JSZip.loadAsync(pptx);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");

    expect(slideXml).toBeTruthy();
    expect(slideXml).not.toContain("左侧文字遮罩");
    expect(slideXml).not.toContain("标题强调线");
  });

  it("uses the unified visual spec palette when exporting PPTX shapes", async () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const pptx = await createDeckPptxBuffer({
      deckSummary: analyzed.deckSummary,
      deckTitle: analyzed.deckTitle,
      imageAssets: [],
      slides: [
        {
          ...slide,
          elements: [
            {
              bounds: {
                height: 0.7,
                width: 4.6,
                x: 0.8,
                y: 0.8
              },
              content: "色板标题",
              editable: true,
              hierarchyLevel: 1,
              id: "pptx-palette-title",
              requiresImageGeneration: false,
              role: "标题",
              semanticType: "title",
              styleNotes: "用于验证标题色。",
              type: "text",
              zIndex: 10
            },
            {
              bounds: {
                height: 1.2,
                width: 2.4,
                x: 0.9,
                y: 2.0
              },
              editable: true,
              hierarchyLevel: 3,
              id: "pptx-palette-shape",
              requiresImageGeneration: false,
              role: "色板形状",
              semanticType: "card",
              styleNotes: "用于验证形状填充色。",
              type: "shape",
              zIndex: 11
            },
            {
              bounds: {
                height: 1.5,
                width: 3.2,
                x: 4.0,
                y: 2.0
              },
              editable: true,
              hierarchyLevel: 2,
              id: "pptx-palette-chart",
              requiresImageGeneration: false,
              role: "色板图表",
              semanticType: "chart",
              styleNotes: "用于验证图表色。",
              type: "chartPlaceholder",
              zIndex: 12
            }
          ],
          generatedImageLayers: [],
          motionPlan: buildSlideMotionPlan(slide)
        }
      ],
      unifiedVisualSpec: {
        ...analyzed.unifiedVisualSpec,
        colorPalette: buildColorPaletteFromHexes(
          [
            "#AA1100",
            "#C9A96E",
            "#4A6B5D",
            "#AA1100",
            "#C9A96E",
            "#4A6B5D",
            "#2563EB",
            "#16A085",
            "#8B5CF6",
            "#F5F0E8",
            "#E8D5B7",
            "#123456",
            "#64748B",
            "#C9A96E"
          ],
          "zh-CN"
        ),
        colorRoles: {
          ...analyzed.unifiedVisualSpec.colorRoles,
          accent: "#AA1100 用于关键强调。",
          background: "#F5F0E8 用于页面背景。",
          bodyText: "#123456 用于正文。",
          borderDivider: "#E8D5B7 用于边框。",
          chart: "#AA1100 / #C9A96E 用于图表。",
          decorative: "#4A6B5D / #C9A96E 用于装饰。",
          highlight: "#C9A96E 用于高亮。",
          surface: "#E8D5B7 / #F5F0E8 用于卡片。",
          titleText: "#123456 用于标题。"
        }
      }
    });
    const zip = await JSZip.loadAsync(pptx);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");

    expect(slideXml).toBeTruthy();
    expect(slideXml).toContain('val="F5F0E8"');
    expect(slideXml).toContain('val="123456"');
    expect(slideXml).toContain('val="AA1100"');
    expect(slideXml).toContain('val="C9A96E"');
    expect(slideXml).toContain('val="E8D5B7"');
    expect(slideXml).not.toContain('val="556677"');
  });

  it("exports semantic asset styles without leaking icon role text", async () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const pptx = await createDeckPptxBuffer({
      deckSummary: analyzed.deckSummary,
      deckTitle: analyzed.deckTitle,
      imageAssets: [],
      slides: [
        {
          ...slide,
          elements: [
            {
              assetBinding: {
                assetId: "asset-text-style",
                kind: "TEXT_STYLE",
                name: "标题文本样式",
                setKey: "common",
                setKind: "COMMON"
              },
              assetStyle: {
                strokeColor: "#112233",
                textRole: "cover-title"
              },
              bounds: {
                height: 0.7,
                width: 4.6,
                x: 0.8,
                y: 0.8
              },
              content: "资产标题",
              editable: true,
              hierarchyLevel: 1,
              id: "pptx-asset-title",
              requiresImageGeneration: false,
              role: "标题",
              semanticType: "title",
              styleNotes: "用于验证资产文本色。",
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
              assetBinding: {
                assetId: "asset-line",
                kind: "LINE",
                name: "红色虚线",
                setKey: "common",
                setKind: "COMMON"
              },
              assetStyle: {
                dash: "dashed",
                lineType: "divider",
                strokeColor: "#AA1100",
                strokeWidth: 3
              },
              bounds: {
                height: 0.08,
                width: 2.4,
                x: 0.9,
                y: 1.8
              },
              editable: true,
              hierarchyLevel: 4,
              id: "pptx-asset-line",
              requiresImageGeneration: false,
              role: "资产线条",
              semanticType: "accentShape",
              styleNotes: "用于验证资产线条色。",
              type: "shape",
              zIndex: 11
            },
            {
              assetBinding: {
                assetId: "asset-icon",
                kind: "ICON",
                name: "不应导出的图标名",
                setKey: "common",
                setKind: "COMMON"
              },
              assetStyle: {
                iconName: "metric",
                strokeColor: "#16A085",
                strokeWidth: 2
              },
              bounds: {
                height: 0.44,
                width: 0.44,
                x: 3.6,
                y: 1.6
              },
              editable: true,
              hierarchyLevel: 4,
              id: "pptx-asset-icon",
              requiresImageGeneration: false,
              role: "不应导出的图标角色",
              semanticType: "icon",
              styleNotes: "用于验证图标不导出文字。",
              type: "icon",
              zIndex: 12
            }
          ],
          generatedImageLayers: [],
          motionPlan: buildSlideMotionPlan(slide)
        }
      ],
      unifiedVisualSpec: analyzed.unifiedVisualSpec
    });
    const zip = await JSZip.loadAsync(pptx);
    const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");

    expect(slideXml).toBeTruthy();
    expect(slideXml).not.toContain('val="112233"');
    expect(slideXml).not.toContain('val="AA1100"');
    expect(slideXml).toContain('val="16A085"');
    expect(slideXml).not.toContain("不应导出的图标名");
    expect(slideXml).not.toContain("不应导出的图标角色");
  });

  it("falls back to mock image layers when the image provider hangs", async () => {
    vi.useFakeTimers();

    try {
      const analyzed = buildMockAnalyzedDeck(input);
      const slide = analyzed.slides[0];
      const request = slide.imageLayerRequests[0];
      const client = {
        images: {
          generate: vi.fn(() => new Promise<never>(() => undefined))
        }
      };
      const generator = new OpenAIImageLayerGenerator({
        client,
        env: {
          AI_IMAGE_MODEL: "gpt-image-2",
          IMAGE_API_KEY: "test-key",
          IMAGE_REQUEST_TIMEOUT_MS: "10000"
        }
      });
      const generationPromise = generator.generateLayer({
        request,
        slide,
        unifiedVisualSpec: analyzed.unifiedVisualSpec
      });

      await vi.advanceTimersByTimeAsync(10_000);

      const generated = await generationPromise;

      expect(client.images.generate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          signal: expect.any(Object),
          timeout: 10_000
        })
      );
      expect(generated.provider).toBe("gpt-image-2-fallback-mock-svg");
      expect(generated.metadata.fallbackReason).toContain(
        "图片生成请求超过 10 秒未返回。"
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
