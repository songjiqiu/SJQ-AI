import { beforeEach, describe, expect, it, vi } from "vitest";

const templateService = vi.hoisted(() => ({
  selectPptTemplateForSlide: vi.fn()
}));
const templateAssetService = vi.hoisted(() => ({
  searchTemplateContainerAssetsForAi: vi.fn(),
  searchTemplateIconAssetsForAi: vi.fn(),
  searchTemplateLineAssetsForAi: vi.fn(),
  searchTemplateNavigationAssetsForAi: vi.fn(),
  searchTemplateShapeAssetsForAi: vi.fn(),
  searchTemplateTextStyleAssetsForAi: vi.fn()
}));

vi.mock("@/lib/admin/templates/service", () => ({
  selectPptTemplateForSlide: templateService.selectPptTemplateForSlide
}));
vi.mock("@/lib/admin/template-assets/service", () => ({
  searchTemplateContainerAssetsForAi:
    templateAssetService.searchTemplateContainerAssetsForAi,
  searchTemplateIconAssetsForAi:
    templateAssetService.searchTemplateIconAssetsForAi,
  searchTemplateLineAssetsForAi:
    templateAssetService.searchTemplateLineAssetsForAi,
  searchTemplateNavigationAssetsForAi:
    templateAssetService.searchTemplateNavigationAssetsForAi,
  searchTemplateShapeAssetsForAi:
    templateAssetService.searchTemplateShapeAssetsForAi,
  searchTemplateTextStyleAssetsForAi:
    templateAssetService.searchTemplateTextStyleAssetsForAi
}));

import {
  analyzeDeckIntent,
  analyzeDeck,
  composeDeckFromOutline,
  composeDeckSlidesFromOutline,
  composeSingleSlideFromOutline,
  createDeckOutline,
  normalizeUnifiedVisualSpec
} from "@/lib/ai-deck/analyzer";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import { AiJsonError, type JsonChatClient } from "@/lib/ai-deck/openai-json";
import {
  deckStructureOutlineSchema,
  unifiedVisualSpecSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type DeckDetailedOutlineResult,
  type DeckDisplayContentResult,
  type DeckStructureOutline,
  type DetailedSlideOutline,
  type SlideContent
} from "@/lib/ai-deck/schema";
import { buildDefaultTemplateSlide } from "@/lib/admin/templates/defaults";
import { extractPaletteHexColors } from "@/lib/ai-deck/visual-colors";

const input: AnalyzeDeckRequest = {
  sourceText: "这是一段用于测试 AI 拆页编排的长文本，包含市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 6,
  deckType: "business-report",
  palette: "star-map",
  locale: "zh-CN"
};

function createFakeClient(queue: Array<unknown | Error>) {
  const calls: Array<Record<string, unknown>> = [];
  const create = vi.fn(async (payload: Record<string, unknown>) => {
    calls.push(payload);
    const next = queue.shift();

    if (next instanceof Error) {
      throw next;
    }

    return {
      choices: [
        {
          message: {
            content: typeof next === "string" ? next : JSON.stringify(next)
          }
        }
      ]
    };
  });

  return {
    calls,
    client: {
      chat: {
        completions: {
          create
        }
      }
    } satisfies JsonChatClient
  };
}

function buildStructure(inputValue: AnalyzeDeckRequest): DeckStructureOutline {
  const mock = buildMockAnalyzedDeck(inputValue);

  return deckStructureOutlineSchema.parse({
    deckTitle: mock.deckTitle,
    deckSummary: mock.deckSummary,
    slides: mock.slides.map((slide) => ({
      slideId: slide.slideId,
      index: slide.index,
      layoutType:
        slide.index === 1
          ? "cover-title"
          : slide.index === inputValue.pageCount
            ? "ending"
            : "title-body-points",
      narrativeRole:
        slide.index === 1
          ? "setup"
          : slide.index === inputValue.pageCount
            ? "call-to-action"
            : "argument",
      pageNumber: slide.index,
      pageType: slide.content.pageType ?? "content",
      title: slide.content.title,
      purpose: slide.content.speakerGoal,
      keyMessage: slide.content.bodyPoints[0],
      visualDirection: slide.content.visualIntent
    }))
  });
}

function toDetailedSlideOutline(slide: SlideContent): DetailedSlideOutline {
  return {
    adaptationRules: slide.adaptationRules,
    audienceFocus: slide.audienceFocus,
    contentBoundary: slide.contentBoundary,
    coreStatement: slide.coreStatement,
    explanationDepth: slide.explanationDepth,
    index: slide.index,
    narrativeRole: slide.narrativeRole,
    pageType: slide.pageType ?? "content",
    slideId: slide.slideId,
    slideTransition: slide.slideTransition,
    sourceRequirement: slide.sourceRequirement,
    speakerGoal: slide.speakerGoal,
    title: slide.title,
    viewerObjective: slide.viewerObjective,
    visualIntent: slide.visualIntent
  };
}

function buildDetailedOutline(
  mock: ReturnType<typeof buildMockAnalyzedDeck>
): DeckDetailedOutlineResult {
  return {
    deckType: input.deckType,
    unifiedVisualSpec: normalizeUnifiedVisualSpec(mock.unifiedVisualSpec, input),
    slides: mock.slides.map((slide) => toDetailedSlideOutline(slide.content))
  };
}

function buildDisplayContent(
  mock: ReturnType<typeof buildMockAnalyzedDeck>,
  detailedOutline = buildDetailedOutline(mock).slides
): DeckDisplayContentResult {
  return {
    deckType: input.deckType,
    unifiedVisualSpec: normalizeUnifiedVisualSpec(mock.unifiedVisualSpec, input),
    detailedOutline,
    slides: mock.slides.map((slide) => ({
      slideId: slide.slideId,
      index: slide.index,
      title: slide.content.title,
      ...(slide.content.subtitle ? { subtitle: slide.content.subtitle } : {}),
      bodyPoints: slide.content.bodyPoints,
      contentBlocks: slide.content.contentBlocks,
      contentLayers: slide.content.contentLayers
    }))
  };
}

function buildLightweightOutlineResponse({
  deckType = "fundraising-pitch",
  pageCount = 6,
  sourceIds = []
}: {
  deckType?: AnalyzeDeckRequest["deckType"];
  pageCount?: number;
  sourceIds?: string[];
} = {}) {
  return {
    deckTitle: "新能源融资路演",
    deckType,
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
        sourceIds: pageNumber === 2 ? sourceIds : [],
        title: `第 ${pageNumber} 页`
      };
    })
  };
}

function extendSlidesToInputCount<T>(slides: T[], makeSlide: (index: number) => T) {
  return Array.from({ length: input.pageCount }, (_, index) =>
    slides[index] ?? makeSlide(index)
  );
}

function toSemanticPlan(slide: ReturnType<typeof buildMockAnalyzedDeck>["slides"][number]) {
  return {
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
}

describe("analyzeDeck", () => {
  beforeEach(() => {
    templateService.selectPptTemplateForSlide.mockReset();
    templateService.selectPptTemplateForSlide.mockResolvedValue(null);
    for (const search of Object.values(templateAssetService)) {
      search.mockReset();
      search.mockResolvedValue([]);
    }
  });

  it("analyzes deck intent with immutable deck type and ignores legacy style", async () => {
    const fake = createFakeClient([
      {
        deckType: "fundraising-pitch",
        style: "data",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 6,
        fileSummaries: [],
        lightweightOutline: buildLightweightOutlineResponse()
      }
    ]);

    const result = await analyzeDeckIntent(
      {
        idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
        sourceText: "",
        textFiles: [],
        deckType: "fundraising-pitch",
        style: "data",
        palette: "star-map",
        locale: "zh-CN"
      },
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );

    expect(result.deckType).toBe("fundraising-pitch");
    expect(result).not.toHaveProperty("style");
    expect(result.input).not.toHaveProperty("style");
    expect(result.recommendedPageCount).toBe(6);
    expect(result.lightweightOutline.pages).toHaveLength(6);
    expect(result.lightweightOutline.pages[0]).toMatchObject({
      layoutType: "cover-title",
      pageNumber: 1,
      pageType: "cover"
    });
    expect(result.structureOutline.slides).toHaveLength(6);
    expect(result.structureOutline.slides[0]).not.toHaveProperty("contentBlocks");
    expect(result.input.idea).toContain("新能源");
    const prompt = JSON.stringify(fake.calls[0].messages);

    expect(prompt).toContain("不得输出 structureOutline");
    expect(prompt).toContain("contentBlocks");
    expect(prompt).toContain("sourceIds 只能从服务端给出的已有 sourceId 中选择");
    expect(prompt).toContain("title-body-points");
  });

  it("uses local mock fallback when no API key is configured", async () => {
    const result = await analyzeDeck(input, {
      env: {
        OPENAI_API_KEY: ""
      }
    });

    expect(result.mode).toBe("mock");
    expect(result.slides).toHaveLength(input.pageCount);
  });

  it("creates an outline-only result without slide composition", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      displayContent
    ]);

    const aiResult = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(aiResult.mode).toBe("ai-json");
    expect(aiResult.slides).toHaveLength(input.pageCount);
    expect(aiResult.unifiedVisualSpec).toMatchObject({
      themeName: mock.unifiedVisualSpec.themeName,
      visualStyle: mock.unifiedVisualSpec.visualStyle,
      pptTypeVisualTone: mock.unifiedVisualSpec.pptTypeVisualTone
    });
    expect(aiResult.unifiedVisualSpec.imageRules.usageNotes).toContain(
      mock.unifiedVisualSpec.imageIllustrationRules.style
    );
    expect(aiResult.unifiedVisualSpec.forbiddenVisualRules).toContain(
      mock.unifiedVisualSpec.forbiddenRules[0]
    );
    expect(aiResult.slides[0].contentBlocks.length).toBeGreaterThanOrEqual(3);
    expect(fake.calls).toHaveLength(3);
    expect(JSON.stringify(fake.calls[0].response_format)).toContain(
      "colorRoles"
    );
    expect(JSON.stringify(fake.calls[0].response_format)).not.toContain(
      "visualSpecMarkdown"
    );
    expect(JSON.stringify(fake.calls[2].response_format)).toContain(
      "contentBlocks"
    );
    expect(JSON.stringify(fake.calls[0].messages)).toContain(
      "不得引用外观配色预设名"
    );
    expect(JSON.stringify(fake.calls[0].messages)).toContain("13.333 英寸");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("12 栏栅格");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("4.5:1");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("图片主体不能压在标题区");
    expect(JSON.stringify(fake.calls[1].messages)).toContain("coreStatement");
    expect(JSON.stringify(fake.calls[1].messages)).toContain("contentLayers");
    expect(JSON.stringify(fake.calls[1].messages)).toContain("不得输出 contentBlocks");
    expect(JSON.stringify(fake.calls[2].messages)).toContain("contentBlocks");
    expect(JSON.stringify(fake.calls[2].messages)).toContain(
      "同一页 contentBlocks.content 必须唯一"
    );
    expect(JSON.stringify(fake.calls[2].messages)).toContain("原始资料上下文");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("pptTypeVisualTone");
    expect(JSON.stringify(fake.calls[0].messages)).toContain(
      "只能返回当前 PPT 类型"
    );
    expect(JSON.stringify(fake.calls[0].messages)).toContain("recommendedTone");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("visualKeywords");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("typographyRules.scale");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("13 类约束");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("组件规范");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("图表规范");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("禁用规则");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("不要输出 Markdown 文档");
    expect(JSON.stringify(fake.calls[2].messages)).not.toContain("visualSpecMarkdown");
    expect(JSON.stringify(fake.calls[0].messages)).not.toContain("typographyScale");
    expect(JSON.stringify(fake.calls[0].messages)).not.toContain("colorRoleDefinitions");

    const result = await createDeckOutline(input, structure, [], {
      env: {
        OPENAI_API_KEY: ""
      }
    });

    expect(result.mode).toBe("mock");
    expect(result.slides).toHaveLength(input.pageCount);
    expect(result.slides[0]).not.toHaveProperty("elements");
    expect(result.unifiedVisualSpec.themeName).toBeTruthy();
    expect(result.unifiedVisualSpec.themeName).not.toMatch(/星图|Star Map/i);
    expect(result.unifiedVisualSpec.pageSpec.gridColumns).toBe(12);
    expect(result.slides[0].coreStatement).toBeTruthy();
    expect(result.slides[0].contentBlocks.length).toBeGreaterThanOrEqual(3);
    expect(result.slides[0].pageType).toBeTruthy();
    expect(result.slides[0].contentLayers.primary.length).toBeGreaterThan(0);
    expect(result.slides[0].slideTransition.toNext).toBeTruthy();
    expect(result.unifiedVisualSpec.typographyRules.scale.coverTitle.fontSize).toBeGreaterThan(20);
    expect(result.unifiedVisualSpec.colorRoles.contrastRequirement).toContain(
      "4.5:1"
    );
    expect(result.unifiedVisualSpec.imageRules.subjectAvoidsTitleArea).toBe(true);
    expect(result.unifiedVisualSpec).not.toHaveProperty("visualSpecMarkdown");
    expect(result.unifiedVisualSpec.chartVisualRules.chartTypes).toContain("柱状");
    expect(result.unifiedVisualSpec.iconStyleRules.style).toBe("line");
    expect(result.unifiedVisualSpec.forbiddenVisualRules.join(" ")).toContain(
      "高饱和"
    );
  });

  it("deduplicates repeated display content blocks within the same slide", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const firstSlide = displayContent.slides[0];
    const duplicateBodyPoint = "写作手法：《小石潭记》的动静结合";
    const distinctBodyPoints = [
      duplicateBodyPoint,
      "情感赏析：《小石潭记》的孤寂心境",
      "文言知识：《小石潭记》的重点词语"
    ];
    const duplicatedDisplayContent = {
      ...displayContent,
      slides: displayContent.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              subtitle: "初中语文精品课件",
              bodyPoints: distinctBodyPoints,
              contentBlocks: [
                {
                  blockType: "title" as const,
                  priority: 5,
                  text: `标题：${firstSlide.title}`
                },
                {
                  blockType: "note" as const,
                  priority: 5,
                  text: "页脚：初中语文精品课件"
                },
                {
                  blockType: "tag" as const,
                  priority: 4,
                  text: "初中语文精品课件"
                },
                {
                  blockType: "body" as const,
                  priority: 2,
                  text: duplicateBodyPoint
                },
                {
                  blockType: "note" as const,
                  priority: 5,
                  text: `备注：${duplicateBodyPoint}`
                },
                {
                  blockType: "body" as const,
                  priority: 2,
                  text: distinctBodyPoints[1]
                },
                {
                  blockType: "body" as const,
                  priority: 2,
                  text: distinctBodyPoints[2]
                }
              ]
            }
          : slide
      )
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      duplicatedDisplayContent
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });
    const texts = result.slides[0].contentBlocks.map((block) => block.text);

    expect(result.slides[0].contentBlocks.length).toBeGreaterThanOrEqual(3);
    expect(
      texts.filter((text) => text.includes("初中语文精品课件"))
    ).toHaveLength(1);
    expect(texts.filter((text) => text.includes("写作手法"))).toHaveLength(1);
    expect(texts).toEqual(expect.arrayContaining([firstSlide.title]));
    expect(texts).toEqual(expect.arrayContaining(distinctBodyPoints));
    expect(texts.join("\n")).not.toContain("页脚：初中语文精品课件");
    expect(texts.join("\n")).not.toContain(`备注：${duplicateBodyPoint}`);
  });

  it("deduplicates cover author and courseware metadata display blocks", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const coverDisplayContent = {
      ...displayContent,
      slides: displayContent.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              subtitle: "统编版八年级下册 文言文精讲课件",
              bodyPoints: [
                "作者：柳宗元（唐）",
                "初中语文精品课件",
                "统编版八年级下册 文言文精讲课件。"
              ],
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
                  blockType: "note" as const,
                  priority: 5,
                  text: "初中语文精品课件",
                  type: "source" as const
                },
                {
                  blockType: "conclusion" as const,
                  priority: 1,
                  text: "统编版八年级下册 文言文精讲课件。",
                  type: "conclusion" as const
                }
              ]
            }
          : slide
      )
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      coverDisplayContent
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });
    const texts = result.slides[0].contentBlocks.map((block) => block.text);

    expect(texts.filter((text) => text.includes("柳宗元"))).toEqual([
      "作者：柳宗元（唐）"
    ]);
    expect(
      texts.filter((text) => /课件|统编版/.test(text))
    ).toHaveLength(1);
    expect(texts).toEqual(expect.arrayContaining(["小石潭记"]));
  });

  it("clamps numeric display content priority values from compatible providers", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const looseDisplayContent = {
      ...displayContent,
      slides: displayContent.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              contentBlocks: slide.contentBlocks.map((block, blockIndex) => ({
                ...block,
                priority: blockIndex === 0 ? 0 : blockIndex + 6
              }))
            }
          : slide
      )
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      looseDisplayContent
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "deepseek-v4-flash"
      }
    });
    const priorities = result.slides[0].contentBlocks.map((block) => block.priority);

    expect(result.slides[0]).toMatchObject({
      index: detailedOutline.slides[0].index,
      slideId: detailedOutline.slides[0].slideId,
      title: detailedOutline.slides[0].title
    });
    expect(priorities.every((priority) => priority >= 1 && priority <= 5)).toBe(
      true
    );
    expect(priorities).toContain(1);
    expect(priorities).toContain(5);
  });

  it("normalizes display content block types from compatible providers", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const looseTypes = [
      "table",
      "diagram",
      "flowchart",
      "image",
      "icon",
      "footer",
      "source",
      "caption",
      "annotation",
      "paragraph",
      "bullet",
      "kpi",
      "summary",
      "unknown-type"
    ];
    const looseDisplayContent = {
      ...displayContent,
      slides: displayContent.slides.map((slide, slideIndex) => ({
        ...slide,
        contentBlocks: Array.from({ length: 12 }, (_, blockIndex) => {
          const looseType =
            looseTypes[(slideIndex * 6 + blockIndex) % looseTypes.length];

          return {
            blockType: looseType,
            priority: Math.min(5, blockIndex + 1),
            text: `兼容内容 ${slideIndex + 1}-${blockIndex + 1} ${looseType}`
          };
        })
      }))
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      new Error("400 This response_format type is unavailable now."),
      looseDisplayContent
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "deepseek-v4-flash"
      }
    });
    const validTypes = new Set([
      "title",
      "body",
      "metric",
      "chart",
      "quote",
      "tag",
      "step",
      "comparison",
      "conclusion",
      "note"
    ]);
    const blockTypes = result.slides.flatMap((slide) =>
      slide.contentBlocks.map((block) => block.blockType)
    );

    expect(result.slides).toHaveLength(detailedOutline.slides.length);
    expect(result.slides[0]).toMatchObject({
      index: detailedOutline.slides[0].index,
      slideId: detailedOutline.slides[0].slideId,
      title: detailedOutline.slides[0].title
    });
    expect(blockTypes.every((blockType) => validTypes.has(blockType))).toBe(true);
    expect(blockTypes).toEqual(expect.arrayContaining(["chart", "note", "body"]));
    expect(fake.calls[2].response_format).toMatchObject({
      type: "json_schema"
    });
    expect(fake.calls[3]).not.toHaveProperty("response_format");
  });

  it("repairs raw control characters in model JSON strings", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = {
      ...buildStructure(input),
      deckSummary: `测试摘要第一行
测试摘要第二行`
    };
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const invalidDisplayContent = {
      ...displayContent,
      slides: displayContent.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              contentBlocks: slide.contentBlocks.map((block, blockIndex) =>
                blockIndex === 0
                  ? {
                      ...block,
                      text: `测试内容第一行
测试内容第二行`
                    }
                  : block
              )
            }
          : slide
      )
    };
    const invalidJson = JSON.stringify(invalidDisplayContent).replace(
      "测试内容第一行\\n测试内容第二行",
      `测试内容第一行
测试内容第二行`
    );
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      new Error("400 This response_format type is unavailable now."),
      invalidJson
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.slides[0].contentBlocks[0].text).toContain("\n");
    expect(result.slides).toHaveLength(input.pageCount);
    expect(fake.calls[3]).not.toHaveProperty("response_format");
  });

  it("uses a final plain repair prompt for DeepSeek-style malformed page copy JSON", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const displayContentJson = JSON.stringify(displayContent);
    const safePoint = JSON.stringify(mock.slides[0].content.bodyPoints[0]);
    const malformedPageCopy = displayContentJson.replace(
      safePoint,
      `"脚注、来源说明、"引用"说明
需要单行"`
    );
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      new Error("400 This response_format type is unavailable now."),
      malformedPageCopy,
      displayContent
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "deepseek-v4-flash"
      }
    });

    expect(result.slides).toHaveLength(input.pageCount);
    expect(result.unifiedVisualSpec.typographyRules.scale.annotation.usage).toBe(
      "来源、脚注、单位和风险提示。"
    );
    expect(fake.calls).toHaveLength(5);
    expect(fake.calls[0].response_format).toMatchObject({
      type: "json_schema"
    });
    expect(fake.calls[3]).not.toHaveProperty("response_format");
    expect(fake.calls[4]).not.toHaveProperty("response_format");
    expect(JSON.stringify(fake.calls[4].messages)).toContain("JSON 格式修复器");
    expect(JSON.stringify(fake.calls[4].messages)).toContain(
      "typographyRules.scale.*.usage"
    );
    expect(fake.calls[4].model).toBe("deepseek-v4-flash");
  });

  it("falls back to a plain JSON prompt when response_format is unavailable", async () => {
    const fake = createFakeClient([
      new Error("400 This response_format type is unavailable now."),
      new Error("400 response_format is not supported."),
      {
        deckType: "fundraising-pitch",
        style: "data",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 6,
        fileSummaries: [],
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
      }
    ]);

    const result = await analyzeDeckIntent(
      {
        idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
        sourceText: "",
        textFiles: [],
        deckType: "fundraising-pitch",
        style: "data",
        palette: "star-map",
        locale: "zh-CN"
      },
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );

    expect(result.recommendedPageCount).toBe(6);
    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[0].response_format).toMatchObject({
      type: "json_schema"
    });
    expect(fake.calls[1].response_format).toMatchObject({
      type: "json_object"
    });
    expect(fake.calls[2]).not.toHaveProperty("response_format");
  });

  it("normalizes DeepSeek JSON mode outline output with missing structural fields", async () => {
    const looseStructure = {
      slides: extendSlidesToInputCount([
        {
          title: "十里长街送总理",
          purpose: "引入课题，创设庄重氛围",
          keyMessage: "周总理逝世，万人送别",
          visualDirection: "深灰色背景，中央放置课文标题，下方配黑白历史照片"
        },
        {
          title: "学习目标",
          purpose: "明确本课学习任务",
          keyMessage: "理解内容，学习写法，体会情感，培养朗读",
          visualDirection: "米白色背景，左侧列出目标条目，右侧配简约图标"
        },
        {
          title: "课文背景与周总理简介",
          purpose: "了解时代背景和人物",
          keyMessage: "周总理逝世于1976年，举国哀悼",
          visualDirection: "深灰背景，两张黑白照片，文字说明用楷体"
        }
      ], (index) => ({
        title: `补充结构 ${index + 1}`,
        purpose: `补齐第 ${index + 1} 页表达任务`,
        keyMessage: `第 ${index + 1} 页核心信息`,
        visualDirection: "延续统一视觉，保持清晰阅读顺序。"
      }))
    };
    const mock = buildMockAnalyzedDeck(input);
    const detailedOutline = {
      deckType: input.deckType,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: looseStructure.slides.map((slide, index) => ({
        title: slide.title,
        pageType: index === 0 ? ("cover" as const) : ("content" as const),
        speakerGoal: slide.purpose,
        visualIntent: slide.visualDirection,
        coreStatement: slide.keyMessage,
        narrativeRole: index === 0 ? ("setup" as const) : ("argument" as const),
        slideTransition: {
          fromPrevious: "承接上一页内容。",
          toNext: "引出下一页内容。"
        },
        explanationDepth: "focus" as const,
        sourceRequirement: {
          required: false,
          categories: ["user-input" as const],
          note: "本页基于用户输入。"
        },
        adaptationRules: {
          splitWhen: "内容过多时拆页。",
          splitCandidates: [slide.keyMessage],
          mergeWhen: "内容较少时合并。",
          mergeWith: "相邻页面"
        },
        audienceFocus: {
          lens: "teaching-understanding" as const,
          focus: "帮助学生理解课文。"
        },
        viewerObjective: {
          type: "understand" as const,
          description: "理解本页重点。"
        },
        contentBoundary: {
          inScope: "只展开本页重点。",
          outOfScope: ["不展开无关背景"]
        }
      }))
    };
    const normalizedStructure = {
      deckTitle: "十里长街送总理",
      deckSummary: "这是一份围绕课堂文本组织的结构大纲。",
      slides: looseStructure.slides.map((slide, index) => ({
        ...slide,
        slideId: `slide-${index + 1}`,
        index: index + 1
      }))
    };
    const detailedMockSlides: AnalyzedDeckResult["slides"] = mock.slides.map(
      (slide, index) => ({
        ...slide,
        slideId: normalizedStructure.slides[index].slideId,
        index: normalizedStructure.slides[index].index,
        content: {
          ...slide.content,
          ...detailedOutline.slides[index],
          slideId: normalizedStructure.slides[index].slideId,
          index: normalizedStructure.slides[index].index,
          title: normalizedStructure.slides[index].title
        }
      })
    );
    const lockedDetailedOutline = buildDetailedOutline({
      ...mock,
      slides: detailedMockSlides
    });
    const displayMockSlides: AnalyzedDeckResult["slides"] = mock.slides.map(
      (slide, index) => {
        const lockedContent = lockedDetailedOutline.slides[index];

        return {
          ...slide,
          slideId: normalizedStructure.slides[index].slideId,
          index: normalizedStructure.slides[index].index,
          content: {
            ...slide.content,
            ...lockedContent,
            slideId: normalizedStructure.slides[index].slideId,
            index: normalizedStructure.slides[index].index,
            title: normalizedStructure.slides[index].title,
            bodyPoints: [
              normalizedStructure.slides[index].keyMessage,
              normalizedStructure.slides[index].purpose
            ]
          }
        };
      }
    );
    const displayContent = buildDisplayContent(
      {
        ...mock,
        slides: displayMockSlides
      },
      lockedDetailedOutline.slides
    );
    const fake = createFakeClient([
      new Error("400 This response_format type is unavailable now"),
      mock.unifiedVisualSpec,
      lockedDetailedOutline,
      displayContent
    ]);
    const result = await createDeckOutline(input, normalizedStructure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "deepseek-v4-flash"
      }
    });

    expect(result.mode).toBe("ai-json");
    expect(result.deckTitle).toBe("十里长街送总理");
    expect(result.deckSummary).toContain("课堂文本");
    expect(result.unifiedVisualSpec.themeName).toBeTruthy();
    expect(result.unifiedVisualSpec.colorPalette.primary).toHaveLength(1);
    expect(result.unifiedVisualSpec.colorPalette.secondary.length).toBeGreaterThanOrEqual(2);
    expect(result.unifiedVisualSpec.colorPalette.chart.length).toBeGreaterThanOrEqual(4);
    expect(result.unifiedVisualSpec.colorPalette.neutral.length).toBeGreaterThanOrEqual(2);
    expect(result.unifiedVisualSpec.colorPalette.accent.length).toBeGreaterThanOrEqual(1);
    expect(
      extractPaletteHexColors(result.unifiedVisualSpec.colorPalette)
    ).toContain("#246BFE");
    expect(result.unifiedVisualSpec.pageSpec).toMatchObject({
      gridColumns: 12,
      width: 13.333
    });
    expect(result.unifiedVisualSpec.imageRules).toMatchObject({
      backgroundAvoidsHighContrastTextArea: true,
      subjectAvoidsTitleArea: true
    });
    expect(result.slides.map((slide) => slide.slideId)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3",
      "slide-4",
      "slide-5",
      "slide-6"
    ]);
    expect(result.slides.map((slide) => slide.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.slides[0].speakerGoal).toBe("引入课题，创设庄重氛围");
    expect(fake.calls[1]).not.toHaveProperty("response_format");
    expect(
      JSON.stringify(fake.calls[1].messages)
    ).toContain("目标 JSON Schema");
  });

  it("fails the outline draft when detailed outline slide count does not match", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = {
      ...buildDetailedOutline(mock),
      slides: buildDetailedOutline(mock).slides.slice(0, 2)
    };
    const fake = createFakeClient([mock.unifiedVisualSpec, detailedOutline]);

    await expect(
      createDeckOutline(input, structure, [], {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      })
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        schemaName: "DeckDetailedOutlineResult"
      })
    });
    expect(fake.calls).toHaveLength(2);
  });

  it("normalizes detailed outline list bounds from compatible providers", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const looseDetailedOutline = {
      ...detailedOutline,
      slides: detailedOutline.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              adaptationRules: {
                ...slide.adaptationRules,
                mergeWith: "",
                splitCandidates: [""]
              },
            }
          : slide
      )
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      looseDetailedOutline,
      {
        ...displayContent,
        detailedOutline: looseDetailedOutline.slides
      }
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "deepseek-v4-flash"
      }
    });

    expect(result.slides[0].adaptationRules.splitCandidates[0].length).toBeGreaterThanOrEqual(2);
    expect(result.slides[0].adaptationRules.mergeWith.length).toBeGreaterThanOrEqual(2);
  });

  it("fails the outline draft when display content slideId does not match", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = {
      ...buildDisplayContent(mock, detailedOutline.slides),
      slides: buildDisplayContent(mock, detailedOutline.slides).slides.map(
        (slide, index) =>
          index === 0
            ? {
                ...slide,
                slideId: "slide-mutated"
              }
            : slide
      )
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      displayContent
    ]);

    await expect(
      createDeckOutline(input, structure, [], {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      })
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        schemaName: "DeckDisplayContentResult"
      })
    });
    expect(fake.calls).toHaveLength(3);
  });

  it("ignores visual spec returned by display content and keeps the locked spec", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const lockedVisualSpec = normalizeUnifiedVisualSpec(mock.unifiedVisualSpec, input);
    const displayContent = {
      ...buildDisplayContent(mock, detailedOutline.slides),
      unifiedVisualSpec: {
        ...mock.unifiedVisualSpec,
        themeName: "被模型改写的视觉主题"
      }
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      detailedOutline,
      displayContent
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.unifiedVisualSpec.themeName).toBe(lockedVisualSpec.themeName);
    expect(result.unifiedVisualSpec.themeName).not.toBe("被模型改写的视觉主题");
  });

  it("fails the outline draft when later stages modify deckType or return locale", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = {
      ...buildDetailedOutline(mock),
      deckType: "training-course"
    };
    const fakeDeckType = createFakeClient([mock.unifiedVisualSpec, detailedOutline]);

    await expect(
      createDeckOutline(input, structure, [], {
        client: fakeDeckType.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      })
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        schemaName: "DeckDetailedOutlineResult"
      })
    });

    const lockedDetailedOutline = buildDetailedOutline(mock);
    const displayContent = {
      ...buildDisplayContent(mock, lockedDetailedOutline.slides),
      locale: input.locale
    };
    const fakeLocale = createFakeClient([
      mock.unifiedVisualSpec,
      lockedDetailedOutline,
      displayContent
    ]);

    await expect(
      createDeckOutline(input, structure, [], {
        client: fakeLocale.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      })
    ).rejects.toMatchObject({
      details: expect.objectContaining({
        schemaName: "DeckDisplayContentResult"
      })
    });
  });

  it("normalizes loose unified visual spec objects from compatible providers", async () => {
    const structure = {
      deckTitle: "测试课件",
      deckSummary: "这是一份用于测试错形视觉说明修复的大纲摘要。",
      slides: extendSlidesToInputCount([
        {
          slideId: "slide-1",
          index: 1,
          title: "开场",
          purpose: "建立主题语境",
          keyMessage: "用一个庄重开场引出主题",
          visualDirection: "深色背景和简洁标题"
        },
        {
          slideId: "slide-2",
          index: 2,
          title: "内容分析",
          purpose: "拆解主要内容",
          keyMessage: "围绕文本重点逐层展开",
          visualDirection: "左右分栏与重点标注"
        },
        {
          slideId: "slide-3",
          index: 3,
          title: "总结",
          purpose: "收束课堂重点",
          keyMessage: "回到核心表达并引导复盘",
          visualDirection: "米白背景和暗红强调线"
        }
      ], (index) => ({
        slideId: `slide-${index + 1}`,
        index: index + 1,
        title: `补充页面 ${index + 1}`,
        purpose: `补齐第 ${index + 1} 页课堂表达任务`,
        keyMessage: `第 ${index + 1} 页课堂重点`,
        visualDirection: "延续米白背景和暗红强调线"
      }))
    };
    const looseVisualSpec = {
      colorScheme: "深灰、暗红、米白",
      animation: "温和淡入，不使用花哨动画",
      layout: ["标题统一置顶", "正文使用左右分栏", "图片不遮挡文字"],
      decoration: "暗红细线与历史照片纹理"
    };
    const normalizedVisualSpec = normalizeUnifiedVisualSpec(looseVisualSpec, input);
    const mock = buildMockAnalyzedDeck(input);
    const detailedOutline = {
      deckType: input.deckType,
      unifiedVisualSpec: normalizedVisualSpec,
      slides: mock.slides.map((slide, index) => ({
        ...toDetailedSlideOutline(slide.content),
        slideId: structure.slides[index].slideId,
        index: structure.slides[index].index,
        title: structure.slides[index].title,
        speakerGoal: structure.slides[index].purpose,
        visualIntent: structure.slides[index].visualDirection,
        coreStatement: structure.slides[index].keyMessage
      }))
    };
    const displayContent = {
      deckType: input.deckType,
      unifiedVisualSpec: normalizedVisualSpec,
      detailedOutline: detailedOutline.slides,
      slides: structure.slides.map((slide, index) => ({
        slideId: slide.slideId,
        index: slide.index,
        title: slide.title,
        bodyPoints: [slide.keyMessage, `第 ${index + 1} 个课堂重点`],
        contentBlocks: [
          {
            blockType: "title",
            priority: 1,
            text: slide.title
          },
          {
            blockType: "conclusion",
            priority: 1,
            text: slide.keyMessage
          },
          {
            blockType: "body",
            priority: 2,
            text: `第 ${index + 1} 个课堂重点`
          }
        ]
      }))
    };
    const fake = createFakeClient([
      looseVisualSpec,
      detailedOutline,
      displayContent
    ]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.unifiedVisualSpec.colorPalette.primary[0]).toMatchObject({
      hex: "#246BFE",
      name: expect.any(String),
      usage: expect.any(String)
    });
    expect(result.unifiedVisualSpec.colorPalette.secondary.length).toBeGreaterThanOrEqual(2);
    expect(result.unifiedVisualSpec.colorPalette.chart.length).toBeGreaterThanOrEqual(4);
    expect(result.unifiedVisualSpec.colorPalette.neutral.length).toBeGreaterThanOrEqual(2);
    expect(result.unifiedVisualSpec.colorPalette.accent.length).toBeGreaterThanOrEqual(1);
    expect(extractPaletteHexColors(result.unifiedVisualSpec.colorPalette)).toEqual(
      expect.arrayContaining(["#246BFE", "#D9E7FF", "#17202A", "#16A085"])
    );
    expect(result.unifiedVisualSpec.visualStyle).toContain("深灰");
    expect(result.unifiedVisualSpec.layoutRules).toMatchObject({
      pageMargin: expect.any(String),
      sectionGap: expect.any(String),
      elementGap: expect.any(String),
      whitespace: expect.any(String)
    });
    expect(result.unifiedVisualSpec.colorRoles.contrastRequirement).toContain(
      "4.5:1"
    );
    expect(result.unifiedVisualSpec.forbiddenRules.length).toBeGreaterThan(0);
    expect(result.unifiedVisualSpec).not.toHaveProperty("visualSpecMarkdown");
    expect(result.unifiedVisualSpec.chartVisualRules.sourceNotes).toContain(
      "来源"
    );
  });

  it("fills structured visual spec fields for legacy visual spec values", () => {
    const normalized = normalizeUnifiedVisualSpec(
      "深灰背景、暗红强调、正文保持高可读性。",
      input
    );

    expect(normalized.visualStyle).toContain("深灰");
    expect(normalized.colorPalette.primary[0]).toMatchObject({
      hex: "#246BFE",
      name: expect.any(String),
      usage: expect.any(String)
    });
    expect(normalized.colorPalette.secondary.length).toBeGreaterThanOrEqual(2);
    expect(normalized.colorPalette.chart.length).toBeGreaterThanOrEqual(4);
    expect(normalized.colorPalette.neutral.length).toBeGreaterThanOrEqual(2);
    expect(normalized.colorPalette.accent.length).toBeGreaterThanOrEqual(1);
    expect(extractPaletteHexColors(normalized.colorPalette)).toEqual(
      expect.arrayContaining(["#246BFE", "#D9E7FF", "#17202A", "#16A085"])
    );
    expect(normalized.pageSpec).toMatchObject({
      aspectRatio: "16:9",
      gridColumns: 12,
      height: 7.5,
      safeMargin: 0.5,
      unit: "inch",
      width: 13.333
    });
    expect(normalized.typographyRules.fontFallback.length).toBeGreaterThanOrEqual(2);
    expect(normalized.colorRoles.contrastRequirement).toContain("4.5:1");
    expect(normalized.imageRules.usageNotes.join(" ")).toContain("标题区");
    expect(normalized.pptTypeVisualTone).toMatchObject({
      deckType: "business-report",
      deckTypeName: "商务汇报",
      recommendedTone: "克制、可信、有层级"
    });
    expect(normalized.pptTypeVisualTone.visualKeywords).toEqual(
      expect.arrayContaining(["数据图表", "结论先行"])
    );
    expect(normalized.typographyRules.scale.chartLabel.usage).toContain("图表");
    expect(normalized).not.toHaveProperty("typographyScale");
    expect(normalized).not.toHaveProperty("colorRoleDefinitions");
    expect(normalized.forbiddenVisualRules.join(" ")).toContain("高饱和");
    expect(normalized).not.toHaveProperty("visualSpecMarkdown");
    expect(normalized.chartVisualRules.chartTypes).toContain("柱状");
    expect(normalized.iconStyleRules.usage).toContain("图标");
  });

  it("deduplicates typography font fallback values and preserves schema minimums", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        typographyRules: {
          fontFallback: [
            "PingFang SC",
            "sans-serif",
            "sans-serif",
            "Microsoft YaHei",
            "sans-serif。"
          ]
        }
      },
      input
    );

    expect(unifiedVisualSpecSchema.parse(normalized)).toBeTruthy();
    expect(normalized.typographyRules.fontFallback).toEqual([
      "PingFang SC",
      "sans-serif",
      "Microsoft YaHei"
    ]);

    const fallbackFilled = normalizeUnifiedVisualSpec(
      {
        typographyRules: {
          fontFallback: ["sans-serif", "sans-serif。"]
        }
      },
      input
    );

    expect(unifiedVisualSpecSchema.parse(fallbackFilled)).toBeTruthy();
    expect(fallbackFilled.typographyRules.fontFallback.length).toBeGreaterThanOrEqual(2);
  });

  it("uses expanded appearance palettes for fallback visual specs", () => {
    const normalized = normalizeUnifiedVisualSpec(undefined, {
      ...input,
      palette: "dai-blue"
    });

    expect(normalized.colorPalette.primary[0].hex).toBe("#284B7A");
    expect(extractPaletteHexColors(normalized.colorPalette)).toEqual(
      expect.arrayContaining(["#284B7A", "#DFE9F4", "#172033", "#C9A46A"])
    );
  });

  it("keeps truncated unified visual spec text within schema length limits", () => {
    const longSectionGap = "区块间距规则".repeat(40);
    const longVisualStyle = "统一视觉风格说明".repeat(40);
    const normalized = normalizeUnifiedVisualSpec(
      {
        layoutRules: {
          sectionGap: longSectionGap
        },
        visualStyle: longVisualStyle
      },
      input
    );

    expect(unifiedVisualSpecSchema.parse(normalized)).toBeTruthy();
    expect(normalized.layoutRules.sectionGap.length).toBeLessThanOrEqual(180);
    expect(normalized.visualStyle.length).toBeLessThanOrEqual(240);
  });

  it("ignores legacy visual spec markdown during normalization", () => {
    const editedMarkdown = `# 全局视觉统一规范

## 1. 基础信息

- **主体名称**：人工修改后的规范
- **适用场景**：PPT / 路演稿 / 汇报材料
- **视觉风格**：人工指定的克制商务风格，保持清晰层级和统一组件。
- **设计意图**：确保所有页面先突出结论，再用数据和案例支撑。

## 2. PPT 页面类型与视觉基调

| PPT 类型 | 推荐视觉基调 | 视觉关键词 |
| -------- | ------------ | ---------- |
| 商务汇报 | 克制、可信、有层级 | 结论先行、清晰图表、专业留白 |

## 13. 禁用规则

- 禁止使用花哨动效，保持专业表达。`;

    const normalized = normalizeUnifiedVisualSpec(
      {
        visualSpecMarkdown: editedMarkdown,
        visualStyle: "历史草稿的结构化视觉风格仍然保留。"
      },
      input
    );

    expect(normalized.visualStyle).toContain("历史草稿");
    expect(normalized).not.toHaveProperty("visualSpecMarkdown");
  });

  it("merges image and forbidden visual rules during normalization", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        imageRules: {
          backgroundAvoidsHighContrastTextArea: true,
          subjectAvoidsTitleArea: true,
          usageNotes: ["背景图低对比", "主体避开标题区"]
        },
        imageIllustrationRules: {
          style: "图片/插画保持水墨风格和低噪声。",
          composition: "主体避开标题区",
          background: "背景图低对比",
          consistency: "整套素材保持同一画风。"
        },
        forbiddenRules: [
          "禁止使用高饱和颜色",
          "避免过度阴影和3D效果",
          "禁止使用高饱和颜色"
        ],
        forbiddenVisualRules: [
          "避免过度阴影和3D效果",
          "禁止复杂背景",
          "避免复杂动画"
        ]
      },
      input
    );

    expect(normalized.imageRules.usageNotes).toEqual(
      expect.arrayContaining([
        "背景图低对比",
        "主体避开标题区",
        "图片/插画保持水墨风格和低噪声。"
      ])
    );
    expect(
      normalized.imageRules.usageNotes.filter((item) => item === "背景图低对比")
    ).toHaveLength(1);
    expect(normalized.forbiddenVisualRules).toEqual(
      expect.arrayContaining([
        "禁止使用高饱和颜色",
        "避免过度阴影和3D效果",
        "禁止复杂背景",
        "避免复杂动画"
      ])
    );
    expect(
      normalized.forbiddenVisualRules.filter(
        (item) => item === "禁止使用高饱和颜色"
      )
    ).toHaveLength(1);
    expect(normalized.forbiddenRules).toEqual(
      normalized.forbiddenVisualRules.slice(0, 6)
    );
  });

  it("deduplicates unified visual spec rule arrays and keeps schema minimums", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        consistencyRules: [
          "所有页面沿用同一色板",
          "所有页面沿用同一色板。",
          "标题和正文层级保持一致"
        ],
        forbiddenRules: [
          "禁止使用高饱和颜色",
          "禁止使用高饱和颜色。",
          "避免过度阴影和3D效果"
        ],
        forbiddenVisualRules: [
          "避免过度阴影和3D效果",
          "禁止复杂背景",
          "禁止复杂背景。"
        ],
        imageRules: {
          forbiddenItems: ["不要水印", "不要水印。", "不要复杂背景"],
          usageNotes: [
            "背景图低对比",
            "背景图低对比。",
            "主体避开标题区"
          ]
        },
        pptTypeVisualTone: {
          deckType: "business-report",
          deckTypeName: "商务汇报",
          recommendedTone: "克制、可信、有层级",
          visualKeywords: [
            "数据图表",
            "数据图表。",
            "结论先行",
            "结论先行"
          ]
        }
      },
      input
    );

    expect(unifiedVisualSpecSchema.parse(normalized)).toBeTruthy();
    expect(
      normalized.consistencyRules.filter((item) =>
        item.startsWith("所有页面沿用同一色板")
      )
    ).toHaveLength(1);
    expect(
      normalized.forbiddenVisualRules.filter((item) =>
        item.startsWith("禁止复杂背景")
      )
    ).toHaveLength(1);
    expect(
      normalized.imageRules.forbiddenItems.filter((item) =>
        item.startsWith("不要水印")
      )
    ).toHaveLength(1);
    expect(
      normalized.imageRules.usageNotes.filter((item) =>
        item.startsWith("背景图低对比")
      )
    ).toHaveLength(1);
    expect(
      normalized.pptTypeVisualTone.visualKeywords.filter((item) =>
        item.startsWith("数据图表")
      )
    ).toHaveLength(1);

    const fallbackFilled = normalizeUnifiedVisualSpec(
      {
        consistencyRules: ["重复规则", "重复规则。"],
        imageRules: {
          forbiddenItems: ["重复禁用项", "重复禁用项。"],
          usageNotes: ["重复图片规则", "重复图片规则。"]
        },
        pptTypeVisualTone: {
          visualKeywords: ["重复关键词", "重复关键词。"]
        }
      },
      input
    );

    expect(unifiedVisualSpecSchema.parse(fallbackFilled)).toBeTruthy();
    expect(fallbackFilled.consistencyRules.length).toBeGreaterThanOrEqual(2);
    expect(fallbackFilled.imageRules.forbiddenItems.length).toBeGreaterThanOrEqual(2);
    expect(fallbackFilled.imageRules.usageNotes.length).toBeGreaterThanOrEqual(2);
    expect(
      fallbackFilled.pptTypeVisualTone.visualKeywords.length
    ).toBeGreaterThanOrEqual(2);
  });

  it("normalizes legacy spacingRules into structured layoutRules", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        spacingRules: {
          pageMargin: "页面四周保留 0.5 英寸安全边距。",
          sectionGap: "区块之间至少保留 0.3 英寸。",
          elementGap: "同类元素保持一致间距。",
          whitespace: "保留 30% 以上留白。"
        }
      },
      input
    );

    expect(normalized.layoutRules.pageMargin).toContain(
      "页面四周保留 0.5 英寸安全边距。"
    );
    expect(normalized.layoutRules.sectionGap).toContain(
      "区块之间至少保留 0.3 英寸。"
    );
    expect(normalized.layoutRules.elementGap).toContain(
      "同类元素保持一致间距。"
    );
    expect(normalized.layoutRules.whitespace).toContain("保留 30% 以上留白。");
  });

  it("maps legacy layout rule arrays into structured layoutRules", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        layoutRules: [
          "每页基于12栏栅格系统，内容避开四周0.5英寸安全边距",
          "标题位于页面顶部或左上方，正文和图表按栅格对齐",
          "信息分组使用卡片或区块，区块间留白0.3英寸"
        ]
      },
      input
    );

    expect(normalized.layoutRules.pageMargin).toContain("0.5英寸安全边距");
    expect(normalized.layoutRules.elementGap).toContain("按栅格对齐");
    expect(normalized.layoutRules.whitespace).toContain("留白0.3英寸");
    expect(normalized.layoutRules.sectionGap.length).toBeGreaterThan(0);
  });

  it("normalizes color roles to palette colors and preserves multi-color text roles", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        colorPalette: ["#246bfe", "#d9e7ff", "#17202a", "#16a085"],
        colorRoles: {
          accent: "#C0392B 用于错误的强调色。",
          background: "#FFFFFF 用于错误背景。",
          bodyText:
            "#2C3E50 与 #17202A / #16A085 用于正文层级和辅助信息。",
          chart: "#C0392B、#246BFE、#16A085 用于图表主次序列。",
          contrastRequirement: "正文色和背景色对比度不得低于 4.5:1。",
          decorative: "#A68A6B 与 #16A085 用于装饰。",
          highlight: "#D9E7FF 与 #C0392B 用于高亮。",
          surface: "#FFFFFF 与 #D9E7FF 用于卡片。",
          titleText: "#2C3E50 / #17202A / #246BFE 用于标题和副标题。"
        }
      },
      input
    );

    expect(normalized.colorPalette.primary[0].hex).toBe("#246BFE");
    expect(normalized.colorPalette.secondary.length).toBeGreaterThanOrEqual(2);
    expect(normalized.colorPalette.chart.length).toBeGreaterThanOrEqual(4);
    expect(normalized.colorPalette.neutral.length).toBeGreaterThanOrEqual(2);
    expect(normalized.colorPalette.accent.length).toBeGreaterThanOrEqual(1);
    expect(extractPaletteHexColors(normalized.colorPalette)).toEqual(
      expect.arrayContaining(["#246BFE", "#D9E7FF", "#17202A", "#16A085"])
    );
    expect(JSON.stringify(normalized.colorRoles)).not.toContain("#C0392B");
    expect(JSON.stringify(normalized.colorRoles)).not.toContain("#2C3E50");
    expect(JSON.stringify(normalized.colorRoles)).not.toContain("#A68A6B");
    expect(JSON.stringify(normalized.colorRoles)).not.toContain("#FFFFFF");
    expect(normalized.colorRoles.accent).toContain("#FFB020");
    expect(normalized.colorRoles.highlight).toContain("#00C2A8");
    expect(normalized.colorRoles.background).toContain("#F6F8FB");
    expect(normalized.colorRoles.bodyText).toContain("#17202A");
    expect(normalized.colorRoles.chart).toContain("#3B82F6");
    expect(normalized.colorRoles.titleText).toContain("#17202A");
  });

  it("normalizes transparency rules to the generated grouped palette", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        colorPalette: {
          accent: [
            {
              hex: "#C23B22",
              name: "朱红",
              usage: "高亮重点词、错误提示、强调箭头"
            },
            {
              hex: "#C8A952",
              name: "金色",
              usage: "获奖标示、星级评价、特殊标注"
            }
          ],
          chart: [
            {
              hex: "#4A7C7F",
              name: "青蓝",
              usage: "图表序列颜色1"
            },
            {
              hex: "#D49A6A",
              name: "暖橙",
              usage: "图表序列颜色2"
            },
            {
              hex: "#8B7E9B",
              name: "淡紫",
              usage: "图表序列颜色3"
            },
            {
              hex: "#5E8B5A",
              name: "翠绿",
              usage: "图表序列颜色4"
            },
            {
              hex: "#C98B8B",
              name: "粉霞",
              usage: "图表序列颜色5"
            }
          ],
          neutral: [
            {
              hex: "#3D3D3D",
              name: "深灰",
              usage: "正文文字色"
            },
            {
              hex: "#7A7A7A",
              name: "中灰",
              usage: "注释文字、辅助说明"
            },
            {
              hex: "#D9D9D9",
              name: "浅灰",
              usage: "分隔线、表格边框、占位符"
            },
            {
              hex: "#FAFAFA",
              name: "暖白",
              usage: "卡片悬停背景、极浅色区域"
            }
          ],
          primary: [
            {
              hex: "#2A5C5A",
              name: "墨青",
              usage: "标题、关键装饰、强调元素的主色"
            }
          ],
          secondary: [
            {
              hex: "#7AB3B0",
              name: "浅青",
              usage: "卡片背景、次要标题、信息模块底色"
            },
            {
              hex: "#F0F4F4",
              name: "霜白",
              usage: "页面背景、浅色填充区域"
            },
            {
              hex: "#9DC0BF",
              name: "石青",
              usage: "图表辅助色、装饰线条"
            }
          ]
        },
        transparencyRules: [
          {
            baseHex: "#2A5C5A",
            opacity: 0.2,
            usage: "用于当前色板内的强调标签弱底色。"
          },
          {
            baseHex: "#FFFFFF",
            opacity: 0.16,
            usage: "模型输出的纯白透明底色，不在色板内。"
          },
          {
            baseHex: "#000000",
            opacity: 0.12,
            usage: "模型输出的纯黑遮罩，不在色板内。"
          },
          {
            baseHex: "#E6F0F0",
            opacity: 0.35,
            usage: "模型输出的派生浅色，不在色板内。"
          }
        ]
      },
      input
    );
    const paletteColors = new Set(extractPaletteHexColors(normalized.colorPalette));

    expect(unifiedVisualSpecSchema.parse(normalized)).toBeTruthy();
    expect(normalized.transparencyRules.length).toBeGreaterThanOrEqual(2);
    expect(normalized.transparencyRules.map((rule) => rule.baseHex)).toEqual(
      expect.arrayContaining(["#F6F8FB", "#D9E7FF", "#246BFE"])
    );
    expect(
      normalized.transparencyRules.every((rule) =>
        paletteColors.has(rule.baseHex)
      )
    ).toBe(true);
    expect(JSON.stringify(normalized.transparencyRules)).not.toContain("#FFFFFF");
    expect(JSON.stringify(normalized.transparencyRules)).not.toContain("#000000");
    expect(JSON.stringify(normalized.transparencyRules)).not.toContain("#E6F0F0");
  });

  it("fills transparency rules from the current palette when model rules are all invalid", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        colorPalette: {
          primary: [
            {
              hex: "#1A5C8A",
              name: "青蓝",
              usage: "主色调，用于标题、强调元素、主按钮、图表主色"
            }
          ],
          secondary: [
            {
              hex: "#3A8A5C",
              name: "松绿",
              usage: "次要色，用于小节标题、图标、标签背景"
            },
            {
              hex: "#B07A4A",
              name: "赭石",
              usage: "辅助色，用于装饰性元素、进度条"
            }
          ],
          chart: [
            {
              hex: "#1A5C8A",
              name: "深蓝",
              usage: "图表序列色1，用于柱状图或折线图主系列"
            },
            {
              hex: "#3A8A5C",
              name: "松绿",
              usage: "图表序列色2，用于次要系列或对比"
            },
            {
              hex: "#B07A4A",
              name: "赭石",
              usage: "图表序列色3，用于第三系列或辅助"
            },
            {
              hex: "#6B5B8A",
              name: "紫灰",
              usage: "图表序列色4，用于第四系列或强调"
            }
          ],
          neutral: [
            {
              hex: "#2B2B2B",
              name: "墨黑",
              usage: "正文主要颜色，深色背景上也可用"
            },
            {
              hex: "#5C5C5C",
              name: "灰",
              usage: "次要文字、注释、图例"
            },
            {
              hex: "#D9D9D9",
              name: "浅灰",
              usage: "分隔线、边框、卡片背景"
            }
          ],
          accent: [
            {
              hex: "#D94A4A",
              name: "朱红",
              usage: "强调色，用于关键词高亮、错误提示、重要标注"
            }
          ]
        },
        transparencyRules: [
          {
            baseHex: "#FFFFFF",
            opacity: 0.1,
            usage: "错误纯白弱底色。"
          },
          {
            baseHex: "#0D2E45",
            opacity: 0.2,
            usage: "错误派生色遮罩。"
          }
        ]
      },
      input
    );
    const paletteColors = new Set(extractPaletteHexColors(normalized.colorPalette));

    expect(unifiedVisualSpecSchema.parse(normalized)).toBeTruthy();
    expect(normalized.transparencyRules).toHaveLength(3);
    expect(normalized.transparencyRules.map((rule) => rule.baseHex)).toEqual([
      "#F6F8FB",
      "#D9E7FF",
      "#246BFE"
    ]);
    expect(
      normalized.transparencyRules.every((rule) =>
        paletteColors.has(rule.baseHex)
      )
    ).toBe(true);
  });

  it("matches visual tone to representative PPT types", () => {
    const cases = [
      {
        deckType: "product-launch" as const,
        expectedName: "产品发布",
        expectedTone: "科技感、品牌感、发布会感",
        expectedKeyword: "产品特写"
      },
      {
        deckType: "training-course" as const,
        expectedName: "课程培训",
        expectedTone: "系统、稳定、可学习",
        expectedKeyword: "章节导航"
      },
      {
        deckType: "research-report" as const,
        expectedName: "研究报告",
        expectedTone: "专业、厚重、报告感",
        expectedKeyword: "目录体系"
      },
      {
        deckType: "portfolio" as const,
        expectedName: "作品集",
        expectedTone: "视觉优先、审美感、案例感",
        expectedKeyword: "大图展示"
      }
    ];

    for (const item of cases) {
      const normalized = normalizeUnifiedVisualSpec(undefined, {
        ...input,
        deckType: item.deckType
      });

      expect(normalized.pptTypeVisualTone).toMatchObject({
        deckType: item.deckType,
        deckTypeName: item.expectedName,
        recommendedTone: item.expectedTone
      });
      expect(normalized.pptTypeVisualTone.visualKeywords).toContain(
        item.expectedKeyword
      );
    }
  });

  it("converts legacy visual tone tables to the current PPT type match", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        pptTypeVisualTone: {
          businessReport: "商务汇报保持克制、清晰、结论优先。",
          trainingCourse: "课程培训保持渐进、亲和、可理解。",
          brandMarketing: "品牌营销强化记忆点、价值主张和情绪感染力。",
          researchReport: "研究报告保持理性、可信、证据优先。"
        }
      },
      {
        ...input,
        deckType: "product-launch"
      }
    );

    expect(normalized.pptTypeVisualTone.deckType).toBe("product-launch");
    expect(normalized.pptTypeVisualTone.deckTypeName).toBe("产品发布");
    expect(normalized.pptTypeVisualTone.recommendedTone).toContain("品牌营销");
    expect(normalized.pptTypeVisualTone.visualKeywords).toContain("产品特写");
  });

  it("removes appearance palette names from normalized visual theme names", () => {
    const normalized = normalizeUnifiedVisualSpec(
      {
        themeName: "小石潭记-黛蓝 Moon White",
        visualStyle: "山水游记课件，清雅留白，正文保持高可读性。",
        colorPalette: ["#246BFE", "#D9E7FF", "#17202A", "#16A085"],
        typography: "标题醒目，正文清晰。",
        imageStyle: "图片干净，不遮挡标题。",
        spacingRules: {
          pageMargin: "正文在安全边距内",
          sectionGap: "标题统一置顶并与正文分区",
          elementGap: "正文按栅格对齐",
          whitespace: "保留清雅留白"
        },
        consistencyRules: ["沿用统一色板", "保持层级一致"],
        forbiddenRules: ["不要使用密集小字图片"]
      },
      input
    );

    expect(normalized.themeName).toBe("小石潭记");
  });

  it("fails when a generation stage changes the locked deck type", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const changedDetailedOutline = {
      ...detailedOutline,
      deckType: "fundraising-pitch"
    };
    const fake = createFakeClient([
      mock.unifiedVisualSpec,
      changedDetailedOutline
    ]);

    await expect(
      createDeckOutline(input, structure, [], {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      })
    ).rejects.toBeInstanceOf(AiJsonError);

    expect(fake.calls).toHaveLength(2);
  });

  it("repairs fenced JSON output before accepting display content JSON", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const detailedOutline = buildDetailedOutline(mock);
    const displayContent = buildDisplayContent(mock, detailedOutline.slides);
    const calls: Array<Record<string, unknown>> = [];
    const create = vi.fn(async (payload: Record<string, unknown>) => {
      calls.push(payload);

      return {
        choices: [
          {
            message: {
              content:
                calls.length === 1
                  ? JSON.stringify(mock.unifiedVisualSpec)
                  : calls.length === 2
                    ? JSON.stringify(detailedOutline)
                  : calls.length === 3
                    ? `\`\`\`json\n${JSON.stringify(displayContent)}\n\`\`\``
                    : JSON.stringify(displayContent)
            }
          }
        ]
      };
    });
    const client = {
      chat: {
        completions: {
          create
        }
      }
    } satisfies JsonChatClient;

    const result = await createDeckOutline(input, structure, [], {
      client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.slides).toHaveLength(input.pageCount);
    expect(calls).toHaveLength(3);
    expect(calls[0].response_format).toMatchObject({ type: "json_schema" });
    expect(calls[1].response_format).toMatchObject({ type: "json_schema" });
    expect(calls[2].response_format).toMatchObject({ type: "json_schema" });
  });

  it("returns structured diagnostics after repeated invalid display content JSON", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const detailedOutline = buildDetailedOutline(mock);
    let thrown: unknown;

    try {
      await createDeckOutline(input, buildStructure(input), [], {
        client: createFakeClient([
          mock.unifiedVisualSpec,
          detailedOutline,
          {
            deckType: input.deckType,
            unifiedVisualSpec: "字段类型错误的视觉规范。",
            detailedOutline: [],
            slides: []
          },
          "这不是 JSON"
        ]).client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AiJsonError);

    const details = (thrown as AiJsonError).details;

    expect(details).toMatchObject({
      model: "test-model",
      schemaName: "DeckDisplayContentResult"
    });
    expect(details?.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          error: expect.stringContaining(
            "Too small: expected array to have >=6 items"
          ),
          mode: "json_schema",
          responseSnippet: expect.stringContaining("字段类型错误"),
          stage: "validation"
        })
      ])
    );
  });

  it("keeps failing when page copy slide count does not match pageCount", async () => {
    let thrown: unknown;

    try {
      await createDeckOutline(input, buildStructure(input), [], {
        client: createFakeClient([
          buildMockAnalyzedDeck(input).unifiedVisualSpec,
          {
            deckType: input.deckType,
            unifiedVisualSpec: buildMockAnalyzedDeck(input).unifiedVisualSpec,
            slides: [
              {
                slideId: "slide-1",
                index: 1,
                title: "第一页",
                bodyPoints: ["背景信息", "结论信息"],
                speakerGoal: "说明背景信息。",
                visualIntent: "简洁背景"
              },
              {
                slideId: "slide-2",
                index: 2,
                title: "第二页",
                bodyPoints: ["结论信息", "行动建议"],
                speakerGoal: "说明结论信息。",
                visualIntent: "重点强调"
              }
            ]
          },
          "这不是 JSON"
        ]).client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AiJsonError);
  });

  it("runs deck analysis then per-slide composition with JSON mode retry", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const deckAnalysis = {
      deckTitle: mock.deckTitle,
      deckSummary: mock.deckSummary,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => slide.content)
    };
    const fake = createFakeClient([
      new Error("json_schema unsupported"),
      deckAnalysis,
      ...mock.slides.map(toSemanticPlan)
    ]);

    const result = await analyzeDeck(input, {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.mode).toBe("ai-json");
    expect(result.slides).toHaveLength(input.pageCount);
    expect(fake.calls).toHaveLength(2 + input.pageCount);
    expect(fake.calls[0].response_format).toMatchObject({
      type: "json_schema"
    });
    expect(fake.calls[1].response_format).toMatchObject({
      type: "json_object"
    });
    expect(JSON.stringify(fake.calls.at(-1)?.messages)).toContain(
      "不要直接写死坐标"
    );
    expect(JSON.stringify(fake.calls[1].messages)).toContain("12 栏栅格");
    expect(JSON.stringify(fake.calls[1].messages)).toContain("字体 fallback");
    expect(JSON.stringify(fake.calls[1].messages)).toContain("高对比文字区域");
  });

  it("composes slide plans from an edited outline without rebuilding the outline", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const editedSlides = mock.slides.map((slide, index) => ({
      ...slide.content,
      title: index === 0 ? "编辑后的开场标题" : slide.content.title
    }));

    const result = await composeDeckFromOutline(
      input,
      editedSlides,
      mock.unifiedVisualSpec,
      {
        env: {
          OPENAI_API_KEY: ""
        }
      }
    );

    expect(result).toHaveLength(input.pageCount);
    expect(result[0].content.title).toBe("编辑后的开场标题");
    expect(result[0].elements.some((element) => element.type === "text")).toBe(
      true
    );
  });

  it("composes outline slide plans concurrently and returns them in slide order", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const shuffledSlides = [
      mock.slides[2].content,
      mock.slides[0].content,
      mock.slides[1].content,
      ...mock.slides.slice(3).map((slide) => slide.content)
    ];
    const delaysBySlideId = new Map([
      ["slide-1", 5],
      ["slide-2", 20],
      ["slide-3", 40]
    ]);
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const completionOrder: string[] = [];
    const create = vi.fn(async (payload: Record<string, unknown>) => {
      const messages = payload.messages as Array<{ content: string }>;
      const userMessage = messages[messages.length - 1]?.content ?? "";
      const slideJson = userMessage.match(
        /单页文案：\n([\s\S]*?)\n\n整套输入背景：/
      )?.[1];
      const requestedSlide = slideJson
        ? (JSON.parse(slideJson) as { slideId?: string; title?: string })
        : null;
      const plan =
        mock.slides.find((slide) => slide.slideId === requestedSlide?.slideId) ??
        mock.slides.find((slide) => userMessage.includes(slide.content.title));

      if (!plan) {
        throw new Error("Missing slide plan for test payload.");
      }

      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

      await new Promise((resolve) =>
        setTimeout(resolve, delaysBySlideId.get(plan.slideId) ?? 0)
      );

      activeRequests -= 1;
      completionOrder.push(plan.slideId);

      return {
        choices: [
          {
            message: {
              content: JSON.stringify(toSemanticPlan(plan))
            }
          }
        ]
      };
    });
    const client = {
      chat: {
        completions: {
          create
        }
      }
    } satisfies JsonChatClient;

    const result = await composeDeckSlidesFromOutline(
      input,
      shuffledSlides,
      mock.unifiedVisualSpec,
      {
        client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );

    expect(create).toHaveBeenCalledTimes(input.pageCount);
    expect(maxActiveRequests).toBeGreaterThan(1);
    expect(completionOrder).toEqual(expect.arrayContaining(["slide-1", "slide-2", "slide-3"]));
    expect(result.map((slide) => slide.slideId)).toEqual(
      Array.from({ length: input.pageCount }, (_, index) => `slide-${index + 1}`)
    );
    expect(result[0].pageIntent).toBeTruthy();
    expect(result[0].semanticElements.length).toBeGreaterThanOrEqual(3);
  });

  it("prompts for semantic planning before server-side layout coordinates", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const fake = createFakeClient([toSemanticPlan(mock.slides[0])]);

    const result = await composeSingleSlideFromOutline(
      input,
      mock.slides[0].content,
      mock.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );
    const messages = JSON.stringify(fake.calls[0].messages);

    expect(messages).toContain("先分析页面意图 pageIntent");
    expect(messages).toContain("contentHierarchy");
    expect(messages).toContain("layoutSelection");
    expect(messages).toContain("cover-title");
    expect(messages).toContain("五维设计质量评分");
    expect(messages).toContain("semanticElements.category 只能使用 text/visual/infographic/navigation/container");
    expect(messages).toContain("禁止输出 bounds、x、y、width、height");
    expect(result.elements[0].bounds).toBeTruthy();
  });

  it("fills empty semantic hierarchy tiers from compatible-provider fallback output", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const semanticPlan = toSemanticPlan(mock.slides[0]);
    const loosePlan = {
      ...semanticPlan,
      contentHierarchy: {
        ...semanticPlan.contentHierarchy,
        tiers: semanticPlan.contentHierarchy.tiers.map((tier) =>
          tier.level === 2
            ? {
                ...tier,
                items: [mock.slides[0].content.bodyPoints[0]]
              }
            : tier.level === 3
              ? {
                  ...tier,
                  items: []
                }
              : tier
        )
      }
    };
    const fake = createFakeClient([
      new Error("400 This response_format type is unavailable now."),
      new Error("400 response_format is not supported."),
      loosePlan
    ]);

    const result = await composeSingleSlideFromOutline(
      input,
      mock.slides[0].content,
      mock.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "deepseek-v4-flash"
        }
      }
    );
    const levelTwo = result.contentHierarchy.tiers.find((tier) => tier.level === 2);
    const levelThree = result.contentHierarchy.tiers.find((tier) => tier.level === 3);

    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[0].response_format).toMatchObject({ type: "json_schema" });
    expect(fake.calls[1].response_format).toMatchObject({ type: "json_object" });
    expect(fake.calls[2]).not.toHaveProperty("response_format");
    expect(levelTwo?.items[0]).toMatchObject({
      content: mock.slides[0].content.bodyPoints[0]
    });
    expect(levelThree?.items.length).toBeGreaterThan(0);
    expect(levelThree?.items[0].content).toBeTruthy();
  });

  it("applies an enabled PPT template after semantic layout selection", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const templateSlide = buildDefaultTemplateSlide("cover-title");
    const template = {
      category: "cover-title",
      createdAt: "2026-06-01T00:00:00.000Z",
      customCategoryKey: null,
      customCategoryName: null,
      description: "测试模板",
      id: "template-cover",
      isEnabled: true,
      name: "测试封面模板",
      slide: {
        ...templateSlide,
        elements: templateSlide.elements.map((element) =>
          element.semanticType === "title"
            ? {
                ...element,
                bounds: {
                  height: 0.7,
                  width: 8.2,
                  x: 2.2,
                  y: 3.1
                }
              }
            : element
        )
      },
      sortOrder: 1,
      tags: ["中国商务通用"],
      updatedAt: "2026-06-01T00:00:00.000Z"
    };
    const fake = createFakeClient([toSemanticPlan(mock.slides[0])]);

    templateService.selectPptTemplateForSlide.mockResolvedValue(template);

    const result = await composeSingleSlideFromOutline(
      input,
      mock.slides[0].content,
      mock.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );
    const title = result.elements.find((element) => element.semanticType === "title");

    expect(templateService.selectPptTemplateForSlide).toHaveBeenCalledWith(
      expect.objectContaining({
        input,
        semanticPlan: expect.objectContaining({
          layoutSelection: expect.objectContaining({
            selectedLayoutType: "cover-title"
          })
        })
      })
    );
    expect(title?.bounds).toEqual({
      height: 0.7,
      width: 8.2,
      x: 2.2,
      y: 3.1
    });
    expect(title?.content).toBe(mock.slides[0].content.title);
    expect(result.designPlan.visualStrategy).toContain("测试封面模板");
    expect(result.layoutDiagnostics.warnings.join(" ")).toContain("已套用模板");
  });

  it("maps title-body-points template text from display content instead of placeholders", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const templateSlide = buildDefaultTemplateSlide("title-body-points");
    const content = {
      ...mock.slides[0].content,
      subtitle: "针对性复习，强化应试",
      bodyPoints: [
        "内容理解：情感变化原因",
        "手法赏析：动静结合、侧面描写",
        "文言考点：词类活用、古今异义"
      ],
      contentBlocks: [
        {
          blockType: "title" as const,
          priority: 1,
          text: mock.slides[0].content.title
        },
        {
          blockType: "body" as const,
          priority: 2,
          text: "内容理解：情感变化原因"
        },
        {
          blockType: "body" as const,
          priority: 2,
          text: "手法赏析：动静结合、侧面描写"
        },
        {
          blockType: "body" as const,
          priority: 2,
          text: "文言考点：词类活用、古今异义"
        }
      ],
      contentLayers: {
        ...mock.slides[0].content.contentLayers,
        supporting: [1, 2, 3]
      }
    };
    const semanticPlan = {
      ...toSemanticPlan(mock.slides[0]),
      content,
      layoutSelection: {
        ...mock.slides[0].layoutSelection,
        candidates: [
          {
            fitReason: "三卡片结构适合承载本页三条考试要点。",
            layoutType: "title-body-points",
            risk: "需要控制单条文字长度。",
            score: 95
          },
          {
            fitReason: "章节页可作为备选承载概览。",
            layoutType: "chapter",
            risk: "细节承载不足。",
            score: 82
          }
        ],
        selectedLayoutType: "title-body-points",
        selectionReason: "优先使用三卡片要点页。"
      }
    };
    const template = {
      category: "title-body-points",
      createdAt: "2026-06-01T00:00:00.000Z",
      customCategoryKey: null,
      customCategoryName: null,
      description: "标题正文要点模板",
      id: "template-title-body-points",
      isEnabled: true,
      name: "测试要点模板",
      slide: templateSlide,
      sortOrder: 1,
      tags: ["中国商务通用"],
      updatedAt: "2026-06-01T00:00:00.000Z"
    };
    const fake = createFakeClient([semanticPlan]);

    templateService.selectPptTemplateForSlide.mockResolvedValue(template);

    const result = await composeSingleSlideFromOutline(
      input,
      content,
      mock.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );
    const subtitle = result.elements.find(
      (element) => element.semanticType === "subtitle" && element.type === "text"
    );
    const cardTexts = result.elements.filter(
      (element) => element.semanticType === "card" && element.type === "text"
    );

    expect(subtitle?.content).toBe("针对性复习，强化应试");
    expect(cardTexts.map((element) => element.content)).toEqual(
      result.content.contentBlocks
        .filter((block) => block.blockType !== "title")
        .sort((first, second) => first.priority - second.priority)
        .slice(0, cardTexts.length)
        .map((block) => block.text)
    );
    expect(result.elements.map((element) => element.content).join("\n")).not.toContain(
      "不应使用的支撑层"
    );
    expect(result.elements.map((element) => element.content).join("\n")).not.toContain(
      "要点一"
    );
  });

  it("adds layout elements for all content blocks when a template has too few body slots", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const templateSlide = buildDefaultTemplateSlide("title-body-points");
    const bodySlot = templateSlide.elements.find(
      (element) => element.type === "text" && element.semanticType === "card"
    );
    const oneSlotTemplateSlide = {
      ...templateSlide,
      elements: templateSlide.elements.filter(
        (element) =>
          element.semanticType !== "card" ||
          element.type !== "text" ||
          element.id === bodySlot?.id
      )
    };
    const denseContent = {
      ...mock.slides[0].content,
      bodyPoints: Array.from({ length: 5 }, (_, index) => `正文要点 ${index + 1}`),
      contentBlocks: [
        {
          blockType: "title" as const,
          priority: 1,
          text: mock.slides[0].content.title
        },
        ...Array.from({ length: 9 }, (_, index) => ({
          blockType: "body" as const,
          priority: Math.min(5, index + 1),
          text: `模板不足时也要落版 ${index + 1}`
        }))
      ]
    };
    const semanticPlan = {
      ...toSemanticPlan(mock.slides[0]),
      content: denseContent,
      layoutSelection: {
        ...mock.slides[0].layoutSelection,
        candidates: [
          {
            fitReason: "测试模板正文位不足时的补齐逻辑。",
            layoutType: "title-body-points",
            risk: "需要紧凑落版。",
            score: 91
          },
          {
            fitReason: "章节页作为备选。",
            layoutType: "chapter",
            risk: "内容承载不足。",
            score: 80
          }
        ],
        selectedLayoutType: "title-body-points",
        selectionReason: "优先套用测试模板。"
      }
    };
    const template = {
      category: "title-body-points",
      createdAt: "2026-06-01T00:00:00.000Z",
      customCategoryKey: null,
      customCategoryName: null,
      description: "正文位不足模板",
      id: "template-one-body-slot",
      isEnabled: true,
      name: "单正文位模板",
      slide: oneSlotTemplateSlide,
      sortOrder: 1,
      tags: ["中国商务通用"],
      updatedAt: "2026-06-01T00:00:00.000Z"
    };
    const fake = createFakeClient([semanticPlan]);

    templateService.selectPptTemplateForSlide.mockResolvedValue(template);

    const result = await composeSingleSlideFromOutline(
      input,
      denseContent,
      mock.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );
    const boundIndexes = new Set(
      result.elements
        .map((element) => element.contentBlockIndex)
        .filter((index): index is number => typeof index === "number")
    );

    expect(boundIndexes.size).toBe(result.content.contentBlocks.length);
    for (const block of result.content.contentBlocks) {
      expect(result.elements.map((element) => element.content).join("\n")).toContain(
        block.text
      );
    }
    expect(result.elements.length).toBeLessThanOrEqual(24);
  });

  it("falls back to built-in layout when template selection returns no match", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const fake = createFakeClient([toSemanticPlan(mock.slides[0])]);

    templateService.selectPptTemplateForSlide.mockResolvedValue(null);

    const result = await composeSingleSlideFromOutline(
      input,
      mock.slides[0].content,
      mock.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );

    expect(result.layoutDiagnostics.warnings.join(" ")).toContain(
      "未命中启用模板"
    );
    expect(result.elements.some((element) => element.id === "slide-1-title")).toBe(
      true
    );
  });

  it("repairs a low-score semantic plan once without changing slide identity", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const lowPlan = {
      ...toSemanticPlan(mock.slides[0]),
      layoutDiagnostics: {
        density: 0.96,
        hasOverflow: true,
        needsUserConfirmation: true,
        overflowFixes: ["reduce-font-size", "compress-copy", "adjust-layout"],
        warnings: ["文本元素 slide-1-body 可能溢出。"]
      },
      semanticElements: toSemanticPlan(mock.slides[0]).semanticElements.map((element) =>
        element.semanticType === "title"
          ? {
              ...element,
              content: `${element.content} ${"很长".repeat(80)}`
            }
          : element
      )
    };
    const repairedPlan = {
      ...toSemanticPlan(mock.slides[0]),
      layoutSelection: {
        ...mock.slides[0].layoutSelection,
        selectedLayoutType: "title-body-points",
        candidates: [
          {
            fitReason: "紧凑要点页更适合修复溢出。",
            layoutType: "title-body-points",
            risk: "需要压缩正文。",
            score: 92
          },
          mock.slides[0].layoutSelection.candidates[0]
        ]
      }
    };
    const fake = createFakeClient([lowPlan, repairedPlan]);

    const result = await composeSingleSlideFromOutline(
      input,
      mock.slides[0].content,
      mock.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );

    expect(fake.calls).toHaveLength(2);
    expect(JSON.stringify(fake.calls[1].messages)).toContain("服务端设计质量评分偏低");
    expect(JSON.stringify(fake.calls[1].messages)).toContain("不得改变 slideId");
    expect(result.slideId).toBe(mock.slides[0].slideId);
    expect(result.index).toBe(mock.slides[0].index);
    expect(["repaired", "still-low"]).toContain(result.designQualityScore.repairStatus);
  });

  it("turns data, process, and comparison semantic roles into compact renderable layouts", async () => {
    const source = buildMockAnalyzedDeck({
      ...input,
      pageCount: 6
    });
    const [dataSlide, processSlide, comparisonSlide] = source.slides.map(toSemanticPlan);
    dataSlide.pageIntent = {
      ...dataSlide.pageIntent,
      contentDensity: "high",
      pageRole: "data",
      primaryGoal: "explain"
    };
    dataSlide.layoutSelection = {
      candidates: [
        {
          fitReason: "数据页需要图表承载指标关系。",
          layoutType: "big-chart",
          risk: "需要控制标签数量。",
          score: 94
        },
        {
          fitReason: "左右结构可让结论与图表并列。",
          layoutType: "left-text-right-chart",
          risk: "正文过长会压缩图表空间。",
          score: 88
        }
      ],
      selectedLayoutType: "big-chart",
      selectionReason: "图表是本页主体。"
    };
    dataSlide.semanticElements = dataSlide.semanticElements.map((element, index) =>
      index === 2
        ? {
            ...element,
            category: "infographic",
            elementType: "chartPlaceholder",
            role: "趋势图表",
            semanticType: "chart"
          }
        : element
    );
    processSlide.pageIntent = {
      ...processSlide.pageIntent,
      contentDensity: "medium",
      pageRole: "process",
      primaryGoal: "explain"
    };
    processSlide.layoutSelection = {
      candidates: [
        {
          fitReason: "流程页需要步骤结构。",
          layoutType: "process-steps",
          risk: "步骤过多时需要拆分。",
          score: 94
        },
        {
          fitReason: "时间轴可承载阶段推进。",
          layoutType: "time-axis",
          risk: "不适合无时间顺序内容。",
          score: 86
        }
      ],
      selectedLayoutType: "process-steps",
      selectionReason: "步骤结构最清晰。"
    };
    comparisonSlide.pageIntent = {
      ...comparisonSlide.pageIntent,
      contentDensity: "medium",
      pageRole: "comparison",
      primaryGoal: "compare"
    };
    comparisonSlide.layoutSelection = {
      candidates: [
        {
          fitReason: "对比页需要左右并列比较。",
          layoutType: "two-column-compare",
          risk: "两侧内容长度需要均衡。",
          score: 94
        },
        {
          fitReason: "矩阵可承载多维比较。",
          layoutType: "quadrant-matrix",
          risk: "维度定义不足时理解成本高。",
          score: 86
        }
      ],
      selectedLayoutType: "two-column-compare",
      selectionReason: "双栏对比最直接。"
    };
    const fake = createFakeClient([
      dataSlide,
      processSlide,
      comparisonSlide,
      ...source.slides.slice(3).map(toSemanticPlan)
    ]);
    const result = await composeDeckSlidesFromOutline(
      input,
      source.slides.map((slide) => slide.content),
      source.unifiedVisualSpec,
      {
        client: fake.client,
        env: {
          OPENAI_API_KEY: "test-key",
          AI_TEXT_MODEL: "test-model"
        }
      }
    );

    expect(result[0].elements.some((element) => element.type === "chartPlaceholder")).toBe(true);
    expect(result[0].layoutDiagnostics.needsUserConfirmation).toBe(true);
    expect(result[1].elements.some((element) => element.id.includes("step"))).toBe(true);
    expect(result[2].elements.some((element) => element.id.includes("left-card"))).toBe(true);
  });
});
