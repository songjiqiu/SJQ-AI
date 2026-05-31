import OpenAI from "openai";
import { z } from "zod";

import {
  buildMockDeckIntentAnalysis,
  buildMockAnalyzedDeck,
  buildMockSlideCompositionPlanFromContent
} from "./fallback";
import { generateValidatedJson, type JsonChatClient } from "./openai-json";
import { normalizeSlideCompositionPlan } from "./postprocess";
import {
  analyzedDeckResultSchema,
  analyzeDeckRequestSchema,
  deckIntentAnalysisResultSchema,
  deckAnalysisResultSchema,
  deckOutlineIntentInputSchema,
  deckPageCopyResultSchema,
  deckOutlineResultSchema,
  deckStructureOutlineResultSchema,
  deckStructureSlideSchema,
  slideContentSchema,
  slideCompositionPlanSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type DeckIntentAnalysisResult,
  type DeckAnalysisResult,
  type DeckOutlineIntentInput,
  type DeckPageCopyResult,
  type DeckOutlineResult,
  type DeckStructureOutlineResult,
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
- coreMessage 是已确认的核心信息，必须贯穿整套内容。
- 每页只表达一个中心观点，bodyPoints 控制在 2-5 条。
- locale=${input.locale}，输出语言必须匹配 locale。

输入：
${serialize(input)}`
    }
  ];
}

function buildIntentAnalysisMessages(input: DeckOutlineIntentInput) {
  return [
    {
      role: "system" as const,
      content:
        "你是中文优先的 PPT 创作意图分析师。你只负责分析输入，不生成大纲。必须只输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请分析以下输入，返回受众、目标、核心信息和推荐页数 JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- style 必须原样返回 "${input.style}"，只能引用，不能改写、翻译或替换。
- recommendedPageCount 必须是 3 到 18 之间的整数。
- 只根据输入推断 audience、goal、coreMessage，不要生成页面大纲。
- locale=${input.locale}，输出语言必须匹配 locale。

输入：
${serialize({
  ...input,
  textFiles: input.textFiles.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    content: file.content
  }))
})}`
    }
  ];
}

function buildStructureOutlineMessages(input: AnalyzeDeckRequest) {
  return [
    {
      role: "system" as const,
      content:
        "你是资深中文优先 PPT 内容架构师。你只负责生成结构大纲和统一视觉说明，不写每页详细文案。必须只输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请基于已确认的输入分析，返回 DeckStructureOutlineResult JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- style 必须原样返回 "${input.style}"，只能引用，不能改写、翻译或替换。
- slides 数量必须等于 pageCount=${input.pageCount}。
- unifiedVisualSpec 是全局统一视觉说明，后续每页文案和图层都要遵守。
- unifiedVisualSpec 必须是对象，必须包含 themeName、visualStyle、colorPalette、typography、imageStyle、layoutRules、consistencyRules、forbiddenRules，不能输出字符串。
- 根对象只能包含 deckType、style、deckTitle、deckSummary、unifiedVisualSpec、slides，不要输出 locale、palette、pageCount。
- 每页结构只写 title、purpose、keyMessage、visualDirection，不要写 bodyPoints。
- 每页必须包含 slideId、index、title、purpose、keyMessage、visualDirection。
- locale=${input.locale}，输出语言必须匹配 locale。

已确认输入分析：
${serialize({
  audience: input.audience,
  goal: input.goal,
  coreMessage: input.coreMessage,
  pageCount: input.pageCount,
  deckType: input.deckType,
  style: input.style,
  palette: input.palette
})}

原始输入：
${serialize({
  sourceText: input.sourceText
})}`
    }
  ];
}

function buildPageCopyMessages({
  input,
  structure
}: {
  input: AnalyzeDeckRequest;
  structure: DeckStructureOutlineResult;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是中文优先 PPT 单页文案规划师。你负责把结构大纲扩展成每页详细文案 JSON。必须只输出 JSON，不能输出 Markdown。"
    },
    {
      role: "user" as const,
      content: `请基于结构大纲返回 DeckPageCopyResult JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- style 必须原样返回 "${input.style}"，只能引用，不能改写、翻译或替换。
- slides 数量必须等于 pageCount=${input.pageCount}。
- 每个 slideId、index 必须与结构大纲一致。
- 根对象只能包含 deckType、style、slides，不要输出 locale、palette、pageCount。
- 每页必须包含 slideId、index、title、bodyPoints、speakerGoal、visualIntent。
- bodyPoints 控制在 2-5 条，每页只表达一个中心观点。
- 输出语言必须匹配 locale=${input.locale}。

已确认输入分析：
${serialize({
  audience: input.audience,
  goal: input.goal,
  coreMessage: input.coreMessage,
  pageCount: input.pageCount,
  deckType: input.deckType,
  style: input.style,
  palette: input.palette
})}

结构大纲与统一视觉说明：
${serialize(structure)}`
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
- canvas 固定为 {"unit":"inch","aspectRatio":"16:9","width":13.333,"height":7.5,"safeMargin":0.5}。
- bounds 使用 inch 坐标，x/y/width/height 都必须在画布内，且元素不能越界。
- 必须分析 expressionIntent、contentHierarchy、designPlan 和 layoutDiagnostics。
- semanticType 使用 title/subtitle/body/heroVisual/supportingVisual/accentShape/icon/chart/card/badge/background/footer。
- hierarchyLevel 1 为最高层级，5 为最低层级；文本元素必须给出 textStyle。
- 至少包含标题文字元素、正文文字元素、一个视觉或形状元素。
- 如果元素 type 是 generatedImage，必须创建对应 imageLayerRequests，并引用 imageRequestId。
- imageLayerRequests 只是图片生成请求，不要返回真实图片；必须包含 imageType、keywords、prompt、avoid、negativePrompt、aspectRatio。
- layoutDiagnostics 需要说明密度、是否溢出、是否需要用户确认；不要自动拆分页面。
- 输出语言必须匹配 locale=${input.locale}。

统一视觉说明：
${serialize(unifiedVisualSpec)}

单页文案：
${serialize(slide)}

整套输入背景：
${serialize({
  audience: input.audience,
  coreMessage: input.coreMessage,
  goal: input.goal,
  pageCount: input.pageCount,
  deckType: input.deckType,
  style: input.style,
  palette: input.palette
})}`
    }
  ];
}

function buildIntentAnalysisSchema(input: DeckOutlineIntentInput) {
  return z
    .object({
      deckType: z.literal(input.deckType),
      style: z.literal(input.style),
      audience: z.string().trim().min(2).max(120),
      goal: z.string().trim().min(2).max(160),
      coreMessage: z.string().trim().min(2).max(300),
      recommendedPageCount: z.number().int().min(3).max(18)
    })
    .strict();
}

function buildStructureOutlineSchema(input: AnalyzeDeckRequest) {
  return deckStructureOutlineResultSchema
    .extend({
      deckType: z.literal(input.deckType),
      style: z.literal(input.style),
      slides: z.array(deckStructureSlideSchema).length(input.pageCount)
    })
    .strict();
}

function buildPageCopySchema(input: AnalyzeDeckRequest) {
  return deckPageCopyResultSchema
    .extend({
      deckType: z.literal(input.deckType),
      style: z.literal(input.style),
      slides: z.array(slideContentSchema).length(input.pageCount)
    })
    .strict();
}

const fallbackColorPalettes: Record<AnalyzeDeckRequest["palette"], string[]> = {
  "star-map": ["#246BFE", "#D9E7FF", "#17202A", "#16A085"],
  matrix: ["#13966A", "#D9F3E9", "#17202A", "#2563EB"],
  "deep-space": ["#7C3AED", "#EADCFF", "#171F2A", "#14B8A6"],
  "morning-mist": ["#C05621", "#F7E5D6", "#17202A", "#2563EB"]
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

function truncateText(text: string, maxLength: number) {
  const trimmed = text.trim();

  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength - 1)}...`
    : trimmed;
}

function formatLooseValue(value: unknown, maxLength: number): string {
  if (typeof value === "string") {
    return compactText(value, maxLength);
  }

  if (Array.isArray(value)) {
    return compactText(
      value
        .map((item: unknown): string => formatLooseValue(item, maxLength))
        .filter(Boolean)
        .join("；"),
      maxLength
    );
  }

  if (isRecord(value)) {
    return compactText(
      Object.entries(value)
        .map(
          ([key, item]): string => `${key}: ${formatLooseValue(item, maxLength)}`
        )
        .filter(Boolean)
        .join("；"),
      maxLength
    );
  }

  return "";
}

function boundedText({
  fallback,
  maxLength,
  minLength,
  value
}: {
  fallback: string;
  maxLength: number;
  minLength: number;
  value: unknown;
}) {
  const text =
    typeof value === "string"
      ? truncateText(value, maxLength)
      : formatLooseValue(value, maxLength);
  const normalized = text.length >= minLength ? text : fallback;

  return truncateText(normalized, maxLength);
}

function boundedTextArray({
  fallback,
  maxItems,
  maxLength,
  minItems,
  minLength,
  value
}: {
  fallback: string[];
  maxItems: number;
  maxLength: number;
  minItems: number;
  minLength: number;
  value: unknown;
}) {
  const values = (Array.isArray(value) ? value : typeof value === "string" ? [value] : [])
    .map((item) => boundedText({
      fallback: "",
      maxLength,
      minLength,
      value: item
    }))
    .filter((item) => item.length >= minLength);

  if (values.length >= minItems) {
    return values.slice(0, maxItems);
  }

  const merged = [...values, ...fallback]
    .map((item) => compactText(item, maxLength))
    .filter((item, index, array) => item.length >= minLength && array.indexOf(item) === index)
    .slice(0, maxItems);

  return merged.length >= minItems ? merged : fallback.slice(0, maxItems);
}

function pickLooseValue(
  source: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    const value = source[key];

    if (formatLooseValue(value, 500).trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function normalizeUnifiedVisualSpec(
  value: unknown,
  input: AnalyzeDeckRequest
): UnifiedVisualSpec {
  const isChinese = input.locale === "zh-CN";
  const fallbackTheme = isChinese ? "统一视觉方案" : "Unified visual system";
  const fallbackStyle = isChinese
    ? `围绕“${compactText(input.goal, 48)}”保持清晰层级、统一色板和克制装饰。`
    : `Keep clear hierarchy, one palette, and restrained decoration around "${compactText(input.goal, 58)}".`;
  const fallbackTypography = isChinese
    ? "标题醒目有层级，正文保持高可读性和稳定行距。"
    : "Use clear title hierarchy and readable body text with stable line height.";
  const fallbackImageStyle = isChinese
    ? "图片图层保持干净边缘、低噪声背景，并避免密集文字。"
    : "Keep image layers clean-edged, low-noise, and free of dense text.";
  const fallbackLayoutRules = isChinese
    ? ["使用 16:9 横版画布", "重要文字放在安全边距内", "主视觉不遮挡标题"]
    : ["Use a 16:9 canvas", "Keep important text within safe margins", "Do not let hero visuals cover titles"];
  const fallbackConsistencyRules = isChinese
    ? ["所有页面沿用同一色板", "标题和正文层级保持一致", "每页聚焦一个中心观点"]
    : ["Reuse one palette across slides", "Keep title and body hierarchy consistent", "Focus each slide on one key point"];
  const fallbackForbiddenRules = isChinese
    ? ["不要生成密集小字图片", "不要使用与主题无关的装饰"]
    : ["Do not generate dense text inside images", "Do not use unrelated decoration"];

  if (!isRecord(value)) {
    const visualStyle =
      typeof value === "string" && value.trim().length > 0
        ? compactText(value, 240)
        : fallbackStyle;

    return {
      themeName: fallbackTheme,
      visualStyle,
      colorPalette: fallbackColorPalettes[input.palette],
      typography: fallbackTypography,
      imageStyle: fallbackImageStyle,
      layoutRules: fallbackLayoutRules,
      consistencyRules: fallbackConsistencyRules,
      forbiddenRules: fallbackForbiddenRules
    };
  }

  const visualStyleSeed =
    pickLooseValue(value, ["visualStyle", "style", "description"]) ??
    [
      formatLooseValue(value.colorScheme, 80),
      formatLooseValue(value.layout, 80),
      formatLooseValue(value.decoration, 80),
      formatLooseValue(value.animation, 80)
    ]
      .filter(Boolean)
      .join("；");

  return {
    themeName: boundedText({
      fallback: fallbackTheme,
      maxLength: 80,
      minLength: 2,
      value: pickLooseValue(value, ["themeName", "theme", "name"])
    }),
    visualStyle: boundedText({
      fallback: fallbackStyle,
      maxLength: 240,
      minLength: 6,
      value: visualStyleSeed
    }),
    colorPalette: boundedTextArray({
      fallback: fallbackColorPalettes[input.palette],
      maxItems: 6,
      maxLength: 40,
      minItems: 3,
      minLength: 3,
      value: pickLooseValue(value, ["colorPalette", "colors"])
    }),
    typography: boundedText({
      fallback: fallbackTypography,
      maxLength: 160,
      minLength: 6,
      value: pickLooseValue(value, ["typography", "font", "fonts"])
    }),
    imageStyle: boundedText({
      fallback: fallbackImageStyle,
      maxLength: 240,
      minLength: 6,
      value: pickLooseValue(value, ["imageStyle", "image", "decoration"])
    }),
    layoutRules: boundedTextArray({
      fallback: fallbackLayoutRules,
      maxItems: 6,
      maxLength: 160,
      minItems: 2,
      minLength: 4,
      value: pickLooseValue(value, ["layoutRules", "layout"])
    }),
    consistencyRules: boundedTextArray({
      fallback: fallbackConsistencyRules,
      maxItems: 8,
      maxLength: 180,
      minItems: 2,
      minLength: 4,
      value: pickLooseValue(value, ["consistencyRules", "consistency"])
    }),
    forbiddenRules: boundedTextArray({
      fallback: fallbackForbiddenRules,
      maxItems: 6,
      maxLength: 160,
      minItems: 1,
      minLength: 4,
      value: pickLooseValue(value, ["forbiddenRules", "forbidden", "avoid"])
    })
  };
}

function normalizeStructureOutlineResult(
  value: unknown,
  input: AnalyzeDeckRequest
) {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return value;
  }

  if (value.slides.length !== input.pageCount) {
    return value;
  }

  const firstSlide = value.slides.find(isRecord);
  const firstTitle = firstSlide
    ? boundedText({
        fallback: input.goal,
        maxLength: 80,
        minLength: 2,
        value: firstSlide.title
      })
    : input.goal;
  const deckTitleFallback = input.locale === "zh-CN"
    ? compactText(firstTitle || input.goal, 100)
    : compactText(firstTitle || input.goal, 100);
  const deckSummaryFallback =
    input.locale === "zh-CN"
      ? `面向${compactText(input.audience, 40)}，围绕“${compactText(
          input.goal,
          72
        )}”与“${compactText(input.coreMessage, 88)}”组织 ${input.pageCount} 页演示。`
      : `A ${input.pageCount}-slide deck for ${compactText(
          input.audience,
          40
        )}, organized around "${compactText(input.goal, 72)}" and "${compactText(
          input.coreMessage,
          88
        )}".`;

  return {
    deckType: input.deckType,
    style: input.style,
    deckTitle: boundedText({
      fallback: deckTitleFallback,
      maxLength: 100,
      minLength: 2,
      value: value.deckTitle
    }),
    deckSummary: boundedText({
      fallback: deckSummaryFallback,
      maxLength: 300,
      minLength: 8,
      value: value.deckSummary
    }),
    unifiedVisualSpec: normalizeUnifiedVisualSpec(value.unifiedVisualSpec, input),
    slides: value.slides.map((slide, slideIndex) => {
      const record = isRecord(slide) ? slide : {};
      const index = slideIndex + 1;

      return {
        slideId: boundedText({
          fallback: `slide-${index}`,
          maxLength: 60,
          minLength: 3,
          value: record.slideId
        }),
        index,
        title: boundedText({
          fallback: input.locale === "zh-CN" ? `第 ${index} 页` : `Slide ${index}`,
          maxLength: 80,
          minLength: 2,
          value: record.title
        }),
        purpose: boundedText({
          fallback: input.locale === "zh-CN"
            ? `说明第 ${index} 页与整体目标的关系。`
            : `Explain how slide ${index} supports the overall goal.`,
          maxLength: 180,
          minLength: 6,
          value: pickLooseValue(record, ["purpose", "speakerGoal"])
        }),
        keyMessage: boundedText({
          fallback: input.coreMessage,
          maxLength: 180,
          minLength: 4,
          value: pickLooseValue(record, ["keyMessage", "message", "summary"])
        }),
        visualDirection: boundedText({
          fallback: input.locale === "zh-CN"
            ? "使用清晰主视觉配合文字信息，形成稳定阅读顺序。"
            : "Use a clear hero visual with text to create a stable reading order.",
          maxLength: 220,
          minLength: 6,
          value: pickLooseValue(record, ["visualDirection", "visualIntent", "visual"])
        })
      };
    })
  };
}

function normalizePageCopyResult(
  value: unknown,
  input: AnalyzeDeckRequest,
  structure: DeckStructureOutlineResult
) {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return value;
  }

  if (value.slides.length !== input.pageCount) {
    return value;
  }

  return {
    deckType: input.deckType,
    style: input.style,
    slides: value.slides.map((slide, slideIndex) => {
      const record = isRecord(slide) ? slide : {};
      const expected = structure.slides[slideIndex];
      const bodyPoints = boundedTextArray({
        fallback: [expected.keyMessage, input.coreMessage],
        maxItems: 5,
        maxLength: 120,
        minItems: 2,
        minLength: 2,
        value: pickLooseValue(record, ["bodyPoints", "points", "bullets"])
      });
      const subtitle = boundedText({
        fallback: "",
        maxLength: 120,
        minLength: 1,
        value: record.subtitle
      });

      return {
        slideId: expected.slideId,
        index: expected.index,
        title: boundedText({
          fallback: expected.title,
          maxLength: 80,
          minLength: 2,
          value: record.title
        }),
        ...(subtitle ? { subtitle } : {}),
        bodyPoints,
        speakerGoal: boundedText({
          fallback: expected.purpose,
          maxLength: 180,
          minLength: 6,
          value: pickLooseValue(record, ["speakerGoal", "purpose"])
        }),
        visualIntent: boundedText({
          fallback: expected.visualDirection,
          maxLength: 220,
          minLength: 6,
          value: pickLooseValue(record, ["visualIntent", "visualDirection", "visual"])
        })
      };
    })
  };
}

function ensurePageCopyMatchesStructure(
  pageCopy: DeckPageCopyResult,
  structure: DeckStructureOutlineResult
) {
  for (const [index, slide] of pageCopy.slides.entries()) {
    const expected = structure.slides[index];

    if (!expected) {
      throw new Error("AI returned an unexpected slide.");
    }

    if (slide.slideId !== expected.slideId || slide.index !== expected.index) {
      throw new Error("AI returned page copy that does not match the outline.");
    }
  }
}

async function analyzeIntentWithAi(
  input: DeckOutlineIntentInput,
  client: JsonChatClient,
  model: string,
  temperature: number
): Promise<DeckIntentAnalysisResult> {
  const analysis = await generateValidatedJson({
    client,
    model,
    temperature,
    schema: buildIntentAnalysisSchema(input),
    schemaName: "DeckIntentAnalysis",
    messages: buildIntentAnalysisMessages(input)
  });

  return deckIntentAnalysisResultSchema.parse({
    ...analysis,
    fileSummaries: buildFileSummaries(input.textFiles),
    input
  });
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
    slides: slides.map((slide) => normalizeSlideCompositionPlan(slide))
  });
}

async function createDeckOutlineWithAi(
  input: AnalyzeDeckRequest,
  client: JsonChatClient,
  model: string,
  temperature: number
): Promise<DeckOutlineResult> {
  const structure = await generateValidatedJson({
    client,
    model,
    temperature,
    schema: buildStructureOutlineSchema(input),
    schemaName: "DeckStructureOutlineResult",
    messages: buildStructureOutlineMessages(input),
    normalize: (value) => normalizeStructureOutlineResult(value, input)
  });

  if (structure.slides.length !== input.pageCount) {
    throw new Error("AI returned a slide count that does not match pageCount.");
  }

  const pageCopy = await generateValidatedJson({
    client,
    model,
    temperature,
    schema: buildPageCopySchema(input),
    schemaName: "DeckPageCopyResult",
    messages: buildPageCopyMessages({
      input,
      structure
    }),
    normalize: (value) => normalizePageCopyResult(value, input, structure)
  });

  ensurePageCopyMatchesStructure(pageCopy, structure);

  return deckOutlineResultSchema.parse({
    mode: "ai-json",
    deckTitle: structure.deckTitle,
    deckSummary: structure.deckSummary,
    unifiedVisualSpec: structure.unifiedVisualSpec,
    slides: pageCopy.slides
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
  const composed = await Promise.all(
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

  return composed.map((slide) => normalizeSlideCompositionPlan(slide));
}

function parseTemperature(value: AiDeckEnv["AI_TEXT_TEMPERATURE"]) {
  if (value === undefined || value === null || value === "") {
    return 0.2;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0.2;
}

function buildFileSummaries(files: DeckOutlineIntentInput["textFiles"]) {
  return files.map((file) => ({
    characterCount: file.content.length,
    name: file.name,
    size: file.size
  }));
}

export async function analyzeDeckIntent(
  rawInput: unknown,
  options: AnalyzeDeckOptions = {}
) {
  const input = deckOutlineIntentInputSchema.parse(rawInput);
  const env = options.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    AI_TEXT_MODEL: process.env.AI_TEXT_MODEL
  };
  const client = options.client ?? createClient(env);
  const model = env.AI_TEXT_MODEL || defaultModel;
  const temperature = parseTemperature(env.AI_TEXT_TEMPERATURE);

  if (!client) {
    return buildMockDeckIntentAnalysis(input);
  }

  return analyzeIntentWithAi(input, client, model, temperature);
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
      normalizeSlideCompositionPlan(
        buildMockSlideCompositionPlanFromContent({
          input,
          slide,
          unifiedVisualSpec
        })
      )
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

export async function composeSingleSlideFromOutline(
  rawInput: unknown,
  slide: SlideContent,
  unifiedVisualSpec: UnifiedVisualSpec,
  options: AnalyzeDeckOptions = {}
): Promise<SlideCompositionPlan> {
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
    return normalizeSlideCompositionPlan(
      buildMockSlideCompositionPlanFromContent({
        input,
        slide,
        unifiedVisualSpec
      })
    );
  }

  const [plan] = await composeSlidesWithAi({
    client,
    input,
    model,
    slides: [slide],
    temperature,
    unifiedVisualSpec
  });

  return plan;
}

export type { DeckAnalysisResult, DeckOutlineResult };
