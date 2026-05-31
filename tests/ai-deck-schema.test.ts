import { describe, expect, it } from "vitest";

import {
  analyzedDeckResultSchema,
  confirmedDeckIntentSchema,
  deckOutlineIntentInputSchema,
  deckOutlineResultSchema,
  generatedDeckResultSchema,
  imageLayerRequestSchema,
  slideElementSchema
} from "@/lib/ai-deck/schema";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import {
  buildContentReview,
  buildConsistencyReport,
  buildSlideMotionPlan
} from "@/lib/ai-deck/postprocess";
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";

const input: AnalyzeDeckRequest = {
  sourceText: "这是一段用于测试 AI 拆页的长文本，包含市场、产品、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 3,
  deckType: "business-report",
  style: "strategic",
  palette: "star-map",
  locale: "zh-CN"
};

describe("ai deck schemas", () => {
  it("accepts initial outline input without audience, goal, or page count", () => {
    const parsed = deckOutlineIntentInputSchema.parse({
      idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
      deckType: "fundraising-pitch",
      style: "data",
      palette: "star-map",
      locale: "zh-CN"
    });

    expect(parsed.textFiles).toEqual([]);
    expect(parsed.deckType).toBe("fundraising-pitch");
  });

  it("requires confirmed intent page count to stay within 3 through 18", () => {
    expect(
      confirmedDeckIntentSchema.safeParse({
        deckType: "business-report",
        style: "strategic",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 2
      }).success
    ).toBe(false);
    expect(
      confirmedDeckIntentSchema.safeParse({
        deckType: "business-report",
        style: "strategic",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 18
      }).success
    ).toBe(true);
    expect(
      confirmedDeckIntentSchema.safeParse({
        deckType: "business-report",
        style: "strategic",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 19
      }).success
    ).toBe(false);
  });

  it("accepts the local fallback deck result", () => {
    const result = buildMockAnalyzedDeck(input);

    expect(analyzedDeckResultSchema.parse(result).slides).toHaveLength(3);
    expect(result.deckTitle).toContain("商务汇报");
  });

  it("rejects elements that overflow the 0-100 canvas", () => {
    const element = {
      id: "slide-1-title",
      type: "text",
      role: "标题",
      content: "标题",
      bounds: { x: 90, y: 10, width: 20, height: 10 },
      zIndex: 1,
      styleNotes: "大号标题",
      requiresImageGeneration: false
    };

    expect(slideElementSchema.safeParse(element).success).toBe(false);
  });

  it("requires generated image elements to reference image requests", () => {
    const element = {
      id: "slide-1-image",
      type: "generatedImage",
      role: "主视觉",
      bounds: { x: 50, y: 10, width: 30, height: 30 },
      zIndex: 2,
      styleNotes: "透明背景",
      requiresImageGeneration: true
    };

    expect(slideElementSchema.safeParse(element).success).toBe(false);
  });

  it("accepts future image layer request metadata", () => {
    expect(
      imageLayerRequestSchema.safeParse({
        id: "slide-1-image-main",
        elementId: "slide-1-image",
        purpose: "生成主视觉透明图层",
        prompt: "生成适合 PPT 页面使用的透明背景主视觉图层",
        negativePrompt: "不要文字、不要水印、不要复杂背景",
        transparentBackground: true,
        aspectRatio: "16:9",
        visualNotes: "产品级视觉素材"
      }).success
    ).toBe(true);
  });

  it("accepts generated deck results with layers, motion, review, and consistency", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const result = {
      id: "deck-1",
      mode: analyzed.mode,
      status: "READY",
      deckTitle: analyzed.deckTitle,
      deckSummary: analyzed.deckSummary,
      input,
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      contentReview: buildContentReview(input, analyzed),
      consistencyReport: buildConsistencyReport(input, analyzed),
      slides: analyzed.slides.map((slide) => ({
        ...slide,
        generatedImageLayers: slide.imageLayerRequests.map((request) => ({
          id: `${request.id}-layer`,
          requestId: request.id,
          elementId: request.elementId,
          assetId: `${request.id}-asset`,
          provider: "mock-svg",
          mimeType: "image/svg+xml",
          url: `/api/decks/deck-1/assets/${request.id}-asset`,
          prompt: request.prompt,
          width: 1280,
          height: 720,
          transparentBackground: request.transparentBackground,
          visualNotes: request.visualNotes
        })),
        motionPlan: buildSlideMotionPlan(slide)
      })),
      pptxUrl: "/api/decks/deck-1/pptx",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expect(generatedDeckResultSchema.parse(result).slides).toHaveLength(3);
  });

  it("accepts 18-slide outline and generated deck results", () => {
    const longInput: AnalyzeDeckRequest = {
      ...input,
      pageCount: 18
    };
    const analyzed = buildMockAnalyzedDeck(longInput);
    const generated = {
      id: "deck-18",
      mode: analyzed.mode,
      status: "READY",
      deckTitle: analyzed.deckTitle,
      deckSummary: analyzed.deckSummary,
      input: longInput,
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      contentReview: buildContentReview(longInput, analyzed),
      consistencyReport: buildConsistencyReport(longInput, analyzed),
      slides: analyzed.slides.map((slide) => ({
        ...slide,
        generatedImageLayers: [],
        motionPlan: buildSlideMotionPlan(slide)
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expect(
      deckOutlineResultSchema.parse({
        mode: analyzed.mode,
        deckTitle: analyzed.deckTitle,
        deckSummary: analyzed.deckSummary,
        unifiedVisualSpec: analyzed.unifiedVisualSpec,
        slides: analyzed.slides.map((slide) => slide.content)
      }).slides
    ).toHaveLength(18);
    expect(generatedDeckResultSchema.parse(generated).slides).toHaveLength(18);
  });
});
