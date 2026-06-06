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
  lightweightOutlineSchema,
  semanticSlidePlanSchema,
  slideLayoutTypeSchema,
  slideCompositionPlanSchema,
  slideElementSchema,
  unifiedVisualSpecSchema
} from "@/lib/ai-deck/schema";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import {
  buildContentReview,
  buildConsistencyReport,
  buildSlideDesignQualityScore,
  normalizeSlideCompositionPlan,
  buildSlideMotionPlan
} from "@/lib/ai-deck/postprocess";
import {
  bindElementsToContentBlocks,
  getMissingContentBlockIndexes,
  resolveSlideContentBlockBindings
} from "@/lib/ai-deck/content-block-bindings";
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";

const input: AnalyzeDeckRequest = {
  sourceText: "这是一段用于测试 AI 拆页的长文本，包含市场、产品、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 6,
  deckType: "business-report",
  palette: "star-map",
  locale: "zh-CN"
};

function layerAllContentBlocks(length: number) {
  return {
    primary: [0],
    supporting: Array.from(
      { length: Math.min(6, Math.max(0, length - 1)) },
      (_, index) => index + 1
    ),
    supplementary: Array.from(
      { length: Math.min(5, Math.max(0, length - 7)) },
      (_, index) => index + 7
    )
  };
}

function buildLightweightOutline(overrides: Record<string, unknown> = {}) {
  const pageCount = 6;

  return {
    deckTitle: "新能源融资路演",
    deckType: "fundraising-pitch",
    narrativeStyle: "proposal-persuasive",
    pageCount,
    globalTheme: {
      objective: "围绕市场机会、试点成果和合作路径组织融资路演。",
      theme: "新能源融资路演"
    },
    chapters: [
      {
        chapterId: "chapter-1",
        pageRange: {
          end: pageCount,
          start: 1
        },
        purpose: "完整组织路演结构，先建立机会，再证明价值，最后收束行动。",
        title: "整体结构"
      }
    ],
    pages: Array.from({ length: pageCount }, (_, index) => {
      const pageNumber = index + 1;

      return {
        chapterId: "chapter-1",
        keyMessage: `第 ${pageNumber} 页核心观点。`,
        layoutType:
          pageNumber === 1
            ? "cover-title"
            : pageNumber === pageCount
              ? "ending"
              : "title-body-points",
        narrativeRole:
          pageNumber === 1
            ? "setup"
            : pageNumber === pageCount
              ? "call-to-action"
              : "argument",
        pageNumber,
        pageType:
          pageNumber === 1
            ? "cover"
            : pageNumber === pageCount
              ? "summary"
              : "content",
        purpose: `说明第 ${pageNumber} 页的表达目的。`,
        sourceIds: [],
        title: `第 ${pageNumber} 页`
      };
    }),
    ...overrides
  };
}

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

  it("requires confirmed intent page count to stay within 6 through 40", () => {
    expect(
      confirmedDeckIntentSchema.safeParse({
        deckType: "business-report",
        style: "strategic",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 5
      }).success
    ).toBe(false);
    expect(
      confirmedDeckIntentSchema.safeParse({
        deckType: "business-report",
        style: "strategic",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 40
      }).success
    ).toBe(true);
    expect(
      confirmedDeckIntentSchema.safeParse({
        deckType: "business-report",
        style: "strategic",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 41
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
        pageCount: 6
      },
      fileSummaries: [],
      deckType: "fundraising-pitch",
      audience: "投资人",
      goal: "获得试点合作意向",
      coreMessage: "用市场机会与试点成果证明合作价值。",
      recommendedPageCount: 6,
      structureOutline: {
        deckTitle: "新能源融资路演",
        deckSummary: "这是一份用于确认结构的大纲草稿。",
        slides: Array.from({ length: 6 }, (_, index) => index + 1).map((index) => ({
          slideId: `slide-${index}`,
          index,
          title: `第 ${index} 页`,
          purpose: `说明第 ${index} 页的表达目的。`,
          keyMessage: `第 ${index} 页核心观点。`,
          visualDirection: "使用清晰主视觉配合文字信息。"
        }))
      }
    };

    expect(deckIntentAnalysisResultSchema.parse(analysis).recommendedPageCount).toBe(6);
    expect(deckIntentAnalysisResultSchema.parse(analysis)).not.toHaveProperty("style");
    expect(deckIntentAnalysisResultSchema.parse(analysis).input).not.toHaveProperty("style");
    expect(
      deckIntentAnalysisResultSchema.safeParse({
        ...analysis,
        recommendedPageCount: 7
      }).success
    ).toBe(false);
  });

  it("validates the lightweight outline contract and rejects L4/L5 fields", () => {
    expect(lightweightOutlineSchema.parse(buildLightweightOutline()).pages).toHaveLength(6);

    expect(
      lightweightOutlineSchema.safeParse(
        buildLightweightOutline({
          pageCount: 7
        })
      ).success
    ).toBe(false);
    expect(
      lightweightOutlineSchema.safeParse(
        buildLightweightOutline({
          pages: buildLightweightOutline().pages.map((page, index) =>
            index === 2 ? { ...page, pageNumber: 2 } : page
          )
        })
      ).success
    ).toBe(false);
    expect(
      lightweightOutlineSchema.safeParse(
        buildLightweightOutline({
          chapters: [
            {
              chapterId: "chapter-1",
              pageRange: {
                end: 4,
                start: 1
              },
              purpose: "覆盖前半部分页面。",
              title: "前半部分"
            },
            {
              chapterId: "chapter-2",
              pageRange: {
                end: 6,
                start: 4
              },
              purpose: "覆盖后半部分页面。",
              title: "后半部分"
            }
          ]
        })
      ).success
    ).toBe(false);
    expect(
      lightweightOutlineSchema.safeParse(
        buildLightweightOutline({
          pages: buildLightweightOutline().pages.map((page, index) =>
            index === 1
              ? {
                  ...page,
                  layoutType: "unknown-template"
                }
              : page
          )
        })
      ).success
    ).toBe(false);
    expect(
      lightweightOutlineSchema.safeParse(
        buildLightweightOutline({
          pages: buildLightweightOutline().pages.map((page, index) =>
            index === 1
              ? {
                  ...page,
                  contentBlocks: []
                }
              : page
          )
        })
      ).success
    ).toBe(false);
  });

  it("validates lightweight outline sourceIds against input sources", () => {
    const base = {
      input: {
        idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
        sourceText: "",
        textFiles: [],
        deckType: "fundraising-pitch",
        palette: "star-map",
        locale: "zh-CN",
        pageCount: 6,
        sources: [
          {
            chunkIndex: 1,
            fileId: "src_f001",
            fileName: "brief.md",
            kind: "text",
            label: "brief.md",
            sourceId: "src_f001_c001",
            text: "试点数据：转化率提升 20%。"
          }
        ]
      },
      fileSummaries: [],
      deckType: "fundraising-pitch",
      audience: "投资人",
      goal: "获得试点合作意向",
      coreMessage: "用市场机会与试点成果证明合作价值。",
      recommendedPageCount: 6,
      lightweightOutline: buildLightweightOutline({
        pages: buildLightweightOutline().pages.map((page, index) =>
          index === 1
            ? {
                ...page,
                sourceIds: ["src_f001_c001"]
              }
            : page
        )
      })
    };

    expect(deckIntentAnalysisResultSchema.safeParse(base).success).toBe(true);
    expect(
      deckIntentAnalysisResultSchema.safeParse({
        ...base,
        lightweightOutline: buildLightweightOutline({
          pages: buildLightweightOutline().pages.map((page, index) =>
            index === 1
              ? {
                  ...page,
                  sourceIds: ["src_missing"]
                }
              : page
          )
        })
      }).success
    ).toBe(false);
  });

  it("accepts the local fallback deck result", () => {
    const result = buildMockAnalyzedDeck(input);

    expect(analyzedDeckResultSchema.parse(result).slides).toHaveLength(input.pageCount);
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

  it("accepts slide elements bound to display content blocks", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const titleElement = analyzed.slides[0].elements.find(
      (element) => element.semanticType === "title"
    );

    expect(titleElement).toBeDefined();
    expect(
      slideElementSchema.safeParse({
        ...titleElement,
        contentBlockIndex: 0
      }).success
    ).toBe(true);
  });

  it("adds display content block bindings to generated mock text elements", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const firstSlide = analyzed.slides[0];
    const titleElement = firstSlide.elements.find(
      (element) => element.semanticType === "title"
    );
    const boundTextElements = firstSlide.elements.filter(
      (element) => element.type === "text" && element.contentBlockIndex !== undefined
    );

    expect(titleElement?.contentBlockIndex).toBe(0);
    expect(boundTextElements.length).toBeGreaterThan(0);
    for (const element of boundTextElements) {
      expect(firstSlide.content.contentBlocks[element.contentBlockIndex ?? -1]).toBeDefined();
    }
  });

  it("infers missing display content block bindings for legacy slide elements", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const legacySlide = {
      ...analyzed.slides[0],
      elements: analyzed.slides[0].elements.map((element) => {
        const legacyElement = { ...element };

        delete legacyElement.contentBlockIndex;

        return legacyElement;
      })
    };
    const normalized = normalizeSlideCompositionPlan(legacySlide);
    const titleElement = normalized.elements.find(
      (element) => element.semanticType === "title"
    );

    expect(titleElement?.contentBlockIndex).toBe(0);
    expect(
      bindElementsToContentBlocks(legacySlide).some(
        (element) => element.contentBlockIndex !== undefined
      )
    ).toBe(true);
  });

  it("completes generated elements for every display content block", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const denseBlocks = [
      {
        blockType: "title" as const,
        priority: 1,
        text: slide.content.title
      },
      {
        blockType: "conclusion" as const,
        priority: 1,
        text: "核心结论必须单独落版"
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        blockType: "body" as const,
        priority: Math.min(5, index + 2),
        text: `第 ${index + 1} 个可展示内容块`
      }))
    ];
    const normalized = normalizeSlideCompositionPlan(
      {
        ...slide,
        content: {
          ...slide.content,
          bodyPoints: denseBlocks.slice(2, 7).map((block) => block.text),
          contentBlocks: denseBlocks,
          contentLayers: layerAllContentBlocks(denseBlocks.length)
        },
        elements: slide.elements.map((element) =>
          element.type === "text" && element.semanticType === "body"
            ? {
                ...element,
                content: denseBlocks.slice(2).map((block) => block.text).join("\n"),
                contentBlockIndex: undefined
              }
            : {
                ...element,
                contentBlockIndex: undefined
              }
        )
      },
      {
        completeContentBlocks: true
      }
    );
    const bindings = resolveSlideContentBlockBindings(normalized);

    expect(getMissingContentBlockIndexes(normalized)).toEqual([]);
    expect(bindings.elementIdByContentBlockIndex.size).toBe(denseBlocks.length);
    expect(normalized.elements.length).toBeLessThanOrEqual(24);
    expect(slideCompositionPlanSchema.safeParse(normalized).success).toBe(true);
  });

  it("deduplicates legacy content blocks and remaps generated element bindings", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const titleElement = slide.elements.find(
      (element) => element.semanticType === "title"
    )!;
    const authorElement = {
      ...titleElement,
      id: `${slide.slideId}-cb-2`,
      content: "作者：柳宗元（唐）",
      contentBlockIndex: 1,
      role: "可展示正文 2",
      semanticType: "body" as const,
      styleNotes: "由可展示内容补齐层生成，确保内容块可在画布和元素编排中选择。",
      zIndex: 37
    };
    const duplicateAuthorElement = {
      ...authorElement,
      id: `${slide.slideId}-cb-3`,
      content: "柳宗元（唐）",
      contentBlockIndex: 2,
      zIndex: 38
    };
    const coursewareElement = {
      ...authorElement,
      id: `${slide.slideId}-cb-4`,
      content: "统编版八年级下册 文言文精讲课件。",
      contentBlockIndex: 3,
      zIndex: 39
    };
    const duplicateCoursewareElement = {
      ...authorElement,
      id: `${slide.slideId}-cb-5`,
      content: "初中语文精品课件",
      contentBlockIndex: 4,
      zIndex: 40
    };
    const normalized = normalizeSlideCompositionPlan(
      {
        ...slide,
        content: {
          ...slide.content,
          pageType: "cover",
          contentBlocks: [
            {
              blockType: "title" as const,
              priority: 1,
              text: "小石潭记",
              type: "heading" as const
            },
            {
              blockType: "body" as const,
              priority: 2,
              text: "作者：柳宗元（唐）",
              type: "text" as const
            },
            {
              blockType: "note" as const,
              priority: 3,
              text: "柳宗元（唐）",
              type: "source" as const
            },
            {
              blockType: "conclusion" as const,
              priority: 1,
              text: "统编版八年级下册 文言文精讲课件。",
              type: "conclusion" as const
            },
            {
              blockType: "note" as const,
              priority: 5,
              text: "初中语文精品课件",
              type: "source" as const
            }
          ]
        },
        elements: [
          titleElement,
          authorElement,
          duplicateAuthorElement,
          coursewareElement,
          duplicateCoursewareElement
        ],
        imageLayerRequests: [],
        designPlan: {
          ...slide.designPlan,
          readingOrder: [
            titleElement.id,
            authorElement.id,
            duplicateAuthorElement.id,
            coursewareElement.id,
            duplicateCoursewareElement.id
          ]
        }
      },
      {
        completeContentBlocks: true
      }
    );
    const texts = normalized.content.contentBlocks.map((block) => block.text);

    expect(texts.filter((text) => text.includes("柳宗元"))).toEqual([
      "作者：柳宗元（唐）"
    ]);
    expect(texts.filter((text) => /课件|统编版/.test(text))).toHaveLength(1);
    expect(
      normalized.elements.some((element) => element.id === duplicateAuthorElement.id)
    ).toBe(false);
    expect(
      normalized.elements.some((element) => element.id === duplicateCoursewareElement.id)
    ).toBe(false);
    expect(
      normalized.elements.find((element) => element.id === coursewareElement.id)
        ?.contentBlockIndex
    ).toBe(2);
    expect(normalized.designPlan.readingOrder).not.toContain(
      duplicateAuthorElement.id
    );
    expect(slideCompositionPlanSchema.safeParse(normalized).success).toBe(true);
  });

  it("reports incomplete display content placement in design quality scoring", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const unplacedBlock = {
      blockType: "body" as const,
      priority: 3,
      text: "没有对应元素的可展示内容"
    };
    const score = buildSlideDesignQualityScore({
      ...slide,
      content: {
        ...slide.content,
        contentBlocks: [...slide.content.contentBlocks, unplacedBlock]
      },
      elements: slide.elements.filter(
        (element) =>
          element.semanticType !== "body" &&
          element.semanticType !== "card" &&
          element.semanticType !== "subtitle"
      )
    });

    expect(score.issues.join(" ")).toContain("页面可展示内容未完全落版");
    expect(score.suggestions.join(" ")).toContain("可展示内容块");
    expect(score.dimensions.expressionCompleteness.summary).toBe(
      "部分可展示内容未落版。"
    );
  });

  it("prefers explicit display content block bindings over text inference", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const titleElement = slide.elements.find(
      (element) => element.semanticType === "title"
    );
    const explicitTitleBlockIndex = slide.content.contentBlocks.length;

    expect(titleElement).toBeDefined();

    const bindings = resolveSlideContentBlockBindings({
      ...slide,
      content: {
        ...slide.content,
        contentBlocks: [
          ...slide.content.contentBlocks,
          {
            blockType: "title",
            priority: 1,
            text: "备用标题块"
          }
        ]
      },
      elements: slide.elements.map((element) =>
        element.id === titleElement?.id
          ? {
              ...element,
              contentBlockIndex: explicitTitleBlockIndex
            }
          : element
      )
    });

    expect(
      bindings.contentBlockIndexByElementId.get(titleElement?.id ?? "")
    ).toBe(explicitTitleBlockIndex);
  });

  it("infers legacy display content bindings from matching text", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const titleSource = slide.elements.find(
      (element) => element.semanticType === "title"
    )!;
    const legacySlide = {
      ...slide,
        content: {
          ...slide.content,
          contentLayers: layerAllContentBlocks(5),
          contentBlocks: [
            {
            blockType: "title" as const,
            priority: 1,
            text: slide.content.title
          },
          {
            blockType: "body" as const,
            priority: 2,
            text: "唯一正文匹配"
          },
          {
            blockType: "conclusion" as const,
            priority: 1,
            text: slide.content.coreStatement
          }
        ]
      },
      elements: [
        {
          ...titleSource,
          contentBlockIndex: undefined
        },
        {
          ...titleSource,
          bounds: {
            ...titleSource.bounds,
            y: titleSource.bounds.y + 1
          },
          content: "唯一正文匹配",
          contentBlockIndex: undefined,
          id: "legacy-body-match",
          role: "旧版正文",
          semanticType: "body" as const
        }
      ]
    };
    const titleElement = legacySlide.elements.find(
      (element) => element.semanticType === "title"
    );
    const bindings = resolveSlideContentBlockBindings(legacySlide);

    expect(bindings.contentBlockIndexByElementId.get(titleElement?.id ?? "")).toBe(0);
    expect(bindings.elementIdByContentBlockIndex.get(0)).toBe(titleElement?.id);
    expect(bindings.contentBlockIndexByElementId.get("legacy-body-match")).toBe(1);
    expect(bindings.elementIdByContentBlockIndex.get(1)).toBe("legacy-body-match");
  });

  it("keeps explicit image content block bindings for generated image elements", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const imageElement = slide.elements.find(
      (element) => element.type === "generatedImage"
    );
    const imageBlockIndex = slide.content.contentBlocks.length;

    expect(imageElement).toBeDefined();

    const imageBoundSlide = {
      ...slide,
      content: {
        ...slide.content,
        contentBlocks: [
          ...slide.content.contentBlocks,
          {
            blockType: "note" as const,
            content: "主视觉图片说明",
            priority: 3,
            sourceIds: [],
            text: "主视觉图片说明",
            type: "image" as const
          }
        ]
      },
      elements: slide.elements.map((element) =>
        element.id === imageElement?.id
          ? {
              ...element,
              contentBlockIndex: imageBlockIndex
            }
          : element
      )
    };
    const bindings = resolveSlideContentBlockBindings(imageBoundSlide);

    expect(
      bindings.contentBlockIndexByElementId.get(imageElement?.id ?? "")
    ).toBe(imageBlockIndex);
    expect(bindings.elementIdByContentBlockIndex.get(imageBlockIndex)).toBe(
      imageElement?.id
    );
  });

  it("does not bind ambiguous display content matches", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const slide = analyzed.slides[0];
    const bodyBlock = slide.content.contentBlocks.find(
      (block) => block.blockType === "body"
    );

    expect(bodyBlock).toBeDefined();
    const ambiguousSlide = {
      ...slide,
      content: {
        ...slide.content,
        contentBlocks: [
          ...slide.content.contentBlocks,
          {
            blockType: "body" as const,
            priority: bodyBlock?.priority ?? 2,
            text: bodyBlock?.text ?? "重复正文"
          }
        ]
      },
      elements: [
        {
          ...slide.elements.find((element) => element.semanticType === "body")!,
          content: bodyBlock?.text ?? "重复正文",
          contentBlockIndex: undefined,
          id: "legacy-ambiguous-body"
        }
      ]
    };
    const bindings = resolveSlideContentBlockBindings(ambiguousSlide);

    expect(
      bindings.contentBlockIndexByElementId.has("legacy-ambiguous-body")
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

    expect(deckStructureOutlineResultSchema.parse(structure).slides).toHaveLength(input.pageCount);
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
    expect(parsed.unifiedVisualSpec.colorPalette.primary).toHaveLength(1);
    expect(parsed.unifiedVisualSpec.colorPalette.primary[0]).toMatchObject({
      hex: "#246BFE",
      name: expect.any(String),
      usage: expect.any(String)
    });
    expect(parsed.unifiedVisualSpec.colorPalette.secondary.length).toBeGreaterThanOrEqual(2);
    expect(parsed.unifiedVisualSpec.colorPalette.chart.length).toBeGreaterThanOrEqual(4);
    expect(parsed.unifiedVisualSpec.colorPalette.neutral.length).toBeGreaterThanOrEqual(2);
    expect(parsed.unifiedVisualSpec.colorPalette.accent.length).toBeGreaterThanOrEqual(1);
    expect(parsed.unifiedVisualSpec.designIntent).toBeTruthy();
    expect(parsed.unifiedVisualSpec.usageConvenience).toBeTruthy();
    expect(parsed.unifiedVisualSpec.themeName).not.toMatch(/星图|Star Map/i);
    expect(parsed.unifiedVisualSpec.pageSpec).toMatchObject({
      aspectRatio: "16:9",
      canvasPixels: {
        height: 1080,
        width: 1920
      },
      gridColumns: 12,
      gridGutterPx: 24,
      height: 7.5,
      safeMargin: 0.5,
      safeMarginPxRange: {
        horizontal: "48-72px",
        vertical: "40-64px"
      },
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
      fontSize: 60,
      fontWeight: "bold"
    });
    expect(parsed.unifiedVisualSpec.typographyRules.scale.coverSubtitle.fontSize).toBe(28);
    expect(parsed.unifiedVisualSpec.typographyRules.scale.sectionTitle.fontSize).toBe(28);
    expect(parsed.unifiedVisualSpec.typographyRules.scale.iconLabel.fontSize).toBe(16);
    expect(parsed.unifiedVisualSpec.typographyRules.textLimits).toMatchObject({
      bodyBulletMaxChineseChars: 24,
      coverTitleMaxLines: 2,
      iconLabelMaxChineseChars: 10,
      noteMaxChineseChars: 32,
      pageTitleMaxLines: 2
    });
    expect(parsed.unifiedVisualSpec.colorRoles.contrastRequirement).toContain(
      "4.5:1"
    );
    expect(parsed.unifiedVisualSpec.colorRoles.borderDivider).toContain("#");
    expect(parsed.unifiedVisualSpec.colorRoles.chart).toContain("#");
    expect(parsed.unifiedVisualSpec.colorRoles.surface).toContain("#");
    expect(parsed.unifiedVisualSpec.colorRoles.titleText).toContain("#");
    expect(parsed.unifiedVisualSpec.transparencyRules[0]).toMatchObject({
      baseHex: expect.stringMatching(/^#[0-9A-F]{6}$/),
      opacity: expect.any(Number),
      usage: expect.any(String)
    });
    expect(parsed.unifiedVisualSpec.imageRules).toMatchObject({
      aspectRatio: "16:9",
      backgroundAvoidsHighContrastTextArea: true,
      imagePromptStyle: expect.any(String),
      imageType: "illustration",
      subjectAvoidsTitleArea: true
    });
    expect(parsed.unifiedVisualSpec.imageRules.forbiddenItems.length).toBeGreaterThanOrEqual(2);
    expect(parsed.unifiedVisualSpec.componentRules).toMatchObject({
      card: expect.any(String),
      chart: expect.any(String),
      icon: expect.any(String),
      metric: expect.any(String),
      table: expect.any(String),
      tag: expect.any(String)
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
    expect(parsed.unifiedVisualSpec.layoutRules).toMatchObject({
      pageMargin: expect.any(String),
      sectionGap: expect.any(String),
      elementGap: expect.any(String),
      whitespace: expect.any(String)
    });
    expect(parsed.unifiedVisualSpec.forbiddenVisualRules.join(" ")).toContain(
      "高饱和"
    );
  });

  it("validates grouped palette counts, uppercase HEX, and declared color references", () => {
    const visualSpec = buildMockAnalyzedDeck(input).unifiedVisualSpec;

    expect(
      unifiedVisualSpecSchema.safeParse({
        ...visualSpec,
        colorRoles: {
          ...visualSpec.colorRoles,
          background: "#FFFFFF 用于纯白背景。",
          bodyText: "#000000 用于纯黑正文。"
        }
      }).success
    ).toBe(true);

    expect(
      unifiedVisualSpecSchema.safeParse({
        ...visualSpec,
        colorPalette: {
          ...visualSpec.colorPalette,
          primary: [
            {
              ...visualSpec.colorPalette.primary[0],
              hex: "#246bfe"
            }
          ]
        }
      }).success
    ).toBe(false);

    expect(
      unifiedVisualSpecSchema.safeParse({
        ...visualSpec,
        colorPalette: {
          ...visualSpec.colorPalette,
          chart: visualSpec.colorPalette.chart.slice(0, 3)
        }
      }).success
    ).toBe(false);

    expect(
      unifiedVisualSpecSchema.safeParse({
        ...visualSpec,
        colorRoles: {
          ...visualSpec.colorRoles,
          accent: "#C0392B 用于未声明强调色。"
        }
      }).success
    ).toBe(false);

    expect(
      unifiedVisualSpecSchema.safeParse({
        ...visualSpec,
        transparencyRules: [
          {
            baseHex: "#C0392B",
            opacity: 0.2,
            usage: "用于错误的透明度基色。"
          },
          ...visualSpec.transparencyRules
        ]
      }).success
    ).toBe(false);
  });

  it("rejects legacy array layoutRules and legacy spacingRules in the new schema", () => {
    const analyzed = buildMockAnalyzedDeck(input);
    const base = {
      deckType: input.deckType,
      slides: analyzed.slides.map((slide) => slide.content)
    };

    expect(
      deckPageCopyResultSchema.safeParse({
        ...base,
        unifiedVisualSpec: {
          ...analyzed.unifiedVisualSpec,
          layoutRules: ["标题统一置顶", "正文在安全边距内"]
        }
      }).success
    ).toBe(false);

    const { layoutRules, ...withoutLayoutRules } = analyzed.unifiedVisualSpec;
    expect(
      deckPageCopyResultSchema.safeParse({
        ...base,
        unifiedVisualSpec: {
          ...withoutLayoutRules,
          spacingRules: layoutRules
        }
      }).success
    ).toBe(false);
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

  it("accepts slide elements with semantic asset bindings and styles", () => {
    const element = {
      assetBinding: {
        assetId: "asset-text-style",
        kind: "TEXT_STYLE",
        matchScore: 92,
        name: "标题文本样式",
        semanticKey: "cover-title",
        setKey: "common",
        setKind: "COMMON",
        usageSuggestion: "用于标题。",
        variantKey: "cover-title"
      },
      assetStyle: {
        fillColor: "#EAF2FF",
        strokeColor: "#AA1100",
        strokeWidth: 2,
        textRole: "cover-title"
      },
      bounds: { height: 0.7, width: 5.2, x: 0.8, y: 0.8 },
      content: "资产标题",
      editable: true,
      hierarchyLevel: 1,
      id: "slide-1-asset-title",
      requiresImageGeneration: false,
      role: "标题",
      semanticType: "title",
      styleNotes: "应用语义资产。",
      type: "text",
      zIndex: 10
    };

    expect(slideElementSchema.safeParse(element).success).toBe(true);
  });

  it("rejects invalid semantic asset binding and style values", () => {
    const element = {
      assetBinding: {
        assetId: "",
        kind: "BAD",
        name: "",
        setKey: "common",
        setKind: "COMMON"
      },
      assetStyle: {
        opacity: 2,
        strokeWidth: 99
      },
      bounds: { height: 0.7, width: 5.2, x: 0.8, y: 0.8 },
      editable: true,
      hierarchyLevel: 3,
      id: "slide-1-bad-asset",
      requiresImageGeneration: false,
      role: "坏资产",
      semanticType: "accentShape",
      styleNotes: "非法资产绑定。",
      type: "shape",
      zIndex: 10
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

    expect(generatedDeckResultSchema.parse(result).slides).toHaveLength(input.pageCount);
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

  it("accepts 40-slide outline and generated deck results", () => {
    const longInput: AnalyzeDeckRequest = {
      ...input,
      pageCount: 40
    };
    const analyzed = buildMockAnalyzedDeck(longInput);
    const generated = {
      id: "deck-40",
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
    ).toHaveLength(40);
    expect(generatedDeckResultSchema.parse(generated).slides).toHaveLength(40);
  });
});
