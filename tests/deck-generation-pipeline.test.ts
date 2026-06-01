import { describe, expect, it, vi } from "vitest";

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
import type { AnalyzeDeckRequest, GeneratedSlideResult } from "@/lib/ai-deck/schema";
import { createDeckPptxBuffer } from "@/lib/decks/pptx";

const input: AnalyzeDeckRequest = {
  sourceText: "这是一段用于测试完整生成管线的长文本，包含市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 4,
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
