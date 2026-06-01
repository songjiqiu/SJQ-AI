import OpenAI from "openai";
import { z } from "zod";

import {
  buildMockDeckIntentAnalysis,
  buildMockAnalyzedDeck,
  buildMockSlideCompositionPlanFromContent
} from "./fallback";
import { generateValidatedJson, type JsonChatClient } from "./openai-json";
import {
  buildSlideDesignQualityScore,
  needsSlideDesignRepair,
  normalizeSlideCompositionPlan
} from "./postprocess";
import {
  buildDefaultDesignConstraints,
  buildDefaultLayoutSelection,
  buildFallbackContentHierarchy,
  buildFallbackPageIntent,
  buildFallbackSemanticElements,
  composeSlideFromSemanticPlan
} from "./semantic-layout";
import { getPptTypeVisualTone } from "@/lib/create-deck/visual-tone";
import {
  analyzedDeckResultSchema,
  analyzeDeckRequestSchema,
  deckIntentAnalysisResultSchema,
  deckAnalysisResultSchema,
  deckOutlineIntentInputSchema,
  deckPageCopyResultSchema,
  deckOutlineResultSchema,
  deckStructureOutlineSchema,
  deckStructureOutlineResultSchema,
  deckStructureSlideSchema,
  semanticSlidePlanSchema,
  slideDesignConstraintsSchema,
  slideLayoutSelectionSchema,
  slideLayoutTypeSchema,
  slideContentSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type DeckIntentAnalysisResult,
  type DeckAnalysisResult,
  type DeckOutlineIntentInput,
  type DeckPageCopyResult,
  type DeckOutlineResult,
  type DeckStructureOutline,
  type DeckStructureOutlineResult,
  type SemanticSlidePlan,
  type SlideCompositionPlan,
  type SlideContent,
  type UnifiedVisualSpec
} from "./schema";

const defaultModel = "gpt-4.1-mini";
const slideCompositionConcurrency = 3;

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
- unifiedVisualSpec 必须是对象，必须包含旧字段 themeName、visualStyle、colorPalette、typography、imageStyle、layoutRules、consistencyRules、forbiddenRules，并补充结构化字段 pageSpec、typographyRules、colorRoles、imageRules。
- themeName 只能描述内容主题或视觉主题，不得引用外观配色预设名，例如不要包含“星图、矩阵、深空、晨雾、Star Map、Matrix、Deep Space、Morning Mist”。
- pageSpec 必须说明：这是一页 16:9 的 PPT，宽 13.333 英寸、高 7.5 英寸，内容要避开四周 0.5 英寸安全边距，并基于 12 栏栅格进行自动排版。
- typographyRules 必须包含默认字号、最小字号、最大行数、行高、字体 fallback 和 scale；scale 必须明确封面标题、页标题、正文、注释、图表标签的字号、字重、行高和用途。
- colorRoles 必须说明背景、卡片/表面、标题、正文、强调、高亮、图表、装饰颜色角色；正文色和背景色对比度不得低于 4.5:1；装饰色不能用于大段正文；高亮色每页最多使用 1-2 处。
- imageRules 必须要求背景图不得包含高对比文字区域，图片主体不能压在标题区。
- deckType 决定 PPT 的场景结构与页面组织方式。
- coreMessage 是已确认的核心信息，必须贯穿整套内容。
- 每页只表达一个中心观点，bodyPoints 控制在 2-5 条。
- locale=${input.locale}，输出语言必须匹配 locale。

输入：
${serialize(input)}`
    }
  ];
}

function buildIntentAnalysisMessages(input: DeckOutlineIntentInput) {
  const fileSummaries = buildFileSummaries(input.textFiles);

  return [
    {
      role: "system" as const,
      content:
        "你是中文优先的 PPT 创作意图分析师和结构大纲规划师。你只负责生成输入分析与结构大纲，不写每页详细文案，不生成统一视觉规范。必须只输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请分析以下输入，返回 DeckIntentAnalysisResult JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- recommendedPageCount 必须是 3 到 18 之间的整数。
${input.pageCount ? `- 用户已指定页数 pageCount=${input.pageCount}，recommendedPageCount 必须等于 ${input.pageCount}。` : "- 用户未指定页数，请根据内容密度推荐 recommendedPageCount。"}
- 必须同时生成 structureOutline，且 structureOutline.slides 数量必须等于 recommendedPageCount。
- structureOutline 只包含 deckTitle、deckSummary、slides；每页只写 slideId、index、title、purpose、keyMessage、visualDirection。
- 本轮不得输出每页详细正文 bodyPoints，不得输出 unifiedVisualSpec。
- fileSummaries 必须原样基于输入文件摘要返回，只能使用 name、size、characterCount、summary、snippets 字段。
- locale=${input.locale}，输出语言必须匹配 locale。

输入：
${serialize({
  idea: input.idea,
  sourceText: input.sourceText,
  fileSummaries,
  deckType: input.deckType,
  palette: input.palette,
  pageCount: input.pageCount,
  locale: input.locale
})}`
    }
  ];
}

function buildPageCopyMessages({
  fileSummaries,
  input,
  structure
}: {
  fileSummaries?: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
  structure: DeckStructureOutlineResult;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是中文优先 PPT 单页文案规划师和统一视觉规范设计师。你负责把结构大纲扩展成每页详细文案 JSON，并生成一份全局统一视觉规范。必须只输出 JSON，不能输出 Markdown。"
    },
    {
      role: "user" as const,
      content: `请基于结构大纲返回 DeckPageCopyResult JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- slides 数量必须等于 pageCount=${input.pageCount}。
- 每个 slideId、index 必须与结构大纲一致。
- 本轮必须生成 unifiedVisualSpec，作为全局统一视觉规范，后续每页图层都要遵守，之后不能被模型修改。
- unifiedVisualSpec 必须是对象，必须包含 themeName、visualStyle、colorPalette、typography、imageStyle、layoutRules、consistencyRules、forbiddenRules、pageSpec、typographyRules、colorRoles、imageRules，不能输出字符串。
- unifiedVisualSpec 还必须补充完整结构化视觉规范：pptTypeVisualTone、informationDensityRules、spacingRules、chartVisualRules、imageIllustrationRules、iconStyleRules、emphasisRules、forbiddenVisualRules。
- pptTypeVisualTone 只能返回当前 PPT 类型 "${input.deckType}" 的匹配结果，必须包含 deckType、deckTypeName、recommendedTone、visualKeywords；不要返回其他 PPT 类型的完整对照表。
- 当前 PPT 类型视觉基调参考：${serialize(getPptTypeVisualTone(input.deckType, input.locale))}
- informationDensityRules 仍按商务汇报、课程培训、品牌营销、研究报告四类说明页面信息密度节奏，用于通用排版约束。
- colorRoles 不只写 HEX 色值，还要说明背景、卡片/表面、标题、正文、强调、高亮、图表、装饰各自用在哪里。
- typographyRules.scale 必须明确封面标题、页标题、正文、注释、图表标签的字号、字重、行高和用途。
- spacingRules 必须说明页面边距、区块间距、元素间距和留白规则；chartVisualRules 必须说明图表类型、坐标网格、标签、配色和来源标注；imageIllustrationRules 与 iconStyleRules 必须统一素材和图标风格；emphasisRules 必须说明高亮、重点数字、关键词、结论句如何突出；forbiddenVisualRules 必须包含避免高饱和、过度阴影、复杂背景、动画滥用等禁用项。
- themeName 只能描述内容主题或视觉主题，不得引用外观配色预设名，例如不要包含“星图、矩阵、深空、晨雾、Star Map、Matrix、Deep Space、Morning Mist”。
- pageSpec 必须说明：这是一页 16:9 的 PPT，宽 13.333 英寸、高 7.5 英寸，内容要避开四周 0.5 英寸安全边距，并基于 12 栏栅格进行自动排版。
- typographyRules 必须包含默认字号、最小字号、最大行数、行高、字体 fallback 和 scale；字体 fallback 优先兼顾中文与英文可读性。
- colorRoles 必须说明背景、卡片/表面、标题、正文、强调、高亮、图表、装饰颜色角色；正文色和背景色对比度不得低于 4.5:1；装饰色不能用于大段正文；高亮色每页最多使用 1-2 处。
- imageRules 必须要求背景图不得包含高对比文字区域，图片主体不能压在标题区。
- 根对象只能包含 deckType、unifiedVisualSpec、slides，不要输出 locale、palette、pageCount。
- 每页必须包含 slideId、index、title、bodyPoints、speakerGoal、visualIntent、coreStatement、narrativeRole、contentLayers、slideTransition、explanationDepth、sourceRequirement、adaptationRules、audienceFocus、viewerObjective、contentBoundary。
- coreStatement 是本页核心表达句，必须让不同 PPT 类型都能知道这一页最终想让观众记住什么。
- narrativeRole 只能使用 setup/argument/turning-point/climax/summary/call-to-action，用于判断本页在叙事中的铺垫、论证、转折、高潮、总结或行动号召作用。
- contentLayers 必须区分 primary 主信息、supporting 支撑信息、supplementary 补充信息，避免后续页面生成平均用力。
- slideTransition 必须说明 fromPrevious 和 toNext，保证整份 PPT 连续叙事而不是孤立页面。
- explanationDepth 只能使用 focus/transition/summary/supporting，区分重点页、过渡页、总结页、辅助页。
- sourceRequirement 必须说明是否需要注明数据、案例、引用、教材内容或用户输入来源。
- adaptationRules 必须说明内容多时哪些可拆页，内容少时可与哪类页面合并。
- audienceFocus 必须匹配受众关注点：商务看结论，教学看理解，销售看价值，研究看证据。
- viewerObjective 必须说明看完本页后观众应该理解、相信、记住或采取什么行动。
- contentBoundary 必须说明本页应该展开什么、不应该展开什么，避免跑题。
- bodyPoints 控制在 2-5 条，每页只表达一个中心观点。
- 输出语言必须匹配 locale=${input.locale}。

已确认输入分析：
${serialize({
  audience: input.audience,
  goal: input.goal,
  coreMessage: input.coreMessage,
  pageCount: input.pageCount,
  deckType: input.deckType,
  palette: input.palette
})}

结构大纲：
${serialize(structure)}

文件摘要或相关片段：
${serialize(fileSummaries ?? [])}`
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
        "你是 PPT 单页语义编排师。你负责先判断页面意图、内容层级和语义元素，不直接写坐标。必须只输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请为单页生成 SemanticSlidePlan JSON。服务端会把语义元素确定性排版成页面坐标，你不要直接写死坐标。

硬性要求：
- deckType 必须只作为场景结构参考，保持为 "${input.deckType}"。
- 第一步先分析页面意图 pageIntent，不要一上来拆元素。必须输出 pageRole、primaryGoal、coreMessage、audienceTakeaway、contentDensity。
- pageRole 只能使用 cover/agenda/section/content/data/comparison/process/summary。
- primaryGoal 只能使用 inform/explain/persuade/compare/summarize/spark-interest。
- contentDensity 只能使用 low/medium/high。
- 第二步判断内容层级 contentHierarchy，并必须输出 tiers 三层：
  - level 1：主标题、核心结论、大数字、关键判断。
  - level 2：小标题、要点、图表主数据、流程节点。
  - level 3：备注、来源、标签、辅助说明、页脚信息。
- contentHierarchy.primaryMessage 必须等于或浓缩自 pageIntent.coreMessage。
- 主标题不等于页面核心结论时，将核心结论放入 level 1，并在 semanticElements 中作为 key message/副标题类元素。
- 第三步从固定内置 layoutType 中选择 2-3 个候选模板进行比较，并输出 layoutSelection。候选只允许使用：chapter、cover-title、title-body-points、big-image-background、left-image-right-text、left-text-right-image、left-text-right-chart、big-chart、two-column-compare、quote、time-axis、process-steps、key-metrics、quadrant-matrix、ending。
- layoutSelection.candidates 必须是 2-3 个，每个包含 layoutType、fitReason、risk、score；selectedLayoutType 必须来自候选。
- 第四步输出 constraints，必须记录 safeMargin=0.5 inch、titleUnique=true、coreMessagePresent=true、maxHeroVisuals=1、subjectAvoidsTitleArea=true、densityLimit 和 renderNotes。
- 每页只能有一个主视觉中心；不要生成多个 heroVisual 或多个高优先级 visual。
- 数据页优先识别指标、维度、趋势、对比关系，并使用 infographic/chart 语义元素。
- 流程页优先识别步骤、顺序、输入输出、依赖关系，并使用 infographic/process/card 语义元素。
- 对比页优先识别比较对象、比较维度、差异结论，并使用 infographic/container/card 语义元素。
- 第五步生成 semanticElements，只描述语义、角色、内容、优先级和约束，禁止输出 bounds、x、y、width、height、canvas、imageLayerRequests、textStyle、zIndex。
- semanticElements.category 只能使用 text/visual/infographic/navigation/container。
- semanticElements.elementType 沿用 text/generatedImage/shape/icon/chartPlaceholder。
- semanticElements.semanticType 沿用 title/subtitle/body/heroVisual/supportingVisual/accentShape/icon/chart/card/badge/background/footer。
- semanticElements.hierarchyLevel 只能是 1/2/3；priority 1 为最高优先级，5 为最低。
- layoutDiagnostics 只描述密度、溢出风险和是否需要确认；不要自动拆分页面。
- 服务端会在生成 elements、asset requests 和 constraints 后执行 JSON Schema 校验，并进行五维设计质量评分：informationHierarchy、visualConsistency、contentDensity、renderability、expressionCompleteness。
- 如果服务端评分 totalScore < 78 或任一维度 < 65，会把问题发回给你进行一次自动修复；修复时不要改变 slideId、index、pageCount。
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
  palette: input.palette
})}`
    }
  ];
}

function buildSlideRepairMessages({
  input,
  score,
  semanticPlan,
  slide,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  score: SlideCompositionPlan["designQualityScore"];
  semanticPlan: SemanticSlidePlan;
  slide: SlideContent;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是 PPT 单页语义编排修复师。你只修复 SemanticSlidePlan JSON，不输出解释。"
    },
    {
      role: "user" as const,
      content: `这页服务端设计质量评分偏低，请基于问题修复 SemanticSlidePlan JSON。

硬性要求：
- 只能输出修复后的 SemanticSlidePlan JSON。
- 不得改变 slideId="${slide.slideId}"、index=${slide.index}、content.slideId、content.index，也不得改变整套 pageCount=${input.pageCount}。
- 优先修复 pageIntent、contentHierarchy、layoutSelection、constraints、designPlan、layoutDiagnostics、semanticElements。
- layoutSelection 必须从固定内置 layoutType 中选 2-3 个候选并给出 selectedLayoutType。
- constraints 必须保持 titleUnique=true、coreMessagePresent=true、safeMargin=0.5 inch、maxHeroVisuals=1、subjectAvoidsTitleArea=true。
- 不要输出 bounds、x、y、width、height、canvas、imageLayerRequests、textStyle、zIndex。
- 输出语言必须匹配 locale=${input.locale}。

质量评分：
${serialize(score)}

原始 SemanticSlidePlan：
${serialize(semanticPlan)}

统一视觉说明：
${serialize(unifiedVisualSpec)}

单页文案：
${serialize(slide)}`
    }
  ];
}

function buildIntentAnalysisSchema(input: DeckOutlineIntentInput) {
  return z
    .object({
      deckType: z.literal(input.deckType),
      audience: z.string().trim().min(2).max(120),
      goal: z.string().trim().min(2).max(160),
      coreMessage: z.string().trim().min(2).max(300),
      recommendedPageCount: input.pageCount
        ? z.literal(input.pageCount)
        : z.number().int().min(3).max(18),
      fileSummaries: z
        .array(
          z.object({
            name: z.string().min(1).max(255),
            size: z.number().int().min(0),
            characterCount: z.number().int().min(0),
            summary: z.string().max(500).default(""),
            snippets: z.array(z.string().min(1).max(1200)).max(4).default([])
          }).strict()
        )
        .max(5),
      structureOutline: deckStructureOutlineSchema
    })
    .strip()
    .superRefine((result, ctx) => {
      if (result.structureOutline.slides.length !== result.recommendedPageCount) {
        ctx.addIssue({
          code: "custom",
          message: "structureOutline.slides length must match recommendedPageCount",
          path: ["structureOutline", "slides"]
        });
      }
    });
}

function buildStructureOutlineSchema(input: AnalyzeDeckRequest) {
  return deckStructureOutlineResultSchema
    .extend({
      deckType: z.literal(input.deckType),
      slides: z.array(deckStructureSlideSchema).length(input.pageCount)
    })
    .strip();
}

function buildPageCopySchema(input: AnalyzeDeckRequest) {
  return deckPageCopyResultSchema
    .extend({
      deckType: z.literal(input.deckType),
      slides: z.array(slideContentSchema).length(input.pageCount)
    })
    .strip();
}

function buildSemanticSlidePlanSchema(slide: SlideContent) {
  return semanticSlidePlanSchema
    .extend({
      slideId: z.literal(slide.slideId),
      index: z.literal(slide.index),
      content: slideContentSchema.extend({
        slideId: z.literal(slide.slideId),
        index: z.literal(slide.index)
      }),
      constraints: slideDesignConstraintsSchema.extend({
        coreMessagePresent: z.literal(true),
        maxHeroVisuals: z.literal(1),
        subjectAvoidsTitleArea: z.literal(true),
        titleUnique: z.literal(true)
      }),
      layoutSelection: slideLayoutSelectionSchema
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

export function normalizeUnifiedVisualSpec(
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
  const fallbackColorPalette = fallbackColorPalettes[input.palette];
  const deckTypeTone = getDeckTypeToneFallback(input);
  const fallbackPageSpec = {
    aspectRatio: "16:9" as const,
    gridColumns: 12 as const,
    height: 7.5 as const,
    layoutInstruction: isChinese
      ? "这是一页 16:9 的 PPT，宽 13.333 英寸、高 7.5 英寸，内容避开四周 0.5 英寸安全边距，并基于 12 栏栅格自动排版。"
      : "Use a 16:9 PPT slide, 13.333 inches wide and 7.5 inches high. Keep content away from the 0.5-inch safe margin and align layout to a 12-column grid.",
    safeMargin: 0.5 as const,
    unit: "inch" as const,
    width: 13.333 as const
  };
  const fallbackTypographyRules = {
    defaultFontSize: 15,
    fontFallback: isChinese
      ? ["Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Arial", "sans-serif"]
      : ["Inter", "Arial", "Helvetica", "Microsoft YaHei", "sans-serif"],
    lineHeight: 1.25,
    maxLines: 8,
    minFontSize: 8,
    scale: buildTypographyScaleFallback(isChinese)
  };
  const fallbackColorRoles = {
    accent: `${fallbackColorPalette[0]} ${
      isChinese ? "用于关键强调、图表主色和少量行动提示。" : "for key emphasis, chart primary marks, and limited action cues."
    }`,
    background: `${fallbackColorPalette[1]} ${
      isChinese ? "用于浅色背景或大面积柔和底色。" : "for light backgrounds or large soft surfaces."
    }`,
    bodyText: `${fallbackColorPalette[2]} ${
      isChinese ? "用于正文和主要信息，正文色和背景色对比度不得低于 4.5:1。" : "for body copy and primary information with at least 4.5:1 contrast against the background."
    }`,
    chart: `${fallbackColorPalette[0]} 与 ${fallbackColorPalette[3] ?? fallbackColorPalette[0]} ${
      isChinese ? "用于图表主次序列，避免过多颜色。" : "for primary and secondary chart series without overusing colors."
    }`,
    contrastRequirement: isChinese
      ? "正文色和背景色对比度不得低于 4.5:1；装饰色不能用于大段正文。"
      : "Body text and background contrast must be at least 4.5:1; decorative colors must not be used for long body copy.",
    decorative: `${fallbackColorPalette[3] ?? fallbackColorPalette[0]} ${
      isChinese ? "仅用于线条、图标或小面积装饰，不能承载大段正文。" : "only for lines, icons, or small decorative areas, not long body copy."
    }`,
    highlight: `${fallbackColorPalette[0]} ${
      isChinese ? "每页最多使用 1-2 处，用于真正需要聚焦的信息。" : "use at most 1-2 times per slide for information that truly needs focus."
    }`,
    surface: `${fallbackColorPalette[1]} ${
      isChinese ? "的浅层变化用于卡片、表格底和信息分区。" : "soft variations for cards, table surfaces, and information zones."
    }`,
    titleText: `${fallbackColorPalette[2]} ${
      isChinese ? "用于标题和结论句，确保最高可读性。" : "for titles and conclusion statements with maximum readability."
    }`
  };
  const fallbackImageRules = {
    backgroundAvoidsHighContrastTextArea: true,
    subjectAvoidsTitleArea: true,
    usageNotes: isChinese
      ? [
          "背景图不得包含高对比文字区域，避免干扰 PPT 正文。",
          "图片主体不能压在标题区，应为标题和核心信息预留干净空间。",
          "主视觉每页最多一个，并与统一色板保持一致。"
        ]
      : [
          "Background images must avoid high-contrast text areas that compete with slide copy.",
          "The main subject must not sit under the title area; reserve clean space for titles and core messages.",
          "Use at most one hero visual per slide and keep it aligned with the unified palette."
        ]
  };
  const fallbackAdvancedVisualSpec = buildAdvancedVisualSpecFallback({
    input,
    isChinese,
    tone: deckTypeTone
  });

  if (!isRecord(value)) {
    const visualStyle =
      typeof value === "string" && value.trim().length > 0
        ? compactText(value, 240)
        : fallbackStyle;

    return {
      themeName: cleanVisualThemeName(fallbackTheme, fallbackTheme),
      visualStyle,
      colorPalette: fallbackColorPalette,
      typography: fallbackTypography,
      imageStyle: fallbackImageStyle,
      layoutRules: fallbackLayoutRules,
      consistencyRules: fallbackConsistencyRules,
      forbiddenRules: fallbackForbiddenRules,
      pageSpec: fallbackPageSpec,
      typographyRules: fallbackTypographyRules,
      colorRoles: fallbackColorRoles,
      imageRules: fallbackImageRules,
      ...fallbackAdvancedVisualSpec
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
    themeName: cleanVisualThemeName(
      boundedText({
        fallback: fallbackTheme,
        maxLength: 80,
        minLength: 2,
        value: pickLooseValue(value, ["themeName", "theme", "name"])
      }),
      fallbackTheme
    ),
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
    }),
    pageSpec: normalizePageSpec(value.pageSpec, fallbackPageSpec),
    typographyRules: normalizeTypographyRules(
      value.typographyRules,
      fallbackTypographyRules,
      value.typographyScale
    ),
    colorRoles: normalizeColorRoles(
      value.colorRoles,
      fallbackColorRoles,
      value.colorRoleDefinitions
    ),
    imageRules: normalizeImageRules(value.imageRules, fallbackImageRules),
    pptTypeVisualTone: normalizePptTypeVisualTone(
      value.pptTypeVisualTone,
      fallbackAdvancedVisualSpec.pptTypeVisualTone
    ),
    informationDensityRules: normalizeInformationDensityRules(
      value.informationDensityRules,
      fallbackAdvancedVisualSpec.informationDensityRules
    ),
    spacingRules: normalizeSpacingRules(
      value.spacingRules,
      fallbackAdvancedVisualSpec.spacingRules
    ),
    chartVisualRules: normalizeChartVisualRules(
      value.chartVisualRules,
      fallbackAdvancedVisualSpec.chartVisualRules
    ),
    imageIllustrationRules: normalizeImageIllustrationRules(
      value.imageIllustrationRules,
      fallbackAdvancedVisualSpec.imageIllustrationRules
    ),
    iconStyleRules: normalizeIconStyleRules(
      value.iconStyleRules,
      fallbackAdvancedVisualSpec.iconStyleRules
    ),
    emphasisRules: normalizeEmphasisRules(
      value.emphasisRules,
      fallbackAdvancedVisualSpec.emphasisRules
    ),
    forbiddenVisualRules: boundedTextArray({
      fallback: fallbackAdvancedVisualSpec.forbiddenVisualRules,
      maxItems: 10,
      maxLength: 180,
      minItems: 3,
      minLength: 4,
      value: pickLooseValue(value, ["forbiddenVisualRules", "visualForbiddenRules"])
    })
  };
}

function getDeckTypeToneFallback(input: AnalyzeDeckRequest) {
  const isChinese = input.locale === "zh-CN";

  if (input.deckType === "training-course" || input.deckType === "teaching-deck") {
    return isChinese
      ? "教学型页面要清晰、渐进、可理解，保留例题和讲解节奏。"
      : "Teaching decks should feel clear, progressive, and easy to understand, with room for examples and explanation rhythm.";
  }

  if (input.deckType === "brand-marketing" || input.deckType === "event-promotion") {
    return isChinese
      ? "营销型页面要有品牌记忆点、情绪感染力和价值主张聚焦。"
      : "Marketing decks should create brand memory, emotional appeal, and a focused value proposition.";
  }

  if (input.deckType === "research-report" || input.deckType === "data-analysis") {
    return isChinese
      ? "研究型页面要克制、可信、证据优先，图表和来源标注保持一致。"
      : "Research decks should feel restrained, credible, and evidence-first, with consistent charts and source notes.";
  }

  return isChinese
    ? "商务型页面要安静、直接、结论优先，方便快速扫读和决策。"
    : "Business decks should feel quiet, direct, and conclusion-first for fast scanning and decisions.";
}

function buildTypographyScaleFallback(
  isChinese: boolean
): UnifiedVisualSpec["typographyRules"]["scale"] {
  return {
    coverTitle: {
      fontSize: 36,
      fontWeight: "bold",
      lineHeight: 1.12,
      usage: isChinese ? "封面主标题，最多两行。" : "Cover title, two lines maximum."
    },
    pageTitle: {
      fontSize: 26,
      fontWeight: "semibold",
      lineHeight: 1.16,
      usage: isChinese ? "普通页面标题和章节标题。" : "Regular slide and section titles."
    },
    body: {
      fontSize: 15,
      fontWeight: "regular",
      lineHeight: 1.28,
      usage: isChinese ? "正文要点、说明段落和卡片内容。" : "Body bullets, explanation copy, and card content."
    },
    annotation: {
      fontSize: 9,
      fontWeight: "regular",
      lineHeight: 1.22,
      usage: isChinese ? "来源、脚注、单位和风险提示。" : "Sources, footnotes, units, and risk notes."
    },
    chartLabel: {
      fontSize: 10,
      fontWeight: "medium",
      lineHeight: 1.18,
      usage: isChinese ? "图表坐标、标签、图例和数据标注。" : "Chart axes, labels, legends, and data callouts."
    }
  };
}

function buildAdvancedVisualSpecFallback({
  input,
  isChinese,
  tone
}: {
  input: AnalyzeDeckRequest;
  isChinese: boolean;
  tone: string;
}): Pick<
  UnifiedVisualSpec,
  | "chartVisualRules"
  | "emphasisRules"
  | "forbiddenVisualRules"
  | "iconStyleRules"
  | "imageIllustrationRules"
  | "informationDensityRules"
  | "pptTypeVisualTone"
  | "spacingRules"
> {
  return {
    pptTypeVisualTone: getPptTypeVisualTone(input.deckType, input.locale),
    informationDensityRules: isChinese
      ? {
          defaultLevel:
            input.deckType === "research-report" || input.deckType === "data-analysis"
              ? "high"
              : input.deckType === "brand-marketing"
                ? "low"
                : "medium",
          businessReport: "商务汇报每页 1 个结论、2-4 个证据点，优先用指标卡、对比表和行动建议。",
          trainingCourse: "课程培训每页只推进一个知识点，保留定义、例子、练习或小结的理解节奏。",
          brandMarketing: "品牌营销降低文字密度，强化主视觉、价值短句和少量关键卖点。",
          researchReport: "研究报告允许较高密度，但必须用图表、注释和来源层级分隔信息。"
        }
      : {
          defaultLevel:
            input.deckType === "research-report" || input.deckType === "data-analysis"
              ? "high"
              : input.deckType === "brand-marketing"
                ? "low"
                : "medium",
          businessReport: "Use one conclusion and 2-4 evidence points per business slide, favoring metrics, comparisons, and actions.",
          trainingCourse: "Advance one learning point per slide with space for definitions, examples, exercises, or recap.",
          brandMarketing: "Keep copy light and emphasize the hero visual, value line, and a few key selling points.",
          researchReport: "Research slides may be denser, but charts, notes, and source hierarchy must separate information."
        },
    spacingRules: isChinese
      ? {
          pageMargin: "重要内容保持在 0.5 英寸安全边距内，标题区与正文区分离。",
          sectionGap: "标题、正文、图表、注释之间保持明确区块间距，避免拥挤。",
          elementGap: "同类元素保持一致间距，卡片和指标组按栅格对齐。",
          whitespace: "留白用于强调层级，商务和研究页不空散，营销页允许更大视觉呼吸。"
        }
      : {
          pageMargin: "Keep important content inside the 0.5-inch safe margin and separate title and body zones.",
          sectionGap: "Maintain clear gaps between titles, body, charts, and notes to avoid crowding.",
          elementGap: "Keep spacing consistent across similar elements and align cards or metrics to the grid.",
          whitespace: "Use whitespace to clarify hierarchy; business/research stay efficient, marketing may breathe more."
        },
    chartVisualRules: isChinese
      ? {
          chartTypes: "按数据关系选择柱状、折线、漏斗、矩阵、表格或指标卡，不为装饰而画图。",
          axisAndGrid: "坐标轴和网格线保持浅色、少量、低干扰，突出趋势和比较结论。",
          labelRules: "图表标签使用统一字号，单位、时间范围和口径要靠近数据。",
          colorUsage: "主序列使用强调色，次序列使用中性色或辅助色，避免彩虹配色。",
          sourceNotes: "外部数据、引用和研究结论需在图表下方或页脚标注来源。"
        }
      : {
          chartTypes: "Choose bars, lines, funnels, matrices, tables, or metric cards by data relationship, not decoration.",
          axisAndGrid: "Keep axes and gridlines light, sparse, and low-noise while emphasizing trends or comparisons.",
          labelRules: "Use consistent label sizes and place units, time ranges, and definitions near the data.",
          colorUsage: "Use accent color for primary series and neutral/support colors for secondary series; avoid rainbow palettes.",
          sourceNotes: "External data, quotes, and research claims need source notes under charts or in footers."
        },
    imageIllustrationRules: isChinese
      ? {
          style: `${tone} 图片/插画保持干净、统一、低噪声，不生成含文字的复杂素材。`,
          composition: "主视觉每页最多一个，主体避开标题区和关键文字区。",
          background: "背景图必须低对比、可承托文字，不使用复杂纹理或高亮文字块。",
          consistency: "整套素材保持同一摄影/插画风格、光线、透视和边缘处理。"
        }
      : {
          style: `${tone} Images/illustrations stay clean, unified, low-noise, and free of dense text.`,
          composition: "Use at most one hero visual per slide and keep subjects away from title and key text areas.",
          background: "Background images must be low-contrast and text-supporting, without complex texture or bright text blocks.",
          consistency: "Keep one photo/illustration style, lighting, perspective, and edge treatment across the deck."
        },
    iconStyleRules: isChinese
      ? {
          style: "line",
          stroke: "线性图标使用 1.5-2px 等效线宽，圆角和端点保持一致。",
          usage: "图标只辅助识别概念或步骤，不替代正文结论。",
          consistency: "整套图标保持单色或双色体系，不混用线性、面性和复杂插画图标。"
        }
      : {
          style: "line",
          stroke: "Line icons use an equivalent 1.5-2px stroke with consistent corners and caps.",
          usage: "Icons support concept or step recognition and never replace the main conclusion.",
          consistency: "Keep icons monochrome or duotone and do not mix line, filled, and complex illustration icons."
        },
    emphasisRules: isChinese
      ? {
          highlight: "高亮只用于真正需要聚焦的信息，每页最多 1-2 处。",
          keyNumbers: "重点数字使用更大字号、强调色或指标卡承载，并补充单位和口径。",
          keywords: "关键词可用加粗、强调色或浅底标签，不使用大面积荧光色。",
          conclusion: "结论句优先放在标题下或正文起始位置，形成清晰阅读入口。"
        }
      : {
          highlight: "Highlight only truly focal information, at most 1-2 instances per slide.",
          keyNumbers: "Key numbers use larger type, accent color, or metric cards with units and definitions.",
          keywords: "Keywords may use bold, accent color, or soft tags without large fluorescent areas.",
          conclusion: "Place conclusion statements under titles or at the start of body copy for a clear entry point."
        },
    forbiddenVisualRules: isChinese
      ? [
          "避免高饱和大面积撞色。",
          "避免过度阴影、厚重发光和复杂背景。",
          "避免在图片内生成密集文字、Logo 水印或不可读标签。",
          "避免动画滥用；本阶段只记录动效计划，不影响静态 PPTX。",
          "避免所有页面保持同一信息密度和同一版式节奏。"
        ]
      : [
          "Avoid large areas of high-saturation clashing colors.",
          "Avoid excessive shadows, heavy glows, and complex backgrounds.",
          "Avoid dense text, logo watermarks, or unreadable labels inside images.",
          "Avoid overusing animation; this stage records motion plans but PPTX remains static.",
          "Avoid giving every slide the same density and layout rhythm."
        ]
  };
}

function normalizePageSpec(
  value: unknown,
  fallback: UnifiedVisualSpec["pageSpec"]
): UnifiedVisualSpec["pageSpec"] {
  const record = isRecord(value) ? value : {};

  return {
    ...fallback,
    layoutInstruction: boundedText({
      fallback: fallback.layoutInstruction,
      maxLength: 240,
      minLength: 8,
      value: record.layoutInstruction
    })
  };
}

function normalizeTypographyRules(
  value: unknown,
  fallback: UnifiedVisualSpec["typographyRules"],
  legacyScale?: unknown
): UnifiedVisualSpec["typographyRules"] {
  const record = isRecord(value) ? value : {};
  const defaultFontSize =
    typeof record.defaultFontSize === "number"
      ? record.defaultFontSize
      : fallback.defaultFontSize;
  const minFontSize =
    typeof record.minFontSize === "number"
      ? record.minFontSize
      : fallback.minFontSize;
  const lineHeight =
    typeof record.lineHeight === "number" ? record.lineHeight : fallback.lineHeight;
  const maxLines =
    typeof record.maxLines === "number" ? record.maxLines : fallback.maxLines;
  const fontFallback = Array.isArray(record.fontFallback)
    ? record.fontFallback
        .map((item) => formatLooseValue(item, 80))
        .filter((item) => item.length > 0)
        .slice(0, 6)
    : fallback.fontFallback;

  return {
    defaultFontSize: clampNumber(defaultFontSize, 8, 40),
    fontFallback:
      fontFallback.length >= 2 ? fontFallback : fallback.fontFallback,
    lineHeight: clampNumber(lineHeight, 1, 1.8),
    maxLines: Math.round(clampNumber(maxLines, 1, 9)),
    minFontSize: clampNumber(minFontSize, 8, 18),
    scale: normalizeTypographyScale(record.scale ?? legacyScale, fallback.scale)
  };
}

function normalizeColorRoles(
  value: unknown,
  fallback: UnifiedVisualSpec["colorRoles"],
  legacyDefinitions?: unknown
): UnifiedVisualSpec["colorRoles"] {
  const record = isRecord(value) ? value : {};
  const legacy = isRecord(legacyDefinitions) ? legacyDefinitions : {};

  return {
    accent: boundedText({
      fallback: fallback.accent,
      maxLength: 180,
      minLength: 3,
      value: record.accent ?? legacy.accent
    }),
    background: boundedText({
      fallback: fallback.background,
      maxLength: 180,
      minLength: 3,
      value: record.background ?? legacy.background
    }),
    bodyText: boundedText({
      fallback: fallback.bodyText,
      maxLength: 180,
      minLength: 3,
      value: record.bodyText ?? legacy.bodyText
    }),
    chart: boundedText({
      fallback: fallback.chart,
      maxLength: 180,
      minLength: 3,
      value: record.chart ?? legacy.chart
    }),
    contrastRequirement: boundedText({
      fallback: fallback.contrastRequirement,
      maxLength: 180,
      minLength: 6,
      value: record.contrastRequirement
    }),
    decorative: boundedText({
      fallback: fallback.decorative,
      maxLength: 180,
      minLength: 3,
      value: record.decorative ?? legacy.decorative
    }),
    highlight: boundedText({
      fallback: fallback.highlight,
      maxLength: 180,
      minLength: 3,
      value: record.highlight ?? legacy.highlight
    }),
    surface: boundedText({
      fallback: fallback.surface,
      maxLength: 180,
      minLength: 3,
      value: record.surface ?? legacy.surface
    }),
    titleText: boundedText({
      fallback: fallback.titleText,
      maxLength: 180,
      minLength: 3,
      value: record.titleText ?? legacy.titleText
    })
  };
}

function normalizeImageRules(
  value: unknown,
  fallback: UnifiedVisualSpec["imageRules"]
): UnifiedVisualSpec["imageRules"] {
  const record = isRecord(value) ? value : {};

  return {
    backgroundAvoidsHighContrastTextArea:
      typeof record.backgroundAvoidsHighContrastTextArea === "boolean"
        ? record.backgroundAvoidsHighContrastTextArea
        : fallback.backgroundAvoidsHighContrastTextArea,
    subjectAvoidsTitleArea:
      typeof record.subjectAvoidsTitleArea === "boolean"
        ? record.subjectAvoidsTitleArea
        : fallback.subjectAvoidsTitleArea,
    usageNotes: boundedTextArray({
      fallback: fallback.usageNotes,
      maxItems: 6,
      maxLength: 180,
      minItems: 2,
      minLength: 4,
      value: record.usageNotes
    })
  };
}

function normalizePptTypeVisualTone(
  value: unknown,
  fallback: UnifiedVisualSpec["pptTypeVisualTone"]
): UnifiedVisualSpec["pptTypeVisualTone"] {
  const record = isRecord(value) ? value : {};
  const legacyTone = pickLegacyPptTypeTone(record, fallback.deckType);
  const visualKeywords = boundedTextArray({
    fallback: fallback.visualKeywords,
    maxItems: 8,
    maxLength: 60,
    minItems: 2,
    minLength: 1,
    value: pickLooseValue(record, [
      "visualKeywords",
      "keywords",
      "visualKeyword",
      "visual_keyword"
    ])
  });

  return {
    deckType: fallback.deckType,
    deckTypeName: boundedText({
      fallback: fallback.deckTypeName,
      maxLength: 80,
      minLength: 2,
      value: pickLooseValue(record, ["deckTypeName", "typeName", "name"])
    }),
    recommendedTone: boundedText({
      fallback: fallback.recommendedTone,
      maxLength: 120,
      minLength: 2,
      value:
        pickLooseValue(record, ["recommendedTone", "tone", "visualTone"]) ??
        legacyTone
    }),
    visualKeywords
  };
}

function pickLegacyPptTypeTone(
  record: Record<string, unknown>,
  deckType: AnalyzeDeckRequest["deckType"]
) {
  const legacyKey = getLegacyPptTypeToneKey(deckType);

  return record[legacyKey];
}

function getLegacyPptTypeToneKey(
  deckType: AnalyzeDeckRequest["deckType"]
): "businessReport" | "trainingCourse" | "brandMarketing" | "researchReport" {
  if (deckType === "training-course" || deckType === "teaching-deck" || deckType === "knowledge-sharing") {
    return "trainingCourse";
  }

  if (
    deckType === "brand-marketing" ||
    deckType === "event-promotion" ||
    deckType === "product-launch" ||
    deckType === "sales-proposal" ||
    deckType === "operation-plan" ||
    deckType === "growth-experiment"
  ) {
    return "brandMarketing";
  }

  if (
    deckType === "research-report" ||
    deckType === "data-analysis" ||
    deckType === "industry-insight"
  ) {
    return "researchReport";
  }

  return "businessReport";
}

function normalizeTypographyScale(
  value: unknown,
  fallback: UnifiedVisualSpec["typographyRules"]["scale"]
): UnifiedVisualSpec["typographyRules"]["scale"] {
  const record = isRecord(value) ? value : {};

  return {
    coverTitle: normalizeTypographyScaleItem(record.coverTitle, fallback.coverTitle),
    pageTitle: normalizeTypographyScaleItem(record.pageTitle, fallback.pageTitle),
    body: normalizeTypographyScaleItem(record.body, fallback.body),
    annotation: normalizeTypographyScaleItem(record.annotation, fallback.annotation),
    chartLabel: normalizeTypographyScaleItem(record.chartLabel, fallback.chartLabel)
  };
}

function normalizeTypographyScaleItem(
  value: unknown,
  fallback: UnifiedVisualSpec["typographyRules"]["scale"]["body"]
): UnifiedVisualSpec["typographyRules"]["scale"]["body"] {
  const record = isRecord(value) ? value : {};
  const fontWeightValues = ["regular", "medium", "semibold", "bold"] as const;
  const fontWeight = fontWeightValues.includes(record.fontWeight as never)
    ? (record.fontWeight as UnifiedVisualSpec["typographyRules"]["scale"]["body"]["fontWeight"])
    : fallback.fontWeight;

  return {
    fontSize:
      typeof record.fontSize === "number"
        ? clampNumber(record.fontSize, 6, 60)
        : fallback.fontSize,
    fontWeight,
    lineHeight:
      typeof record.lineHeight === "number"
        ? clampNumber(record.lineHeight, 1, 1.8)
        : fallback.lineHeight,
    usage: boundedText({
      fallback: fallback.usage,
      maxLength: 180,
      minLength: 4,
      value: record.usage
    })
  };
}

function normalizeInformationDensityRules(
  value: unknown,
  fallback: UnifiedVisualSpec["informationDensityRules"]
): UnifiedVisualSpec["informationDensityRules"] {
  const record = isRecord(value) ? value : {};
  const levels = ["low", "medium", "high"] as const;

  return {
    defaultLevel: levels.includes(record.defaultLevel as never)
      ? (record.defaultLevel as UnifiedVisualSpec["informationDensityRules"]["defaultLevel"])
      : fallback.defaultLevel,
    businessReport: boundedText({ fallback: fallback.businessReport, maxLength: 220, minLength: 6, value: record.businessReport }),
    trainingCourse: boundedText({ fallback: fallback.trainingCourse, maxLength: 220, minLength: 6, value: record.trainingCourse }),
    brandMarketing: boundedText({ fallback: fallback.brandMarketing, maxLength: 220, minLength: 6, value: record.brandMarketing }),
    researchReport: boundedText({ fallback: fallback.researchReport, maxLength: 220, minLength: 6, value: record.researchReport })
  };
}

function normalizeSpacingRules(
  value: unknown,
  fallback: UnifiedVisualSpec["spacingRules"]
): UnifiedVisualSpec["spacingRules"] {
  const record = isRecord(value) ? value : {};

  return {
    pageMargin: boundedText({ fallback: fallback.pageMargin, maxLength: 180, minLength: 4, value: record.pageMargin }),
    sectionGap: boundedText({ fallback: fallback.sectionGap, maxLength: 180, minLength: 4, value: record.sectionGap }),
    elementGap: boundedText({ fallback: fallback.elementGap, maxLength: 180, minLength: 4, value: record.elementGap }),
    whitespace: boundedText({ fallback: fallback.whitespace, maxLength: 220, minLength: 4, value: record.whitespace })
  };
}

function normalizeChartVisualRules(
  value: unknown,
  fallback: UnifiedVisualSpec["chartVisualRules"]
): UnifiedVisualSpec["chartVisualRules"] {
  const record = isRecord(value) ? value : {};

  return {
    chartTypes: boundedText({ fallback: fallback.chartTypes, maxLength: 220, minLength: 4, value: record.chartTypes }),
    axisAndGrid: boundedText({ fallback: fallback.axisAndGrid, maxLength: 220, minLength: 4, value: record.axisAndGrid }),
    labelRules: boundedText({ fallback: fallback.labelRules, maxLength: 220, minLength: 4, value: record.labelRules }),
    colorUsage: boundedText({ fallback: fallback.colorUsage, maxLength: 220, minLength: 4, value: record.colorUsage }),
    sourceNotes: boundedText({ fallback: fallback.sourceNotes, maxLength: 220, minLength: 4, value: record.sourceNotes })
  };
}

function normalizeImageIllustrationRules(
  value: unknown,
  fallback: UnifiedVisualSpec["imageIllustrationRules"]
): UnifiedVisualSpec["imageIllustrationRules"] {
  const record = isRecord(value) ? value : {};

  return {
    style: boundedText({ fallback: fallback.style, maxLength: 220, minLength: 4, value: record.style }),
    composition: boundedText({ fallback: fallback.composition, maxLength: 220, minLength: 4, value: record.composition }),
    background: boundedText({ fallback: fallback.background, maxLength: 220, minLength: 4, value: record.background }),
    consistency: boundedText({ fallback: fallback.consistency, maxLength: 220, minLength: 4, value: record.consistency })
  };
}

function normalizeIconStyleRules(
  value: unknown,
  fallback: UnifiedVisualSpec["iconStyleRules"]
): UnifiedVisualSpec["iconStyleRules"] {
  const record = isRecord(value) ? value : {};
  const styles = ["line", "filled", "duotone", "monochrome"] as const;

  return {
    style: styles.includes(record.style as never)
      ? (record.style as UnifiedVisualSpec["iconStyleRules"]["style"])
      : fallback.style,
    stroke: boundedText({ fallback: fallback.stroke, maxLength: 160, minLength: 2, value: record.stroke }),
    usage: boundedText({ fallback: fallback.usage, maxLength: 220, minLength: 4, value: record.usage }),
    consistency: boundedText({ fallback: fallback.consistency, maxLength: 220, minLength: 4, value: record.consistency })
  };
}

function normalizeEmphasisRules(
  value: unknown,
  fallback: UnifiedVisualSpec["emphasisRules"]
): UnifiedVisualSpec["emphasisRules"] {
  const record = isRecord(value) ? value : {};

  return {
    highlight: boundedText({ fallback: fallback.highlight, maxLength: 220, minLength: 4, value: record.highlight }),
    keyNumbers: boundedText({ fallback: fallback.keyNumbers, maxLength: 220, minLength: 4, value: record.keyNumbers }),
    keywords: boundedText({ fallback: fallback.keywords, maxLength: 220, minLength: 4, value: record.keywords }),
    conclusion: boundedText({ fallback: fallback.conclusion, maxLength: 220, minLength: 4, value: record.conclusion })
  };
}

function cleanVisualThemeName(value: string, fallback: string) {
  const paletteNamePattern =
    /(?:星图|矩阵|深空|晨雾|Star Map|Matrix|Deep Space|Morning Mist)/gi;
  const cleaned = value
    .replace(paletteNamePattern, "")
    .replace(/(?:统一视觉|Unified Visual)\s*[:：]\s*$/gi, "")
    .replace(/[\s｜|·•:：/_-]+$/g, "")
    .replace(/^[\s｜|·•:：/_-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned.length >= 2
    ? cleaned
    : value.replace(paletteNamePattern, "").trim() || fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeIntentAnalysisResult(
  value: unknown,
  input: DeckOutlineIntentInput
) {
  if (!isRecord(value)) {
    return value;
  }

  const recommendedPageCount =
    input.pageCount ??
    (typeof value.recommendedPageCount === "number"
      ? value.recommendedPageCount
      : undefined);

  if (
    typeof recommendedPageCount !== "number" ||
    !isRecord(value.structureOutline)
  ) {
    return {
      ...value,
      ...(input.pageCount ? { recommendedPageCount: input.pageCount } : {})
    };
  }

  return {
    ...value,
    ...(input.pageCount ? { recommendedPageCount: input.pageCount } : {}),
    fileSummaries: buildFileSummaries(input.textFiles),
    structureOutline: normalizeStructureOutlineValue(
      value.structureOutline,
      {
        coreMessage: formatLooseValue(value.coreMessage, 300) || input.idea,
        audience: formatLooseValue(value.audience, 120) || "",
        goal: formatLooseValue(value.goal, 160) || input.idea,
        locale: input.locale,
        pageCount: recommendedPageCount
      }
    )
  };
}

function normalizeStructureOutlineValue(
  value: unknown,
  input: Pick<
    AnalyzeDeckRequest,
    "audience" | "coreMessage" | "goal" | "locale" | "pageCount"
  >
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
  const deckTitleFallback = compactText(firstTitle || input.goal, 100);
  const deckSummaryFallback =
    input.locale === "zh-CN"
      ? `面向${compactText(input.audience, 40)}，围绕“${compactText(
          input.goal,
          72
        )}”与“${compactText(input.coreMessage, 88)}”组织 ${input.pageCount} 页结构大纲。`
      : `A ${input.pageCount}-slide structure outline for ${compactText(
          input.audience,
          40
        )}, organized around "${compactText(input.goal, 72)}" and "${compactText(
          input.coreMessage,
          88
        )}".`;

  return {
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
          fallback:
            input.locale === "zh-CN"
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
          fallback:
            input.locale === "zh-CN"
              ? "使用清晰主视觉配合文字信息，形成稳定阅读顺序。"
              : "Use a clear hero visual with text to create a stable reading order.",
          maxLength: 220,
          minLength: 6,
          value: pickLooseValue(record, [
            "visualDirection",
            "visualIntent",
            "visual"
          ])
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
    ...("deckType" in value ? { deckType: value.deckType } : {}),
    ...("unifiedVisualSpec" in value
      ? {
          unifiedVisualSpec: normalizeUnifiedVisualSpec(
            value.unifiedVisualSpec,
            input
          )
        }
      : {}),
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

      return normalizeSlideContent(record, input, {
        bodyPoints,
        expected,
        nextTitle: structure.slides[slideIndex + 1]?.title,
        previousTitle: structure.slides[slideIndex - 1]?.title,
        slideCount: structure.slides.length,
        subtitle
      });
    })
  };
}

export function normalizeSlideContent(
  value: unknown,
  input: AnalyzeDeckRequest,
  options: {
    bodyPoints?: string[];
    expected?: DeckStructureOutlineResult["slides"][number];
    nextTitle?: string;
    previousTitle?: string;
    slideCount?: number;
    subtitle?: string;
  } = {}
): SlideContent {
  const record = isRecord(value) ? value : {};
  const expected = options.expected;
  const index =
    expected?.index ??
    (typeof record.index === "number" ? Math.round(record.index) : 1);
  const slideCount = options.slideCount ?? input.pageCount;
  const title = boundedText({
    fallback:
      expected?.title ??
      (input.locale === "zh-CN" ? `第 ${index} 页` : `Slide ${index}`),
    maxLength: 80,
    minLength: 2,
    value: record.title
  });
  const bodyPoints =
    options.bodyPoints ??
    boundedTextArray({
      fallback: [expected?.keyMessage ?? input.coreMessage, input.goal],
      maxItems: 5,
      maxLength: 120,
      minItems: 2,
      minLength: 2,
      value: pickLooseValue(record, ["bodyPoints", "points", "bullets"])
    });
  const subtitle =
    options.subtitle ??
    boundedText({
      fallback: "",
      maxLength: 120,
      minLength: 1,
      value: record.subtitle
    });
  const speakerGoal = boundedText({
    fallback:
      expected?.purpose ??
      (input.locale === "zh-CN"
        ? `说明本页如何支持“${compactText(input.goal, 60)}”。`
        : `Explain how this slide supports "${compactText(input.goal, 70)}".`),
    maxLength: 180,
    minLength: 6,
    value: pickLooseValue(record, ["speakerGoal", "purpose"])
  });
  const visualIntent = boundedText({
    fallback:
      expected?.visualDirection ??
      (input.locale === "zh-CN"
        ? "使用清晰主视觉配合文字信息，形成稳定阅读顺序。"
        : "Use a clear hero visual with text to create a stable reading order."),
    maxLength: 220,
    minLength: 6,
    value: pickLooseValue(record, ["visualIntent", "visualDirection", "visual"])
  });
  const coreStatement = boundedText({
    fallback: expected?.keyMessage ?? bodyPoints[0] ?? input.coreMessage,
    maxLength: 220,
    minLength: 4,
    value: pickLooseValue(record, ["coreStatement", "keyMessage", "coreMessage"])
  });
  const slideId = boundedText({
    fallback: expected?.slideId ?? `slide-${index}`,
    maxLength: 60,
    minLength: 3,
    value: record.slideId
  });

  return {
    slideId,
    index,
    title,
    ...(subtitle ? { subtitle } : {}),
    bodyPoints,
    speakerGoal,
    visualIntent,
    coreStatement,
    narrativeRole: normalizeNarrativeRole(record.narrativeRole, index, slideCount),
    contentLayers: normalizeContentLayers(record.contentLayers, {
      bodyPoints,
      coreStatement,
      input,
      speakerGoal,
      subtitle,
      title
    }),
    slideTransition: normalizeSlideTransition(record.slideTransition, {
      input,
      nextTitle: options.nextTitle,
      previousTitle: options.previousTitle,
      title
    }),
    explanationDepth: normalizeExplanationDepth(
      record.explanationDepth,
      index,
      slideCount
    ),
    sourceRequirement: normalizeSourceRequirement(record.sourceRequirement, {
      bodyPoints,
      input,
      title
    }),
    adaptationRules: normalizeAdaptationRules(record.adaptationRules, {
      bodyPoints,
      input,
      nextTitle: options.nextTitle,
      previousTitle: options.previousTitle,
      title
    }),
    audienceFocus: normalizeAudienceFocus(record.audienceFocus, input),
    viewerObjective: normalizeViewerObjective(record.viewerObjective, {
      coreStatement,
      input,
      speakerGoal
    }),
    contentBoundary: normalizeContentBoundary(record.contentBoundary, {
      bodyPoints,
      input,
      title
    })
  };
}

function normalizeNarrativeRole(
  value: unknown,
  index: number,
  slideCount: number
): SlideContent["narrativeRole"] {
  const roles = [
    "setup",
    "argument",
    "turning-point",
    "climax",
    "summary",
    "call-to-action"
  ] as const;

  if (roles.includes(value as never)) {
    return value as SlideContent["narrativeRole"];
  }

  if (index === 1) {
    return "setup";
  }

  if (index === slideCount) {
    return "call-to-action";
  }

  if (index === slideCount - 1) {
    return "summary";
  }

  if (index >= Math.ceil(slideCount * 0.7)) {
    return "climax";
  }

  if (index === Math.ceil(slideCount / 2)) {
    return "turning-point";
  }

  return "argument";
}

function normalizeExplanationDepth(
  value: unknown,
  index: number,
  slideCount: number
): SlideContent["explanationDepth"] {
  const depths = ["focus", "transition", "summary", "supporting"] as const;

  if (depths.includes(value as never)) {
    return value as SlideContent["explanationDepth"];
  }

  if (index === slideCount) {
    return "summary";
  }

  if (index === 1 || index === Math.ceil(slideCount / 2)) {
    return "transition";
  }

  return index <= Math.ceil(slideCount * 0.7) ? "focus" : "supporting";
}

function normalizeContentLayers(
  value: unknown,
  fallback: {
    bodyPoints: string[];
    coreStatement: string;
    input: AnalyzeDeckRequest;
    speakerGoal: string;
    subtitle: string;
    title: string;
  }
): SlideContent["contentLayers"] {
  const record = isRecord(value) ? value : {};

  return {
    primary: boundedTextArray({
      fallback: [fallback.coreStatement || fallback.title],
      maxItems: 4,
      maxLength: 160,
      minItems: 1,
      minLength: 2,
      value: record.primary
    }),
    supporting: boundedTextArray({
      fallback: fallback.bodyPoints.length > 0 ? fallback.bodyPoints : [fallback.speakerGoal],
      maxItems: 6,
      maxLength: 160,
      minItems: 1,
      minLength: 2,
      value: record.supporting
    }),
    supplementary: boundedTextArray({
      fallback: [
        fallback.subtitle,
        fallback.input.locale === "zh-CN"
          ? `面向${compactText(fallback.input.audience, 30)}的辅助说明。`
          : `Supporting context for ${compactText(fallback.input.audience, 40)}.`
      ].filter(Boolean),
      maxItems: 5,
      maxLength: 160,
      minItems: 0,
      minLength: 2,
      value: record.supplementary
    })
  };
}

function normalizeSlideTransition(
  value: unknown,
  fallback: {
    input: AnalyzeDeckRequest;
    nextTitle?: string;
    previousTitle?: string;
    title: string;
  }
): SlideContent["slideTransition"] {
  const record = isRecord(value) ? value : {};
  const isChinese = fallback.input.locale === "zh-CN";

  return {
    fromPrevious: boundedText({
      fallback: fallback.previousTitle
        ? isChinese
          ? `承接上一页“${compactText(fallback.previousTitle, 40)}”，进入“${compactText(fallback.title, 40)}”。`
          : `Continue from "${compactText(fallback.previousTitle, 48)}" into "${compactText(fallback.title, 48)}".`
        : isChinese
          ? "作为开场页，先建立主题边界和阅读预期。"
          : "As the opening slide, establish the topic boundary and reading expectation.",
      maxLength: 220,
      minLength: 4,
      value: record.fromPrevious
    }),
    toNext: boundedText({
      fallback: fallback.nextTitle
        ? isChinese
          ? `自然引出下一页“${compactText(fallback.nextTitle, 40)}”。`
          : `Lead naturally into "${compactText(fallback.nextTitle, 48)}".`
        : isChinese
          ? "收束整套表达，并提示后续行动或复盘。"
          : "Close the deck and cue follow-up action or review.",
      maxLength: 220,
      minLength: 4,
      value: record.toNext
    })
  };
}

function normalizeSourceRequirement(
  value: unknown,
  fallback: {
    bodyPoints: string[];
    input: AnalyzeDeckRequest;
    title: string;
  }
): SlideContent["sourceRequirement"] {
  const record = isRecord(value) ? value : {};
  const corpus = `${fallback.title} ${fallback.bodyPoints.join(" ")}`;
  const inferredCategories: SlideContent["sourceRequirement"]["categories"] =
    /%|数据|指标|增长|同比|环比|data|metric|trend|\d/.test(corpus)
      ? ["data", "user-input"]
      : fallback.input.deckType === "teaching-deck" ||
          fallback.input.deckType === "training-course"
        ? ["course-material", "user-input"]
        : ["user-input"];
  const categories = Array.isArray(record.categories)
    ? record.categories.filter((item): item is SlideContent["sourceRequirement"]["categories"][number] =>
        ["data", "case", "quote", "course-material", "user-input", "none"].includes(
          String(item)
        )
      )
    : inferredCategories;
  const required =
    typeof record.required === "boolean"
      ? record.required
      : !categories.includes("none");

  return {
    required,
    categories: categories.length > 0 ? categories.slice(0, 5) : ["user-input"],
    note: boundedText({
      fallback:
        fallback.input.locale === "zh-CN"
          ? required
            ? "涉及数据、案例、引用或教材内容时需在页脚或图表下方注明来源。"
            : "本页主要基于用户输入，不强制增加外部来源。"
          : required
            ? "Add sources in the footer or under charts when data, cases, quotes, or course material appear."
            : "This slide mainly uses user input and does not require external source notes.",
      maxLength: 220,
      minLength: 4,
      value: record.note
    })
  };
}

function normalizeAdaptationRules(
  value: unknown,
  fallback: {
    bodyPoints: string[];
    input: AnalyzeDeckRequest;
    nextTitle?: string;
    previousTitle?: string;
    title: string;
  }
): SlideContent["adaptationRules"] {
  const record = isRecord(value) ? value : {};
  const isChinese = fallback.input.locale === "zh-CN";

  return {
    splitWhen: boundedText({
      fallback: isChinese
        ? "当正文要点超过 5 条、包含多组数据或出现两个以上结论时拆成独立页面。"
        : "Split when body points exceed five, multiple data groups appear, or more than two conclusions compete.",
      maxLength: 220,
      minLength: 4,
      value: record.splitWhen
    }),
    splitCandidates: boundedTextArray({
      fallback:
        fallback.bodyPoints.length > 2
          ? fallback.bodyPoints.slice(1, 4)
          : [fallback.title],
      maxItems: 5,
      maxLength: 120,
      minItems: 1,
      minLength: 2,
      value: record.splitCandidates
    }),
    mergeWhen: boundedText({
      fallback: isChinese
        ? "当只剩一个支撑点且没有独立图表或案例时，可与相邻过渡页合并。"
        : "Merge when only one supporting point remains and there is no standalone chart or case.",
      maxLength: 220,
      minLength: 4,
      value: record.mergeWhen
    }),
    mergeWith: boundedText({
      fallback:
        fallback.nextTitle ??
        fallback.previousTitle ??
        (isChinese ? "相邻主题页" : "an adjacent topic slide"),
      maxLength: 120,
      minLength: 2,
      value: record.mergeWith
    })
  };
}

function normalizeAudienceFocus(
  value: unknown,
  input: AnalyzeDeckRequest
): SlideContent["audienceFocus"] {
  const record = isRecord(value) ? value : {};
  const lensValues = [
    "business-conclusion",
    "teaching-understanding",
    "sales-value",
    "research-evidence",
    "general"
  ] as const;
  const fallbackLens =
    input.deckType === "training-course" || input.deckType === "teaching-deck"
      ? "teaching-understanding"
      : input.deckType === "sales-proposal" ||
          input.deckType === "brand-marketing" ||
          input.deckType === "product-launch"
        ? "sales-value"
        : input.deckType === "research-report" || input.deckType === "data-analysis"
          ? "research-evidence"
          : input.deckType === "business-report" ||
              input.deckType === "project-plan" ||
              input.deckType === "operation-plan"
            ? "business-conclusion"
            : "general";
  const lens = lensValues.includes(record.lens as never)
    ? (record.lens as SlideContent["audienceFocus"]["lens"])
    : fallbackLens;

  return {
    lens,
    focus: boundedText({
      fallback:
        input.locale === "zh-CN"
          ? lens === "business-conclusion"
            ? "受众优先关注结论、影响和下一步决策。"
            : lens === "teaching-understanding"
              ? "受众优先关注概念理解、例子和可复述的学习路径。"
              : lens === "sales-value"
                ? "受众优先关注价值、差异化和购买/合作理由。"
                : lens === "research-evidence"
                  ? "受众优先关注证据、方法、数据口径和可信度。"
                  : "受众关注主题是否清晰、信息是否可记住。"
          : lens === "business-conclusion"
            ? "The audience cares first about conclusions, impact, and decisions."
            : lens === "teaching-understanding"
              ? "The audience cares first about understanding, examples, and a repeatable learning path."
              : lens === "sales-value"
                ? "The audience cares first about value, differentiation, and reasons to buy or partner."
                : lens === "research-evidence"
                  ? "The audience cares first about evidence, method, definitions, and credibility."
                  : "The audience cares whether the topic is clear and memorable.",
      maxLength: 220,
      minLength: 4,
      value: record.focus
    })
  };
}

function normalizeViewerObjective(
  value: unknown,
  fallback: {
    coreStatement: string;
    input: AnalyzeDeckRequest;
    speakerGoal: string;
  }
): SlideContent["viewerObjective"] {
  const record = isRecord(value) ? value : {};
  const types = ["understand", "believe", "remember", "act"] as const;
  const type = types.includes(record.type as never)
    ? (record.type as SlideContent["viewerObjective"]["type"])
    : fallback.input.deckType === "sales-proposal" ||
        fallback.input.deckType === "fundraising-pitch"
      ? "believe"
      : fallback.input.deckType === "training-course" ||
          fallback.input.deckType === "teaching-deck"
        ? "understand"
        : fallback.input.deckType === "brand-marketing"
          ? "remember"
          : "act";

  return {
    type,
    description: boundedText({
      fallback:
        fallback.input.locale === "zh-CN"
          ? `看完本页后，观众应${viewerObjectiveVerb(type, fallback.input.locale)}：${compactText(
              fallback.coreStatement || fallback.speakerGoal,
              100
            )}`
          : `After this slide, the audience should ${viewerObjectiveVerb(
              type,
              fallback.input.locale
            )}: ${compactText(fallback.coreStatement || fallback.speakerGoal, 110)}`,
      maxLength: 220,
      minLength: 4,
      value: record.description
    })
  };
}

function viewerObjectiveVerb(
  type: SlideContent["viewerObjective"]["type"],
  locale: AnalyzeDeckRequest["locale"]
) {
  if (locale === "zh-CN") {
    return {
      act: "采取行动",
      believe: "相信",
      remember: "记住",
      understand: "理解"
    }[type];
  }

  return {
    act: "act on",
    believe: "believe",
    remember: "remember",
    understand: "understand"
  }[type];
}

function normalizeContentBoundary(
  value: unknown,
  fallback: {
    bodyPoints: string[];
    input: AnalyzeDeckRequest;
    title: string;
  }
): SlideContent["contentBoundary"] {
  const record = isRecord(value) ? value : {};

  return {
    inScope: boundedText({
      fallback:
        fallback.input.locale === "zh-CN"
          ? `本页只展开“${compactText(fallback.title, 50)}”相关的核心观点和必要支撑。`
          : `This slide only expands the core point and necessary support for "${compactText(
              fallback.title,
              60
            )}".`,
      maxLength: 220,
      minLength: 4,
      value: record.inScope
    }),
    outOfScope: boundedTextArray({
      fallback:
        fallback.input.locale === "zh-CN"
          ? ["不展开无关背景", "不重复整套方案细节", "不加入未经说明的数据来源"]
          : ["Do not expand unrelated background", "Do not repeat full deck details", "Do not add unexplained data sources"],
      maxItems: 6,
      maxLength: 160,
      minItems: 1,
      minLength: 2,
      value: record.outOfScope
    })
  };
}

function normalizeSemanticSlidePlanResult(
  value: unknown,
  input: AnalyzeDeckRequest,
  slide: SlideContent
) {
  if (!isRecord(value)) {
    return value;
  }

  const pageIntent = isRecord(value.pageIntent)
    ? value.pageIntent
    : buildFallbackPageIntent({ input, slide });
  const normalizedPageIntent = buildFallbackPageIntent({
    input,
    slide
  });
  const mergedPageIntent = {
    ...normalizedPageIntent,
    ...pageIntent
  };
  const fallbackHierarchy = buildFallbackContentHierarchy({
    input,
    pageIntent: normalizedPageIntent,
    slide
  });
  const contentHierarchy = isRecord(value.contentHierarchy)
    ? normalizeContentHierarchyForSemanticPlan(
        value.contentHierarchy,
        fallbackHierarchy
      )
    : fallbackHierarchy;
  const semanticElements = Array.isArray(value.semanticElements)
    ? value.semanticElements
    : buildFallbackSemanticElements({
        input,
        pageIntent: normalizedPageIntent,
        slide
      });
  const fallbackLayoutSelection = buildDefaultLayoutSelection({
    input,
    pageIntent: mergedPageIntent,
    slide
  });
  const layoutSelection = isRecord(value.layoutSelection)
    ? normalizeLayoutSelectionForSemanticPlan(
        value.layoutSelection,
        fallbackLayoutSelection
      )
    : fallbackLayoutSelection;
  const fallbackConstraints = buildDefaultDesignConstraints({
    input,
    pageIntent: mergedPageIntent,
    slide
  });
  const constraints = isRecord(value.constraints)
    ? normalizeDesignConstraintsForSemanticPlan(
        value.constraints,
        fallbackConstraints
      )
    : fallbackConstraints;
  const fallbackDesignPlan = {
    expressionIntent:
      input.locale === "zh-CN"
        ? "先表达页面核心结论，再用语义元素支撑理解。"
        : "Lead with the page's core message, then support it with semantic elements.",
    layoutTemplate: "semantic-layout",
    readingOrder: semanticElements
      .filter(isRecord)
      .map((element) => formatLooseValue(element.id, 80))
      .filter(Boolean),
    visualStrategy: slide.visualIntent
  };
  const designPlan = isRecord(value.designPlan)
    ? {
        ...fallbackDesignPlan,
        ...value.designPlan,
        readingOrder: Array.isArray(value.designPlan.readingOrder)
          ? value.designPlan.readingOrder
          : fallbackDesignPlan.readingOrder
      }
    : fallbackDesignPlan;
  const fallbackDiagnostics = {
    density: mergedPageIntent.contentDensity === "high" ? 0.78 : 0.52,
    hasOverflow: false,
    needsUserConfirmation: mergedPageIntent.contentDensity === "high",
    overflowFixes:
      mergedPageIntent.contentDensity === "high"
        ? ["compress-copy", "adjust-layout"]
        : [],
    warnings: []
  };

  return {
    slideId: slide.slideId,
    index: slide.index,
    content: normalizeSlideContent(
      {
        ...slide,
        ...(isRecord(value.content) ? value.content : {}),
        slideId: slide.slideId,
        index: slide.index
      },
      input,
      {
        bodyPoints: slide.bodyPoints,
        expected: {
          slideId: slide.slideId,
          index: slide.index,
          title: slide.title,
          purpose: slide.speakerGoal,
          keyMessage: slide.coreStatement,
          visualDirection: slide.visualIntent
        },
        slideCount: input.pageCount,
        subtitle: slide.subtitle ?? ""
      }
    ),
    pageIntent: mergedPageIntent,
      contentHierarchy,
    layoutSelection,
    constraints,
    expressionIntent: boundedText({
      fallback:
        formatLooseValue(value.expressionIntent, 240) ||
        slide.speakerGoal,
      maxLength: 240,
      minLength: 4,
      value: value.expressionIntent
    }),
    designPlan,
    layoutDiagnostics: isRecord(value.layoutDiagnostics)
      ? {
          ...fallbackDiagnostics,
          ...value.layoutDiagnostics,
          overflowFixes: Array.isArray(value.layoutDiagnostics.overflowFixes)
            ? value.layoutDiagnostics.overflowFixes
            : fallbackDiagnostics.overflowFixes,
          warnings: Array.isArray(value.layoutDiagnostics.warnings)
            ? value.layoutDiagnostics.warnings
            : fallbackDiagnostics.warnings
        }
      : fallbackDiagnostics,
    semanticElements
  };
}

function normalizeContentHierarchyForSemanticPlan(
  value: Record<string, unknown>,
  fallback: SlideCompositionPlan["contentHierarchy"]
) {
  const tiers = Array.isArray(value.tiers)
    ? value.tiers
    : fallback.tiers;

  return {
    primaryMessage: boundedText({
      fallback: fallback.primaryMessage,
      maxLength: 180,
      minLength: 2,
      value: value.primaryMessage
    }),
    levels: Array.isArray(value.levels) ? value.levels : fallback.levels,
    tiers
  };
}

function normalizeLayoutSelectionForSemanticPlan(
  value: Record<string, unknown>,
  fallback: SlideCompositionPlan["layoutSelection"]
): SlideCompositionPlan["layoutSelection"] {
  const parsed = slideLayoutSelectionSchema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  const candidatesValue = Array.isArray(value.candidates)
    ? value.candidates
    : fallback.candidates;
  const candidates = candidatesValue
    .map((candidate, index) => {
      const record = isRecord(candidate) ? candidate : {};
      const rawLayoutType =
        typeof record.layoutType === "string"
          ? record.layoutType
          : typeof candidate === "string"
            ? candidate
            : fallback.candidates[index]?.layoutType;
      const parsedLayoutType = slideLayoutTypeSchema.safeParse(rawLayoutType);

      if (!parsedLayoutType.success) {
        return null;
      }

      return {
        fitReason: boundedText({
          fallback: fallback.candidates[index]?.fitReason ?? fallback.selectionReason,
          maxLength: 220,
          minLength: 4,
          value: record.fitReason ?? record.reason
        }),
        layoutType: parsedLayoutType.data,
        risk: boundedText({
          fallback: fallback.candidates[index]?.risk ?? "保持渲染风险可控。",
          maxLength: 180,
          minLength: 2,
          value: record.risk
        }),
        score:
          typeof record.score === "number"
            ? Math.max(0, Math.min(100, Math.round(record.score)))
            : fallback.candidates[index]?.score ?? Math.max(70, 94 - index * 8)
      };
    })
    .filter(
      (candidate): candidate is SlideCompositionPlan["layoutSelection"]["candidates"][number] =>
        Boolean(candidate)
    )
    .slice(0, 3);
  const safeCandidates = candidates.length >= 2 ? candidates : fallback.candidates;
  const selectedLayoutType: SlideCompositionPlan["layoutSelection"]["selectedLayoutType"] =
    typeof value.selectedLayoutType === "string" &&
    slideLayoutTypeSchema.safeParse(value.selectedLayoutType).success &&
    safeCandidates.some((candidate) => candidate.layoutType === value.selectedLayoutType)
      ? value.selectedLayoutType as SlideCompositionPlan["layoutSelection"]["selectedLayoutType"]
      : safeCandidates[0].layoutType;

  return {
    candidates: safeCandidates.slice(0, 3) as SlideCompositionPlan["layoutSelection"]["candidates"],
    selectedLayoutType,
    selectionReason: boundedText({
      fallback: fallback.selectionReason,
      maxLength: 240,
      minLength: 4,
      value: value.selectionReason
    })
  };
}

function normalizeDesignConstraintsForSemanticPlan(
  value: Record<string, unknown>,
  fallback: SlideCompositionPlan["constraints"]
): SlideCompositionPlan["constraints"] {
  return {
    coreMessagePresent:
      typeof value.coreMessagePresent === "boolean"
        ? value.coreMessagePresent
        : fallback.coreMessagePresent,
    densityLimit:
      value.densityLimit === "low" ||
      value.densityLimit === "medium" ||
      value.densityLimit === "high"
        ? value.densityLimit
        : fallback.densityLimit,
    maxHeroVisuals: 1,
    renderNotes: boundedTextArray({
      fallback: fallback.renderNotes,
      maxItems: 8,
      maxLength: 180,
      minItems: 1,
      minLength: 2,
      value: value.renderNotes
    }),
    safeMargin: {
      appliesTo: boundedTextArray({
        fallback: fallback.safeMargin.appliesTo,
        maxItems: 6,
        maxLength: 80,
        minItems: 1,
        minLength: 2,
        value: isRecord(value.safeMargin) ? value.safeMargin.appliesTo : undefined
      }),
      unit: "inch",
      value: 0.5
    },
    subjectAvoidsTitleArea:
      typeof value.subjectAvoidsTitleArea === "boolean"
        ? value.subjectAvoidsTitleArea
        : fallback.subjectAvoidsTitleArea,
    titleUnique:
      typeof value.titleUnique === "boolean"
        ? value.titleUnique
        : fallback.titleUnique
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
    messages: buildIntentAnalysisMessages(input),
    normalize: (value) => normalizeIntentAnalysisResult(value, input)
  });

  return deckIntentAnalysisResultSchema.parse({
    ...analysis,
    fileSummaries: analysis.fileSummaries,
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
    messages: buildDeckAnalysisMessages(input),
    normalize: (value) => normalizeDeckAnalysisResult(value, input)
  });

  if (analysis.slides.length !== input.pageCount) {
    throw new Error("AI returned a slide count that does not match pageCount.");
  }

  const slides = await mapWithConcurrency(
    analysis.slides,
    slideCompositionConcurrency,
    (slide) =>
      composeSingleSemanticPlanWithRepair({
        client,
        input,
        model,
        slide,
        temperature,
        unifiedVisualSpec: analysis.unifiedVisualSpec
      })
  );

  return analyzedDeckResultSchema.parse({
    mode: "ai-json",
    deckTitle: analysis.deckTitle,
    deckSummary: analysis.deckSummary,
    unifiedVisualSpec: analysis.unifiedVisualSpec,
    slides: slides.map((slide) => slide.composition)
  });
}

function normalizeDeckAnalysisResult(value: unknown, input: AnalyzeDeckRequest) {
  if (!isRecord(value)) {
    return value;
  }

  const rawSlides = Array.isArray(value.slides) ? value.slides : null;

  return {
    ...value,
    unifiedVisualSpec: normalizeUnifiedVisualSpec(
      value.unifiedVisualSpec,
      input
    ),
    slides: rawSlides
      ? rawSlides.map((slide, index) =>
          normalizeSlideContent(slide, input, {
            nextTitle: getLooseSlideTitle(rawSlides, index + 1),
            previousTitle: getLooseSlideTitle(rawSlides, index - 1),
            slideCount: rawSlides.length || input.pageCount
          })
        )
      : value.slides
  };
}

function getLooseSlideTitle(slides: unknown[], index: number) {
  const slide = slides[index];

  return isRecord(slide) ? formatLooseValue(slide.title, 80) : undefined;
}

async function createDeckOutlineWithAi(
  input: AnalyzeDeckRequest,
  structure: DeckStructureOutlineResult | DeckStructureOutline,
  fileSummaries: DeckIntentAnalysisResult["fileSummaries"],
  client: JsonChatClient,
  model: string,
  temperature: number
): Promise<DeckOutlineResult> {
  if (structure.slides.length !== input.pageCount) {
    throw new Error("AI returned a slide count that does not match pageCount.");
  }

  const lockedStructure = buildStructureOutlineSchema(input).parse({
    deckType: input.deckType,
    ...structure
  });
  const pageCopy = await generateValidatedJson({
    client,
    model,
    temperature,
    schema: buildPageCopySchema(input),
    schemaName: "DeckPageCopyResult",
    messages: buildPageCopyMessages({
      input,
      structure: lockedStructure,
      fileSummaries
    }),
    normalize: (value) => normalizePageCopyResult(value, input, lockedStructure)
  });

  ensurePageCopyMatchesStructure(pageCopy, lockedStructure);

  return deckOutlineResultSchema.parse({
    mode: "ai-json",
    deckTitle: lockedStructure.deckTitle,
    deckSummary: lockedStructure.deckSummary,
    unifiedVisualSpec: pageCopy.unifiedVisualSpec,
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
  const composed = await mapWithConcurrency(
    slides,
    slideCompositionConcurrency,
    (slide) =>
      composeSingleSemanticPlanWithRepair({
        client,
        input,
        model,
        slide,
        temperature,
        unifiedVisualSpec
      })
  );

  return sortSlidePlansByIndex(
    composed.map((item) => item.composition)
  );
}

async function composeSingleSemanticPlanWithRepair({
  client,
  input,
  model,
  slide,
  temperature,
  unifiedVisualSpec
}: {
  client: JsonChatClient;
  input: AnalyzeDeckRequest;
  model: string;
  slide: SlideContent;
  temperature: number;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  const schema = buildSemanticSlidePlanSchema(slide);
  const semanticPlan = await generateValidatedJson({
    client,
    model,
    temperature,
    schema,
    schemaName: "SemanticSlidePlan",
    messages: buildSlideCompositionMessages({
      input,
      slide,
      unifiedVisualSpec
    }),
    normalize: (value) => normalizeSemanticSlidePlanResult(value, input, slide)
  });
  const firstComposition = normalizeSlideCompositionPlan(
    composeSlideFromSemanticPlan({
      input,
      semanticPlan,
      unifiedVisualSpec
    })
  );

  if (!needsSlideDesignRepair(firstComposition.designQualityScore)) {
    return {
      composition: firstComposition,
      semanticPlan
    };
  }

  try {
    const repairedPlan = await generateValidatedJson({
      client,
      model,
      temperature,
      schema,
      schemaName: "SemanticSlidePlanRepair",
      messages: buildSlideRepairMessages({
        input,
        score: firstComposition.designQualityScore,
        semanticPlan,
        slide,
        unifiedVisualSpec
      }),
      normalize: (value) => normalizeSemanticSlidePlanResult(value, input, slide)
    });
    const repairedComposition = normalizeSlideCompositionPlan(
      composeSlideFromSemanticPlan({
        input,
        semanticPlan: repairedPlan,
        unifiedVisualSpec
      })
    );

    return {
      composition: normalizeSlideCompositionPlan({
        ...repairedComposition,
        designQualityScore: {
          ...repairedComposition.designQualityScore,
          repairStatus: needsSlideDesignRepair(repairedComposition.designQualityScore)
            ? "still-low"
            : "repaired"
        }
      }),
      semanticPlan: repairedPlan
    };
  } catch {
    return {
      composition: normalizeSlideCompositionPlan({
        ...firstComposition,
        designQualityScore: {
          ...buildSlideDesignQualityScore(firstComposition, "failed"),
          repairStatus: "failed"
        }
      }),
      semanticPlan
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;

        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );

  return results;
}

function sortSlidePlansByIndex(slides: SlideCompositionPlan[]) {
  return [...slides].sort((current, next) => current.index - next.index);
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
    size: file.size,
    summary: compactText(file.content, 500),
    snippets: buildFileSnippets(file.content)
  }));
}

function buildFileSnippets(content: string) {
  return content
    .split(/\n{2,}|(?<=[。！？.!?])\s+/)
    .map((item) => compactText(item, 1200))
    .filter((item) => item.length > 0)
    .slice(0, 4);
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
  structureOutline: DeckStructureOutline,
  fileSummaries: DeckIntentAnalysisResult["fileSummaries"] = [],
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
      deckTitle: structureOutline.deckTitle,
      deckSummary: structureOutline.deckSummary,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide, index) =>
        normalizeSlideContent(
          {
            ...slide.content,
            slideId: structureOutline.slides[index]?.slideId ?? slide.slideId,
            index: structureOutline.slides[index]?.index ?? slide.index,
            title: structureOutline.slides[index]?.title ?? slide.content.title,
            speakerGoal:
              structureOutline.slides[index]?.purpose ?? slide.content.speakerGoal,
            visualIntent:
              structureOutline.slides[index]?.visualDirection ??
              slide.content.visualIntent
          },
          input,
          {
            bodyPoints: slide.content.bodyPoints,
            expected: structureOutline.slides[index],
            nextTitle: structureOutline.slides[index + 1]?.title,
            previousTitle: structureOutline.slides[index - 1]?.title,
            slideCount: structureOutline.slides.length,
            subtitle: slide.content.subtitle ?? ""
          }
        )
      )
    });
  }

  return createDeckOutlineWithAi(
    input,
    structureOutline,
    fileSummaries,
    client,
    model,
    temperature
  );
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
    return sortSlidePlansByIndex(
      slides.map((slide) =>
        normalizeSlideCompositionPlan(
          buildMockSlideCompositionPlanFromContent({
            input,
            slide,
            unifiedVisualSpec
          })
        )
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

export async function composeDeckSlidesFromOutline(
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
    return sortSlidePlansByIndex(
      slides.map((slide) =>
        normalizeSlideCompositionPlan(
          buildMockSlideCompositionPlanFromContent({
            input,
            slide,
            unifiedVisualSpec
          })
        )
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
