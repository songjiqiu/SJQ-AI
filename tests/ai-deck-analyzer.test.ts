import { describe, expect, it, vi } from "vitest";

import {
  analyzeDeckIntent,
  analyzeDeck,
  composeDeckFromOutline,
  createDeckOutline
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
  style: "strategic",
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

describe("analyzeDeck", () => {
  it("analyzes deck intent with immutable deck type and style", async () => {
    const fake = createFakeClient([
      {
        deckType: "fundraising-pitch",
        style: "data",
        audience: "投资人",
        goal: "获得试点合作意向",
        coreMessage: "用市场机会与试点成果证明合作价值。",
        recommendedPageCount: 5
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
    expect(result.style).toBe("data");
    expect(result.recommendedPageCount).toBe(5);
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
    const structure = {
      deckType: input.deckType,
      style: input.style,
      deckTitle: mock.deckTitle,
      deckSummary: mock.deckSummary,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => ({
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
      style: input.style,
      slides: mock.slides.map((slide) => slide.content)
    };
    const fake = createFakeClient([structure, pageCopy]);

    const aiResult = await createDeckOutline(input, {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(aiResult.mode).toBe("ai-json");
    expect(aiResult.slides).toHaveLength(3);
    expect(fake.calls).toHaveLength(2);

    const result = await createDeckOutline(input, {
      env: {
        OPENAI_API_KEY: ""
      }
    });

    expect(result.mode).toBe("mock");
    expect(result.slides).toHaveLength(3);
    expect(result.slides[0]).not.toHaveProperty("elements");
    expect(result.unifiedVisualSpec.themeName).toBeTruthy();
  });

  it("repairs raw control characters in model JSON strings", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = {
      deckType: input.deckType,
      style: input.style,
      deckTitle: mock.deckTitle,
      deckSummary: `测试摘要第一行
测试摘要第二行`,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => ({
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
      style: input.style,
      slides: mock.slides.map((slide) => slide.content)
    };
    const invalidJson = JSON.stringify(structure).replace(
      "测试摘要第一行\\n测试摘要第二行",
      `测试摘要第一行
测试摘要第二行`
    );
    const fake = createFakeClient([
      new Error("400 This response_format type is unavailable now."),
      invalidJson,
      pageCopy
    ]);

    const result = await createDeckOutline(input, {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.deckSummary).toContain("\n");
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
        recommendedPageCount: 5
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
      deckType: input.deckType,
      style: input.style,
      locale: input.locale,
      palette: input.palette,
      pageCount: input.pageCount,
      unifiedVisualSpec:
        "整体风格庄重素雅，主色调为深灰、暗红、米白色；标题使用宋体，正文使用楷体；背景以深灰或米白为主。",
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
      style: input.style,
      locale: input.locale,
      slides: looseStructure.slides.map((slide) => ({
        title: slide.title,
        bodyPoints: [slide.keyMessage, slide.purpose]
      }))
    };
    const fake = createFakeClient([
      new Error("400 This response_format type is unavailable now"),
      looseStructure,
      loosePageCopy
    ]);

    const result = await createDeckOutline(input, {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "deepseek-v4-flash"
      }
    });

    expect(result.mode).toBe("ai-json");
    expect(result.deckTitle).toBe("十里长街送总理");
    expect(result.deckSummary).toContain(input.goal);
    expect(result.unifiedVisualSpec.themeName).toBeTruthy();
    expect(result.unifiedVisualSpec.colorPalette).toHaveLength(4);
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
      deckType: input.deckType,
      style: input.style,
      deckTitle: "测试课件",
      deckSummary: "这是一份用于测试错形视觉说明修复的大纲摘要。",
      unifiedVisualSpec: {
        colorScheme: "深灰、暗红、米白",
        animation: "温和淡入，不使用花哨动画",
        layout: ["标题统一置顶", "正文使用左右分栏", "图片不遮挡文字"],
        decoration: "暗红细线与历史照片纹理"
      },
      slides: [
        {
          title: "开场",
          purpose: "建立主题语境",
          keyMessage: "用一个庄重开场引出主题",
          visualDirection: "深色背景和简洁标题"
        },
        {
          title: "内容分析",
          purpose: "拆解主要内容",
          keyMessage: "围绕文本重点逐层展开",
          visualDirection: "左右分栏与重点标注"
        },
        {
          title: "总结",
          purpose: "收束课堂重点",
          keyMessage: "回到核心表达并引导复盘",
          visualDirection: "米白背景和暗红强调线"
        }
      ]
    };
    const pageCopy = {
      deckType: input.deckType,
      style: input.style,
      slides: structure.slides.map((slide, index) => ({
        title: slide.title,
        bodyPoints: [slide.keyMessage, `第 ${index + 1} 个课堂重点`],
        speakerGoal: slide.purpose,
        visualIntent: slide.visualDirection
      }))
    };
    const fake = createFakeClient([structure, pageCopy]);

    const result = await createDeckOutline(input, {
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
    expect(result.unifiedVisualSpec.forbiddenRules.length).toBeGreaterThan(0);
  });

  it("repairs fenced JSON output before accepting outline JSON", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const structure = {
      deckType: input.deckType,
      style: input.style,
      deckTitle: mock.deckTitle,
      deckSummary: mock.deckSummary,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => ({
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
      style: input.style,
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
                  ? `\`\`\`json\n${JSON.stringify(structure)}\n\`\`\``
                  : JSON.stringify(calls.length === 2 ? structure : pageCopy)
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

    const result = await createDeckOutline(input, {
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

  it("returns structured diagnostics after repeated invalid outline JSON", async () => {
    let thrown: unknown;

    try {
      await createDeckOutline(input, {
        client: createFakeClient([
          {
            deckType: input.deckType,
            style: input.style,
            deckTitle: 123,
            deckSummary: "字段类型错误的结构大纲响应。",
            unifiedVisualSpec: {},
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
      schemaName: "DeckStructureOutlineResult"
    });
    expect(details?.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: "json_schema",
          responseSnippet: expect.stringContaining("\"deckTitle\":123"),
          stage: "validation",
          zodIssues: expect.arrayContaining([
            expect.objectContaining({
              path: expect.arrayContaining(["deckTitle"])
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

  it("keeps failing when loose outline slide count does not match pageCount", async () => {
    let thrown: unknown;

    try {
      await createDeckOutline(input, {
        client: createFakeClient([
          {
            deckType: input.deckType,
            style: input.style,
            unifiedVisualSpec: "只有两页的大纲不能被安全修复。",
            slides: [
              {
                title: "第一页",
                purpose: "说明背景",
                keyMessage: "背景信息",
                visualDirection: "简洁背景"
              },
              {
                title: "第二页",
                purpose: "说明结论",
                keyMessage: "结论信息",
                visualDirection: "重点强调"
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
      ...mock.slides
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
});
