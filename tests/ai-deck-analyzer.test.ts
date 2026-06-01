import { describe, expect, it, vi } from "vitest";

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
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";

const input: AnalyzeDeckRequest = {
  sourceText: "这是一段用于测试 AI 拆页编排的长文本，包含市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 3,
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

function buildStructure(inputValue: AnalyzeDeckRequest) {
  const mock = buildMockAnalyzedDeck(inputValue);

  return {
    deckTitle: mock.deckTitle,
    deckSummary: mock.deckSummary,
    slides: mock.slides.map((slide) => ({
      slideId: slide.slideId,
      index: slide.index,
      title: slide.content.title,
      purpose: slide.content.speakerGoal,
      keyMessage: slide.content.bodyPoints[0],
      visualDirection: slide.content.visualIntent
    }))
  };
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
  it("analyzes deck intent with immutable deck type and ignores legacy style", async () => {
    const fake = createFakeClient([
      {
        deckType: "fundraising-pitch",
        style: "data",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 5,
        fileSummaries: [],
        structureOutline: {
          deckTitle: "新能源融资路演",
          deckSummary: "这是一份用于确认结构的大纲草稿。",
          slides: [1, 2, 3, 4, 5].map((index) => ({
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

    expect(result.deckType).toBe("fundraising-pitch");
    expect(result).not.toHaveProperty("style");
    expect(result.input).not.toHaveProperty("style");
    expect(result.recommendedPageCount).toBe(5);
    expect(result.structureOutline.slides).toHaveLength(5);
    expect(result.input.idea).toContain("新能源");
  });

  it("uses local mock fallback when no API key is configured", async () => {
    const result = await analyzeDeck(input, {
      env: {
        OPENAI_API_KEY: ""
      }
    });

    expect(result.mode).toBe("mock");
    expect(result.slides).toHaveLength(3);
  });

  it("creates an outline-only result without slide composition", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const pageCopy = {
      deckType: input.deckType,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => slide.content)
    };
    const fake = createFakeClient([pageCopy]);

    const aiResult = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(aiResult.mode).toBe("ai-json");
    expect(aiResult.slides).toHaveLength(3);
    expect(aiResult.unifiedVisualSpec).toEqual(mock.unifiedVisualSpec);
    expect(fake.calls).toHaveLength(1);
    expect(JSON.stringify(fake.calls[0].response_format)).toContain(
      "unifiedVisualSpec"
    );
    expect(JSON.stringify(fake.calls[0].messages)).toContain(
      "不得引用外观配色预设名"
    );
    expect(JSON.stringify(fake.calls[0].messages)).toContain("13.333 英寸");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("12 栏栅格");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("4.5:1");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("图片主体不能压在标题区");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("coreStatement");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("contentLayers");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("pptTypeVisualTone");
    expect(JSON.stringify(fake.calls[0].messages)).toContain(
      "只能返回当前 PPT 类型"
    );
    expect(JSON.stringify(fake.calls[0].messages)).toContain("recommendedTone");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("visualKeywords");
    expect(JSON.stringify(fake.calls[0].messages)).toContain("typographyRules.scale");
    expect(JSON.stringify(fake.calls[0].messages)).not.toContain("typographyScale");
    expect(JSON.stringify(fake.calls[0].messages)).not.toContain("colorRoleDefinitions");

    const result = await createDeckOutline(input, structure, [], {
      env: {
        OPENAI_API_KEY: ""
      }
    });

    expect(result.mode).toBe("mock");
    expect(result.slides).toHaveLength(3);
    expect(result.slides[0]).not.toHaveProperty("elements");
    expect(result.unifiedVisualSpec.themeName).toBeTruthy();
    expect(result.unifiedVisualSpec.themeName).not.toMatch(/星图|Star Map/i);
    expect(result.unifiedVisualSpec.pageSpec.gridColumns).toBe(12);
    expect(result.slides[0].coreStatement).toBeTruthy();
    expect(result.slides[0].contentLayers.primary.length).toBeGreaterThan(0);
    expect(result.slides[0].slideTransition.toNext).toBeTruthy();
    expect(result.unifiedVisualSpec.typographyRules.scale.coverTitle.fontSize).toBeGreaterThan(20);
    expect(result.unifiedVisualSpec.colorRoles.contrastRequirement).toContain(
      "4.5:1"
    );
    expect(result.unifiedVisualSpec.imageRules.subjectAvoidsTitleArea).toBe(true);
  });

  it("repairs raw control characters in model JSON strings", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = {
      ...buildStructure(input),
      deckSummary: `测试摘要第一行
测试摘要第二行`
    };
    const pageCopy = {
      deckType: input.deckType,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => slide.content)
    };
    const invalidJson = JSON.stringify(pageCopy).replace(
      mock.slides[0].content.bodyPoints[0],
      `测试正文第一行
测试正文第二行`
    );
    const fake = createFakeClient([
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

    expect(result.slides[0].bodyPoints[0]).toContain("\n");
    expect(result.slides).toHaveLength(3);
    expect(fake.calls[1].response_format).toMatchObject({
      type: "json_object"
    });
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
        recommendedPageCount: 5,
        fileSummaries: [],
        structureOutline: {
          deckTitle: "新能源融资路演",
          deckSummary: "这是一份用于确认结构的大纲草稿。",
          slides: [1, 2, 3, 4, 5].map((index) => ({
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

    expect(result.recommendedPageCount).toBe(5);
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
      slides: [
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
      ]
    };
    const loosePageCopy = {
      deckType: input.deckType,
      locale: input.locale,
      unifiedVisualSpec:
        "整体风格庄重素雅，主色调为深灰、暗红、米白色；标题使用宋体，正文使用楷体；背景以深灰或米白为主。",
      slides: looseStructure.slides.map((slide) => ({
        title: slide.title,
        bodyPoints: [slide.keyMessage, slide.purpose]
      }))
    };
    const fake = createFakeClient([
      new Error("400 This response_format type is unavailable now"),
      loosePageCopy
    ]);

    const normalizedStructure = {
      deckTitle: "十里长街送总理",
      deckSummary: "这是一份围绕课堂文本组织的结构大纲。",
      slides: looseStructure.slides.map((slide, index) => ({
        ...slide,
        slideId: `slide-${index + 1}`,
        index: index + 1
      }))
    };
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
    expect(result.unifiedVisualSpec.colorPalette).toHaveLength(4);
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
      "slide-3"
    ]);
    expect(result.slides.map((slide) => slide.index)).toEqual([1, 2, 3]);
    expect(result.slides[0].speakerGoal).toBe("引入课题，创设庄重氛围");
    expect(fake.calls[1].response_format).toMatchObject({
      type: "json_object"
    });
    expect(
      JSON.stringify(fake.calls[1].messages)
    ).toContain("目标 JSON Schema");
  });

  it("normalizes loose unified visual spec objects from compatible providers", async () => {
    const structure = {
      deckTitle: "测试课件",
      deckSummary: "这是一份用于测试错形视觉说明修复的大纲摘要。",
      slides: [
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
      ]
    };
    const pageCopy = {
      deckType: input.deckType,
      unifiedVisualSpec: {
        colorScheme: "深灰、暗红、米白",
        animation: "温和淡入，不使用花哨动画",
        layout: ["标题统一置顶", "正文使用左右分栏", "图片不遮挡文字"],
        decoration: "暗红细线与历史照片纹理"
      },
      slides: structure.slides.map((slide, index) => ({
        title: slide.title,
        bodyPoints: [slide.keyMessage, `第 ${index + 1} 个课堂重点`],
        speakerGoal: slide.purpose,
        visualIntent: slide.visualDirection
      }))
    };
    const fake = createFakeClient([pageCopy]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.unifiedVisualSpec.colorPalette).toEqual([
      "#246BFE",
      "#D9E7FF",
      "#17202A",
      "#16A085"
    ]);
    expect(result.unifiedVisualSpec.visualStyle).toContain("深灰");
    expect(result.unifiedVisualSpec.layoutRules).toEqual([
      "标题统一置顶",
      "正文使用左右分栏",
      "图片不遮挡文字"
    ]);
    expect(result.unifiedVisualSpec.colorRoles.contrastRequirement).toContain(
      "4.5:1"
    );
    expect(result.unifiedVisualSpec.forbiddenRules.length).toBeGreaterThan(0);
  });

  it("fills structured visual spec fields for legacy visual spec values", () => {
    const normalized = normalizeUnifiedVisualSpec(
      "深灰背景、暗红强调、正文保持高可读性。",
      input
    );

    expect(normalized.visualStyle).toContain("深灰");
    expect(normalized.colorPalette).toEqual([
      "#246BFE",
      "#D9E7FF",
      "#17202A",
      "#16A085"
    ]);
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
        themeName: "小石潭记-星图",
        visualStyle: "山水游记课件，清雅留白，正文保持高可读性。",
        colorPalette: ["#246BFE", "#D9E7FF", "#17202A", "#16A085"],
        typography: "标题醒目，正文清晰。",
        imageStyle: "图片干净，不遮挡标题。",
        layoutRules: ["标题统一置顶", "正文在安全边距内"],
        consistencyRules: ["沿用统一色板", "保持层级一致"],
        forbiddenRules: ["不要使用密集小字图片"]
      },
      input
    );

    expect(normalized.themeName).toBe("小石潭记");
  });

  it("repairs changed deck type before accepting page copy JSON", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const repairedPageCopy = {
      deckType: input.deckType,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => slide.content)
    };
    const changedPageCopy = {
      ...repairedPageCopy,
      deckType: "fundraising-pitch"
    };
    const fake = createFakeClient([changedPageCopy, repairedPageCopy]);

    const result = await createDeckOutline(input, structure, [], {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.slides).toHaveLength(3);
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[1].response_format).toMatchObject({
      type: "json_object"
    });
    expect(JSON.stringify(fake.calls[1].messages)).toContain("上一次输出未通过结构化校验");
  });

  it("repairs fenced JSON output before accepting page copy JSON", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = buildStructure(input);
    const pageCopy = {
      deckType: input.deckType,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => slide.content)
    };
    const calls: Array<Record<string, unknown>> = [];
    const create = vi.fn(async (payload: Record<string, unknown>) => {
      calls.push(payload);

      return {
        choices: [
          {
            message: {
              content:
                calls.length === 1
                  ? `\`\`\`json\n${JSON.stringify(pageCopy)}\n\`\`\``
                  : JSON.stringify(pageCopy)
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

    expect(result.slides).toHaveLength(3);
    expect(calls[0].response_format).toMatchObject({ type: "json_schema" });
    expect(calls[1].response_format).toMatchObject({ type: "json_object" });
  });

  it("returns structured diagnostics after repeated invalid page copy JSON", async () => {
    let thrown: unknown;

    try {
      await createDeckOutline(input, buildStructure(input), [], {
        client: createFakeClient([
          {
            deckType: input.deckType,
            unifiedVisualSpec: "字段类型错误的视觉规范。",
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
      schemaName: "DeckPageCopyResult"
    });
    expect(details?.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: "json_schema",
          responseSnippet: expect.stringContaining("字段类型错误"),
          stage: "validation",
          zodIssues: expect.arrayContaining([
            expect.objectContaining({
              path: expect.arrayContaining(["unifiedVisualSpec"])
            })
          ])
        }),
        expect.objectContaining({
          error: expect.stringContaining("non-JSON"),
          mode: "json_object",
          responseSnippet: "这不是 JSON",
          stage: "parse"
        })
      ])
    );
  });

  it("keeps failing when page copy slide count does not match pageCount", async () => {
    let thrown: unknown;

    try {
      await createDeckOutline(input, buildStructure(input), [], {
        client: createFakeClient([
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
    expect(result.slides).toHaveLength(3);
    expect(fake.calls).toHaveLength(5);
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

    expect(result).toHaveLength(3);
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
      mock.slides[1].content
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

    expect(create).toHaveBeenCalledTimes(3);
    expect(maxActiveRequests).toBeGreaterThan(1);
    expect(completionOrder).toEqual(["slide-1", "slide-2", "slide-3"]);
    expect(result.map((slide) => slide.slideId)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3"
    ]);
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
      pageCount: 3
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
    const fake = createFakeClient([dataSlide, processSlide, comparisonSlide]);
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
