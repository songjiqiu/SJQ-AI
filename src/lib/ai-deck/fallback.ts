import {
  deckIntentAnalysisResultSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type DeckIntentAnalysisResult,
  type DeckOutlineIntentInput,
  type SlideCompositionPlan,
  type SlideContent,
  type UnifiedVisualSpec
} from "./schema";
import { normalizeSlideCompositionPlan } from "./postprocess";
import {
  buildSemanticPlanFromSlide,
  composeSlideFromSemanticPlan
} from "./semantic-layout";
import { getPptTypeVisualTone } from "@/lib/create-deck/visual-tone";

const paletteCopy = {
  "zh-CN": {
    "star-map": ["#246BFE", "#D9E7FF", "#17202A", "#16A085"],
    matrix: ["#13966A", "#D9F3E9", "#17202A", "#2563EB"],
    "deep-space": ["#7C3AED", "#EADCFF", "#171F2A", "#14B8A6"],
    "morning-mist": ["#C05621", "#F7E5D6", "#17202A", "#2563EB"]
  },
  "en-US": {
    "star-map": ["#246BFE", "#D9E7FF", "#17202A", "#16A085"],
    matrix: ["#13966A", "#D9F3E9", "#17202A", "#2563EB"],
    "deep-space": ["#7C3AED", "#EADCFF", "#171F2A", "#14B8A6"],
    "morning-mist": ["#C05621", "#F7E5D6", "#17202A", "#2563EB"]
  }
};

const deckTypeCopy = {
  "zh-CN": {
    "brand-marketing": "品牌营销",
    "business-report": "商务汇报",
    "community-sharing": "社群分享",
    "data-analysis": "数据分析",
    "event-promotion": "活动宣发",
    "fundraising-pitch": "融资路演",
    "growth-experiment": "增长实验",
    "industry-insight": "行业洞察",
    "knowledge-sharing": "知识科普",
    "operation-plan": "运营方案",
    "personal-review": "个人述职",
    portfolio: "作品集",
    product: "产品发布",
    "product-launch": "产品发布",
    "project-plan": "项目计划",
    proposal: "方案提案",
    "research-report": "研究报告",
    "retrospective-summary": "复盘总结",
    "sales-proposal": "销售提案",
    "teaching-deck": "教学课件",
    "training-course": "课程培训"
  },
  "en-US": {
    "brand-marketing": "Brand marketing",
    "business-report": "Business report",
    "community-sharing": "Community sharing",
    "data-analysis": "Data analysis",
    "event-promotion": "Event promotion",
    "fundraising-pitch": "Fundraising pitch",
    "growth-experiment": "Growth experiment",
    "industry-insight": "Industry insight",
    "knowledge-sharing": "Knowledge sharing",
    "operation-plan": "Operation plan",
    "personal-review": "Personal review",
    portfolio: "Portfolio",
    product: "Product launch",
    "product-launch": "Product launch",
    "project-plan": "Project plan",
    proposal: "Proposal",
    "research-report": "Research report",
    "retrospective-summary": "Retrospective summary",
    "sales-proposal": "Sales proposal",
    "teaching-deck": "Teaching deck",
    "training-course": "Training course"
  }
};

const slideTitles = {
  "zh-CN": [
    "开场定位",
    "核心问题",
    "关键判断",
    "方案路径",
    "证据支撑",
    "执行节奏",
    "风险回应",
    "下一步行动"
  ],
  "en-US": [
    "Opening Frame",
    "Core Problem",
    "Key Judgment",
    "Solution Path",
    "Evidence",
    "Execution Rhythm",
    "Risk Response",
    "Next Action"
  ]
};

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

function buildSourceTextFromIntent(input: DeckOutlineIntentInput) {
  const sections = [
    ["创作想法", input.idea],
    ["补充文本", input.sourceText],
    ...input.textFiles.map((file) => [`文件：${file.name}`, file.content] as const)
  ]
    .filter(([, content]) => content.trim().length > 0)
    .map(([title, content]) => `【${title}】\n${content.trim()}`);
  const merged = sections.join("\n\n").replace(/\s+\n/g, "\n").trim();

  return merged.length > 12000 ? merged.slice(0, 12000) : merged;
}

export function buildMockDeckIntentAnalysis(
  input: DeckOutlineIntentInput
): DeckIntentAnalysisResult {
  const isChinese = input.locale === "zh-CN";
  const sourceText = buildSourceTextFromIntent(input);
  const compact = compactText(sourceText, isChinese ? 80 : 120);
  const recommendedPageCount =
    input.pageCount ?? (sourceText.length > 1800 ? 8 : sourceText.length > 900 ? 6 : 5);
  const titleSeed = compactText(sourceText, isChinese ? 28 : 42);
  const slides = Array.from({ length: recommendedPageCount }, (_, slideIndex) => {
    const index = slideIndex + 1;
    const titlePool = slideTitles[input.locale];
    const title = titlePool[slideIndex] ?? titlePool[titlePool.length - 1];

    return {
      slideId: `slide-${index}`,
      index,
      title,
      purpose: isChinese
        ? `说明第 ${index} 页与整体表达目标的关系。`
        : `Explain how slide ${index} supports the overall goal.`,
      keyMessage: isChinese
        ? `围绕“${compactText(compact, 60)}”提炼第 ${index} 个结构重点。`
        : `Extract structure point ${index} from "${compactText(compact, 80)}".`,
      visualDirection: isChinese
        ? "使用清晰主视觉配合简洁文字，形成稳定阅读顺序。"
        : "Use a clear hero visual with concise text and stable reading order."
    };
  });

  return deckIntentAnalysisResultSchema.parse({
    input,
    fileSummaries: input.textFiles.map((file) => ({
      characterCount: file.content.length,
      name: file.name,
      size: file.size,
      summary: compactText(file.content, 220),
      snippets: buildTextSnippets(file.content)
    })),
    deckType: input.deckType,
    audience: isChinese ? "通用受众" : "general audience",
    goal: isChinese ? "清晰传达核心内容" : "communicate the core message clearly",
    coreMessage: isChinese
      ? `围绕“${compact}”提炼一条清晰、可被记住的核心表达。`
      : `Turn "${compact}" into one clear, memorable core message.`,
    recommendedPageCount,
    structureOutline: {
      deckTitle: isChinese ? `${titleSeed}｜结构大纲` : `${titleSeed} | Outline`,
      deckSummary: isChinese
        ? `围绕输入内容组织 ${recommendedPageCount} 页结构大纲，先确认表达目标，再扩展详细文案。`
        : `A ${recommendedPageCount}-slide structure outline for confirmation before detailed copy generation.`,
      slides
    }
  });
}

function buildTextSnippets(text: string) {
  return text
    .split(/\n{2,}|(?<=[。！？.!?])\s+/)
    .map((item) => compactText(item, 360))
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

export function buildMockAnalyzedDeck(input: AnalyzeDeckRequest): AnalyzedDeckResult {
  const locale = input.locale;
  const deckTypeName = deckTypeCopy[locale][input.deckType];
  const pptTypeVisualTone = getPptTypeVisualTone(input.deckType, locale);
  const titleSeed = compactText(input.sourceText, locale === "zh-CN" ? 28 : 42);
  const isChinese = locale === "zh-CN";
  const palette = paletteCopy[locale][input.palette];
  const deckTitle =
    isChinese
      ? `${titleSeed}｜${deckTypeName}`
      : `${titleSeed} | ${deckTypeName}`;

  const unifiedVisualSpec = {
    themeName:
      isChinese
        ? `统一视觉：${deckTypeName}`
        : `Unified Visual: ${deckTypeName}`,
    visualStyle:
      isChinese
        ? `面向${deckTypeName}场景，保持清晰层级、克制装饰和稳定留白，突出每页一个中心判断。`
        : `For a ${deckTypeName} scenario, keep clear hierarchy, restrained decoration, and stable spacing to keep one core point per slide.`,
    colorPalette: palette,
    typography:
      isChinese
        ? "标题使用有力量的黑体气质，正文保持高可读性和中等行距。"
        : "Use strong sans-serif titles with readable body text and moderate line height.",
    imageStyle:
      isChinese
        ? "图片图层应像产品级视觉素材，透明背景、边缘干净、避免复杂文字。"
        : "Generated image layers should feel product-grade, transparent, clean-edged, and avoid dense text.",
    layoutRules:
      isChinese
        ? [
            "16:9 横版画布，13.333 x 7.5 英寸",
            "重要文字放在 0.5 英寸安全边距内",
            "基于 12 栏栅格进行自动排版",
            "图片图层不遮挡标题"
          ]
        : [
            "Use a 16:9 canvas, 13.333 x 7.5 inches",
            "Keep important text within the 0.5-inch safe margin",
            "Align automatic layouts to a 12-column grid",
            "Image layers must not cover titles"
          ],
    consistencyRules:
      isChinese
        ? [
            "所有页面沿用同一色板",
            "正文色和背景色对比度不得低于 4.5:1",
            "图层阴影和圆角保持一致",
            "每页最多一个主视觉"
          ]
        : [
            "Reuse one palette across slides",
            "Keep body text/background contrast at 4.5:1 or higher",
            "Keep shadows and radii consistent",
            "Use at most one hero visual per slide"
          ],
    forbiddenRules:
      isChinese
        ? [
            "不要生成密集小字图片",
            "不要使用与主题无关的装饰",
            "装饰色不能用于大段正文",
            "背景图不得包含高对比文字区域"
          ]
        : [
            "Do not generate dense text inside images",
            "Do not use unrelated decoration",
            "Do not use decorative colors for long body copy",
            "Background images must not contain high-contrast text areas"
          ],
    pageSpec: {
      aspectRatio: "16:9" as const,
      gridColumns: 12 as const,
      height: 7.5 as const,
      layoutInstruction: isChinese
        ? "这是一页 16:9 的 PPT，宽 13.333 英寸、高 7.5 英寸，内容避开四周 0.5 英寸安全边距，并基于 12 栏栅格自动排版。"
        : "Use a 16:9 PPT slide, 13.333 inches wide and 7.5 inches high. Keep content away from the 0.5-inch safe margin and align layout to a 12-column grid.",
      safeMargin: 0.5 as const,
      unit: "inch" as const,
      width: 13.333 as const
    },
    typographyRules: {
      defaultFontSize: 15,
      fontFallback: isChinese
        ? ["Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Arial", "sans-serif"]
        : ["Inter", "Arial", "Helvetica", "Microsoft YaHei", "sans-serif"],
      lineHeight: 1.25,
      maxLines: 8,
      minFontSize: 8,
      scale: {
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
          usage: isChinese ? "页面标题和章节标题。" : "Slide and section titles."
        },
        body: {
          fontSize: 15,
          fontWeight: "regular",
          lineHeight: 1.28,
          usage: isChinese ? "正文要点和说明文字。" : "Body bullets and explanatory copy."
        },
        annotation: {
          fontSize: 9,
          fontWeight: "regular",
          lineHeight: 1.22,
          usage: isChinese ? "来源、脚注和单位说明。" : "Sources, footnotes, and unit notes."
        },
        chartLabel: {
          fontSize: 10,
          fontWeight: "medium",
          lineHeight: 1.18,
          usage: isChinese ? "图表坐标、标签和图例。" : "Chart axes, labels, and legends."
        }
      }
    },
    colorRoles: {
      accent: isChinese
        ? `${palette[0]} 用于关键强调、图表主色和少量行动提示。`
        : `${palette[0]} for key emphasis, chart primary marks, and limited action cues.`,
      background: isChinese
        ? `${palette[1]} 用于浅色背景或大面积柔和底色。`
        : `${palette[1]} for light backgrounds or large soft surfaces.`,
      bodyText: isChinese
        ? `${palette[2]} 用于正文和主要信息，正文色和背景色对比度不得低于 4.5:1。`
        : `${palette[2]} for body copy and primary information with at least 4.5:1 contrast against the background.`,
      chart: isChinese
        ? `${palette[0]} 与 ${palette[3]} 用于图表主次序列。`
        : `${palette[0]} and ${palette[3]} for primary and secondary chart series.`,
      contrastRequirement: isChinese
        ? "正文色和背景色对比度不得低于 4.5:1；装饰色不能用于大段正文。"
        : "Body text and background contrast must be at least 4.5:1; decorative colors must not be used for long body copy.",
      decorative: isChinese
        ? `${palette[3]} 仅用于线条、图标或小面积装饰，不能承载大段正文。`
        : `${palette[3]} only for lines, icons, or small decorative areas, not long body copy.`,
      highlight: isChinese
        ? `${palette[0]} 每页最多使用 1-2 处，用于真正需要聚焦的信息。`
        : `${palette[0]} use at most 1-2 times per slide for information that truly needs focus.`,
      surface: isChinese
        ? `${palette[1]} 的浅层变化用于卡片、表格底和信息分区。`
        : `Soft variations of ${palette[1]} for cards, tables, and content zones.`,
      titleText: isChinese
        ? `${palette[2]} 用于标题和结论句。`
        : `${palette[2]} for titles and conclusion statements.`
    },
    imageRules: {
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
    },
    pptTypeVisualTone,
    informationDensityRules: isChinese
      ? {
          defaultLevel: input.deckType === "brand-marketing" ? "low" : input.deckType === "research-report" || input.deckType === "data-analysis" ? "high" : "medium",
          businessReport: "商务汇报每页 1 个结论、2-4 个证据点。",
          trainingCourse: "课程培训每页只推进一个知识点，保留例子和小结。",
          brandMarketing: "品牌营销降低文字密度，强化主视觉和价值短句。",
          researchReport: "研究报告允许较高密度，但必须用图表和来源层级分隔。"
        }
      : {
          defaultLevel: input.deckType === "brand-marketing" ? "low" : input.deckType === "research-report" || input.deckType === "data-analysis" ? "high" : "medium",
          businessReport: "Use one conclusion and 2-4 evidence points per business slide.",
          trainingCourse: "Advance one learning point per slide with examples and recap.",
          brandMarketing: "Keep copy light and emphasize hero visuals and value lines.",
          researchReport: "Research slides may be denser but must separate charts and sources clearly."
        },
    spacingRules: isChinese
      ? {
          pageMargin: "重要内容保持在 0.5 英寸安全边距内。",
          sectionGap: "标题、正文、图表、注释之间保持明确区块间距。",
          elementGap: "同类元素保持一致间距，卡片和指标组按栅格对齐。",
          whitespace: "留白用于强调层级，避免拥挤或松散。"
        }
      : {
          pageMargin: "Keep important content inside the 0.5-inch safe margin.",
          sectionGap: "Maintain clear gaps between titles, body, charts, and notes.",
          elementGap: "Keep spacing consistent and align cards or metrics to the grid.",
          whitespace: "Use whitespace to clarify hierarchy without crowding or looseness."
        },
    chartVisualRules: isChinese
      ? {
          chartTypes: "按数据关系选择柱状、折线、矩阵、表格或指标卡。",
          axisAndGrid: "坐标轴和网格线保持浅色、少量、低干扰。",
          labelRules: "图表标签统一字号，单位和口径靠近数据。",
          colorUsage: "主序列使用强调色，次序列使用中性色或辅助色。",
          sourceNotes: "外部数据和研究结论需在图表下方或页脚标注来源。"
        }
      : {
          chartTypes: "Choose bars, lines, matrices, tables, or metric cards by data relationship.",
          axisAndGrid: "Keep axes and gridlines light, sparse, and low-noise.",
          labelRules: "Use consistent label sizes and keep units and definitions near data.",
          colorUsage: "Use accent for primary series and neutral/support colors for secondary series.",
          sourceNotes: "External data and research claims need source notes under charts or in footers."
        },
    imageIllustrationRules: isChinese
      ? {
          style: "图片/插画保持干净、统一、低噪声，不生成含文字的复杂素材。",
          composition: "主视觉每页最多一个，主体避开标题区和关键文字区。",
          background: "背景图低对比、可承托文字，不使用复杂纹理。",
          consistency: "整套素材保持同一摄影/插画风格、光线和边缘处理。"
        }
      : {
          style: "Images/illustrations stay clean, unified, low-noise, and free of dense text.",
          composition: "Use at most one hero visual per slide and keep subjects away from title and key text areas.",
          background: "Backgrounds stay low-contrast and text-supporting without complex texture.",
          consistency: "Keep one photo/illustration style, lighting, and edge treatment across the deck."
        },
    iconStyleRules: isChinese
      ? {
          style: "line",
          stroke: "线性图标使用 1.5-2px 等效线宽。",
          usage: "图标只辅助识别概念或步骤，不替代正文结论。",
          consistency: "整套图标保持单色或双色体系，不混用线性和面性。"
        }
      : {
          style: "line",
          stroke: "Line icons use an equivalent 1.5-2px stroke.",
          usage: "Icons support concept or step recognition and never replace the conclusion.",
          consistency: "Keep icons monochrome or duotone and do not mix line and filled styles."
        },
    emphasisRules: isChinese
      ? {
          highlight: "高亮只用于真正需要聚焦的信息，每页最多 1-2 处。",
          keyNumbers: "重点数字使用更大字号、强调色或指标卡承载。",
          keywords: "关键词可用加粗、强调色或浅底标签。",
          conclusion: "结论句优先放在标题下或正文起始位置。"
        }
      : {
          highlight: "Highlight only truly focal information, at most 1-2 instances per slide.",
          keyNumbers: "Key numbers use larger type, accent color, or metric cards.",
          keywords: "Keywords may use bold, accent color, or soft tags.",
          conclusion: "Place conclusion statements under titles or at the start of body copy."
        },
    forbiddenVisualRules: isChinese
      ? [
          "避免高饱和大面积撞色。",
          "避免过度阴影、厚重发光和复杂背景。",
          "避免在图片内生成密集文字或水印。",
          "避免动画滥用。",
          "避免所有页面保持同一信息密度。"
        ]
      : [
          "Avoid large areas of high-saturation clashing colors.",
          "Avoid excessive shadows, heavy glows, and complex backgrounds.",
          "Avoid dense text or watermarks inside images.",
          "Avoid overusing animation.",
          "Avoid giving every slide the same information density."
        ]
  } satisfies UnifiedVisualSpec;

  const slides = Array.from({ length: input.pageCount }, (_, slideIndex) => {
    const index = slideIndex + 1;
    const slideId = `slide-${index}`;
    const titlePool = slideTitles[locale];
    const title = titlePool[slideIndex] ?? titlePool[titlePool.length - 1];
    const bodyPoints = isChinese
      ? [
          `围绕“${compactText(input.goal, 42)}”组织本页信息。`,
          `承接核心信息：${compactText(input.coreMessage, 48)}。`,
          `面向${compactText(input.audience, 32)}说明关键判断。`,
          `从原始文本中提炼第 ${index} 个表达重点。`
        ]
      : [
          `Organize this slide around "${compactText(input.goal, 52)}".`,
          `Carry the core message: ${compactText(input.coreMessage, 58)}.`,
          `Explain the key point for ${compactText(input.audience, 42)}.`,
          `Extract focus point ${index} from the source text.`
        ];

    const coreStatement = bodyPoints[0];
    const content = {
      slideId,
      index,
      title,
      subtitle: isChinese ? `第 ${index} 页内容拆解` : `Slide ${index} content split`,
      bodyPoints,
      speakerGoal: isChinese
        ? `让${input.audience}理解本页与整体目标的关系。`
        : `Help ${input.audience} understand how this slide supports the overall goal.`,
      visualIntent: isChinese
        ? "使用一个主视觉图层配合文字信息，形成清晰阅读顺序。"
        : "Use one hero visual layer with text blocks to create a clear reading order.",
      coreStatement,
      narrativeRole:
        index === 1
          ? "setup"
          : index === input.pageCount
            ? "call-to-action"
            : index === input.pageCount - 1
              ? "summary"
              : index === Math.ceil(input.pageCount / 2)
                ? "turning-point"
                : "argument",
      contentLayers: {
        primary: [coreStatement],
        supporting: bodyPoints.slice(1),
        supplementary: [
          isChinese
            ? `面向${compactText(input.audience, 32)}的辅助说明。`
            : `Supporting context for ${compactText(input.audience, 42)}.`
        ]
      },
      slideTransition: {
        fromPrevious:
          slideIndex === 0
            ? isChinese
              ? "作为开场页，先建立主题边界和阅读预期。"
              : "As the opening slide, establish the topic boundary and reading expectation."
            : isChinese
              ? `承接上一页“${titlePool[slideIndex - 1] ?? ""}”。`
              : `Continue from "${titlePool[slideIndex - 1] ?? ""}".`,
        toNext:
          slideIndex === input.pageCount - 1
            ? isChinese
              ? "收束整套表达，并提示后续行动。"
              : "Close the deck and cue follow-up action."
            : isChinese
              ? `自然引出下一页“${titlePool[slideIndex + 1] ?? title}”。`
              : `Lead naturally into "${titlePool[slideIndex + 1] ?? title}".`
      },
      explanationDepth:
        index === input.pageCount
          ? "summary"
          : index === 1 || index === Math.ceil(input.pageCount / 2)
            ? "transition"
            : "focus",
      sourceRequirement: {
        required: true,
        categories: ["user-input"],
        note: isChinese
          ? "本页主要基于用户输入；涉及数据或引用时在页脚标注来源。"
          : "This slide mainly uses user input; cite sources in the footer when data or quotes appear."
      },
      adaptationRules: {
        splitWhen: isChinese
          ? "当正文要点超过 5 条或出现两个以上结论时拆页。"
          : "Split when body points exceed five or more than two conclusions compete.",
        splitCandidates: bodyPoints.slice(1, 4),
        mergeWhen: isChinese
          ? "当只剩一个支撑点且没有独立图表时可与相邻页合并。"
          : "Merge when only one support point remains and no standalone chart is needed.",
        mergeWith: titlePool[slideIndex + 1] ?? titlePool[slideIndex - 1] ?? title
      },
      audienceFocus: {
        lens:
          input.deckType === "training-course" || input.deckType === "teaching-deck"
            ? "teaching-understanding"
            : input.deckType === "research-report" || input.deckType === "data-analysis"
              ? "research-evidence"
              : input.deckType === "sales-proposal" || input.deckType === "brand-marketing"
                ? "sales-value"
                : "business-conclusion",
        focus: isChinese
          ? "围绕受众最关心的结论、价值或证据组织信息。"
          : "Organize information around the audience's conclusion, value, or evidence needs."
      },
      viewerObjective: {
        type: index === input.pageCount ? "act" : "understand",
        description: isChinese
          ? `看完本页后，观众应该理解：${compactText(coreStatement, 80)}`
          : `After this slide, the audience should understand: ${compactText(coreStatement, 90)}`
      },
      contentBoundary: {
        inScope: isChinese
          ? `本页只展开“${title}”相关的核心观点和必要支撑。`
          : `This slide only expands the core point and necessary support for "${title}".`,
        outOfScope: isChinese
          ? ["不展开无关背景", "不重复整套方案细节", "不加入未经说明的数据来源"]
          : ["Do not expand unrelated background", "Do not repeat full deck details", "Do not add unexplained data sources"]
      }
    } satisfies SlideContent;

    return buildMockSlideCompositionPlanFromContent({
      input,
      slide: content,
      unifiedVisualSpec
    });
  });

  return {
    mode: "mock",
    deckTitle,
    deckSummary:
      locale === "zh-CN"
        ? `面向${input.audience}的${deckTypeName}，围绕“${input.goal}”和“${input.coreMessage}”拆分为 ${input.pageCount} 页结构化演示。`
        : `A ${input.pageCount}-slide ${deckTypeName} deck for ${input.audience}, organized around "${input.goal}" and "${input.coreMessage}".`,
    unifiedVisualSpec,
    slides
  };
}

export function buildMockSlideCompositionPlanFromContent({
  input,
  slide,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  slide: SlideContent;
  unifiedVisualSpec: UnifiedVisualSpec;
}): SlideCompositionPlan {
  return normalizeSlideCompositionPlan(
    composeSlideFromSemanticPlan({
      input,
      semanticPlan: buildSemanticPlanFromSlide({
        input,
        slide,
        unifiedVisualSpec
      }),
      unifiedVisualSpec
    })
  );
}
