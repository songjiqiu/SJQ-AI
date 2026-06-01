import { describe, expect, it } from "vitest";

import {
  analyzedDeckResultSchema,
  confirmedDeckIntentSchema,
  deckIntentAnalysisResultSchema,
  deckPageCopyResultSchema,
  deckOutlineIntentInputSchema,
  deckOutlineResultSchema,
  deckStructureOutlineResultSchema,
  generatedDeckResultSchema,
  imageLayerRequestSchema,
  semanticSlidePlanSchema,
  slideLayoutTypeSchema,
  slideCompositionPlanSchema,
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
    expect(parsed).not.toHaveProperty("style");
  });

  it("accepts optional user-specified page count in initial outline input", () => {
    const parsed = deckOutlineIntentInputSchema.parse({
      idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
      deckType: "fundraising-pitch",
      style: "data",
      palette: "star-map",
      locale: "zh-CN",
      pageCount: 8
    });

    expect(parsed.pageCount).toBe(8);
    expect(parsed).not.toHaveProperty("style");
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

  it("requires first-round structure outline to match recommended page count", () => {
    const analysis = {
      input: {
        idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
        sourceText: "",
        textFiles: [],
        deckType: "fundraising-pitch",
        style: "data",
        palette: "star-map",
        locale: "zh-CN",
        pageCount: 3
      },
      fileSummaries: [],
      deckType: "fundraising-pitch",
      audience: "投资人",
      goal: "获得试点合作意向",
      coreMessage: "用市场机会与试点成果证明合作价值。",
      recommendedPageCount: 3,
      structureOutline: {
        deckTitle: "新能源融资路演",
        deckSummary: "这是一份用于确认结构的大纲草稿。",
        slides: [1, 2, 3].map((index) => ({
          slideId: `slide-${index}`,
          index,
          title: `第 ${index} 页`,
          purpose: `说明第 ${index} 页的表达目的。`,
          keyMessage: `第 ${index} 页核心观点。`,
          visualDirection: "使用清晰主视觉配合文字信息。"
        }))
      }
    };

    expect(deckIntentAnalysisResultSchema.parse(analysis).recommendedPageCount).toBe(3);
    expect(deckIntentAnalysisResultSchema.parse(analysis)).not.toHaveProperty("style");
    expect(deckIntentAnalysisResultSchema.parse(analysis).input).not.toHaveProperty("style");
    expect(
      deckIntentAnalysisResultSchema.safeParse({
        ...analysis,
        recommendedPageCount: 4
      }).success
    ).toBe(false);
  });

  it("accepts the local fallback deck result", () => {
    const result = buildMockAnalyzedDeck(input);

    expect(analyzedDeckResultSchema.parse(result).slides).toHaveLength(3);
    expect(result.deckTitle).toContain("商务汇报");
    expect(result.slides[0].pageIntent).toMatchObject({
      contentDensity: expect.any(String),
      pageRole: expect.any(String),
      primaryGoal: expect.any(String)
    });
    expect(result.slides[0].contentHierarchy.tiers.map((tier) => tier.level)).toEqual([
      1,
      2,
      3
    ]);
    expect(result.slides[0].layoutSelection.candidates).toHaveLength(3);
    expect(result.slides[0].layoutSelection.selectedLayoutType).toBe(
      "cover-title"
    );
    expect(result.slides[0].constraints).toMatchObject({
      coreMessagePresent: true,
      maxHeroVisuals: 1,
      safeMargin: {
        unit: "inch",
        value: 0.5
      },
      titleUnique: true
    });
    expect(result.slides[0].designQualityScore.totalScore).toBeGreaterThan(0);
    expect(result.slides[0].semanticElements.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the fixed preview layout type contract", () => {
    const layoutTypes = [
      "chapter",
      "cover-title",
      "title-body-points",
      "big-image-background",
      "left-image-right-text",
      "left-text-right-image",
      "left-text-right-chart",
      "big-chart",
      "two-column-compare",
      "quote",
      "time-axis",
      "process-steps",
      "key-metrics",
      "quadrant-matrix",
      "ending"
    ];

    for (const layoutType of layoutTypes) {
      expect(slideLayoutTypeSchema.safeParse(layoutType).success).toBe(true);
    }

    expect(slideLayoutTypeSchema.safeParse("unknown-template").success).toBe(false);
  });

  it("requires semantic slide plans to include page intent and three content tiers", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const semanticPlan = {
      slideId: slide.slideId,
      index: slide.index,
      content: slide.content,
      pageIntent: slide.pageIntent,
      contentHierarchy: slide.contentHierarchy,
      layoutSelection: slide.layoutSelection,
      constraints: slide.constraints,
      expressionIntent: slide.expressionIntent,
      designPlan: slide.designPlan,
      layoutDiagnostics: slide.layoutDiagnostics,
      semanticElements: slide.semanticElements
    };

    expect(semanticSlidePlanSchema.parse(semanticPlan).pageIntent).toMatchObject({
      contentDensity: slide.pageIntent.contentDensity,
      pageRole: slide.pageIntent.pageRole
    });
    expect(
      semanticSlidePlanSchema.safeParse({
        ...semanticPlan,
        contentHierarchy: {
          ...slide.contentHierarchy,
          tiers: slide.contentHierarchy.tiers.slice(0, 2)
        }
      }).success
    ).toBe(false);
  });

  it("rejects semantic elements that include coordinates", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const semanticPlan = {
      slideId: slide.slideId,
      index: slide.index,
      content: slide.content,
      pageIntent: slide.pageIntent,
      contentHierarchy: slide.contentHierarchy,
      layoutSelection: slide.layoutSelection,
      constraints: slide.constraints,
      expressionIntent: slide.expressionIntent,
      designPlan: slide.designPlan,
      layoutDiagnostics: slide.layoutDiagnostics,
      semanticElements: [
        {
          ...slide.semanticElements[0],
          bounds: { x: 0, y: 0, width: 1, height: 1 }
        },
        ...slide.semanticElements.slice(1)
      ]
    };

    expect(semanticSlidePlanSchema.safeParse(semanticPlan).success).toBe(false);
  });

  it("requires final slide composition plans to keep semantic metadata", () => {
    const analyzed = buildMockAnalyzedDeck(input);

    expect(slideCompositionPlanSchema.parse(analyzed.slides[0]).pageIntent).toEqual(
      analyzed.slides[0].pageIntent
    );
    expect(
      slideCompositionPlanSchema.safeParse({
        ...analyzed.slides[0],
        constraints: {
          ...analyzed.slides[0].constraints,
          titleUnique: false
        }
      }).success
    ).toBe(false);
    expect(
      slideCompositionPlanSchema.safeParse({
        ...analyzed.slides[0],
        elements: analyzed.slides[0].elements.filter(
          (element) => element.semanticType !== "title"
        )
      }).success
    ).toBe(false);
  });

  it("keeps structure outline and page copy visual spec responsibilities separate", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const structure = {
      deckType: input.deckType,
      deckTitle: analyzed.deckTitle,
      deckSummary: analyzed.deckSummary,
      slides: analyzed.slides.map((slide) => ({
        slideId: slide.slideId,
        index: slide.index,
        title: slide.content.title,
        purpose: slide.content.speakerGoal,
        keyMessage: slide.content.bodyPoints[0],
        visualDirection: slide.content.visualIntent
      }))
    };
    const pageCopy = {
      deckType: input.deckType,
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      slides: analyzed.slides.map((slide) => slide.content)
    };

    expect(deckStructureOutlineResultSchema.parse(structure).slides).toHaveLength(3);
    expect(deckStructureOutlineResultSchema.parse({
      ...structure,
      style: "legacy"
    })).not.toHaveProperty("style");
    expect(
      deckStructureOutlineResultSchema.parse({
        ...structure,
        unifiedVisualSpec: analyzed.unifiedVisualSpec
      })
    ).not.toHaveProperty("unifiedVisualSpec");
    expect(deckPageCopyResultSchema.parse(pageCopy).unifiedVisualSpec).toEqual(
      analyzed.unifiedVisualSpec
    );
    expect(
      deckPageCopyResultSchema.safeParse({
        deckType: input.deckType,
        slides: analyzed.slides.map((slide) => slide.content)
      }).success
    ).toBe(false);
  });

  it("requires unified visual specs to include structured page, typography, color, and image rules", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const parsed = deckPageCopyResultSchema.parse({
      deckType: input.deckType,
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      slides: analyzed.slides.map((slide) => slide.content)
    });

    expect(parsed.unifiedVisualSpec.colorPalette).toEqual(
      analyzed.unifiedVisualSpec.colorPalette
    );
    expect(parsed.unifiedVisualSpec.themeName).not.toMatch(/星图|Star Map/i);
    expect(parsed.unifiedVisualSpec.pageSpec).toMatchObject({
      aspectRatio: "16:9",
      gridColumns: 12,
      height: 7.5,
      safeMargin: 0.5,
      unit: "inch",
      width: 13.333
    });
    expect(parsed.unifiedVisualSpec.typographyRules).toMatchObject({
      defaultFontSize: 15,
      lineHeight: 1.25,
      maxLines: 8,
      minFontSize: 8
    });
    expect(parsed.unifiedVisualSpec.typographyRules.scale.coverTitle).toMatchObject({
      fontSize: 36,
      fontWeight: "bold"
    });
    expect(parsed.unifiedVisualSpec.colorRoles.contrastRequirement).toContain(
      "4.5:1"
    );
    expect(parsed.unifiedVisualSpec.colorRoles.chart).toContain("#");
    expect(parsed.unifiedVisualSpec.colorRoles.surface).toContain("#");
    expect(parsed.unifiedVisualSpec.colorRoles.titleText).toContain("#");
    expect(parsed.unifiedVisualSpec.imageRules).toMatchObject({
      backgroundAvoidsHighContrastTextArea: true,
      subjectAvoidsTitleArea: true
    });
    expect(parsed.unifiedVisualSpec.pptTypeVisualTone).toMatchObject({
      deckType: "business-report",
      deckTypeName: "商务汇报",
      recommendedTone: "克制、可信、有层级"
    });
    expect(parsed.unifiedVisualSpec.pptTypeVisualTone.visualKeywords).toEqual(
      expect.arrayContaining(["数据图表", "结论先行"])
    );
    expect(parsed.unifiedVisualSpec).not.toHaveProperty("colorRoleDefinitions");
    expect(parsed.unifiedVisualSpec).not.toHaveProperty("typographyScale");
    expect(parsed.unifiedVisualSpec.informationDensityRules.defaultLevel).toBe(
      "medium"
    );
    expect(parsed.unifiedVisualSpec.chartVisualRules.sourceNotes).toContain(
      "来源"
    );
    expect(parsed.unifiedVisualSpec.iconStyleRules.style).toBe("line");
    expect(parsed.unifiedVisualSpec.forbiddenVisualRules.join(" ")).toContain(
      "高饱和"
    );
  });

  it("requires slide copy to include structured narrative metadata", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0].content;

    expect(deckPageCopyResultSchema.parse({
      deckType: input.deckType,
      style: "legacy",
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      slides: analyzed.slides.map((item) => item.content)
    })).not.toHaveProperty("style");
    expect(deckPageCopyResultSchema.parse({
      deckType: input.deckType,
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      slides: analyzed.slides.map((item) => item.content)
    }).slides[0]).toMatchObject({
      coreStatement: expect.any(String),
      narrativeRole: "setup",
      contentLayers: expect.objectContaining({
        primary: expect.any(Array),
        supporting: expect.any(Array)
      }),
      slideTransition: expect.objectContaining({
        fromPrevious: expect.any(String),
        toNext: expect.any(String)
      }),
      sourceRequirement: expect.objectContaining({
        categories: expect.arrayContaining(["user-input"])
      }),
      contentBoundary: expect.objectContaining({
        outOfScope: expect.any(Array)
      })
    });
    expect(
      deckPageCopyResultSchema.safeParse({
        deckType: input.deckType,
        unifiedVisualSpec: analyzed.unifiedVisualSpec,
        slides: [
          {
            slideId: slide.slideId,
            index: slide.index,
            title: slide.title,
            bodyPoints: slide.bodyPoints,
            speakerGoal: slide.speakerGoal,
            visualIntent: slide.visualIntent
          },
          ...analyzed.slides.slice(1).map((item) => item.content)
        ]
      }).success
    ).toBe(false);
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

  it("accepts generated text elements with nine max lines", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const result = {
      id: "deck-max-lines-9",
      mode: analyzed.mode,
      status: "READY",
      deckTitle: analyzed.deckTitle,
      deckSummary: analyzed.deckSummary,
      input,
      unifiedVisualSpec: analyzed.unifiedVisualSpec,
      contentReview: buildContentReview(input, analyzed),
      consistencyReport: buildConsistencyReport(input, analyzed),
      slides: analyzed.slides.map((slide, slideIndex) => ({
        ...slide,
        elements: slide.elements.map((element, elementIndex) =>
          slideIndex === 0 &&
          elementIndex === 0 &&
          element.type === "text" &&
          element.textStyle
            ? {
                ...element,
                textStyle: {
                  ...element.textStyle,
                  maxLines: 9
                }
              }
            : element
        ),
        generatedImageLayers: [],
        motionPlan: buildSlideMotionPlan(slide)
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expect(
      generatedDeckResultSchema.parse(result).slides[0].elements[0].textStyle
        ?.maxLines
    ).toBe(9);
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
