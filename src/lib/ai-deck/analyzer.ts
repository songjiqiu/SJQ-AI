import OpenAI from "openai";
import { z } from "zod";

import {
  buildMockDeckIntentAnalysis,
  buildMockAnalyzedDeck
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
  buildSemanticPlanFromSlide,
  composeSlideFromTemplate,
  composeSlideFromSemanticPlan
} from "./semantic-layout";
import { enhanceSlideWithSemanticAssets } from "./semantic-assets";
import {
  contentBlockText,
  dedupeSlideContentBlocks,
  normalizeContentBlockText
} from "./content-block-bindings";
import { selectPptTemplateForSlide } from "@/lib/admin/templates/service";
import { getPptTypeVisualTone } from "@/lib/create-deck/visual-tone";
import {
  extractPaletteHexColors,
  extractHexColor,
  formatColorPaletteForPrompt,
  normalizeHexColor,
  sanitizeColorRoleText,
  stripHexColorsFromText
} from "@/lib/ai-deck/visual-colors";
import {
  buildColorPaletteFromHexes,
  buildFallbackColorPalette,
  buildFallbackUnifiedVisualSpec
} from "@/lib/ai-deck/visual-spec-defaults";
import {
  analyzedDeckResultSchema,
  analyzeDeckRequestSchema,
  deckDetailedOutlineResultSchema,
  deckDisplayContentResultSchema,
  deckPageCountMax,
  deckPageCountMin,
  deckIntentAnalysisResultSchema,
  lightweightNarrativeStyleIds,
  lightweightOutlineSchema,
  deckAnalysisResultSchema,
  deckOutlineIntentInputSchema,
  deckPageCopyResultSchema,
  deckOutlineResultSchema,
  deckStructureOutlineResultSchema,
  deckStructureSlideSchema,
  detailedSlideOutlineSchema,
  semanticSlidePlanSchema,
  slideDesignConstraintsSchema,
  slideContentBlockMaxCount,
  slideDisplayContentSchema,
  slideLayoutSelectionSchema,
  slideLayoutTypeSchema,
  slideLayoutTypeIds,
  slideContentSchema,
  unifiedVisualSpecSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type DeckIntentAnalysisResult,
  type DeckAnalysisResult,
  type DeckDetailedOutlineResult,
  type DeckDisplayContentResult,
  type DeckOutlineIntentInput,
  type DeckPageCopyResult,
  type DeckOutlineResult,
  type DeckStructureOutline,
  type DeckStructureOutlineResult,
  type DetailedSlideOutline,
  type SemanticSlideElement,
  type SemanticSlidePlan,
  type SlideCompositionPlan,
  type SlideContent,
  type SlidePageIntent,
  type UnifiedVisualSpec
} from "./schema";

const defaultModel = "gpt-4.1-mini";
const slideCompositionConcurrency = 3;
const outlineSourceContextMaxLength = 16000;

const slidePageTypeValues = [
  "cover",
  "agenda",
  "section",
  "content",
  "data",
  "comparison",
  "process",
  "summary"
] as const;

const slideContentBlockTypeValues = [
  "heading",
  "text",
  "list",
  "image",
  "table",
  "metric",
  "chart",
  "quote",
  "callout",
  "comparison",
  "timeline",
  "steps",
  "summary",
  "conclusion",
  "source"
] as const;

export type AiDeckEnv = {
  AI_TEXT_TEMPERATURE?: string | number;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  AI_TEXT_MODEL?: string;
};

export type AnalyzeDeckOptions = {
  client?: JsonChatClient;
  env?: AiDeckEnv;
  intentAnalysis?: DeckIntentAnalysisResult;
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
- unifiedVisualSpec 必须是对象，只输出结构化 JSON，不要输出 Markdown 文档或规范全文；字段必须包含 themeName、visualStyle、designIntent、usageConvenience、colorPalette、typography、imageStyle、consistencyRules、forbiddenRules、pageSpec、typographyRules、colorRoles、transparencyRules、imageRules、componentRules。
- unifiedVisualSpec 还必须包含完整结构化视觉规范：pptTypeVisualTone、informationDensityRules、layoutRules、chartVisualRules、imageIllustrationRules、iconStyleRules、emphasisRules、forbiddenVisualRules。
- 统一视觉说明字段内容必须遵循全局视觉统一规范的 13 类约束：基础信息、PPT 页面类型与视觉基调、色彩系统、页面规格与布局、字体与排版、间距规范、图片使用规范、组件规范、表格规范、图表规范、图标与轻量元素、一致性规则、禁用规则。
- 规范映射到现有字段：themeName/visualStyle/pptTypeVisualTone 对应基础信息与 PPT 类型视觉基调；colorPalette/colorRoles 对应色彩系统；pageSpec/layoutRules/informationDensityRules 对应页面规格、12 栏栅格、间距和密度；typography/typographyRules 对应字体与排版；imageStyle/imageRules/imageIllustrationRules 对应图片使用规范；layoutRules/emphasisRules 对应组件规范；chartVisualRules 对应表格和图表规范；iconStyleRules 对应图标与轻量元素；consistencyRules/forbiddenRules/forbiddenVisualRules 对应一致性和禁用规则。
- themeName 只能描述内容主题或视觉主题，不得引用外观配色预设名，例如不要包含“星图、矩阵、深空、晨雾、月白、竹青、黛蓝、胭脂、鎏金、玄墨、Star Map、Matrix、Deep Space、Morning Mist、Moon White、Bamboo Green、Dai Blue、Rouge、Gilded Gold、Ink Black”。
- pageSpec 必须说明：这是一页 16:9 的 PPT，宽 13.333 英寸、高 7.5 英寸，内容要避开四周 0.5 英寸安全边距，并基于 12 栏栅格进行自动排版。
- colorPalette 必须是分组对象：primary 恰好 1 个、secondary 2-3 个、chart 4-8 个、neutral 2-4 个、accent 1-2 个；每个颜色都必须是 {name, hex, usage}，hex 使用大写 #RRGGBB。
- 所有页面颜色必须来自 colorPalette；除色板颜色外只允许 #000000 和 #FFFFFF；不得创造未声明的渐变色、阴影色、边框色或透明色。
- typographyRules 必须包含默认字号、最小字号、最大行数、行高、字体 fallback、scale 和 textLimits；scale 必须明确封面标题、封面副标题、页标题、小节标题、正文、注释、图表标签、图标标签的字号、字重、行高和用途。
- colorRoles 必须说明背景、卡片/表面、标题、正文、强调、高亮、图表、装饰、边框/分隔线颜色角色；所有 HEX 色值必须来自 colorPalette 或 #000000/#FFFFFF；标题色、正文色、图表色可以引用多个色板内颜色，其它角色只写一个主色；正文色和背景色对比度不得低于 4.5:1；装饰色不能用于大段正文；高亮色每页最多使用 1-2 处。
- transparencyRules 只能基于 colorPalette 中的 baseHex 生成 rgba 语义，必须明确遮罩、弱背景、悬浮层或分隔线等用途。
- imageRules 必须要求背景图不得包含高对比文字区域，图片主体不能压在标题区，并输出 imagePromptStyle 便于后续拼接图片生成 prompt。
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
  const fileSummaries = buildFileSummaries(input);
  const sourceReferences = buildSourceReferences(input.sources ?? []);

  return [
    {
      role: "system" as const,
      content:
        "你是中文优先的 PPT 创作意图分析师和轻量大纲规划师。你只负责生成 L0-L3 粗粒度结构，不写每页详细文案，不生成统一视觉规范。必须只输出 JSON。"
    },
    {
      role: "user" as const,
      content: `请分析以下输入，返回 DeckIntentAnalysisResult JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- recommendedPageCount 必须是 ${deckPageCountMin} 到 ${deckPageCountMax} 之间的整数。
${input.pageCount ? `- 用户已指定页数 pageCount=${input.pageCount}，recommendedPageCount 必须等于 ${input.pageCount}。` : "- 用户未指定页数，请根据内容密度推荐 recommendedPageCount。"}
- 必须生成 lightweightOutline，且 lightweightOutline.pageCount、recommendedPageCount、lightweightOutline.pages.length 三者必须完全相等。
- lightweightOutline 根字段只能包含 deckTitle、deckType、narrativeStyle、pageCount、globalTheme、chapters、pages。
- L0 globalTheme 只描述整套 PPT 的全局主题和整体目标。
- L1 chapters 只定义 chapterId、title、purpose、pageRange，pageRange 必须覆盖 1 到 pageCount 全部页面且不能重叠。
- L2/L3 pages 只定义 pageNumber、pageType、layoutType、title、purpose、keyMessage、sourceIds、chapterId、narrativeRole。
- pageNumber 必须从 1 到 pageCount 连续，不允许缺页或重复页码。
- pageType 只能使用：${slidePageTypeValues.join("、")}。
- layoutType 只能使用：${slideLayoutTypeIds.join("、")}。
- narrativeStyle 只能使用：${lightweightNarrativeStyleIds.join("、")}。
- narrativeRole 只能使用 setup、argument、turning-point、climax、summary、call-to-action，顺序必须符合 setup -> argument -> turning-point -> climax -> summary -> call-to-action，不得倒退。
- 页面顺序必须符合 PPT 类型 "${input.deckType}" 与 narrativeStyle 的叙事逻辑：封面先建立主题，中段逐步论证或教学展开，后段总结或行动收束。
- sourceIds 只能从服务端给出的已有 sourceId 中选择，不得编造；如果没有可引用来源，返回空数组。
- 本轮不得输出 structureOutline、slides、contentBlocks、bodyPoints、subtitle、unifiedVisualSpec。
- 不得输出具体正文段落、图表数据、图片关键词、图片 prompt、页面元素坐标、页面元素层级、zIndex、textStyle 或具体视觉样式。
- fileSummaries 必须原样基于输入文件摘要返回，只能使用 name、size、characterCount、summary、snippets 字段。
- locale=${input.locale}，输出语言必须匹配 locale。

输入：
${serialize({
  idea: input.idea,
  sourceText: input.sourceText,
  fileSummaries,
  sourceReferences,
  deckType: input.deckType,
  palette: input.palette,
  pageCount: input.pageCount,
  locale: input.locale
})}`
    }
  ];
}

function buildVisualSpecMessages({
  fileSummaries,
  input,
  intentAnalysis,
  sourceContext,
  structure
}: {
  fileSummaries?: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
  intentAnalysis: DeckIntentAnalysisResult;
  sourceContext: string;
  structure: DeckStructureOutlineResult;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是中文优先 PPT 统一视觉规范设计师。你只负责生成整套 PPT 的全局统一视觉规范，不写每页详细文案。必须只输出 JSON，不能输出 Markdown。"
    },
    {
      role: "user" as const,
      content: `请基于已确认输入分析、结构大纲和原始资料上下文返回 UnifiedVisualSpec JSON。

硬性要求：
- 根对象就是 unifiedVisualSpec 本身，不要包裹 unifiedVisualSpec 字段，不要输出 slides、deckType、locale、palette、pageCount。
- 只输出 UnifiedVisualSpec 结构化 JSON，不要输出 Markdown 文档、规范全文或任何额外全文字段。
- unifiedVisualSpec 必须包含 themeName、visualStyle、designIntent、usageConvenience、colorPalette、typography、imageStyle、consistencyRules、forbiddenRules、pageSpec、typographyRules、colorRoles、transparencyRules、imageRules、componentRules。
- unifiedVisualSpec 还必须包含完整结构化视觉规范：pptTypeVisualTone、informationDensityRules、layoutRules、chartVisualRules、imageIllustrationRules、iconStyleRules、emphasisRules、forbiddenVisualRules。
- 字段内容必须遵循全局视觉统一规范的完整约束（13 类约束扩展版）：基础信息、PPT 类型视觉基调、色彩系统、版式字体、图片规则、组件元素、高级规则、一致性和禁用规则。
- 规范映射到现有字段：themeName/visualStyle/pptTypeVisualTone 对应基础信息与 PPT 类型视觉基调；colorPalette/colorRoles 对应色彩系统；pageSpec/layoutRules/informationDensityRules 对应页面规格、12 栏栅格、间距和密度；typography/typographyRules 对应字体与排版；imageStyle/imageRules/imageIllustrationRules 对应图片使用规范；layoutRules/emphasisRules 对应组件规范；chartVisualRules 对应表格和图表规范；iconStyleRules 对应图标与轻量元素；consistencyRules/forbiddenRules/forbiddenVisualRules 对应一致性和禁用规则。
- pptTypeVisualTone 只能返回当前 PPT 类型 "${input.deckType}" 的匹配结果，必须包含 deckType、deckTypeName、recommendedTone、visualKeywords；不要返回其他 PPT 类型的完整对照表。
- 当前 PPT 类型视觉基调参考：${serialize(getPptTypeVisualTone(input.deckType, input.locale))}
- 当前已锁定配色预设为 "${input.palette}"，最终 HEX 只能来自以下服务端色板；你只能围绕这些颜色改写名称、用途、角色说明，不得自行发明、替换或扩展任何 HEX：
${formatColorPaletteForPrompt(buildFallbackColorPalette(input.palette, input.locale))}
- informationDensityRules 仍按商务汇报、课程培训、品牌营销、研究报告四类说明页面信息密度节奏，用于通用排版约束。
- colorPalette 必须是分组对象：primary 恰好 1 个、secondary 2-3 个、chart 4-8 个、neutral 2-4 个、accent 1-2 个；每个颜色都必须是 {name, hex, usage}，hex 使用大写 #RRGGBB；禁止输出字符串数组色板。
- 所有页面颜色必须来自已锁定服务端色板；除色板颜色外只允许 #000000 和 #FFFFFF；不允许自行创造新颜色，不允许使用未在色板中声明的渐变色、阴影色、边框色或透明色。
- 如需透明度，只允许在 transparencyRules 中基于色板颜色生成 rgba 语义，不得引入新色相，并明确用途，例如遮罩、弱背景、悬浮层、分隔线；transparencyRules.baseHex 必须直接使用 colorPalette 中已声明的 HEX，不得使用颜色名称、派生色、透明色或未声明 HEX。
- colorRoles 不只写 HEX 色值，还要说明背景、卡片/表面、标题、正文、强调、高亮、图表、装饰、边框/分隔线各自用在哪里；所有 HEX 色值必须来自 colorPalette 或 #000000/#FFFFFF，标题色、正文色、图表色可以引用多个色板内颜色用于层级和图表序列，其它角色只写一个主色。
- typographyRules.scale 必须明确封面标题、封面副标题、页标题、小节标题、正文、注释、图表标签、图标标签的字号、字重、行高和用途；textLimits 必须保存标题行数、bullet 字数、注释长度、图标标签长度和禁止大段正文规则。
- layoutRules 必须说明页面边距、区块间距、元素间距和留白规则；componentRules 必须覆盖卡片、标签、数字指标、表格、图表、图标与轻量元素规范；chartVisualRules 必须说明图表类型、坐标网格、标签、配色和来源标注；imageIllustrationRules 与 iconStyleRules 必须统一素材和图标风格；emphasisRules 必须说明高亮、重点数字、关键词、结论句如何突出；forbiddenVisualRules 必须包含避免高饱和、过度阴影、复杂背景、动画滥用、自由漂浮布局、低对比文字等禁用项。
- imageRules.usageNotes 必须吸收图片/插画风格的核心使用说明，避免与 imageIllustrationRules 逐字重复；forbiddenRules 与 forbiddenVisualRules 必须表达同一套去重后的禁用规则，避免拆成两组重复规则。
- themeName 只能描述内容主题或视觉主题，不得引用外观配色预设名，例如不要包含“星图、矩阵、深空、晨雾、月白、竹青、黛蓝、胭脂、鎏金、玄墨、Star Map、Matrix、Deep Space、Morning Mist、Moon White、Bamboo Green、Dai Blue、Rouge、Gilded Gold、Ink Black”。
- pageSpec 必须说明：这是一页 16:9 的 PPT，宽 13.333 英寸、高 7.5 英寸，内容要避开四周 0.5 英寸安全边距，并基于 12 栏栅格进行自动排版。
- typographyRules 必须包含默认字号、最小字号、最大行数、行高、字体 fallback、scale 和 textLimits；字体 fallback 优先兼顾中文与英文可读性。
- typographyRules.scale 下每个 usage 只能是单行短句；所有 JSON 字符串里的换行、制表符、回车和英文双引号必须使用合法 JSON 转义。
- colorRoles 必须说明背景、卡片/表面、标题、正文、强调、高亮、图表、装饰、边框/分隔线颜色角色；所有 HEX 色值必须来自 colorPalette 或 #000000/#FFFFFF；标题色、正文色、图表色可以引用多个色板内颜色，其它角色只写一个主色；正文色和背景色对比度不得低于 4.5:1；装饰色不能用于大段正文；高亮色每页最多使用 1-2 处。
- imageRules 必须要求背景图不得包含高对比文字区域，图片主体不能压在标题区，并输出 imageType、aspectRatio、forbiddenItems、imagePromptStyle。
- 输出语言必须匹配 locale=${input.locale}。

已确认输入分析完整 JSON：
${serialize(intentAnalysis)}

结构大纲：
${serialize(structure)}

文件摘要或相关片段：
${serialize(fileSummaries ?? [])}

原始资料上下文（已截断）：
${sourceContext}`
    }
  ];
}

function buildDetailedOutlineMessages({
  fileSummaries,
  input,
  intentAnalysis,
  sourceContext,
  structure,
  unifiedVisualSpec
}: {
  fileSummaries?: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
  intentAnalysis: DeckIntentAnalysisResult;
  sourceContext: string;
  structure: DeckStructureOutlineResult;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是中文优先 PPT 每页详细大纲规划师。你只决定每一页讲什么，不生成最终可落版文字块。必须只输出 JSON，不能输出 Markdown。"
    },
    {
      role: "user" as const,
      content: `请基于结构大纲和统一视觉说明返回每页详细大纲 JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- slides 数量必须等于 pageCount=${input.pageCount}。
- 每个 slideId、index 必须与结构大纲一致。
- 已锁定全局统一视觉规范只作为规划参考，由服务端持有；本轮不要输出 unifiedVisualSpec，也不要另起一套视觉规范。
- 根对象只能包含 deckType、slides，不要输出 unifiedVisualSpec、locale、palette、pageCount。
- 本轮只生成每页详细大纲，决定这一页讲什么；不得输出 contentBlocks、contentLayers、bodyPoints、subtitle 或任何最终展示文案块。
- 每页必须包含 slideId、index、pageType、title、speakerGoal、visualIntent、coreStatement、narrativeRole、slideTransition、explanationDepth、sourceRequirement、adaptationRules、audienceFocus、viewerObjective、contentBoundary。
- pageType 只能使用 cover/agenda/section/content/data/comparison/process/summary，用于说明页面类型。
- coreStatement 是本页核心表达句，必须让不同 PPT 类型都能知道这一页最终想让观众记住什么。
- narrativeRole 只能使用 setup/argument/turning-point/climax/summary/call-to-action，用于判断本页在叙事中的铺垫、论证、转折、高潮、总结或行动号召作用。
- contentLayers 由下一轮基于 contentBlocks 索引生成，本轮禁止输出，避免与最终可展示内容重复或冲突。
- slideTransition 必须说明 fromPrevious 和 toNext，保证整份 PPT 连续叙事而不是孤立页面。
- explanationDepth 只能使用 focus/transition/summary/supporting，区分重点页、过渡页、总结页、辅助页。
- sourceRequirement 必须说明是否需要注明数据、案例、引用、教材内容或用户输入来源。
- adaptationRules 必须说明内容多时哪些可拆页，内容少时可与哪类页面合并；splitCandidates 1-5 条且每条至少 2 个字符，mergeWith 必须写具体相邻页面或页面类型，不得为空字符串。
- audienceFocus 必须匹配受众关注点：商务看结论，教学看理解，销售看价值，研究看证据。
- viewerObjective 必须说明看完本页后观众应该理解、相信、记住或采取什么行动。
- contentBoundary 必须说明本页应该展开什么、不应该展开什么，避免跑题。
- 每页只表达一个中心观点，不要把多个主题塞进同一页。
- 输出语言必须匹配 locale=${input.locale}。

已确认输入分析完整 JSON：
${serialize(intentAnalysis)}

结构大纲：
${serialize(structure)}

已锁定全局统一视觉规范：
${serialize(unifiedVisualSpec)}

文件摘要或相关片段：
${serialize(fileSummaries ?? [])}

原始资料上下文（已截断）：
${sourceContext}`
    }
  ];
}

function buildDisplayContentMessages({
  detailedOutline,
  fileSummaries,
  input,
  intentAnalysis,
  sourceContext,
  structure,
  unifiedVisualSpec
}: {
  detailedOutline: DetailedSlideOutline[];
  fileSummaries?: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
  intentAnalysis: DeckIntentAnalysisResult;
  sourceContext: string;
  structure: DeckStructureOutlineResult;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  return [
    {
      role: "system" as const,
      content:
        "你是中文优先 PPT 可展示内容 JSON 规划师。你只把已锁定的详细大纲转成每页可落版的文字、数据和内容模块，不做坐标排版。必须只输出 JSON，不能输出 Markdown。"
    },
    {
      role: "user" as const,
      content: `请基于已锁定详细大纲返回每页可展示内容 JSON。

硬性要求：
- deckType 必须原样返回 "${input.deckType}"，只能引用，不能改写、翻译或替换。
- slides 数量必须等于 pageCount=${input.pageCount}。
- 每个 slideId、index 必须与结构大纲和详细大纲一致。
- 已锁定全局统一视觉规范和每页详细大纲由服务端持有；本轮不要输出 unifiedVisualSpec 或 detailedOutline。
- 根对象只能包含 deckType、slides，不要输出 unifiedVisualSpec、detailedOutline、locale、palette、pageCount。
- slides 只输出每页可展示内容 JSON：slideId、index、title、subtitle、bodyPoints、contentBlocks、contentLayers。
- title 必须与对应详细大纲 title 保持一致；subtitle 可选，用于展示辅助语。
- bodyPoints 控制在 2-5 条，每条是可直接展示的正文要点，不要写讲解说明。
- contentBlocks 是可落版内容模块，每个 block 必须包含 type、content、priority、sourceIds；type 只能使用 heading/text/list/image/table/chart/quote/callout/metric/comparison/timeline/steps/summary/conclusion/source；priority 只能是 1、2、3、4、5，1 为最高优先级，5 为最低。
- sourceIds 只能从服务端 sources 中选择，不得编造；没有引用来源时使用空数组。
- priority 是重要程度，不是条目序号、数组下标或“第 N 个模块”；不得输出 0、6、7、8 等超出范围的数字，超出主要层级的补充信息统一使用 5。
- contentBlocks 应覆盖标题、正文、数字指标、图表说明、引用、标签、步骤、对比项、图片/主视觉/背景图需求等本页需要展示或生成的信息；每页 3-12 个 block。
- 图片、主视觉和背景图需求必须作为 type="image" 的 contentBlock 输出，例如“背景图：清冷古风山水意境图”；不得只写在 visualIntent 或 contentLayers 中。
- contentBlocks 不写坐标、不写样式、不写布局，只描述可展示文字或数据。
- contentLayers 是对本页 contentBlocks 的 0-based 索引分组，只能包含 primary、supporting、supplementary 三组数字数组，不得包含新文本。
- contentLayers 必须覆盖本页每一个 contentBlocks 下标，且每个下标只能出现一次；primary 至少 1 条、最多 4 条，supporting 至少 1 条、最多 6 条，supplementary 最多 5 条。
- contentLayers 分层应与 priority 保持一致：primary 优先引用 P1 重点块，supporting 引用 P2/P3 支撑块，supplementary 引用 P4/P5 补充块。
- 同一页 contentBlocks.content 必须唯一；忽略空白、标点、书名号、大小写和“页脚/页眉/备注/主题/课件主题”等装饰前缀后仍相同的内容，只能输出一次。
- 不要把页脚、页眉、课程名、课件名、主题名、装饰性备注反复写入 contentBlocks；已出现在 title、subtitle 或 bodyPoints 中的文字，不要再作为 note/tag/footer/header 类内容重复输出。
- 封面页不要同时输出“作者：X”和“X”；作者信息只保留一个 contentBlock。
- 封面页课程、课件、版本、年级、册次等元信息只能合并为一个 contentBlock，不要拆成 source/conclusion/text 多条。
- 如果多个模块围绕同一课文或主题展开，必须写出不同信息任务，例如“写作手法”“情感赏析”“文言知识”，不能只重复课程名或课件名。
- 输出语言必须匹配 locale=${input.locale}。

已确认输入分析完整 JSON：
${serialize(intentAnalysis)}

结构大纲：
${serialize(structure)}

已锁定每页详细大纲：
${serialize(detailedOutline)}

已锁定全局统一视觉规范：
${serialize(unifiedVisualSpec)}

文件摘要或相关片段：
${serialize(fileSummaries ?? [])}

原始资料上下文（已截断）：
${sourceContext}`
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
- contentHierarchy.tiers 必须恰好包含 level 1、2、3，每一层 items 至少 1 条，不能输出空数组。
- 如果 level 3 没有明确内容，请使用副标题、sourceRequirement.note、讲解备注或页脚辅助信息补足。
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
- semanticElements 必须覆盖单页文案 content.contentBlocks 中的每一个 block；每个 block.content 至少对应一个 semanticElements.content，文本必须保持一致，不能只生成标题、结论和少量正文。
- 覆盖 contentBlocks 的语义元素必须写 contentBlockIndex，值为该 block 在 content.contentBlocks 中的 0-based 下标；非内容块视觉/页码元素可省略。
- 每个 semanticElement 都应写 styleRole，用于绑定统一视觉说明角色，例如 page-title、key-message、body、body-list、metric、chart、table、quote、callout、comparison、timeline、steps、summary、conclusion、source-note、hero-visual、supporting-visual。
- 如果 contentBlocks 超过模板文字位，也要继续输出对应语义元素；服务端会在确定性排版后把低优先级内容落到紧凑文本区。
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
- semanticElements 必须覆盖原始 content.contentBlocks 的每一个 block.content，不得在修复时删除低优先级可展示内容。
- 覆盖 contentBlocks 的语义元素必须保留或补齐 contentBlockIndex；每个 semanticElement 都应保留或补齐 styleRole。
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
        : z.number().int().min(deckPageCountMin).max(deckPageCountMax),
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
      lightweightOutline: lightweightOutlineSchema.refine(
        (outline) => outline.deckType === input.deckType,
        {
          message: "lightweightOutline.deckType must match deckType",
          path: ["deckType"]
        }
      )
    })
    .strip()
    .superRefine((result, ctx) => {
      if (result.lightweightOutline.pageCount !== result.recommendedPageCount) {
        ctx.addIssue({
          code: "custom",
          message: "lightweightOutline.pageCount must match recommendedPageCount",
          path: ["lightweightOutline", "pageCount"]
        });
      }

      if (result.lightweightOutline.pages.length !== result.recommendedPageCount) {
        ctx.addIssue({
          code: "custom",
          message: "lightweightOutline.pages length must match recommendedPageCount",
          path: ["lightweightOutline", "pages"]
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

function buildUnifiedVisualSpecSchema() {
  return unifiedVisualSpecSchema;
}

function buildDetailedOutlineSchema(input: AnalyzeDeckRequest) {
  return z
    .object({
      deckType: z.literal(input.deckType),
      slides: z.array(detailedSlideOutlineSchema).length(input.pageCount)
    })
    .strip();
}

function buildDisplayContentSchema(input: AnalyzeDeckRequest) {
  return z
    .object({
      deckType: z.literal(input.deckType),
      slides: z.array(slideDisplayContentSchema).length(input.pageCount)
    })
    .strip();
}

function buildSemanticSlidePlanSchema(slide: SlideContent) {
  return semanticSlidePlanSchema
    .extend({
      slideId: z.literal(slide.slideId),
      index: z.literal(slide.index),
      content: slideContentSchema.safeExtend({
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return appendAsciiEllipsis(normalized, maxLength);
}

function truncateText(text: string, maxLength: number) {
  const trimmed = text.trim();

  return appendAsciiEllipsis(trimmed, maxLength);
}

function appendAsciiEllipsis(text: string, maxLength: number) {
  const ellipsis = "...";

  if (maxLength <= 0) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= ellipsis.length) {
    return ellipsis.slice(0, maxLength);
  }

  return `${text.slice(0, maxLength - ellipsis.length)}${ellipsis}`;
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

  const dedupedValues = dedupeTextValues(values, maxItems, maxLength).filter(
    (item) => item.length >= minLength
  );

  if (dedupedValues.length >= minItems) {
    return dedupedValues;
  }

  const merged = dedupeTextValues(
    [...dedupedValues, ...fallback],
    maxItems,
    maxLength
  ).filter((item) => item.length >= minLength);

  return merged.length >= minItems ? merged : fallback.slice(0, maxItems);
}

function normalizeVisualRuleText(value: string) {
  return value.replace(/\s+/g, "").replace(/[。；;，,、/]+$/g, "").toLowerCase();
}

function dedupeTextValues(values: string[], maxItems: number, maxLength: number) {
  const seen = new Set<string>();

  return values
    .flatMap((value) => {
      const trimmed = truncateText(value.trim(), maxLength);
      const key = normalizeVisualRuleText(trimmed);

      if (!trimmed || seen.has(key)) {
        return [];
      }

      seen.add(key);
      return [trimmed];
    })
    .slice(0, maxItems);
}

function mergeBoundedTextArrays({
  fallback,
  maxItems,
  maxLength,
  minItems,
  minLength,
  values
}: {
  fallback: string[];
  maxItems: number;
  maxLength: number;
  minItems: number;
  minLength: number;
  values: Array<unknown>;
}) {
  const normalized = values.flatMap((value) =>
    boundedTextArray({
      fallback: [],
      maxItems,
      maxLength,
      minItems: 0,
      minLength,
      value
    })
  );
  const merged = dedupeTextValues(normalized, maxItems, maxLength).filter(
    (item) => item.length >= minLength
  );

  if (merged.length >= minItems) {
    return merged;
  }

  const mergedWithFallback = dedupeTextValues(
    [...merged, ...fallback],
    maxItems,
    maxLength
  ).filter((item) => item.length >= minLength);

  return mergedWithFallback.length >= minItems
    ? mergedWithFallback
    : fallback.slice(0, maxItems);
}

function buildOutlineSourceContext({
  fileSummaries,
  input
}: {
  fileSummaries: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
}) {
  const sections = [
    input.sourceText ? `【原始用户输入与文件全文】\n${input.sourceText}` : "",
    fileSummaries.length > 0
      ? `【文件摘要与片段】\n${serialize(fileSummaries)}`
      : ""
  ].filter(Boolean);

  return truncateText(sections.join("\n\n"), outlineSourceContextMaxLength);
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
  const fallback = buildFallbackUnifiedVisualSpec(input);

  if (!isRecord(value)) {
    const visualStyle =
      typeof value === "string" && value.trim().length > 0
        ? compactText(value, 240)
        : fallback.visualStyle;
    const mergedImageRules = mergeImageRulesWithIllustrationRules(
      fallback.imageRules,
      fallback.imageIllustrationRules,
      fallback.imageRules
    );
    const mergedForbiddenRules = mergeForbiddenVisualRules(
      fallback.forbiddenRules,
      fallback.forbiddenVisualRules,
      fallback.forbiddenVisualRules
    );

    return {
      ...fallback,
      themeName: cleanVisualThemeName(fallback.themeName, fallback.themeName),
      visualStyle,
      forbiddenRules: mergedForbiddenRules
        .map((item) => compactText(item, 160))
        .slice(0, 6),
      imageRules: mergedImageRules,
      forbiddenVisualRules: mergedForbiddenRules
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

  const normalizedColorPalette = normalizeColorPalette(
    pickLooseValue(value, ["colorPalette", "colors"]),
    fallback.colorPalette,
    input.locale
  );
  const lockedColorPalette = lockColorPaletteToInputPalette(
    normalizedColorPalette,
    input
  );
  const imageIllustrationRules = normalizeImageIllustrationRules(
    value.imageIllustrationRules,
    fallback.imageIllustrationRules
  );
  const imageRules = mergeImageRulesWithIllustrationRules(
    normalizeImageRules(value.imageRules, fallback.imageRules),
    imageIllustrationRules,
    fallback.imageRules
  );
  const forbiddenRules = boundedTextArray({
    fallback: fallback.forbiddenRules,
    maxItems: 6,
    maxLength: 160,
    minItems: 1,
    minLength: 4,
    value: pickLooseValue(value, ["forbiddenRules", "forbidden", "avoid"])
  });
  const forbiddenVisualRules = mergeForbiddenVisualRules(
    forbiddenRules,
    boundedTextArray({
      fallback: fallback.forbiddenVisualRules,
      maxItems: 10,
      maxLength: 180,
      minItems: 3,
      minLength: 4,
      value: pickLooseValue(value, ["forbiddenVisualRules", "visualForbiddenRules"])
    }),
    fallback.forbiddenVisualRules
  );

  return {
    themeName: cleanVisualThemeName(
      boundedText({
        fallback: fallback.themeName,
        maxLength: 80,
        minLength: 2,
        value: pickLooseValue(value, ["themeName", "theme", "name"])
      }),
      fallback.themeName
    ),
    designIntent: boundedText({
      fallback: fallback.designIntent,
      maxLength: 240,
      minLength: 6,
      value: pickLooseValue(value, ["designIntent", "intent", "designGoal"])
    }),
    usageConvenience: boundedText({
      fallback: fallback.usageConvenience,
      maxLength: 180,
      minLength: 4,
      value: pickLooseValue(value, ["usageConvenience", "convenience", "usageEase"])
    }),
    visualStyle: boundedText({
      fallback: fallback.visualStyle,
      maxLength: 240,
      minLength: 6,
      value: visualStyleSeed
    }),
    colorPalette: lockedColorPalette,
    typography: boundedText({
      fallback: fallback.typography,
      maxLength: 160,
      minLength: 6,
      value: pickLooseValue(value, ["typography", "font", "fonts"])
    }),
    imageStyle: boundedText({
      fallback: fallback.imageStyle,
      maxLength: 240,
      minLength: 6,
      value: pickLooseValue(value, ["imageStyle", "image", "decoration"])
    }),
    consistencyRules: boundedTextArray({
      fallback: fallback.consistencyRules,
      maxItems: 8,
      maxLength: 180,
      minItems: 2,
      minLength: 4,
      value: pickLooseValue(value, ["consistencyRules", "consistency"])
    }),
    forbiddenRules: forbiddenVisualRules
      .map((item) => compactText(item, 160))
      .slice(0, 6),
    pageSpec: normalizePageSpec(value.pageSpec, fallback.pageSpec),
    typographyRules: normalizeTypographyRules(
      value.typographyRules,
      fallback.typographyRules,
      value.typographyScale
    ),
    colorRoles: normalizeColorRoles(
      value.colorRoles,
      fallback.colorRoles,
      value.colorRoleDefinitions,
      lockedColorPalette
    ),
    transparencyRules: normalizeTransparencyRules(
      value.transparencyRules,
      fallback.transparencyRules,
      lockedColorPalette
    ),
    imageRules,
    pptTypeVisualTone: normalizePptTypeVisualTone(
      value.pptTypeVisualTone,
      fallback.pptTypeVisualTone
    ),
    informationDensityRules: normalizeInformationDensityRules(
      value.informationDensityRules,
      fallback.informationDensityRules
    ),
    layoutRules: normalizeLayoutRules(
      value,
      fallback.layoutRules
    ),
    chartVisualRules: normalizeChartVisualRules(
      value.chartVisualRules,
      fallback.chartVisualRules
    ),
    imageIllustrationRules,
    iconStyleRules: normalizeIconStyleRules(
      value.iconStyleRules,
      fallback.iconStyleRules
    ),
    emphasisRules: normalizeEmphasisRules(
      value.emphasisRules,
      fallback.emphasisRules
    ),
    componentRules: normalizeComponentRules(
      value.componentRules,
      fallback.componentRules
    ),
    forbiddenVisualRules
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
    ? dedupeTextValues(
        record.fontFallback
          .map((item) => formatLooseValue(item, 80))
          .filter((item) => item.length > 0),
        6,
        80
      )
    : fallback.fontFallback;

  return {
    defaultFontSize: clampNumber(defaultFontSize, 8, 40),
    fontFallback:
      fontFallback.length >= 2 ? fontFallback : fallback.fontFallback,
    lineHeight: clampNumber(lineHeight, 1, 1.8),
    maxLines: Math.round(clampNumber(maxLines, 1, 9)),
    minFontSize: clampNumber(minFontSize, 8, 18),
    scale: normalizeTypographyScale(record.scale ?? legacyScale, fallback.scale),
    textLimits: normalizeTypographyTextLimits(
      record.textLimits,
      fallback.textLimits
    )
  };
}

function normalizeColorPalette(
  value: unknown,
  fallback: UnifiedVisualSpec["colorPalette"],
  locale: AnalyzeDeckRequest["locale"]
): UnifiedVisualSpec["colorPalette"] {
  if (isRecord(value)) {
    const normalized = {
      accent: normalizePaletteColorGroup(value.accent, fallback.accent, 1, 2),
      chart: normalizePaletteColorGroup(value.chart, fallback.chart, 4, 8),
      neutral: normalizePaletteColorGroup(value.neutral, fallback.neutral, 2, 4),
      primary: normalizePaletteColorGroup(value.primary, fallback.primary, 1, 1),
      secondary: normalizePaletteColorGroup(value.secondary, fallback.secondary, 2, 3)
    };

    if (isColorPaletteComplete(normalized)) {
      return normalized;
    }
  }

  const looseHexes = extractLoosePaletteHexes(value);

  if (looseHexes.length >= 3) {
    return buildColorPaletteFromHexes(looseHexes, locale);
  }

  return fallback;
}

function lockColorPaletteToInputPalette(
  modelPalette: UnifiedVisualSpec["colorPalette"],
  input: AnalyzeDeckRequest
): UnifiedVisualSpec["colorPalette"] {
  const lockedPalette = buildFallbackColorPalette(input.palette, input.locale);
  const copyText = (
    group: keyof UnifiedVisualSpec["colorPalette"],
    index: number
  ) => {
    const modelColor = modelPalette[group][index];
    const lockedColor = lockedPalette[group][index];

    return {
      ...lockedColor,
      name:
        modelColor?.name && modelColor.name.trim()
          ? compactText(modelColor.name, 40)
          : lockedColor.name,
      usage:
        modelColor?.usage && modelColor.usage.trim().length >= 4
          ? compactText(stripHexColorsFromText(modelColor.usage), 160) || lockedColor.usage
          : lockedColor.usage
    };
  };

  return {
    accent: lockedPalette.accent.map((_, index) => copyText("accent", index)),
    chart: lockedPalette.chart.map((_, index) => copyText("chart", index)),
    neutral: lockedPalette.neutral.map((_, index) => copyText("neutral", index)),
    primary: lockedPalette.primary.map((_, index) => copyText("primary", index)),
    secondary: lockedPalette.secondary.map((_, index) => copyText("secondary", index))
  };
}

function normalizePaletteColorGroup(
  value: unknown,
  fallback: UnifiedVisualSpec["colorPalette"]["primary"],
  minItems: number,
  maxItems: number
): UnifiedVisualSpec["colorPalette"]["primary"] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const normalized = values.flatMap((item, index) => {
    const fallbackItem = fallback[index] ?? fallback[0];
    const color = normalizePaletteColorItem(item, fallbackItem);

    return color ? [color] : [];
  });
  const merged = [...normalized, ...fallback].filter(
    (item, index, array) =>
      array.findIndex((candidate) => candidate.hex === item.hex) === index
  );

  return merged.slice(0, maxItems).length >= minItems
    ? merged.slice(0, maxItems)
    : fallback.slice(0, maxItems);
}

function normalizePaletteColorItem(
  value: unknown,
  fallback: UnifiedVisualSpec["colorPalette"]["primary"][number]
) {
  if (isRecord(value)) {
    const hex =
      typeof value.hex === "string" ? normalizeHexValue(value.hex) : undefined;

    if (!hex) {
      return undefined;
    }

    return {
      hex,
      name: boundedText({
        fallback: fallback.name,
        maxLength: 40,
        minLength: 1,
        value: value.name
      }),
      usage: boundedText({
        fallback: fallback.usage,
        maxLength: 160,
        minLength: 4,
        value: value.usage
      })
    };
  }

  if (typeof value === "string") {
    const hex = extractHexColor(value);

    if (!hex) {
      return undefined;
    }

    return {
      ...fallback,
      hex,
      usage: stripLooseHexForUsage(value, fallback.usage)
    };
  }

  return undefined;
}

function isColorPaletteComplete(value: UnifiedVisualSpec["colorPalette"]) {
  return (
    value.primary.length === 1 &&
    value.secondary.length >= 2 &&
    value.chart.length >= 4 &&
    value.neutral.length >= 2 &&
    value.accent.length >= 1
  );
}

function extractLoosePaletteHexes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value.flatMap((item) => {
          const color = extractHexColor(formatLooseValue(item, 80));

          return color ? [color] : [];
        })
      )
    );
  }

  if (isRecord(value)) {
    return Array.from(
      new Set(
        Object.values(value).flatMap((item) => extractLoosePaletteHexes(item))
      )
    );
  }

  const color = extractHexColor(formatLooseValue(value, 80));

  return color ? [color] : [];
}

function normalizeHexValue(value: string) {
  const color = extractHexColor(value);

  return color ? normalizeHexColor(color) : undefined;
}

function stripLooseHexForUsage(value: string, fallback: string) {
  const text = value.replace(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, "").trim();

  return text.length >= 4 ? compactText(text, 160) : fallback;
}

function normalizeColorRoles(
  value: unknown,
  fallback: UnifiedVisualSpec["colorRoles"],
  legacyDefinitions: unknown,
  colorPalette: UnifiedVisualSpec["colorPalette"]
): UnifiedVisualSpec["colorRoles"] {
  const record = isRecord(value) ? value : {};
  const legacy = isRecord(legacyDefinitions) ? legacyDefinitions : {};
  const base = {
    accent: normalizeColorRoleText(
      record.accent ?? legacy.accent,
      fallback.accent,
      "accent",
      colorPalette
    ),
    background: normalizeColorRoleText(
      record.background ?? legacy.background,
      fallback.background,
      "background",
      colorPalette
    ),
    bodyText: normalizeColorRoleText(
      record.bodyText ?? legacy.bodyText,
      fallback.bodyText,
      "bodyText",
      colorPalette
    ),
    borderDivider: normalizeColorRoleText(
      record.borderDivider ?? legacy.borderDivider,
      fallback.borderDivider,
      "borderDivider",
      colorPalette
    ),
    chart: normalizeColorRoleText(
      record.chart ?? legacy.chart,
      fallback.chart,
      "chart",
      colorPalette
    ),
    contrastRequirement: boundedText({
      fallback: fallback.contrastRequirement,
      maxLength: 180,
      minLength: 6,
      value: record.contrastRequirement
    }),
    decorative: normalizeColorRoleText(
      record.decorative ?? legacy.decorative,
      fallback.decorative,
      "decorative",
      colorPalette
    ),
    highlight: normalizeColorRoleText(
      record.highlight ?? legacy.highlight,
      fallback.highlight,
      "highlight",
      colorPalette
    ),
    surface: normalizeColorRoleText(
      record.surface ?? legacy.surface,
      fallback.surface,
      "surface",
      colorPalette
    ),
    titleText: normalizeColorRoleText(
      record.titleText ?? legacy.titleText,
      fallback.titleText,
      "titleText",
      colorPalette
    )
  };

  return enforceReadableColorRoles(base, fallback, colorPalette);
}

function normalizeColorRoleText(
  value: unknown,
  fallback: string,
  role: keyof UnifiedVisualSpec["colorRoles"],
  colorPalette: UnifiedVisualSpec["colorPalette"]
) {
  return sanitizeColorRoleText({
    fallback,
    palette: colorPalette,
    role,
    value: boundedText({
      fallback,
      maxLength: 180,
      minLength: 3,
      value
    })
  });
}

function enforceReadableColorRoles(
  roles: UnifiedVisualSpec["colorRoles"],
  fallback: UnifiedVisualSpec["colorRoles"],
  colorPalette: UnifiedVisualSpec["colorPalette"]
): UnifiedVisualSpec["colorRoles"] {
  const palette = extractPaletteHexColors(colorPalette);
  const background = pickRoleColor({
    allowedColors: colorPalette.neutral.map((color) => color.hex),
    colorPalette,
    fallback: fallback.background,
    preferred: colorPalette.neutral[0]?.hex,
    role: "background",
    value: roles.background
  });
  const surface = pickRoleColor({
    allowedColors: colorPalette.neutral.map((color) => color.hex),
    colorPalette,
    fallback: fallback.surface,
    preferred: colorPalette.neutral[1]?.hex ?? colorPalette.neutral[0]?.hex,
    role: "surface",
    value: roles.surface
  });
  const bestReadable = (value: string, fallbackValue: string) => {
    const candidates = [
      ...colorPalette.neutral.map((color) => color.hex),
      colorPalette.primary[0]?.hex,
      ...colorPalette.secondary.map((color) => color.hex)
    ].filter((color): color is string => Boolean(color));
    const current = pickRoleColor({
      allowedColors: candidates,
      colorPalette,
      fallback: fallbackValue,
      preferred: candidates[0],
      role: "bodyText",
      value
    });

    if (contrastRatio(current, background) >= 4.5) {
      return current;
    }

    return candidates
      .map((color) => ({
        color,
        contrast: contrastRatio(color, background)
      }))
      .sort((first, second) => second.contrast - first.contrast)[0]?.color ?? current;
  };
  const bodyText = bestReadable(roles.bodyText, fallback.bodyText);
  const titleText = bestReadable(roles.titleText, fallback.titleText);
  const accent = pickRoleColor({
    allowedColors: colorPalette.accent.map((color) => color.hex),
    colorPalette,
    fallback: fallback.accent,
    preferred: colorPalette.accent[0]?.hex ?? colorPalette.primary[0]?.hex,
    role: "accent",
    value: roles.accent
  });
  const highlight = pickRoleColor({
    allowedColors: colorPalette.accent.map((color) => color.hex),
    colorPalette,
    fallback: fallback.highlight,
    preferred: colorPalette.accent[1]?.hex ?? colorPalette.accent[0]?.hex,
    role: "highlight",
    value: roles.highlight
  });
  const decorative = pickRoleColor({
    allowedColors: colorPalette.secondary.map((color) => color.hex),
    colorPalette,
    fallback: fallback.decorative,
    preferred: colorPalette.secondary[0]?.hex,
    role: "decorative",
    value: roles.decorative
  });
  const borderDivider = pickRoleColor({
    allowedColors: [
      ...colorPalette.neutral.map((color) => color.hex),
      ...colorPalette.secondary.map((color) => color.hex)
    ],
    colorPalette,
    fallback: fallback.borderDivider,
    preferred: colorPalette.neutral[1]?.hex ?? colorPalette.neutral[0]?.hex,
    role: "borderDivider",
    value: roles.borderDivider
  });
  const chartColors = Array.from(
    new Set([
      ...colorPalette.chart.map((color) => color.hex),
      colorPalette.primary[0]?.hex,
      ...colorPalette.secondary.map((color) => color.hex)
    ].filter((color): color is string => Boolean(color)))
  ).slice(0, 6);
  const description = (
    value: string,
    fallbackValue: string,
    defaultText: string
  ) =>
    stripHexColorsFromText(value) ||
    stripHexColorsFromText(fallbackValue) ||
    defaultText;
  const roleText = (
    colors: string[],
    value: string,
    fallbackValue: string,
    defaultText: string
  ) => compactText(
    [colors.filter((color) => palette.includes(color)).join(" / "), description(value, fallbackValue, defaultText)]
      .filter(Boolean)
      .join(" "),
    180
  );

  return {
    accent: roleText([accent], roles.accent, fallback.accent, "用于关键强调。"),
    background: roleText([background], roles.background, fallback.background, "用于页面背景。"),
    bodyText: roleText([bodyText], roles.bodyText, fallback.bodyText, "用于正文和主要信息，正文色和背景色对比度不得低于 4.5:1。"),
    borderDivider: roleText([borderDivider], roles.borderDivider, fallback.borderDivider, "用于边框和分隔线。"),
    chart: roleText(chartColors, roles.chart, fallback.chart, "用于图表序列，同一页图表颜色不可超过 6 个。"),
    contrastRequirement:
      roles.contrastRequirement.includes("4.5")
        ? roles.contrastRequirement
        : fallback.contrastRequirement,
    decorative: roleText([decorative], roles.decorative, fallback.decorative, "仅用于线条、角标和轻量背景块。"),
    highlight: roleText([highlight], roles.highlight, fallback.highlight, "每页最多使用 1-2 处，用于局部重点。"),
    surface: roleText([surface], roles.surface, fallback.surface, "用于卡片、内容容器和信息分区。"),
    titleText: roleText([titleText], roles.titleText, fallback.titleText, "用于标题、结论句和层级区分。")
  };
}

function pickRoleColor({
  allowedColors,
  colorPalette,
  fallback,
  preferred,
  role,
  value
}: {
  allowedColors?: string[];
  colorPalette: UnifiedVisualSpec["colorPalette"];
  fallback: string;
  preferred: string | undefined;
  role: keyof UnifiedVisualSpec["colorRoles"];
  value: string;
}) {
  const fromValue = sanitizeColorRoleText({
    fallback,
    palette: colorPalette,
    role,
    value
  }).match(/#[0-9A-F]{6}\b/)?.[0];
  const allowed = allowedColors ? new Set(allowedColors) : null;

  if (fromValue && (!allowed || allowed.has(fromValue))) {
    return fromValue;
  }

  return preferred ?? extractHexColor(fallback) ?? colorPalette.primary[0].hex;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string) {
  const match = color.match(/^#([0-9A-F]{6})$/i);

  if (!match) {
    return 0;
  }

  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255;

    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function normalizeImageRules(
  value: unknown,
  fallback: UnifiedVisualSpec["imageRules"]
): UnifiedVisualSpec["imageRules"] {
  const record = isRecord(value) ? value : {};

  return {
    aspectRatio: normalizeImageRuleAspectRatio(record.aspectRatio, fallback.aspectRatio),
    backgroundAvoidsHighContrastTextArea:
      typeof record.backgroundAvoidsHighContrastTextArea === "boolean"
        ? record.backgroundAvoidsHighContrastTextArea
        : fallback.backgroundAvoidsHighContrastTextArea,
    forbiddenItems: boundedTextArray({
      fallback: fallback.forbiddenItems,
      maxItems: 8,
      maxLength: 120,
      minItems: 2,
      minLength: 2,
      value: record.forbiddenItems
    }),
    imagePromptStyle: boundedText({
      fallback: fallback.imagePromptStyle,
      maxLength: 500,
      minLength: 12,
      value: record.imagePromptStyle
    }),
    imageType: normalizeImageRuleType(record.imageType, fallback.imageType),
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

function mergeImageRulesWithIllustrationRules(
  imageRules: UnifiedVisualSpec["imageRules"],
  imageIllustrationRules: UnifiedVisualSpec["imageIllustrationRules"],
  fallback: UnifiedVisualSpec["imageRules"]
): UnifiedVisualSpec["imageRules"] {
  return {
    ...imageRules,
    usageNotes: mergeBoundedTextArrays({
      fallback: fallback.usageNotes,
      maxItems: 6,
      maxLength: 180,
      minItems: 2,
      minLength: 4,
      values: [
        imageRules.usageNotes,
        imageIllustrationRules.style,
        imageIllustrationRules.composition,
        imageIllustrationRules.background,
        imageIllustrationRules.consistency
      ]
    })
  };
}

function normalizeTransparencyRules(
  value: unknown,
  fallback: UnifiedVisualSpec["transparencyRules"],
  colorPalette: UnifiedVisualSpec["colorPalette"]
): UnifiedVisualSpec["transparencyRules"] {
  const paletteColors = new Set(extractPaletteHexColors(colorPalette));
  const safeFallback = buildTransparencyRulesFallbackFromPalette(
    fallback,
    colorPalette
  );
  const values = Array.isArray(value) ? value : [];
  const normalized = values.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const baseHex =
      typeof item.baseHex === "string"
        ? normalizeHexValue(item.baseHex)
        : undefined;

    if (!baseHex || !paletteColors.has(baseHex)) {
      return [];
    }

    return [
      {
        baseHex,
        opacity:
          typeof item.opacity === "number"
            ? clampNumber(item.opacity, 0.04, 0.95)
            : fallback[0].opacity,
        usage: boundedText({
          fallback: fallback[0].usage,
          maxLength: 160,
          minLength: 4,
          value: item.usage
        })
      }
    ];
  });
  const merged = [...normalized, ...safeFallback].filter(
    (item, index, array) =>
      array.findIndex(
        (candidate) =>
          candidate.baseHex === item.baseHex &&
          candidate.opacity === item.opacity &&
          candidate.usage === item.usage
      ) === index
  );

  return merged.slice(0, 8).length >= 2 ? merged.slice(0, 8) : safeFallback;
}

function buildTransparencyRulesFallbackFromPalette(
  fallback: UnifiedVisualSpec["transparencyRules"],
  colorPalette: UnifiedVisualSpec["colorPalette"]
): UnifiedVisualSpec["transparencyRules"] {
  const neutralWeak = colorPalette.neutral[0]?.hex ?? colorPalette.primary[0].hex;
  const neutralLine =
    colorPalette.neutral[1]?.hex ??
    colorPalette.neutral[0]?.hex ??
    colorPalette.primary[0].hex;
  const primary = colorPalette.primary[0].hex;
  const fallbackOpacity = (index: number, defaultOpacity: number) =>
    fallback[index]?.opacity ?? defaultOpacity;
  const isChinese = /[\u4e00-\u9fff]/.test(fallback[0]?.usage ?? "");

  return [
    {
      baseHex: neutralWeak,
      opacity: fallbackOpacity(0, 0.35),
      usage: isChinese
        ? "用于弱背景、表格斑马纹和轻量分区。"
        : "For weak backgrounds, zebra rows, and subtle sections."
    },
    {
      baseHex: neutralLine,
      opacity: fallbackOpacity(1, 0.12),
      usage: isChinese
        ? "用于分隔线、悬浮层边框和轻量遮罩。"
        : "For dividers, floating borders, and light overlays."
    },
    {
      baseHex: primary,
      opacity: fallbackOpacity(2, 0.16),
      usage: isChinese
        ? "用于选中态或强调标签弱底色。"
        : "For selected states or soft emphasis tag fills."
    }
  ];
}

function mergeForbiddenVisualRules(
  forbiddenRules: string[],
  forbiddenVisualRules: string[],
  fallback: string[]
) {
  return mergeBoundedTextArrays({
    fallback,
    maxItems: 10,
    maxLength: 180,
    minItems: 3,
    minLength: 4,
    values: [forbiddenRules, forbiddenVisualRules]
  });
}

function normalizeTypographyTextLimits(
  value: unknown,
  fallback: UnifiedVisualSpec["typographyRules"]["textLimits"]
): UnifiedVisualSpec["typographyRules"]["textLimits"] {
  const record = isRecord(value) ? value : {};

  return {
    bodyBulletMaxChineseChars: 24,
    bodyModuleBulletCount: boundedText({
      fallback: fallback.bodyModuleBulletCount,
      maxLength: 120,
      minLength: 4,
      value: record.bodyModuleBulletCount
    }),
    coverTitleMaxLines: 2,
    iconLabelMaxChineseChars: 10,
    noteMaxChineseChars: 32,
    pageTitleMaxLines: 2,
    sectionTitleMaxLines: boundedText({
      fallback: fallback.sectionTitleMaxLines,
      maxLength: 80,
      minLength: 4,
      value: record.sectionTitleMaxLines
    }),
    textBoxRule: boundedText({
      fallback: fallback.textBoxRule,
      maxLength: 180,
      minLength: 4,
      value: record.textBoxRule
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
    coverSubtitle: normalizeTypographyScaleItem(record.coverSubtitle, fallback.coverSubtitle),
    pageTitle: normalizeTypographyScaleItem(record.pageTitle, fallback.pageTitle),
    sectionTitle: normalizeTypographyScaleItem(record.sectionTitle, fallback.sectionTitle),
    body: normalizeTypographyScaleItem(record.body, fallback.body),
    annotation: normalizeTypographyScaleItem(record.annotation, fallback.annotation),
    chartLabel: normalizeTypographyScaleItem(record.chartLabel, fallback.chartLabel),
    iconLabel: normalizeTypographyScaleItem(record.iconLabel, fallback.iconLabel)
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

function normalizeLayoutRules(
  value: unknown,
  fallback: UnifiedVisualSpec["layoutRules"]
): UnifiedVisualSpec["layoutRules"] {
  const record = isRecord(value) ? value : {};
  const structuredValue = isRecord(record.layoutRules)
    ? record.layoutRules
    : isRecord(record.spacingRules)
      ? record.spacingRules
      : record;
  const legacyArray = Array.isArray(record.layoutRules)
    ? record.layoutRules
    : Array.isArray(record.layout)
      ? record.layout
      : [];
  const legacyMapped = mapLegacyLayoutRuleArrayToStructured(
    legacyArray,
    fallback
  );

  return {
    pageMargin: mergeStructuredLayoutRuleValue({
      fallback: fallback.pageMargin,
      legacyValue: legacyMapped.pageMargin,
      value: structuredValue.pageMargin
    }),
    sectionGap: mergeStructuredLayoutRuleValue({
      fallback: fallback.sectionGap,
      legacyValue: legacyMapped.sectionGap,
      value: structuredValue.sectionGap
    }),
    elementGap: mergeStructuredLayoutRuleValue({
      fallback: fallback.elementGap,
      legacyValue: legacyMapped.elementGap,
      value: structuredValue.elementGap
    }),
    whitespace: mergeStructuredLayoutRuleValue({
      fallback: fallback.whitespace,
      legacyValue: legacyMapped.whitespace,
      maxLength: 220,
      value: structuredValue.whitespace
    })
  };
}

function mergeStructuredLayoutRuleValue({
  fallback,
  legacyValue,
  maxLength = 180,
  value
}: {
  fallback: string;
  legacyValue: string;
  maxLength?: number;
  value: unknown;
}) {
  const primary = boundedText({
    fallback: "",
    maxLength,
    minLength: 4,
    value
  });
  const merged = dedupeTextValues(
    [primary, legacyValue, fallback].filter((item) => item.trim().length > 0),
    3,
    maxLength
  );

  return merged[0]
    ? compactText(merged.join(" / "), maxLength)
    : compactText(fallback, maxLength);
}

function mapLegacyLayoutRuleArrayToStructured(
  value: unknown[],
  fallback: UnifiedVisualSpec["layoutRules"]
): UnifiedVisualSpec["layoutRules"] {
  const grouped = {
    elementGap: [] as string[],
    pageMargin: [] as string[],
    sectionGap: [] as string[],
    whitespace: [] as string[]
  };
  const normalized = boundedTextArray({
    fallback: [],
    maxItems: 6,
    maxLength: 160,
    minItems: 0,
    minLength: 4,
    value
  });

  for (const item of normalized) {
    const target = classifyLegacyLayoutRule(item);
    grouped[target].push(item);
  }

  return {
    pageMargin: buildLegacyLayoutRuleGroupValue(grouped.pageMargin, fallback.pageMargin),
    sectionGap: buildLegacyLayoutRuleGroupValue(grouped.sectionGap, fallback.sectionGap),
    elementGap: buildLegacyLayoutRuleGroupValue(grouped.elementGap, fallback.elementGap),
    whitespace: buildLegacyLayoutRuleGroupValue(grouped.whitespace, fallback.whitespace, 220)
  };
}

function buildLegacyLayoutRuleGroupValue(
  values: string[],
  fallback: string,
  maxLength = 180
) {
  const merged = dedupeTextValues(values, 3, maxLength);

  return merged.length > 0
    ? compactText(merged.join(" / "), maxLength)
    : fallback;
}

function classifyLegacyLayoutRule(
  value: string
): keyof UnifiedVisualSpec["layoutRules"] {
  const normalized = normalizeVisualRuleText(value);

  if (
    normalized.includes("边距") ||
    normalized.includes("安全边距") ||
    normalized.includes("安全边") ||
    normalized.includes("safe") ||
    normalized.includes("margin")
  ) {
    return "pageMargin";
  }

  if (
    normalized.includes("留白") ||
    normalized.includes("呼吸") ||
    normalized.includes("拥挤") ||
    normalized.includes("whitespace")
  ) {
    return "whitespace";
  }

  if (
    normalized.includes("间距") ||
    normalized.includes("gap") ||
    normalized.includes("对齐") ||
    normalized.includes("栅格") ||
    normalized.includes("grid") ||
    normalized.includes("卡片") ||
    normalized.includes("指标组")
  ) {
    return "elementGap";
  }

  return "sectionGap";
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

function normalizeComponentRules(
  value: unknown,
  fallback: UnifiedVisualSpec["componentRules"]
): UnifiedVisualSpec["componentRules"] {
  const record = isRecord(value) ? value : {};

  return {
    card: boundedText({ fallback: fallback.card, maxLength: 320, minLength: 6, value: record.card }),
    chart: boundedText({ fallback: fallback.chart, maxLength: 360, minLength: 6, value: record.chart }),
    icon: boundedText({ fallback: fallback.icon, maxLength: 260, minLength: 6, value: record.icon }),
    metric: boundedText({ fallback: fallback.metric, maxLength: 260, minLength: 6, value: record.metric }),
    table: boundedText({ fallback: fallback.table, maxLength: 320, minLength: 6, value: record.table }),
    tag: boundedText({ fallback: fallback.tag, maxLength: 260, minLength: 6, value: record.tag })
  };
}

function normalizeImageRuleType(
  value: unknown,
  fallback: UnifiedVisualSpec["imageRules"]["imageType"]
): UnifiedVisualSpec["imageRules"]["imageType"] {
  const values = [
    "photo",
    "illustration",
    "icon",
    "diagram",
    "texture",
    "background",
    "cutout"
  ] as const;

  return values.includes(value as never)
    ? (value as UnifiedVisualSpec["imageRules"]["imageType"])
    : fallback;
}

function normalizeImageRuleAspectRatio(
  value: unknown,
  fallback: UnifiedVisualSpec["imageRules"]["aspectRatio"]
): UnifiedVisualSpec["imageRules"]["aspectRatio"] {
  const values = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;

  return values.includes(value as never)
    ? (value as UnifiedVisualSpec["imageRules"]["aspectRatio"])
    : fallback;
}

function cleanVisualThemeName(value: string, fallback: string) {
  const paletteNamePattern =
    /(?:星图|矩阵|深空|晨雾|月白|竹青|黛蓝|胭脂|鎏金|玄墨|Star Map|Matrix|Deep Space|Morning Mist|Moon White|Bamboo Green|Dai Blue|Rouge|Gilded Gold|Ink Black)/gi;
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
    (!isRecord(value.lightweightOutline) && !isRecord(value.structureOutline))
  ) {
    return {
      ...value,
      ...(input.pageCount ? { recommendedPageCount: input.pageCount } : {})
    };
  }

  const outlineContext = {
    coreMessage: formatLooseValue(value.coreMessage, 300) || input.idea,
    audience: formatLooseValue(value.audience, 120) || "",
    deckType: input.deckType,
    goal: formatLooseValue(value.goal, 160) || input.idea,
    locale: input.locale,
    pageCount: recommendedPageCount,
    sources: input.sources ?? []
  };
  const lightweightOutline = normalizeLightweightOutlineValue(
    value.lightweightOutline ?? value.structureOutline,
    outlineContext
  );
  const parsedLightweightOutline = lightweightOutlineSchema.safeParse(lightweightOutline);
  const structureOutline = parsedLightweightOutline.success
    ? buildStructureOutlineFromLightweightOutlineValue(parsedLightweightOutline.data)
    : value.structureOutline;

  return {
    ...value,
    ...(input.pageCount ? { recommendedPageCount: input.pageCount } : {}),
    fileSummaries: buildFileSummaries(input),
    lightweightOutline,
    structureOutline: normalizeStructureOutlineValue(structureOutline, outlineContext)
  };
}

function normalizeLightweightOutlineValue(
  value: unknown,
  input: Pick<
    AnalyzeDeckRequest,
    "audience" | "coreMessage" | "deckType" | "goal" | "locale" | "pageCount" | "sources"
  >
) {
  if (!isRecord(value)) {
    return value;
  }

  const rawPages = Array.isArray(value.pages)
    ? value.pages
    : Array.isArray(value.slides)
      ? value.slides
      : [];

  if (rawPages.length !== input.pageCount) {
    return {
      ...value,
      deckType: input.deckType,
      pageCount: input.pageCount
    };
  }

  const firstPage = rawPages.find(isRecord);
  const firstTitle = firstPage
    ? boundedText({
        fallback: input.goal,
        maxLength: 80,
        minLength: 2,
        value: firstPage.title
      })
    : input.goal;
  const deckTitleFallback = compactText(firstTitle || input.goal, 100);
  const themeObjectiveFallback =
    input.locale === "zh-CN"
      ? `面向${compactText(input.audience, 40)}，围绕“${compactText(
          input.goal,
          72
        )}”与“${compactText(input.coreMessage, 88)}”组织 ${input.pageCount} 页轻量大纲。`
      : `A ${input.pageCount}-slide lightweight outline for ${compactText(
          input.audience,
          40
        )}, organized around "${compactText(input.goal, 72)}" and "${compactText(
          input.coreMessage,
          88
        )}".`;
  const allowedSourceIds = new Set(
    (input.sources ?? []).map((source) => source.sourceId)
  );
  const deckTitle = boundedText({
    fallback: deckTitleFallback,
    maxLength: 100,
    minLength: 2,
    value: value.deckTitle
  });
  const pages = rawPages.map((page, pageIndex) => {
    const record = isRecord(page) ? page : {};
    const pageNumber =
      typeof record.pageNumber === "number"
        ? record.pageNumber
        : typeof record.index === "number"
          ? record.index
          : pageIndex + 1;
    const pageType = slidePageTypeValues.includes(record.pageType as never)
      ? record.pageType
      : pageNumber === 1
        ? "cover"
        : pageNumber === input.pageCount
          ? "summary"
          : "content";

    return {
      chapterId: boundedText({
        fallback: inferChapterId(pageNumber, input.pageCount),
        maxLength: 60,
        minLength: 3,
        value: record.chapterId
      }),
      keyMessage: boundedText({
        fallback: input.coreMessage,
        maxLength: 180,
        minLength: 4,
        value: pickLooseValue(record, ["keyMessage", "message", "summary"])
      }),
      layoutType: slideLayoutTypeIds.includes(record.layoutType as never)
        ? record.layoutType
        : inferLayoutType(pageType, pageNumber, input.pageCount),
      narrativeRole:
        pageNumber === 1
          ? "setup"
          : pageNumber === input.pageCount
            ? "call-to-action"
            : "argument",
      pageNumber,
      pageType,
      purpose: boundedText({
        fallback:
          input.locale === "zh-CN"
            ? `说明第 ${pageNumber} 页与整体目标的关系。`
            : `Explain how slide ${pageNumber} supports the overall goal.`,
        maxLength: 180,
        minLength: 6,
        value: pickLooseValue(record, ["purpose", "speakerGoal"])
      }),
      sourceIds: normalizeSourceIds(record.sourceIds, allowedSourceIds),
      title: boundedText({
        fallback:
          input.locale === "zh-CN" ? `第 ${pageNumber} 页` : `Slide ${pageNumber}`,
        maxLength: 80,
        minLength: 2,
        value: record.title
      })
    };
  });
  const chapters = normalizeLightweightOutlineChapters(value.chapters, {
    deckTitle,
    input,
    themeObjectiveFallback
  });

  return {
    deckTitle,
    deckType: input.deckType,
    narrativeStyle: lightweightNarrativeStyleIds.includes(value.narrativeStyle as never)
      ? value.narrativeStyle
      : inferNarrativeStyle(input.deckType),
    pageCount: input.pageCount,
    globalTheme: {
      objective: boundedText({
        fallback: themeObjectiveFallback,
        maxLength: 220,
        minLength: 6,
        value: isRecord(value.globalTheme)
          ? value.globalTheme.objective
          : value.deckSummary
      }),
      theme: boundedText({
        fallback: deckTitle,
        maxLength: 100,
        minLength: 2,
        value: isRecord(value.globalTheme) ? value.globalTheme.theme : value.deckTitle
      })
    },
    chapters,
    pages: pages.map((page) => ({
      ...page,
      chapterId: chapters.some((chapter) => chapter.chapterId === page.chapterId)
        ? page.chapterId
        : findChapterIdForPage(chapters, page.pageNumber)
    }))
  };
}

function normalizeLightweightOutlineChapters(
  value: unknown,
  {
    deckTitle,
    input,
    themeObjectiveFallback
  }: {
    deckTitle: string;
    input: Pick<AnalyzeDeckRequest, "locale" | "pageCount">;
    themeObjectiveFallback: string;
  }
) {
  const rawChapters = Array.isArray(value) ? value.filter(isRecord) : [];
  const normalizedChapters = rawChapters
    .map((chapter, index) => {
      const pageRange = isRecord(chapter.pageRange) ? chapter.pageRange : {};
      const start =
        typeof pageRange.start === "number" ? pageRange.start : index === 0 ? 1 : 0;
      const end =
        typeof pageRange.end === "number" ? pageRange.end : index === 0 ? input.pageCount : 0;

      return {
        chapterId: boundedText({
          fallback: `chapter-${index + 1}`,
          maxLength: 60,
          minLength: 3,
          value: chapter.chapterId
        }),
        pageRange: {
          end,
          start
        },
        purpose: boundedText({
          fallback: themeObjectiveFallback,
          maxLength: 180,
          minLength: 6,
          value: chapter.purpose
        }),
        title: boundedText({
          fallback:
            index === 0
              ? deckTitle
              : input.locale === "zh-CN"
                ? `章节 ${index + 1}`
                : `Chapter ${index + 1}`,
          maxLength: 80,
          minLength: 2,
          value: chapter.title
        })
      };
    })
    .filter(
      (chapter) =>
        chapter.pageRange.start >= 1 &&
        chapter.pageRange.end >= chapter.pageRange.start &&
        chapter.pageRange.end <= input.pageCount
    );

  if (normalizedChapters.length > 0) {
    return normalizedChapters;
  }

  if (input.pageCount <= 6) {
    return [
      {
        chapterId: "chapter-1",
        pageRange: {
          end: input.pageCount,
          start: 1
        },
        purpose: themeObjectiveFallback,
        title: deckTitle
      }
    ];
  }

  const middleEnd = Math.max(2, input.pageCount - 1);

  return [
    {
      chapterId: "chapter-1",
      pageRange: {
        end: 1,
        start: 1
      },
      purpose:
        input.locale === "zh-CN"
          ? "建立演示主题和阅读预期。"
          : "Establish the topic and reading expectation.",
      title: input.locale === "zh-CN" ? "开场定位" : "Opening Frame"
    },
    {
      chapterId: "chapter-2",
      pageRange: {
        end: middleEnd,
        start: 2
      },
      purpose: themeObjectiveFallback,
      title: input.locale === "zh-CN" ? "主体论证" : "Main Argument"
    },
    {
      chapterId: "chapter-3",
      pageRange: {
        end: input.pageCount,
        start: input.pageCount
      },
      purpose:
        input.locale === "zh-CN"
          ? "收束核心信息并引导下一步。"
          : "Close the core message and guide next steps.",
      title: input.locale === "zh-CN" ? "总结行动" : "Closing Action"
    }
  ];
}

function inferNarrativeStyle(deckType: AnalyzeDeckRequest["deckType"]) {
  if (
    deckType === "training-course" ||
    deckType === "teaching-deck" ||
    deckType === "knowledge-sharing"
  ) {
    return "teaching-progressive";
  }

  if (
    deckType === "research-report" ||
    deckType === "data-analysis" ||
    deckType === "industry-insight"
  ) {
    return "insight-evidence";
  }

  if (
    deckType === "sales-proposal" ||
    deckType === "proposal" ||
    deckType === "fundraising-pitch"
  ) {
    return "proposal-persuasive";
  }

  if (deckType === "portfolio") {
    return "portfolio-showcase";
  }

  if (deckType === "personal-review" || deckType === "retrospective-summary") {
    return "review-summary";
  }

  return "problem-solution";
}

function inferChapterId(pageNumber: number, pageCount: number) {
  if (pageCount <= 6) {
    return "chapter-1";
  }

  if (pageNumber === 1) {
    return "chapter-1";
  }

  if (pageNumber === pageCount) {
    return "chapter-3";
  }

  return "chapter-2";
}

function findChapterIdForPage(
  chapters: Array<{ chapterId: string; pageRange: { end: number; start: number } }>,
  pageNumber: number
) {
  return (
    chapters.find(
      (chapter) =>
        pageNumber >= chapter.pageRange.start && pageNumber <= chapter.pageRange.end
    )?.chapterId ?? chapters[0]?.chapterId ?? "chapter-1"
  );
}

function inferLayoutType(
  pageType: unknown,
  pageNumber: number,
  pageCount: number
) {
  if (pageNumber === 1 || pageType === "cover") {
    return "cover-title";
  }

  if (pageNumber === pageCount || pageType === "summary") {
    return "ending";
  }

  if (pageType === "section" || pageType === "agenda") {
    return "chapter";
  }

  if (pageType === "data") {
    return "key-metrics";
  }

  if (pageType === "comparison") {
    return "two-column-compare";
  }

  if (pageType === "process") {
    return "process-steps";
  }

  return "title-body-points";
}

function buildStructureOutlineFromLightweightOutlineValue(
  outline: z.infer<typeof lightweightOutlineSchema>
) {
  return {
    deckSummary: outline.globalTheme.objective,
    deckTitle: outline.deckTitle,
    slides: [...outline.pages]
      .sort((left, right) => left.pageNumber - right.pageNumber)
      .map((page) => ({
        chapterId: page.chapterId,
        index: page.pageNumber,
        keyMessage: page.keyMessage,
        layoutType: page.layoutType,
        narrativeRole: page.narrativeRole,
        pageNumber: page.pageNumber,
        pageType: page.pageType,
        purpose: page.purpose,
        sourceIds: page.sourceIds,
        slideId: `slide-${page.pageNumber}`,
        title: page.title,
        visualDirection:
          page.pageType === "cover"
            ? "承接轻量大纲主题，后续统一视觉阶段再定义具体视觉表达。"
            : "承接轻量大纲结构，后续详细大纲阶段再定义视觉意图。"
      }))
  };
}

function contentBlockTexts(blocks: SlideContent["contentBlocks"]) {
  return blocks.map((block) => contentBlockText(block));
}

function buildLightweightOutlineFromStructureValue(
  structure: DeckStructureOutlineResult | DeckStructureOutline,
  input: AnalyzeDeckRequest
) {
  const chapters =
    input.pageCount <= 6
      ? [
          {
            chapterId: "chapter-1",
            pageRange: {
              end: input.pageCount,
              start: 1
            },
            purpose: structure.deckSummary,
            title: structure.deckTitle
          }
        ]
      : [
          {
            chapterId: "chapter-1",
            pageRange: {
              end: 1,
              start: 1
            },
            purpose:
              input.locale === "zh-CN"
                ? "建立演示主题和阅读预期。"
                : "Establish the topic and reading expectation.",
            title: input.locale === "zh-CN" ? "开场定位" : "Opening Frame"
          },
          {
            chapterId: "chapter-2",
            pageRange: {
              end: input.pageCount - 1,
              start: 2
            },
            purpose: structure.deckSummary,
            title: input.locale === "zh-CN" ? "主体展开" : "Main Flow"
          },
          {
            chapterId: "chapter-3",
            pageRange: {
              end: input.pageCount,
              start: input.pageCount
            },
            purpose:
              input.locale === "zh-CN"
                ? "总结核心信息并引导下一步。"
                : "Summarize the message and guide next steps.",
            title: input.locale === "zh-CN" ? "总结行动" : "Closing Action"
          }
        ];

  return lightweightOutlineSchema.parse({
    chapters,
    deckTitle: structure.deckTitle,
    deckType: input.deckType,
    globalTheme: {
      objective: structure.deckSummary,
      theme: structure.deckTitle
    },
    narrativeStyle: inferNarrativeStyle(input.deckType),
    pageCount: input.pageCount,
    pages: structure.slides.map((slide) => ({
      chapterId:
        slide.chapterId ?? findChapterIdForPage(chapters, slide.index),
      keyMessage: slide.keyMessage,
      layoutType:
        slide.layoutType ?? inferLayoutType(slide.pageType, slide.index, input.pageCount),
      narrativeRole:
        slide.index === 1
          ? "setup"
          : slide.index === input.pageCount
            ? "call-to-action"
            : "argument",
      pageNumber: slide.index,
      pageType:
        slide.pageType ??
        (slide.index === 1
          ? "cover"
          : slide.index === input.pageCount
            ? "summary"
            : "content"),
      purpose: slide.purpose,
      sourceIds: slide.sourceIds ?? [],
      title: slide.title
    }))
  });
}

function normalizeStructureOutlineValue(
  value: unknown,
  input: Pick<
    AnalyzeDeckRequest,
    "audience" | "coreMessage" | "goal" | "locale" | "pageCount" | "sources"
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
  const allowedSourceIds = new Set(
    (input.sources ?? []).map((source) => source.sourceId)
  );

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
        chapterId:
          typeof record.chapterId === "string"
            ? record.chapterId
            : undefined,
        slideId: boundedText({
          fallback: `slide-${index}`,
          maxLength: 60,
          minLength: 3,
          value: record.slideId
        }),
        index,
        layoutType: slideLayoutTypeIds.includes(record.layoutType as never)
          ? record.layoutType
          : undefined,
        narrativeRole: normalizeNarrativeRole(
          record.narrativeRole,
          index,
          input.pageCount
        ),
        pageNumber:
          typeof record.pageNumber === "number" ? record.pageNumber : index,
        pageType: slidePageTypeValues.includes(record.pageType as never)
          ? (record.pageType as DeckStructureOutlineResult["slides"][number]["pageType"])
          : index === 1
            ? "cover"
            : index === input.pageCount
              ? "summary"
              : "content",
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
        sourceIds: normalizeSourceIds(record.sourceIds, allowedSourceIds),
        visualDirection: boundedText({
          fallback:
            input.locale === "zh-CN"
              ? "承接轻量大纲结构，后续详细大纲阶段再定义视觉意图。"
              : "Follow the lightweight outline; define visual intent in the detailed outline stage.",
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

function normalizeDetailedOutlineResult(
  value: unknown,
  input: AnalyzeDeckRequest,
  structure: DeckStructureOutlineResult,
  lockedVisualSpec: UnifiedVisualSpec
) {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return value;
  }

  ensureNoForbiddenOutlineFields(
    value,
    ["locale", "palette", "pageCount"],
    "Detailed outline"
  );
  ensureDeckTypeMatchesInput(value, input, "Detailed outline");

  if (value.slides.length !== input.pageCount) {
    return value;
  }

  ensureRawSlidesMatchStructure(value.slides, structure, "Detailed outline");

  return {
    ...value,
    unifiedVisualSpec: lockedVisualSpec,
    slides: value.slides.map((slide, index) =>
      normalizeDetailedOutlineSlide(slide, input, structure, index)
    )
  };
}

function normalizeDisplayContentResult(
  value: unknown,
  input: AnalyzeDeckRequest,
  lockedDetailedOutline: DetailedSlideOutline[],
  lockedVisualSpec: UnifiedVisualSpec
) {
  if (!isRecord(value) || !Array.isArray(value.slides)) {
    return value;
  }

  ensureNoForbiddenOutlineFields(
    value,
    ["locale", "palette", "pageCount"],
    "Display content"
  );
  ensureDeckTypeMatchesInput(value, input, "Display content");

  if (value.slides.length !== input.pageCount) {
    return value;
  }

  ensureRawSlidesMatchDetailedOutline(
    value.slides,
    lockedDetailedOutline,
    "Display content"
  );

  const allowedSourceIds = new Set(
    (input.sources ?? []).map((source) => source.sourceId)
  );
  const normalizedSlides = value.slides.map((slide, index) =>
    normalizeDisplayContentSlideBlocks(
      slide,
      lockedDetailedOutline[index],
      input,
      allowedSourceIds
    )
  );

  return {
    ...value,
    detailedOutline: lockedDetailedOutline,
    unifiedVisualSpec: lockedVisualSpec,
    slides: normalizedSlides
  };
}

function normalizeDisplayContentSlideBlocks(
  slide: unknown,
  lockedOutline: DetailedSlideOutline | undefined,
  input: AnalyzeDeckRequest,
  allowedSourceIds: Set<string>
) {
  if (!isRecord(slide) || !Array.isArray(slide.contentBlocks)) {
    return slide;
  }

  const pageType = lockedOutline?.pageType ?? "content";
  const bodyPoints = boundedTextArray({
    fallback: lockedOutline
      ? [lockedOutline.coreStatement, lockedOutline.speakerGoal]
      : [String(slide.title ?? ""), String(input.goal)],
    maxItems: 5,
    maxLength: 120,
    minItems: 2,
    minLength: 2,
    value: slide.bodyPoints
  });
  const normalizedBlocks = limitDisplayContentBlocks(
    slide.contentBlocks.map((block, index) => {
      if (!isRecord(block) || typeof block.priority !== "number") {
        return block;
      }

      const content =
        typeof block.content === "string"
          ? block.content
          : typeof block.text === "string"
            ? block.text
            : "";
      const type = normalizeDisplayContentBlockType(
        block.type ?? block.blockType,
        content,
        pageType,
        index
      );

      return {
        ...block,
        content,
        priority: Math.trunc(Math.min(5, Math.max(1, block.priority))),
        sourceIds: normalizeSourceIds(block.sourceIds, allowedSourceIds),
        type
      };
    })
  );
  const contentBlocks = normalizeContentBlocks(normalizedBlocks, {
    bodyPoints,
    coreStatement: lockedOutline?.coreStatement ?? String(slide.title ?? ""),
    pageType,
    subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
    title: typeof slide.title === "string" ? slide.title : lockedOutline?.title ?? ""
  });

  return {
    ...slide,
    bodyPoints,
    contentBlocks,
    contentLayers: normalizeContentLayers(slide.contentLayers, {
      bodyPoints: bodyPoints.length > 0 ? bodyPoints : contentBlockTexts(contentBlocks),
      contentBlocks,
      coreStatement: lockedOutline?.coreStatement ?? String(slide.title ?? ""),
      input,
      speakerGoal: lockedOutline?.speakerGoal ?? "",
      subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
      title: typeof slide.title === "string" ? slide.title : lockedOutline?.title ?? ""
    })
  };
}

function limitDisplayContentBlocks(blocks: unknown[]) {
  const selected = new Map<
    string,
    {
      block: unknown;
      index: number;
      priority: number;
    }
  >();
  const passthroughBlocks: Array<{ block: unknown; index: number }> = [];

  blocks.forEach((block, index) => {
    if (!isRecord(block)) {
      passthroughBlocks.push({ block, index });
      return;
    }

    if (
      typeof (block.type ?? block.blockType) !== "string" ||
      typeof block.priority !== "number" ||
      typeof (block.content ?? block.text) !== "string"
    ) {
      passthroughBlocks.push({ block, index });
      return;
    }

    const key = normalizeContentBlockText(String(block.content ?? block.text));

    if (!key) {
      passthroughBlocks.push({ block, index });
      return;
    }

    const existing = selected.get(key);

    if (
      !existing ||
      block.priority < existing.priority ||
      (block.priority === existing.priority && index < existing.index)
    ) {
      selected.set(key, {
        block,
        index,
        priority: block.priority
      });
    }
  });

  return [
    ...passthroughBlocks,
    ...Array.from(selected.values()).sort(
      (current, next) =>
        current.priority - next.priority || current.index - next.index
    )
  ]
    .slice(0, slideContentBlockMaxCount)
    .sort((current, next) => current.index - next.index)
    .map((item) => item.block);
}

function normalizeDisplayContentBlockType(
  value: unknown,
  text: string,
  pageType: NonNullable<SlideContent["pageType"]>,
  index: number
): NonNullable<SlideContent["contentBlocks"][number]["type"]> {
  if (isSemanticContentBlockType(value)) {
    return value;
  }

  const normalizedValue =
    typeof value === "string"
      ? value
          .normalize("NFKC")
          .trim()
          .toLowerCase()
          .replace(/[\s_\-—–|｜/\\]+/g, "")
      : "";
  const typeMap: Record<
    string,
    NonNullable<SlideContent["contentBlocks"][number]["type"]>
  > = {
    annotation: "source",
    body: "text",
    bullet: "list",
    bullets: "list",
    caption: "source",
    chartplaceholder: "chart",
    data: "metric",
    datapoint: "metric",
    diagram: "chart",
    figure: "chart",
    finding: "conclusion",
    flow: "steps",
    flowchart: "chart",
    footer: "source",
    footnote: "source",
    generatedimage: "image",
    header: "source",
    icon: "image",
    image: "image",
    insight: "conclusion",
    item: "text",
    keymessage: "conclusion",
    kpi: "metric",
    kpis: "metric",
    list: "list",
    number: "metric",
    paragraph: "text",
    picture: "image",
    point: "text",
    source: "source",
    stat: "metric",
    statistic: "metric",
    step: "steps",
    summary: "summary",
    table: "table",
    takeaway: "conclusion",
    text: "text",
    title: "heading",
    visual: "image",
    图: "chart",
    图例: "chart",
    图像: "image",
    图标: "image",
    图文: "image",
    图片: "image",
    图形: "chart",
    图示: "chart",
    图表: "chart",
    表格: "table",
    数据: "metric",
    指标: "metric",
    数字: "metric",
    数值: "metric",
    数字指标: "metric",
    关键指标: "metric",
    关键数字: "metric",
    统计: "metric",
    正文: "text",
    正文要点: "text",
    文本: "text",
    段落: "text",
    要点: "text",
    列表: "list",
    结论: "conclusion",
    总结: "summary",
    摘要: "summary",
    洞察: "conclusion",
    发现: "conclusion",
    带走信息: "conclusion",
    引用: "quote",
    金句: "quote",
    标签: "callout",
    关键词: "callout",
    步骤: "steps",
    流程: "steps",
    阶段: "timeline",
    对比: "comparison",
    比较: "comparison",
    注释: "source",
    注解: "source",
    备注: "source",
    说明: "source",
    页脚: "source",
    页眉: "source",
    来源: "source",
    标注: "source",
    插图: "image",
    标题: "heading"
  };

  if (Object.prototype.hasOwnProperty.call(typeMap, normalizedValue)) {
    return typeMap[normalizedValue];
  }

  return inferContentBlockType(text, pageType, index);
}

function normalizeDetailedOutlineSlide(
  slide: unknown,
  input: AnalyzeDeckRequest,
  structure: DeckStructureOutlineResult,
  index: number
): DetailedSlideOutline {
  const record = isRecord(slide) ? slide : {};
  const expected = structure.slides[index];
  const fallbackSlide = normalizeSlideContent(record, input, {
    bodyPoints: [expected.keyMessage, input.goal],
    expected,
    nextTitle: structure.slides[index + 1]?.title,
    previousTitle: structure.slides[index - 1]?.title,
    slideCount: structure.slides.length
  });

  return {
    adaptationRules: normalizeAdaptationRules(record.adaptationRules, {
      bodyPoints: [expected.keyMessage, input.goal],
      input,
      nextTitle: structure.slides[index + 1]?.title,
      previousTitle: structure.slides[index - 1]?.title,
      title: expected.title
    }),
    audienceFocus: normalizeAudienceFocus(record.audienceFocus, input),
    contentBoundary: normalizeContentBoundary(record.contentBoundary, {
      bodyPoints: [expected.keyMessage, input.goal],
      input,
      title: expected.title
    }),
    coreStatement: boundedText({
      fallback: expected.keyMessage,
      maxLength: 220,
      minLength: 4,
      value: record.coreStatement
    }),
    explanationDepth: normalizeExplanationDepth(
      record.explanationDepth,
      expected.index,
      structure.slides.length
    ),
    index: expected.index,
    narrativeRole: normalizeNarrativeRole(
      record.narrativeRole,
      expected.index,
      structure.slides.length
    ),
    pageType: normalizeSlidePageType(record.pageType, {
      bodyPoints: [expected.keyMessage, input.goal],
      index: expected.index,
      input,
      slideCount: structure.slides.length,
      title: expected.title
    }),
    slideId: expected.slideId,
    slideTransition: normalizeSlideTransition(record.slideTransition, {
      input,
      nextTitle: structure.slides[index + 1]?.title,
      previousTitle: structure.slides[index - 1]?.title,
      title: expected.title
    }),
    sourceRequirement: normalizeSourceRequirement(record.sourceRequirement, {
      bodyPoints: [expected.keyMessage, input.goal],
      input,
      title: expected.title
    }),
    speakerGoal: boundedText({
      fallback: expected.purpose,
      maxLength: 180,
      minLength: 6,
      value: record.speakerGoal
    }),
    title: expected.title,
    viewerObjective: normalizeViewerObjective(record.viewerObjective, {
      coreStatement: fallbackSlide.coreStatement,
      input,
      speakerGoal: fallbackSlide.speakerGoal
    }),
    visualIntent: boundedText({
      fallback: expected.visualDirection,
      maxLength: 220,
      minLength: 6,
      value: record.visualIntent
    })
  };
}

function mergeDetailedOutlineAndDisplayContent({
  displayContent,
  input,
  lockedDetailedOutline,
  structure,
  unifiedVisualSpec
}: {
  displayContent: DeckDisplayContentResult;
  input: AnalyzeDeckRequest;
  lockedDetailedOutline: DetailedSlideOutline[];
  structure: DeckStructureOutlineResult;
  unifiedVisualSpec: UnifiedVisualSpec;
}): DeckPageCopyResult {
  const slides = lockedDetailedOutline.map((outline, index) => {
    const display = displayContent.slides[index];

    return normalizeSlideContent(
      {
        ...outline,
        ...display,
        pageType: outline.pageType,
        speakerGoal: outline.speakerGoal,
        visualIntent: outline.visualIntent,
        coreStatement: outline.coreStatement,
        narrativeRole: outline.narrativeRole,
        contentLayers: display.contentLayers,
        slideTransition: outline.slideTransition,
        explanationDepth: outline.explanationDepth,
        sourceRequirement: outline.sourceRequirement,
        adaptationRules: outline.adaptationRules,
        audienceFocus: outline.audienceFocus,
        viewerObjective: outline.viewerObjective,
        contentBoundary: outline.contentBoundary
      },
      input,
      {
        bodyPoints: display.bodyPoints,
        expected: structure.slides[index],
        nextTitle: structure.slides[index + 1]?.title,
        previousTitle: structure.slides[index - 1]?.title,
        slideCount: structure.slides.length,
        subtitle: display.subtitle ?? ""
      }
    );
  });

  return deckPageCopyResultSchema.parse({
    deckType: input.deckType,
    unifiedVisualSpec,
    slides
  });
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
  const pageType = normalizeSlidePageType(record.pageType, {
    bodyPoints,
    index,
    input,
    slideCount,
    title
  });
  const contentBlocks = ensureVisualContentBlock(
    normalizeContentBlocks(record.contentBlocks, {
      bodyPoints,
      coreStatement,
      pageType,
      subtitle,
      title
    }),
    {
      pageType,
      visualIntent
    }
  );

  return {
    slideId,
    index,
    pageType,
    title,
    ...(subtitle ? { subtitle } : {}),
    bodyPoints,
    contentBlocks,
    speakerGoal,
    visualIntent,
    coreStatement,
    narrativeRole: normalizeNarrativeRole(record.narrativeRole, index, slideCount),
    contentLayers: normalizeContentLayers(record.contentLayers, {
      bodyPoints,
      contentBlocks,
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

function normalizeSlidePageType(
  value: unknown,
  fallback: {
    bodyPoints: string[];
    index: number;
    input: AnalyzeDeckRequest;
    slideCount: number;
    title: string;
  }
): NonNullable<SlideContent["pageType"]> {
  if (slidePageTypeValues.includes(value as never)) {
    return value as NonNullable<SlideContent["pageType"]>;
  }

  const corpus = `${fallback.title} ${fallback.bodyPoints.join(" ")}`;

  if (fallback.index === 1) {
    return "cover";
  }

  if (fallback.index === fallback.slideCount) {
    return "summary";
  }

  if (/目录|agenda|contents|outline/i.test(corpus)) {
    return "agenda";
  }

  if (/步骤|流程|阶段|路径|step|process|phase/i.test(corpus)) {
    return "process";
  }

  if (/对比|比较|差异|矩阵|compare|comparison|matrix/i.test(corpus)) {
    return "comparison";
  }

  if (/%|数据|指标|增长|同比|环比|营收|chart|data|metric|trend|\d/.test(corpus)) {
    return "data";
  }

  if (fallback.index === Math.ceil(fallback.slideCount / 2)) {
    return "section";
  }

  return "content";
}

function normalizeContentBlocks(
  value: unknown,
  fallback: {
    bodyPoints: string[];
    coreStatement: string;
    pageType: NonNullable<SlideContent["pageType"]>;
    subtitle: string;
    title: string;
  }
): SlideContent["contentBlocks"] {
  const blocks = Array.isArray(value)
    ? value.flatMap((item, index) => {
        const record = isRecord(item) ? item : {};
        const content = boundedText({
          fallback: "",
          maxLength: 500,
          minLength: 2,
          value: isRecord(item) ? record.content ?? record.text : item
        });

        if (!content) {
          return [];
        }

        const rawType = isRecord(item) ? record.type ?? record.blockType : undefined;
        const type = isSemanticContentBlockType(rawType)
          ? rawType
          : inferContentBlockType(content, fallback.pageType, index);
        const rawPriority = isRecord(item) ? Number(record.priority) : index + 1;
        const priority =
          Number.isFinite(rawPriority) && rawPriority >= 1 && rawPriority <= 5
            ? Math.trunc(rawPriority)
            : Math.min(5, index + 1);

        return [
          buildContentBlock({
            content,
            priority,
            sourceIds: isRecord(item) && Array.isArray(record.sourceIds)
              ? record.sourceIds.map(String)
              : [],
            type
          })
        ];
      })
    : [];
  const fallbackBlocks: SlideContent["contentBlocks"] = [
    {
      ...buildContentBlock({
        content: fallback.title,
        priority: 1,
        type: "heading"
      })
    },
    ...(fallback.subtitle
      ? [
          {
            ...buildContentBlock({
              content: fallback.subtitle,
              priority: 3,
              type: "source"
            })
          }
        ]
      : []),
    {
      ...buildContentBlock({
        content: fallback.coreStatement,
        priority: 1,
        type: "conclusion"
      })
    },
    ...fallback.bodyPoints.map((point, index) =>
      buildContentBlock({
        content: point,
        priority: Math.min(5, index + 2),
        type: inferContentBlockType(point, fallback.pageType, index + 2)
      })
    )
  ];
  const merged = dedupeSlideContentBlocks([...blocks, ...fallbackBlocks], {
    pageType: fallback.pageType
  }).contentBlocks;

  if (merged.length >= 3) {
    return merged;
  }

  return dedupeSlideContentBlocks([...merged, ...fallbackBlocks], {
    pageType: fallback.pageType
  }).contentBlocks;
}

function appendContentBlockIfMissing(
  blocks: SlideContent["contentBlocks"],
  text: string,
  options: {
    pageType: NonNullable<SlideContent["pageType"]>;
    priority?: number;
    type?: NonNullable<SlideContent["contentBlocks"][number]["type"]>;
  }
) {
  const content = truncateText(text.trim(), 500);
  const key = normalizeContentBlockText(content);

  if (!content || !key) {
    return blocks;
  }

  if (blocks.some((block) => normalizeContentBlockText(contentBlockText(block)) === key)) {
    return blocks;
  }

  if (blocks.length >= slideContentBlockMaxCount) {
    return blocks;
  }

  return [
    ...blocks,
    buildContentBlock({
      content,
      priority: options.priority ?? 5,
      type: options.type ?? inferContentBlockType(content, options.pageType, blocks.length)
    })
  ];
}

function ensureVisualContentBlock(
  blocks: SlideContent["contentBlocks"],
  fallback: {
    pageType: NonNullable<SlideContent["pageType"]>;
    visualIntent?: string;
  }
) {
  if (
    blocks.some((block) => {
      const type = isSemanticContentBlockType(block.type)
        ? block.type
        : normalizeDisplayContentBlockType(
            block.blockType,
            contentBlockText(block),
            fallback.pageType,
            0
          );

      return type === "image";
    })
  ) {
    return blocks;
  }

  const visualIntent = fallback.visualIntent?.trim();

  if (!visualIntent || visualIntent.length < 6) {
    return blocks;
  }

  if (!/图|图片|背景|主视觉|视觉|插画|photo|image|visual|background|illustration/i.test(visualIntent)) {
    return blocks;
  }

  return appendContentBlockIfMissing(blocks, visualIntent, {
    pageType: fallback.pageType,
    priority: 3,
    type: "image"
  });
}

function buildContentBlock({
  content,
  priority,
  sourceIds = [],
  type
}: {
  content: string;
  priority: number;
  sourceIds?: string[];
  type: NonNullable<SlideContent["contentBlocks"][number]["type"]>;
}): SlideContent["contentBlocks"][number] {
  const blockType = legacyContentBlockTypeForSemanticType(type);

  return {
    blockType,
    content,
    priority,
    sourceIds,
    text: content,
    type
  };
}

function isSemanticContentBlockType(
  value: unknown
): value is NonNullable<SlideContent["contentBlocks"][number]["type"]> {
  return (
    typeof value === "string" &&
    (slideContentBlockTypeValues as readonly string[]).includes(value)
  );
}

function legacyContentBlockTypeForSemanticType(
  type: NonNullable<SlideContent["contentBlocks"][number]["type"]>
): SlideContent["contentBlocks"][number]["blockType"] {
  const map: Record<
    NonNullable<SlideContent["contentBlocks"][number]["type"]>,
    SlideContent["contentBlocks"][number]["blockType"]
  > = {
    callout: "tag",
    chart: "chart",
    comparison: "comparison",
    conclusion: "conclusion",
    heading: "title",
    image: "note",
    list: "body",
    metric: "metric",
    quote: "quote",
    source: "note",
    steps: "step",
    summary: "conclusion",
    table: "chart",
    text: "body",
    timeline: "step"
  };

  return map[type];
}

function normalizeSourceIds(value: unknown, allowedSourceIds: Set<string>) {
  if (!Array.isArray(value) || allowedSourceIds.size === 0) {
    return [];
  }

  return Array.from(
    new Set(value.map((item) => String(item)).filter((item) => allowedSourceIds.has(item)))
  ).slice(0, 24);
}

function inferContentBlockType(
  text: string,
  pageType: NonNullable<SlideContent["pageType"]>,
  index: number
): NonNullable<SlideContent["contentBlocks"][number]["type"]> {
  if (index === 0) {
    return "heading";
  }

  if (pageType === "data" && /%|\d|数据|指标|metric|data/i.test(text)) {
    return "metric";
  }

  if (pageType === "process") {
    return "steps";
  }

  if (pageType === "comparison") {
    return "comparison";
  }

  if (/图表|趋势|chart|trend/i.test(text)) {
    return "chart";
  }

  if (/引用|quote|“|”|"/i.test(text) && text.length <= 80) {
    return "quote";
  }

  return index <= 2 ? "text" : "source";
}

function normalizeContentLayers(
  value: unknown,
  fallback: {
    bodyPoints: string[];
    contentBlocks: SlideContent["contentBlocks"];
    coreStatement: string;
    input: AnalyzeDeckRequest;
    speakerGoal: string;
    subtitle: string;
    title: string;
  }
): SlideContent["contentLayers"] {
  const record = isRecord(value) ? value : {};
  const blockCount = fallback.contentBlocks.length;
  const textKeyToIndex = new Map<string, number>();

  fallback.contentBlocks.forEach((block, index) => {
    const key = normalizeContentBlockText(contentBlockText(block));

    if (key && !textKeyToIndex.has(key)) {
      textKeyToIndex.set(key, index);
    }
  });

  const used = new Set<number>();
  const normalizeGroup = (
    rawValue: unknown,
    maxItems: number
  ) => {
    const values = Array.isArray(rawValue)
      ? rawValue
      : typeof rawValue === "number" || typeof rawValue === "string"
        ? [rawValue]
        : [];
    const indexes: number[] = [];

    for (const item of values) {
      const index =
        typeof item === "number" && Number.isInteger(item)
          ? item
          : typeof item === "string"
            ? textKeyToIndex.get(normalizeContentBlockText(item))
            : undefined;

      if (
        index === undefined ||
        index < 0 ||
        index >= blockCount ||
        used.has(index)
      ) {
        continue;
      }

      used.add(index);
      indexes.push(index);

      if (indexes.length >= maxItems) {
        break;
      }
    }

    return indexes;
  };

  const layers: SlideContent["contentLayers"] = {
    primary: normalizeGroup(record.primary, 4),
    supporting: normalizeGroup(record.supporting, 6),
    supplementary: normalizeGroup(record.supplementary, 5)
  };

  const allIndexes = Array.from({ length: blockCount }, (_, index) => index);
  const sortedByPriority = [...allIndexes].sort((left, right) => {
    const leftPriority = fallback.contentBlocks[left]?.priority ?? 5;
    const rightPriority = fallback.contentBlocks[right]?.priority ?? 5;

    return leftPriority - rightPriority || left - right;
  });

  const addToLayer = (
    group: keyof SlideContent["contentLayers"],
    index: number,
    maxItems: number
  ) => {
    if (used.has(index) || layers[group].length >= maxItems) {
      return false;
    }

    used.add(index);
    layers[group].push(index);
    return true;
  };

  for (const index of sortedByPriority) {
    const priority = fallback.contentBlocks[index]?.priority ?? 5;

    if (layers.primary.length < 1 && priority <= 1) {
      addToLayer("primary", index, 4);
    }
  }

  for (const index of sortedByPriority) {
    if (layers.primary.length >= 1) {
      break;
    }

    addToLayer("primary", index, 4);
  }

  for (const index of sortedByPriority) {
    const priority = fallback.contentBlocks[index]?.priority ?? 5;

    if (layers.supporting.length < 1 && priority >= 2 && priority <= 3) {
      addToLayer("supporting", index, 6);
    }
  }

  for (const index of sortedByPriority) {
    if (layers.supporting.length >= 1) {
      break;
    }

    addToLayer("supporting", index, 6);
  }

  for (const index of sortedByPriority) {
    if (used.has(index)) {
      continue;
    }

    const priority = fallback.contentBlocks[index]?.priority ?? 5;
    const group =
      priority <= 1 && layers.primary.length < 4
        ? "primary"
        : priority <= 3 && layers.supporting.length < 6
          ? "supporting"
          : layers.supplementary.length < 5
            ? "supplementary"
            : layers.supporting.length < 6
              ? "supporting"
              : "primary";

    addToLayer(group, index, group === "primary" ? 4 : group === "supporting" ? 6 : 5);
  }

  return layers;
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
  const semanticElements = normalizeSemanticElementsForSlide({
    input,
    pageIntent: normalizedPageIntent,
    slide,
    value: value.semanticElements
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

function normalizeSemanticElementsForSlide({
  input,
  pageIntent,
  slide,
  value
}: {
  input: AnalyzeDeckRequest;
  pageIntent: SlidePageIntent;
  slide: SlideContent;
  value: unknown;
}): SemanticSlideElement[] {
  const fallbackElements = buildFallbackSemanticElements({
    input,
    pageIntent,
    slide
  });
  const rawElements = Array.isArray(value) ? value : fallbackElements;
  const contentBlockIndexByText = new Map<string, number>();

  slide.contentBlocks.forEach((block, index) => {
    const key = normalizeContentBlockText(contentBlockText(block));

    if (key && !contentBlockIndexByText.has(key)) {
      contentBlockIndexByText.set(key, index);
    }
  });

  return rawElements
    .map((rawElement, index) => {
      const fallback = fallbackElements[index] ?? fallbackElements[0];

      if (!isRecord(rawElement)) {
        return fallback;
      }

      const content = formatLooseValue(rawElement.content, 500);
      const explicitContentBlockIndex =
        typeof rawElement.contentBlockIndex === "number" &&
        Number.isInteger(rawElement.contentBlockIndex) &&
        rawElement.contentBlockIndex >= 0 &&
        rawElement.contentBlockIndex < slide.contentBlocks.length
          ? rawElement.contentBlockIndex
          : undefined;
      const inferredContentBlockIndex =
        explicitContentBlockIndex ??
        (content
          ? contentBlockIndexByText.get(normalizeContentBlockText(content))
          : undefined);
      const semanticType =
        typeof rawElement.semanticType === "string"
          ? rawElement.semanticType
          : fallback.semanticType;
      const role = boundedText({
        fallback: fallback.role,
        maxLength: 100,
        minLength: 2,
        value: rawElement.role
      });

      return {
        ...fallback,
        ...rawElement,
        content: content || fallback.content,
        contentBlockIndex: inferredContentBlockIndex,
        role,
        styleRole:
          formatLooseValue(rawElement.styleRole, 100) ||
          fallback.styleRole ||
          styleRoleForSemanticType(semanticType, role)
      } as SemanticSlideElement;
    })
    .slice(0, 14);
}

function styleRoleForSemanticType(semanticType: unknown, role: string) {
  const normalized = typeof semanticType === "string" ? semanticType : "";
  const map: Record<string, string> = {
    accentShape: "decorative",
    background: "background",
    badge: "callout",
    body: "body",
    card: "card",
    chart: "chart",
    footer: "source-note",
    heroVisual: "hero-visual",
    icon: "icon",
    subtitle: "key-message",
    supportingVisual: "supporting-visual",
    title: "page-title"
  };

  return map[normalized] ?? role;
}

function normalizeContentHierarchyForSemanticPlan(
  value: Record<string, unknown>,
  fallback: SlideCompositionPlan["contentHierarchy"]
): SlideCompositionPlan["contentHierarchy"] {
  const inputTiers = Array.isArray(value.tiers) ? value.tiers : [];
  const tiers = ([1, 2, 3] as const).map((level, index) => {
    const fallbackTier =
      fallback.tiers.find((tier) => tier.level === level) ??
      fallback.tiers[index];
    const sourceTier = inputTiers.find((tier) => {
      if (!isRecord(tier)) {
        return false;
      }

      return tier.level === level;
    }) ?? inputTiers[index];

    if (!isRecord(sourceTier)) {
      return fallbackTier;
    }

    const rawItems = Array.isArray(sourceTier.items) ? sourceTier.items : [];
    const items = rawItems
      .map((item, itemIndex) => {
        const fallbackItem =
          fallbackTier.items[itemIndex] ?? fallbackTier.items[0];

        if (typeof item === "string") {
          return {
            content: boundedText({
              fallback: fallbackItem.content,
              maxLength: 220,
              minLength: 1,
              value: item
            }),
            role: fallbackItem.role
          };
        }

        if (!isRecord(item)) {
          return null;
        }

        return {
          content: boundedText({
            fallback: fallbackItem.content,
            maxLength: 220,
            minLength: 1,
            value: item.content
          }),
          role: boundedText({
            fallback: fallbackItem.role,
            maxLength: 80,
            minLength: 1,
            value: item.role
          })
        };
      })
      .filter(
        (
          item
        ): item is SlideCompositionPlan["contentHierarchy"]["tiers"][number]["items"][number] =>
          Boolean(item)
      )
      .slice(0, 8);

    return {
      label: boundedText({
        fallback: fallbackTier.label,
        maxLength: 80,
        minLength: 1,
        value: sourceTier.label
      }),
      level,
      items: items.length > 0 ? items : fallbackTier.items
    };
  });

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

function ensureDetailedOutlineMatchesStructure(
  detailedOutline: DeckDetailedOutlineResult,
  structure: DeckStructureOutlineResult
) {
  for (const [index, slide] of detailedOutline.slides.entries()) {
    const expected = structure.slides[index];

    if (!expected) {
      throw new Error("AI returned an unexpected detailed outline slide.");
    }

    if (slide.slideId !== expected.slideId || slide.index !== expected.index) {
      throw new Error("AI returned detailed outline that does not match the structure outline.");
    }

    if (slide.title !== expected.title) {
      throw new Error("AI returned detailed outline title that does not match the structure outline.");
    }
  }
}

function ensureDisplayContentMatchesDetailedOutline(
  displayContent: DeckDisplayContentResult,
  detailedOutline: DetailedSlideOutline[]
) {
  for (const [index, slide] of displayContent.slides.entries()) {
    const expected = detailedOutline[index];

    if (!expected) {
      throw new Error("AI returned an unexpected display content slide.");
    }

    if (slide.slideId !== expected.slideId || slide.index !== expected.index) {
      throw new Error("AI returned display content that does not match the detailed outline.");
    }

    if (slide.title !== expected.title) {
      throw new Error("AI returned display content title that does not match the detailed outline.");
    }
  }
}

function ensureRawSlidesMatchStructure(
  slides: unknown[],
  structure: DeckStructureOutlineResult,
  stage: string
) {
  for (const [index, slide] of slides.entries()) {
    const record = isRecord(slide) ? slide : {};
    const expected = structure.slides[index];

    if (!expected) {
      throw new Error(`${stage} returned an unexpected slide.`);
    }

    if (record.slideId !== expected.slideId || record.index !== expected.index) {
      throw new Error(`${stage} returned slideId or index that does not match the structure outline.`);
    }

    if (record.title !== expected.title) {
      throw new Error(`${stage} returned title that does not match the structure outline.`);
    }
  }
}

function ensureRawSlidesMatchDetailedOutline(
  slides: unknown[],
  detailedOutline: DetailedSlideOutline[],
  stage: string
) {
  for (const [index, slide] of slides.entries()) {
    const record = isRecord(slide) ? slide : {};
    const expected = detailedOutline[index];

    if (!expected) {
      throw new Error(`${stage} returned an unexpected slide.`);
    }

    if (record.slideId !== expected.slideId || record.index !== expected.index) {
      throw new Error(`${stage} returned slideId or index that does not match the detailed outline.`);
    }

    if (record.title !== expected.title) {
      throw new Error(`${stage} returned title that does not match the detailed outline.`);
    }
  }
}

function ensureNoForbiddenOutlineFields(
  value: unknown,
  forbiddenFields: string[],
  stage: string
) {
  if (!isRecord(value)) {
    return;
  }

  for (const field of forbiddenFields) {
    if (field in value) {
      throw new Error(`${stage} returned forbidden field "${field}".`);
    }
  }
}

function ensureDeckTypeMatchesInput(value: unknown, input: AnalyzeDeckRequest, stage: string) {
  if (!isRecord(value)) {
    return;
  }

  if (value.deckType !== input.deckType) {
    throw new Error(`${stage} modified deckType.`);
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

async function createUnifiedVisualSpecWithAi({
  client,
  fileSummaries,
  input,
  intentAnalysis,
  lockedStructure,
  model,
  sourceContext,
  temperature
}: {
  client: JsonChatClient;
  fileSummaries: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
  intentAnalysis: DeckIntentAnalysisResult;
  lockedStructure: DeckStructureOutlineResult;
  model: string;
  sourceContext: string;
  temperature: number;
}) {
  return generateValidatedJson({
    client,
    model,
    retryValidation: false,
    temperature,
    schema: buildUnifiedVisualSpecSchema(),
    schemaName: "UnifiedVisualSpec",
    messages: buildVisualSpecMessages({
      input,
      intentAnalysis,
      sourceContext,
      structure: lockedStructure,
      fileSummaries
    }),
    normalize: (value) => normalizeUnifiedVisualSpec(value, input)
  });
}

async function createDetailedOutlineWithAi({
  client,
  fileSummaries,
  input,
  intentAnalysis,
  lockedStructure,
  model,
  sourceContext,
  temperature,
  unifiedVisualSpec
}: {
  client: JsonChatClient;
  fileSummaries: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
  intentAnalysis: DeckIntentAnalysisResult;
  lockedStructure: DeckStructureOutlineResult;
  model: string;
  sourceContext: string;
  temperature: number;
  unifiedVisualSpec: UnifiedVisualSpec;
}): Promise<DeckDetailedOutlineResult> {
  const detailedOutline = await generateValidatedJson({
    client,
    model,
    retryValidation: false,
    temperature,
    schema: buildDetailedOutlineSchema(input),
    schemaName: "DeckDetailedOutlineResult",
    messages: buildDetailedOutlineMessages({
      input,
      intentAnalysis,
      sourceContext,
      structure: lockedStructure,
      fileSummaries,
      unifiedVisualSpec
    }),
    normalize: (value) =>
      normalizeDetailedOutlineResult(value, input, lockedStructure, unifiedVisualSpec)
  });

  return deckDetailedOutlineResultSchema.parse({
    ...detailedOutline,
    unifiedVisualSpec
  });
}

async function createDisplayContentFromDetailedOutlineWithAi({
  client,
  detailedOutline,
  fileSummaries,
  input,
  intentAnalysis,
  lockedStructure,
  model,
  sourceContext,
  temperature,
  unifiedVisualSpec
}: {
  client: JsonChatClient;
  detailedOutline: DetailedSlideOutline[];
  fileSummaries: DeckIntentAnalysisResult["fileSummaries"];
  input: AnalyzeDeckRequest;
  intentAnalysis: DeckIntentAnalysisResult;
  lockedStructure: DeckStructureOutlineResult;
  model: string;
  sourceContext: string;
  temperature: number;
  unifiedVisualSpec: UnifiedVisualSpec;
}): Promise<DeckDisplayContentResult> {
  const displayContent = await generateValidatedJson({
    client,
    model,
    retryValidation: false,
    temperature,
    schema: buildDisplayContentSchema(input),
    schemaName: "DeckDisplayContentResult",
    messages: buildDisplayContentMessages({
      detailedOutline,
      input,
      intentAnalysis,
      sourceContext,
      structure: lockedStructure,
      fileSummaries,
      unifiedVisualSpec
    }),
    normalize: (value) =>
      normalizeDisplayContentResult(value, input, detailedOutline, unifiedVisualSpec)
  });

  return deckDisplayContentResultSchema.parse({
    ...displayContent,
    detailedOutline,
    unifiedVisualSpec
  });
}

async function createDeckOutlineWithAi(
  input: AnalyzeDeckRequest,
  intentAnalysis: DeckIntentAnalysisResult,
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
  const sourceContext = buildOutlineSourceContext({
    fileSummaries,
    input
  });
  const unifiedVisualSpec = await createUnifiedVisualSpecWithAi({
    client,
    fileSummaries,
    input,
    intentAnalysis,
    lockedStructure,
    model,
    sourceContext,
    temperature
  });
  const detailedOutline = await createDetailedOutlineWithAi({
    client,
    fileSummaries,
    input,
    intentAnalysis,
    lockedStructure,
    model,
    sourceContext,
    temperature,
    unifiedVisualSpec
  });
  ensureDetailedOutlineMatchesStructure(detailedOutline, lockedStructure);

  const displayContent = await createDisplayContentFromDetailedOutlineWithAi({
    client,
    detailedOutline: detailedOutline.slides,
    fileSummaries,
    input,
    intentAnalysis,
    lockedStructure,
    model,
    sourceContext,
    temperature,
    unifiedVisualSpec
  });

  ensureDisplayContentMatchesDetailedOutline(displayContent, detailedOutline.slides);

  const pageCopy = mergeDetailedOutlineAndDisplayContent({
    displayContent,
    input,
    lockedDetailedOutline: detailedOutline.slides,
    structure: lockedStructure,
    unifiedVisualSpec
  });

  ensurePageCopyMatchesStructure(pageCopy, lockedStructure);

  return deckOutlineResultSchema.parse({
    mode: "ai-json",
    deckTitle: lockedStructure.deckTitle,
    deckSummary: lockedStructure.deckSummary,
    unifiedVisualSpec,
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
  const firstComposition = await composeSlideWithTemplateFallback({
    input,
    semanticPlan,
    unifiedVisualSpec
  });

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
    const repairedComposition = await composeSlideWithTemplateFallback({
      input,
      semanticPlan: repairedPlan,
      unifiedVisualSpec
    });

    return {
      composition: normalizeSlideCompositionPlan({
        ...repairedComposition,
        designQualityScore: {
          ...repairedComposition.designQualityScore,
          repairStatus: needsSlideDesignRepair(repairedComposition.designQualityScore)
            ? "still-low"
            : "repaired"
        }
      }, {
        completeContentBlocks: true,
        unifiedVisualSpec
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
      }, {
        completeContentBlocks: true,
        unifiedVisualSpec
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

async function composeSlideWithTemplateFallback({
  input,
  semanticPlan,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  semanticPlan: SemanticSlidePlan;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  const fallback = () =>
    normalizeSlideCompositionPlan(
      composeSlideFromSemanticPlan({
        input,
        semanticPlan,
        unifiedVisualSpec
      }),
      {
        completeContentBlocks: true,
        unifiedVisualSpec
      }
    );
  const enhance = (
    slide: SlideCompositionPlan,
    templateTags: string[] = []
  ) =>
    enhanceSlideWithSemanticAssets({
      input,
      slide,
      templateTags,
      unifiedVisualSpec
    });

  try {
    const template = await selectPptTemplateForSlide({
      input,
      semanticPlan,
      unifiedVisualSpec
    });

    if (!template) {
      return enhance(
        withTemplateWarning(
          fallback(),
          input.locale === "zh-CN"
            ? "未命中启用模板，使用内置排版。"
            : "No enabled template matched; built-in layout was used."
        )
      );
    }

    return enhance(
      normalizeSlideCompositionPlan(
        composeSlideFromTemplate({
          input,
          semanticPlan,
          template,
          unifiedVisualSpec
        }),
        {
          completeContentBlocks: true,
          unifiedVisualSpec
        }
      ),
      template.tags
    );
  } catch (error) {
    return enhance(
      withTemplateWarning(
        fallback(),
        input.locale === "zh-CN"
          ? `模板套用失败，已回退内置排版：${compactText(formatErrorMessage(error), 80)}`
          : `Template application failed; built-in layout was used: ${compactText(formatErrorMessage(error), 90)}`
      )
    );
  }
}

async function composeMockAnalyzedDeckWithTemplates(
  input: AnalyzeDeckRequest
): Promise<AnalyzedDeckResult> {
  const mock = buildMockAnalyzedDeck(input);
  const slides = await mapWithConcurrency(
    mock.slides.map((slide) => slide.content),
    slideCompositionConcurrency,
    async (slide) =>
      composeSlideWithTemplateFallback({
        input,
        semanticPlan: buildSemanticPlanFromSlide({
          input,
          slide,
          unifiedVisualSpec: mock.unifiedVisualSpec
        }),
        unifiedVisualSpec: mock.unifiedVisualSpec
      })
  );

  return analyzedDeckResultSchema.parse({
    ...mock,
    slides: sortSlidePlansByIndex(slides)
  });
}

function withTemplateWarning(
  slide: SlideCompositionPlan,
  warning: string
): SlideCompositionPlan {
  return {
    ...slide,
    designPlan: {
      ...slide.designPlan,
      visualStrategy: `${slide.designPlan.visualStrategy} ${warning}`
    },
    layoutDiagnostics: {
      ...slide.layoutDiagnostics,
      warnings: Array.from(
        new Set([...slide.layoutDiagnostics.warnings, warning])
      ).slice(0, 8)
    }
  };
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

function buildFileSummaries(input: DeckOutlineIntentInput) {
  if ((input.parsedFiles ?? []).length > 0) {
    return (input.parsedFiles ?? []).map((file) => ({
      characterCount: file.characterCount,
      name: file.name,
      size: file.size,
      summary: compactText(file.summary || file.text, 500),
      snippets: buildFileSnippets(file.text || file.summary)
    }));
  }

  return input.textFiles.map((file) => ({
    characterCount: file.content.length,
    name: file.name,
    size: file.size,
    summary: compactText(file.content, 500),
    snippets: buildFileSnippets(file.content)
  }));
}

function buildSourceReferences(
  sources: NonNullable<DeckOutlineIntentInput["sources"] | AnalyzeDeckRequest["sources"]>
) {
  return sources.slice(0, 80).map((source) => ({
    fileName: source.fileName,
    label: source.label,
    sourceId: source.sourceId,
    text: compactText(source.text, 260)
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
    return composeMockAnalyzedDeckWithTemplates(input);
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
    options.intentAnalysis ??
      {
        deckType: input.deckType,
        audience: input.audience,
        goal: input.goal,
        coreMessage: input.coreMessage,
        recommendedPageCount: input.pageCount,
        fileSummaries,
        input: {
          idea: input.sourceText,
          sourceText: input.sourceText,
          textFiles: [],
          pageCount: input.pageCount,
          deckType: input.deckType,
          palette: input.palette,
          locale: input.locale
        },
        lightweightOutline: buildLightweightOutlineFromStructureValue(
          structureOutline,
          input
        ),
        structureOutline: {
          deckTitle: structureOutline.deckTitle,
          deckSummary: structureOutline.deckSummary,
          slides: structureOutline.slides
        }
      },
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
      await mapWithConcurrency(
        slides,
        slideCompositionConcurrency,
        async (slide) =>
          composeSlideWithTemplateFallback({
            input,
            semanticPlan: buildSemanticPlanFromSlide({
              input,
              slide,
              unifiedVisualSpec
            }),
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
      await mapWithConcurrency(
        slides,
        slideCompositionConcurrency,
        async (slide) =>
          composeSlideWithTemplateFallback({
            input,
            semanticPlan: buildSemanticPlanFromSlide({
              input,
              slide,
              unifiedVisualSpec
            }),
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
    return composeSlideWithTemplateFallback({
      input,
      semanticPlan: buildSemanticPlanFromSlide({
        input,
        slide,
        unifiedVisualSpec
      }),
      unifiedVisualSpec
    });
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
