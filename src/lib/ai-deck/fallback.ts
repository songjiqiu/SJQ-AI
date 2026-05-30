import {
  slideCompositionPlanSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type SlideCompositionPlan,
  type SlideContent,
  type UnifiedVisualSpec
} from "./schema";

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

const styleCopy = {
  "zh-CN": {
    data: "数据论证",
    minimal: "极简商务",
    "problem-solution": "问题方案",
    product: "产品发布",
    retrospective: "复盘总结",
    story: "故事叙事",
    strategic: "战略叙事",
    teaching: "教学讲解",
    "visual-proposal": "视觉提案"
  },
  "en-US": {
    data: "Data argument",
    minimal: "Minimal business",
    "problem-solution": "Problem solution",
    product: "Product launch",
    retrospective: "Retrospective summary",
    story: "Story narrative",
    strategic: "Strategic story",
    teaching: "Teaching flow",
    "visual-proposal": "Visual proposal"
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

export function buildMockAnalyzedDeck(input: AnalyzeDeckRequest): AnalyzedDeckResult {
  const locale = input.locale;
  const styleName = styleCopy[locale][input.style];
  const deckTypeName = deckTypeCopy[locale][input.deckType];
  const titleSeed = compactText(input.sourceText, locale === "zh-CN" ? 28 : 42);
  const deckTitle =
    locale === "zh-CN"
      ? `${titleSeed}｜${deckTypeName}｜${styleName}`
      : `${titleSeed} | ${deckTypeName} | ${styleName}`;

  const unifiedVisualSpec = {
    themeName:
      locale === "zh-CN"
        ? `统一视觉：${deckTypeName}`
        : `Unified Visual: ${deckTypeName}`,
    visualStyle:
      locale === "zh-CN"
        ? `面向${deckTypeName}场景，使用${styleName}表达、清晰层级、克制装饰和稳定留白，突出每页一个中心判断。`
        : `For a ${deckTypeName} scenario, use a ${styleName} expression with clear hierarchy, restrained decoration, and stable spacing to keep one core point per slide.`,
    colorPalette: paletteCopy[locale][input.palette],
    typography:
      locale === "zh-CN"
        ? "标题使用有力量的黑体气质，正文保持高可读性和中等行距。"
        : "Use strong sans-serif titles with readable body text and moderate line height.",
    imageStyle:
      locale === "zh-CN"
        ? "图片图层应像产品级视觉素材，透明背景、边缘干净、避免复杂文字。"
        : "Generated image layers should feel product-grade, transparent, clean-edged, and avoid dense text.",
    layoutRules:
      locale === "zh-CN"
        ? ["16:9 横版画布", "重要文字放在安全边距内", "图片图层不遮挡标题"]
        : ["Use a 16:9 canvas", "Keep important text within safe margins", "Image layers must not cover titles"],
    consistencyRules:
      locale === "zh-CN"
        ? ["所有页面沿用同一色板", "图层阴影和圆角保持一致", "每页最多一个主视觉"]
        : ["Reuse one palette across slides", "Keep shadows and radii consistent", "Use at most one hero visual per slide"],
    forbiddenRules:
      locale === "zh-CN"
        ? ["不要生成密集小字图片", "不要使用与主题无关的装饰"]
        : ["Do not generate dense text inside images", "Do not use unrelated decoration"]
  };

  const slides = Array.from({ length: input.pageCount }, (_, slideIndex) => {
    const index = slideIndex + 1;
    const slideId = `slide-${index}`;
    const titlePool = slideTitles[locale];
    const title = titlePool[slideIndex] ?? titlePool[titlePool.length - 1];
    const isChinese = locale === "zh-CN";
    const bodyPoints = isChinese
      ? [
          `围绕“${compactText(input.goal, 42)}”组织本页信息。`,
          `面向${compactText(input.audience, 32)}说明关键判断。`,
          `从原始文本中提炼第 ${index} 个表达重点。`
        ]
      : [
          `Organize this slide around "${compactText(input.goal, 52)}".`,
          `Explain the key point for ${compactText(input.audience, 42)}.`,
          `Extract focus point ${index} from the source text.`
        ];

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
        : "Use one hero visual layer with text blocks to create a clear reading order."
    };

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
        ? `面向${input.audience}的${deckTypeName}，围绕“${input.goal}”以${styleName}拆分为 ${input.pageCount} 页结构化演示。`
        : `A ${input.pageCount}-slide ${deckTypeName} deck for ${input.audience}, organized around "${input.goal}" with a ${styleName} structure.`,
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
  const isChinese = input.locale === "zh-CN";
  const imageRequestId = `${slide.slideId}-image-main`;
  const visualElementId = `${slide.slideId}-visual`;

  return slideCompositionPlanSchema.parse({
    slideId: slide.slideId,
    index: slide.index,
    content: slide,
    canvas: {
      aspectRatio: "16:9",
      width: 100,
      height: 56.25
    },
    elements: [
      {
        id: `${slide.slideId}-title`,
        type: "text",
        role: isChinese ? "标题" : "Title",
        content: slide.title,
        bounds: { x: 7, y: 7, width: 54, height: 8 },
        zIndex: 30,
        styleNotes: isChinese ? "大号标题，强对比" : "Large title with strong contrast",
        requiresImageGeneration: false
      },
      {
        id: `${slide.slideId}-body`,
        type: "text",
        role: isChinese ? "正文要点" : "Body points",
        content: slide.bodyPoints.join("\n"),
        bounds: { x: 7, y: 18, width: 45, height: 25 },
        zIndex: 30,
        styleNotes: isChinese
          ? "三条以内要点，保持行距"
          : "Up to three points with comfortable line height",
        requiresImageGeneration: false
      },
      {
        id: visualElementId,
        type: "generatedImage",
        role: isChinese ? "主视觉图层" : "Hero image layer",
        bounds: { x: 57, y: 14, width: 34, height: 31 },
        zIndex: 20,
        styleNotes: unifiedVisualSpec.imageStyle,
        requiresImageGeneration: true,
        imageRequestId
      },
      {
        id: `${slide.slideId}-accent`,
        type: "shape",
        role: isChinese ? "强调色块" : "Accent shape",
        bounds: { x: 6, y: 48, width: 88, height: 3 },
        zIndex: 10,
        styleNotes: isChinese
          ? "低对比强调线，统一页脚节奏"
          : "Low-contrast accent line for footer rhythm",
        requiresImageGeneration: false
      }
    ],
    imageLayerRequests: [
      {
        id: imageRequestId,
        elementId: visualElementId,
        purpose: isChinese
          ? "生成本页主视觉透明图层"
          : "Generate the transparent hero visual layer",
        prompt: isChinese
          ? `为PPT第 ${slide.index} 页生成透明背景主视觉：${slide.visualIntent}。统一风格：${unifiedVisualSpec.visualStyle}`
          : `Generate a transparent-background hero visual for slide ${slide.index}: ${slide.visualIntent}. Unified style: ${unifiedVisualSpec.visualStyle}`,
        negativePrompt: isChinese
          ? "不要文字、不要水印、不要复杂背景、不要低清晰度"
          : "No text, no watermark, no complex background, no low-resolution artifacts",
        transparentBackground: true,
        aspectRatio: "16:9",
        visualNotes: unifiedVisualSpec.imageStyle
      }
    ]
  });
}
