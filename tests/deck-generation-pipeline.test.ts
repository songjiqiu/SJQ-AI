import { describe, expect, it } from "vitest";

import { MockImageLayerGenerator } from "@/lib/ai-deck/image-generator";
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
  pageCount: 4,
  deckType: "business-report",
  style: "strategic",
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
});
