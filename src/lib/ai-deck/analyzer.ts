import OpenAI from "openai";

import {
  buildMockAnalyzedDeck,
  buildMockSlideCompositionPlanFromContent
} from "./fallback";
import { generateValidatedJson, type JsonChatClient } from "./openai-json";
import {
  analyzedDeckResultSchema,
  analyzeDeckRequestSchema,
  deckAnalysisResultSchema,
  deckOutlineResultSchema,
  slideCompositionPlanSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type DeckAnalysisResult,
  type DeckOutlineResult,
  type SlideCompositionPlan,
  type SlideContent,
  type UnifiedVisualSpec
} from "./schema";

const defaultModel = "gpt-4.1-mini";

export type AiDeckEnv = {
  AI_TEXT_TEMPERATURE?: string | number;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  AI_TEXT_MODEL?: string;
};

export type AnalyzeDeckOptions = {
  client?: JsonChatClient;
  env?: AiDeckEnv;
};

function createClient(env: AiDeckEnv): JsonChatClient | null {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || undefined
  }) as unknown as JsonChatClient;
}

function serialize(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildDeckAnalysisMessages(input: AnalyzeDeckRequest) {
  return [
    {
      role: "system" as const,
      content:
        "你是资深中文优先 PPT 内容架构师。你负责把原始文本拆成结构清晰的 PPT 页面文案，并给出统一视觉说明。必须只输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请分析以下输入，返回 DeckAnalysisResult JSON。

硬性要求：
- slides 数量必须等于 pageCount。
- unifiedVisualSpec 是全局统一视觉说明，后续每页图层都要遵守。
- deckType 决定 PPT 的场景结构与页面组织方式，style 决定叙事与表达方式。
- 每页只表达一个中心观点，bodyPoints 控制在 2-5 条。
- locale=${input.locale}，输出语言必须匹配 locale。

输入：
${serialize(input)}`
    }
  ];
}

function buildSlideCompositionMessages({
  input,
  slide,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  slide: SlideContent;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是 PPT 单页视觉编排师。你负责判断哪些内容用文字，哪些内容生成图片图层，并输出可由程序合成 PPT 页面的 JSON。必须只输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请为单页生成 SlideCompositionPlan JSON。

硬性要求：
- canvas 固定为 {"aspectRatio":"16:9","width":100,"height":56.25}。
- bounds 使用百分比坐标，x/y/width/height 都必须在 0-100 内，且元素不能越界。
- 至少包含标题文字元素、正文文字元素、一个视觉或形状元素。
- 如果元素 type 是 generatedImage，必须创建对应 imageLayerRequests，并引用 imageRequestId。
- imageLayerRequests 只是图片生成请求，不要返回真实图片。
- 输出语言必须匹配 locale=${input.locale}。

统一视觉说明：
${serialize(unifiedVisualSpec)}

单页文案：
${serialize(slide)}

整套输入背景：
${serialize({
  audience: input.audience,
  goal: input.goal,
  pageCount: input.pageCount,
  deckType: input.deckType,
  style: input.style,
  palette: input.palette
})}`
    }
  ];
}

async function analyzeWithAi(
  input: AnalyzeDeckRequest,
  client: JsonChatClient,
  model: string,
  temperature: number
): Promise<AnalyzedDeckResult> {
  const analysis = await generateValidatedJson({
    client,
    model,
    temperature,
    schema: deckAnalysisResultSchema,
    schemaName: "DeckAnalysisResult",
    messages: buildDeckAnalysisMessages(input)
  });

  if (analysis.slides.length !== input.pageCount) {
    throw new Error("AI returned a slide count that does not match pageCount.");
  }

  const slides = await Promise.all(
    analysis.slides.map((slide) =>
      generateValidatedJson({
        client,
        model,
        temperature,
        schema: slideCompositionPlanSchema,
        schemaName: "SlideCompositionPlan",
        messages: buildSlideCompositionMessages({
          input,
          slide,
          unifiedVisualSpec: analysis.unifiedVisualSpec
        })
      })
    )
  );

  return analyzedDeckResultSchema.parse({
    mode: "ai-json",
    deckTitle: analysis.deckTitle,
    deckSummary: analysis.deckSummary,
    unifiedVisualSpec: analysis.unifiedVisualSpec,
    slides
  });
}

async function createDeckOutlineWithAi(
  input: AnalyzeDeckRequest,
  client: JsonChatClient,
  model: string,
  temperature: number
): Promise<DeckOutlineResult> {
  const analysis = await generateValidatedJson({
    client,
    model,
    temperature,
    schema: deckAnalysisResultSchema,
    schemaName: "DeckAnalysisResult",
    messages: buildDeckAnalysisMessages(input)
  });

  if (analysis.slides.length !== input.pageCount) {
    throw new Error("AI returned a slide count that does not match pageCount.");
  }

  return deckOutlineResultSchema.parse({
    mode: "ai-json",
    ...analysis
  });
}

async function composeSlidesWithAi({
  client,
  input,
  model,
  slides,
  temperature,
  unifiedVisualSpec
}: {
  client: JsonChatClient;
  input: AnalyzeDeckRequest;
  model: string;
  slides: SlideContent[];
  temperature: number;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  return Promise.all(
    slides.map((slide) =>
      generateValidatedJson({
        client,
        model,
        temperature,
        schema: slideCompositionPlanSchema,
        schemaName: "SlideCompositionPlan",
        messages: buildSlideCompositionMessages({
          input,
          slide,
          unifiedVisualSpec
        })
      })
    )
  );
}

function parseTemperature(value: AiDeckEnv["AI_TEXT_TEMPERATURE"]) {
  if (value === undefined || value === null || value === "") {
    return 0.2;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0.2;
}

export async function analyzeDeck(
  rawInput: unknown,
  options: AnalyzeDeckOptions = {}
) {
  const input = analyzeDeckRequestSchema.parse(rawInput);
  const env = options.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_TEXT_MODEL: process.env.AI_TEXT_MODEL
  };
  const client = options.client ?? createClient(env);
  const model = env.AI_TEXT_MODEL || defaultModel;
  const temperature = parseTemperature(env.AI_TEXT_TEMPERATURE);

  if (!client) {
    return buildMockAnalyzedDeck(input);
  }

  return analyzeWithAi(input, client, model, temperature);
}

export async function createDeckOutline(
  rawInput: unknown,
  options: AnalyzeDeckOptions = {}
) {
  const input = analyzeDeckRequestSchema.parse(rawInput);
  const env = options.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_TEXT_MODEL: process.env.AI_TEXT_MODEL
  };
  const client = options.client ?? createClient(env);
  const model = env.AI_TEXT_MODEL || defaultModel;
  const temperature = parseTemperature(env.AI_TEXT_TEMPERATURE);

  if (!client) {
    const mock = buildMockAnalyzedDeck(input);

    return deckOutlineResultSchema.parse({
      mode: "mock",
      deckTitle: mock.deckTitle,
      deckSummary: mock.deckSummary,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => slide.content)
    });
  }

  return createDeckOutlineWithAi(input, client, model, temperature);
}

export async function composeDeckFromOutline(
  rawInput: unknown,
  slides: SlideContent[],
  unifiedVisualSpec: UnifiedVisualSpec,
  options: AnalyzeDeckOptions = {}
): Promise<SlideCompositionPlan[]> {
  const input = analyzeDeckRequestSchema.parse(rawInput);
  const env = options.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_TEXT_MODEL: process.env.AI_TEXT_MODEL
  };
  const client = options.client ?? createClient(env);
  const model = env.AI_TEXT_MODEL || defaultModel;
  const temperature = parseTemperature(env.AI_TEXT_TEMPERATURE);

  if (slides.length !== input.pageCount) {
    throw new Error("Outline slide count does not match pageCount.");
  }

  if (!client) {
    return slides.map((slide) =>
      buildMockSlideCompositionPlanFromContent({
        input,
        slide,
        unifiedVisualSpec
      })
    );
  }

  return composeSlidesWithAi({
    client,
    input,
    model,
    slides,
    temperature,
    unifiedVisualSpec
  });
}

export type { DeckAnalysisResult, DeckOutlineResult };
