import {
  slideCanvasHeight,
  slideCanvasSafeMargin,
  slideCanvasUnit,
  slideCanvasWidth,
  type ImageLayerRequest,
  type SemanticSlideElement,
  type SlideCompositionPlan,
  type SlideElement
} from "@/lib/ai-deck/schema";
import { buildSlideDesignQualityScore } from "@/lib/ai-deck/postprocess";
import {
  buildDefaultDesignConstraints,
  buildDefaultLayoutSelection,
  buildFallbackContentHierarchy
} from "@/lib/ai-deck/semantic-layout";
import type { PptTemplateCategoryId } from "@/lib/admin/templates/categories";

type TemplateDefinition = {
  body: string[];
  designPlan: string;
  elements: SlideElement[];
  imageLayerRequests?: ImageLayerRequest[];
  title: string;
  visualIntent: string;
};

const categoryDefaults: Record<PptTemplateCategoryId, TemplateDefinition> = {
  chapter: {
    title: "章节页",
    body: ["章节核心问题", "承接上一部分并提示下一部分"],
    designPlan: "左侧章节编号与标题，右侧留白",
    visualIntent: "用章节编号和短标题完成演示节奏切换。",
    elements: [
      text("kicker", "章节编号", "PART 01", 1.05, 1.05, 2.6, 0.48, 16, "bold", 20, "badge"),
      text("title", "章节标题", "章节页", 1.05, 2, 6.5, 0.9, 32, "bold", 35, "title"),
      text("body", "章节说明", "章节核心问题\n承接上一部分并提示下一部分", 1.08, 3.18, 5.4, 1.1, 16, "regular", 30, "body"),
      shape("block", "章节色块", 8.2, 1.3, 2.8, 4.7, 10)
    ]
  },
  "cover-title": {
    title: "封面大标题",
    body: ["一句话定义演示主题", "补充副标题或场景说明"],
    designPlan: "封面大标题与右侧主视觉",
    visualIntent: "用强标题和主视觉建立整套 PPT 的第一印象。",
    elements: [
      text("title", "标题", "封面大标题", 0.9, 1, 6.4, 1, 34, "bold", 40, "title"),
      text("subtitle", "副标题", "一句话定义演示主题", 0.95, 2.2, 5.6, 0.72, 18, "medium", 35, "subtitle"),
      shape("accent", "强调色块", 0.95, 3.25, 1.2, 0.16, 12),
      generatedImage("hero", "封面主视觉", 7.2, 0.9, 4.8, 4.8, "hero")
    ],
    imageLayerRequests: [imageRequest("hero", "hero", "封面主视觉")]
  },
  "title-body-points": {
    title: "标题 + 正文/要点",
    body: ["要点一：说明当前判断", "要点二：补充证据", "要点三：给出行动含义"],
    designPlan: "顶部标题与三条正文要点",
    visualIntent: "用清晰标题和要点列表组织标准内容页。",
    elements: [
      text("title", "标题", "标题 + 正文/要点", 0.82, 0.62, 8.4, 0.6, 28, "bold", 35, "title"),
      text("lead", "导语", "用一句判断说明本页主题", 0.9, 1.42, 6.8, 0.55, 16, "medium", 30, "subtitle"),
      shape("card1", "要点卡片", 0.9, 2.3, 3.45, 2.5, 10),
      shape("card2", "要点卡片", 4.95, 2.3, 3.45, 2.5, 10),
      shape("card3", "要点卡片", 9, 2.3, 3.45, 2.5, 10),
      text("point1", "要点一", "要点一\n说明当前判断", 1.25, 2.72, 2.75, 1.38, 16, "medium", 25, "card"),
      text("point2", "要点二", "要点二\n补充关键证据", 5.3, 2.72, 2.75, 1.38, 16, "medium", 25, "card"),
      text("point3", "要点三", "要点三\n给出行动含义", 9.35, 2.72, 2.75, 1.38, 16, "medium", 25, "card")
    ]
  },
  "big-image-background": {
    title: "大图背景",
    body: ["让背景承载情绪和场景", "前景文字保持高对比"],
    designPlan: "全幅背景图与前景标题",
    visualIntent: "用大图建立场景沉浸感。",
    elements: [
      generatedImage("background", "大图背景", 0, 0, 13.333, 7.5, "background"),
      shape("overlay", "文字遮罩", 0.7, 0.75, 5.8, 5.8, 18),
      text("title", "标题", "大图背景", 1.08, 1.5, 4.8, 0.82, 30, "bold", 35, "title"),
      text("body", "说明", "让背景承载情绪和场景\n前景文字保持高对比", 1.1, 2.72, 4.6, 1.2, 16, "regular", 30, "body")
    ],
    imageLayerRequests: [imageRequest("background", "background", "页面背景图", "background")]
  },
  "left-image-right-text": {
    title: "左图右文",
    body: ["右侧承接标题和三条信息", "左侧图片负责场景表达"],
    designPlan: "左侧主视觉，右侧文本",
    visualIntent: "图片先吸引注意，再阅读右侧观点。",
    elements: [
      generatedImage("image", "左侧图片", 0.82, 1, 5.4, 4.95, "image"),
      text("title", "标题", "左图右文", 7.05, 1.12, 4.8, 0.72, 28, "bold", 35, "title"),
      text("body", "正文", "右侧承接标题和三条信息\n左侧图片负责场景表达", 7.08, 2.18, 4.65, 2.5, 16, "regular", 30, "body"),
      shape("line", "右侧强调线", 7.08, 5.1, 2.4, 0.12, 12)
    ],
    imageLayerRequests: [imageRequest("image", "image", "左侧主视觉")]
  },
  "left-text-right-image": {
    title: "左文右图",
    body: ["左侧先给出判断", "右侧图片强化信息"],
    designPlan: "左侧文本，右侧主视觉",
    visualIntent: "从观点进入，再用图像强化理解。",
    elements: [
      text("title", "标题", "左文右图", 0.9, 1, 5.6, 0.75, 28, "bold", 35, "title"),
      text("body", "正文", "左侧先给出判断\n右侧图片强化信息", 0.94, 2.05, 5.2, 2.7, 16, "regular", 30, "body"),
      generatedImage("image", "右侧图片", 7.1, 1, 4.9, 4.95, "image"),
      shape("line", "左侧强调线", 0.95, 5.25, 2.3, 0.12, 12)
    ],
    imageLayerRequests: [imageRequest("image", "image", "右侧主视觉")]
  },
  "left-text-right-chart": {
    title: "左文右图表",
    body: ["左侧说明结论", "右侧放置图表占位"],
    designPlan: "左侧结论，右侧图表",
    visualIntent: "让数据图表支撑左侧判断。",
    elements: [
      text("title", "标题", "左文右图表", 0.9, 0.9, 5.4, 0.75, 27, "bold", 35, "title"),
      text("body", "正文", "左侧说明结论\n右侧放置图表占位", 0.94, 1.95, 4.9, 2.7, 16, "regular", 30, "body"),
      chart("chart", "右侧图表", 6.7, 1.15, 5.25, 4.35, 18),
      shape("axis", "图表底线", 7.1, 5.18, 4.45, 0.1, 22)
    ]
  },
  "big-chart": {
    title: "大图表",
    body: ["用图表承载主要证据", "标题只保留结论"],
    designPlan: "顶部结论标题，下方大图表",
    visualIntent: "让图表成为页面主体。",
    elements: [
      text("title", "标题", "大图表", 0.82, 0.55, 8.8, 0.6, 26, "bold", 35, "title"),
      chart("chart", "大图表", 0.9, 1.45, 11.5, 4.85, 20),
      text("caption", "图表注释", "数据口径 / 来源说明", 0.92, 6.45, 5.5, 0.35, 12, "regular", 25, "footer")
    ]
  },
  "two-column-compare": {
    title: "双栏对比",
    body: ["左侧呈现现状或方案 A", "右侧呈现目标或方案 B"],
    designPlan: "左右双栏对比",
    visualIntent: "用对称结构强化差异。",
    elements: [
      text("title", "标题", "双栏对比", 0.82, 0.62, 7.8, 0.6, 26, "bold", 35, "title"),
      shape("left-card", "左栏背景", 0.9, 1.55, 5.45, 4.6, 10),
      shape("right-card", "右栏背景", 7, 1.55, 5.45, 4.6, 10),
      text("left", "左栏", "方案 A\n关键特征\n约束条件", 1.3, 2.05, 4.5, 2.9, 17, "medium", 25, "card"),
      text("right", "右栏", "方案 B\n关键收益\n行动建议", 7.4, 2.05, 4.5, 2.9, 17, "medium", 25, "card")
    ]
  },
  quote: {
    title: "引用/金句页",
    body: ["把最重要的一句话放大", "注明来源或语境"],
    designPlan: "居中引用句与来源",
    visualIntent: "用留白和大字号强调金句。",
    elements: [
      text("quote", "引用", "“把最重要的一句话放大。”", 2.05, 2, 9.25, 1.15, 32, "bold", 35, "title", "center"),
      text("source", "来源", "来源 / 场景说明", 4.1, 3.58, 5.1, 0.42, 14, "regular", 25, "footer", "center"),
      shape("mark-left", "引用符号", 1.45, 1.45, 0.55, 0.55, 10),
      shape("mark-right", "引用符号", 11.35, 4.1, 0.55, 0.55, 10)
    ]
  },
  "time-axis": {
    title: "时间轴",
    body: ["2024：启动", "2025：验证", "2026：规模化"],
    designPlan: "横向时间轴与关键节点",
    visualIntent: "展示事件或阶段沿时间顺序推进。",
    elements: [
      text("title", "标题", "时间轴", 0.82, 0.62, 7.8, 0.6, 26, "bold", 35, "title"),
      shape("line", "时间轴", 1.25, 3.55, 10.8, 0.12, 10),
      text("node1", "节点一", "2024\n启动", 1.15, 2.25, 2.6, 1.1, 16, "bold", 24, "card", "center"),
      text("node2", "节点二", "2025\n验证", 5.35, 3.95, 2.6, 1.1, 16, "bold", 24, "card", "center"),
      text("node3", "节点三", "2026\n规模化", 9.35, 2.25, 2.6, 1.1, 16, "bold", 24, "card", "center")
    ]
  },
  "process-steps": {
    title: "流程/步骤",
    body: ["第一步：输入想法", "第二步：生成结构", "第三步：导出演示"],
    designPlan: "三段式步骤流程",
    visualIntent: "用连续步骤说明操作流程或方法路径。",
    elements: [
      text("title", "标题", "流程/步骤", 0.82, 0.62, 7.8, 0.6, 26, "bold", 35, "title"),
      shape("step1-card", "步骤卡片", 0.9, 2, 3.25, 2.35, 10),
      shape("step2-card", "步骤卡片", 5.05, 2, 3.25, 2.35, 10),
      shape("step3-card", "步骤卡片", 9.2, 2, 3.25, 2.35, 10),
      text("step1", "第一步", "01\n输入想法", 1.25, 2.45, 2.45, 1.25, 18, "bold", 25, "card", "center"),
      text("step2", "第二步", "02\n生成结构", 5.4, 2.45, 2.45, 1.25, 18, "bold", 25, "card", "center"),
      text("step3", "第三步", "03\n导出演示", 9.55, 2.45, 2.45, 1.25, 18, "bold", 25, "card", "center"),
      shape("connector1", "流程连接线", 4.25, 3.12, 0.62, 0.1, 20),
      shape("connector2", "流程连接线", 8.4, 3.12, 0.62, 0.1, 20)
    ]
  },
  "key-metrics": {
    title: "关键指标页",
    body: ["用一个关键数字承载结论", "补充数字背后的业务含义"],
    designPlan: "关键数字 + 指标解释",
    visualIntent: "用指标形成强记忆点。",
    elements: [
      text("number", "关键指标", "86%", 0.95, 1.35, 5.15, 1.35, 40, "bold", 45, "badge"),
      text("title", "结论", "关键指标页", 0.98, 3.05, 5.9, 0.62, 26, "bold", 35, "title"),
      text("body", "解释", "用一个关键数字承载结论\n补充数字背后的业务含义", 1.02, 4.05, 5.8, 1.3, 16, "regular", 30, "body"),
      shape("panel", "右侧背景", 7.5, 0.9, 4.4, 5.4, 8)
    ]
  },
  "quadrant-matrix": {
    title: "四象限/矩阵",
    body: ["高价值 / 高紧急", "高价值 / 低紧急", "低价值 / 高紧急", "低价值 / 低紧急"],
    designPlan: "二维矩阵与四象限标签",
    visualIntent: "用横纵坐标帮助比较和决策。",
    elements: [
      text("title", "标题", "四象限/矩阵", 0.82, 0.62, 7.8, 0.6, 26, "bold", 35, "title"),
      shape("matrix", "矩阵底", 2.35, 1.45, 8.6, 5, 8),
      shape("vertical-axis", "纵轴", 6.62, 1.62, 0.08, 4.66, 18),
      shape("horizontal-axis", "横轴", 2.52, 3.9, 8.26, 0.08, 18),
      text("q1", "象限一", "高价值\n高紧急", 3.05, 2.12, 2.55, 0.9, 16, "bold", 25, "card", "center"),
      text("q2", "象限二", "高价值\n低紧急", 7.45, 2.12, 2.55, 0.9, 16, "bold", 25, "card", "center"),
      text("q3", "象限三", "低价值\n高紧急", 3.05, 4.45, 2.55, 0.9, 16, "bold", 25, "card", "center"),
      text("q4", "象限四", "低价值\n低紧急", 7.45, 4.45, 2.55, 0.9, 16, "bold", 25, "card", "center")
    ]
  },
  ending: {
    title: "结束页",
    body: ["总结核心观点", "给出下一步行动"],
    designPlan: "结束语与行动按钮",
    visualIntent: "用简洁收束完成演示。",
    elements: [
      text("title", "结束语", "谢谢观看", 2.5, 2.1, 8.2, 0.95, 36, "bold", 35, "title", "center"),
      text("body", "下一步", "总结核心观点\n给出下一步行动", 3.6, 3.32, 6, 1.05, 16, "regular", 28, "body", "center"),
      shape("button", "行动按钮", 5.3, 5.05, 2.8, 0.58, 12)
    ]
  }
};

export function buildDefaultTemplateSlide(
  category: PptTemplateCategoryId
): SlideCompositionPlan {
  const definition = categoryDefaults[category];
  const slideId = `template-${category}`;
  const content = {
    slideId,
    index: 1,
    title: definition.title,
    subtitle: definition.designPlan,
    bodyPoints: definition.body,
    speakerGoal: "帮助管理员快速搭建可复用的 PPT 页面模板。",
    visualIntent: definition.visualIntent,
    coreStatement: definition.body[0] ?? definition.title,
    narrativeRole: "setup",
    contentLayers: {
      primary: [definition.body[0] ?? definition.title],
      supporting: definition.body.slice(1),
      supplementary: [definition.designPlan]
    },
    slideTransition: {
      fromPrevious: "作为模板示例页，先展示版式核心能力。",
      toNext: "可继续扩展为同类型页面或相邻内容页。"
    },
    explanationDepth: "supporting",
    sourceRequirement: {
      required: false,
      categories: ["user-input"],
      note: "模板示例不强制注明外部来源。"
    },
    adaptationRules: {
      splitWhen: "当模板内容超过 5 个模块时拆为多页模板。",
      splitCandidates: definition.body.slice(0, 3),
      mergeWhen: "当只保留一个模块时可与相邻模板合并。",
      mergeWith: "相邻模板页"
    },
    audienceFocus: {
      lens: "business-conclusion",
      focus: "管理员关注模板是否能快速复用、结构是否清晰。"
    },
    viewerObjective: {
      type: "understand",
      description: "看完本页后，管理员应理解模板的适用场景和可复用结构。"
    },
    contentBoundary: {
      inScope: "只展示模板结构、占位内容和视觉意图。",
      outOfScope: ["不展开真实业务内容", "不引入外部数据"]
    }
  } satisfies SlideCompositionPlan["content"];
  const pageIntent = {
    audienceTakeaway: definition.body[0] ?? definition.visualIntent,
    contentDensity: definition.body.length >= 4 ? "high" : "medium",
    coreMessage: definition.body[0] ?? definition.title,
    pageRole: templatePageRole(category),
    primaryGoal: templatePrimaryGoal(category)
  } satisfies SlideCompositionPlan["pageIntent"];
  const semanticElements = buildTemplateSemanticElements({
    category,
    definition,
    slideId
  });
  const fallbackInput = {
    sourceText: definition.body.join("\n"),
    audience: "管理员",
    coreMessage: pageIntent.coreMessage,
    deckType: "business-report",
    goal: definition.visualIntent,
    locale: "zh-CN",
    pageCount: 3,
    palette: "star-map"
  } as const;
  const layoutSelection = buildDefaultLayoutSelection({
    input: fallbackInput,
    pageIntent,
    slide: content
  });
  const constraints = buildDefaultDesignConstraints({
    input: fallbackInput,
    pageIntent,
    slide: content
  });
  const baseSlide = {
    slideId,
    index: 1,
    content,
    pageIntent,
    contentHierarchy: buildFallbackContentHierarchy({
      input: fallbackInput,
      pageIntent,
      slide: content
    }),
    layoutSelection: {
      ...layoutSelection,
      candidates: [
        {
          fitReason: "模板分类与当前版式完全一致。",
          layoutType: category,
          risk: "替换内容后需要复核文字长度。",
          score: 96
        },
        ...layoutSelection.candidates.filter((candidate) => candidate.layoutType !== category)
      ].slice(0, 3),
      selectedLayoutType: category,
      selectionReason: `管理员模板固定使用 ${category} 版式。`
    },
    constraints,
    expressionIntent: definition.visualIntent,
    designPlan: {
      expressionIntent: definition.visualIntent,
      layoutTemplate: category,
      readingOrder: semanticElements.map((element) => element.id),
      visualStrategy: definition.designPlan
    },
    layoutDiagnostics: {
      density: 0.48,
      hasOverflow: false,
      needsUserConfirmation: false,
      overflowFixes: [],
      warnings: []
    },
    semanticElements,
    canvas: {
      aspectRatio: "16:9",
      height: slideCanvasHeight,
      safeMargin: slideCanvasSafeMargin,
      unit: slideCanvasUnit,
      width: slideCanvasWidth
    },
    elements: definition.elements,
    imageLayerRequests: definition.imageLayerRequests ?? []
  } satisfies Omit<SlideCompositionPlan, "designQualityScore">;

  return {
    ...baseSlide,
    designQualityScore: buildSlideDesignQualityScore({
      ...baseSlide,
      designQualityScore: {
        dimensions: {
          contentDensity: { score: 0, summary: "等待评分。" },
          expressionCompleteness: { score: 0, summary: "等待评分。" },
          informationHierarchy: { score: 0, summary: "等待评分。" },
          renderability: { score: 0, summary: "等待评分。" },
          visualConsistency: { score: 0, summary: "等待评分。" }
        },
        issues: [],
        repairStatus: "not-needed",
        suggestions: [],
        totalScore: 0
      }
    })
  };
}

function templatePageRole(
  category: PptTemplateCategoryId
): SlideCompositionPlan["pageIntent"]["pageRole"] {
  if (category === "cover-title") {
    return "cover";
  }

  if (category === "chapter") {
    return "section";
  }

  if (category === "big-chart" || category === "left-text-right-chart" || category === "key-metrics") {
    return "data";
  }

  if (category === "two-column-compare" || category === "quadrant-matrix") {
    return "comparison";
  }

  if (category === "process-steps" || category === "time-axis") {
    return "process";
  }

  if (category === "ending") {
    return "summary";
  }

  return "content";
}

function templatePrimaryGoal(
  category: PptTemplateCategoryId
): SlideCompositionPlan["pageIntent"]["primaryGoal"] {
  const pageRole = templatePageRole(category);

  if (pageRole === "comparison") {
    return "compare";
  }

  if (pageRole === "process" || pageRole === "data") {
    return "explain";
  }

  if (pageRole === "summary") {
    return "summarize";
  }

  if (pageRole === "cover") {
    return "spark-interest";
  }

  return "inform";
}

function buildTemplateSemanticElements({
  definition,
  slideId
}: {
  category: PptTemplateCategoryId;
  definition: TemplateDefinition;
  slideId: string;
}): SemanticSlideElement[] {
  const hasImageRequest = Boolean(definition.imageLayerRequests?.length);
  const visualElement: SemanticSlideElement = {
    category: hasImageRequest ? "visual" : "container",
    constraints: ["每页最多一个主视觉中心", "不得遮挡标题"],
    content: definition.visualIntent,
    elementType: hasImageRequest ? "generatedImage" : "shape",
    hierarchyLevel: 2,
    id: `${slideId}-semantic-visual`,
    priority: 3,
    role: "模板视觉中心",
    semanticType: hasImageRequest ? "heroVisual" : "card"
  };

  const elements: SemanticSlideElement[] = [
    {
      category: "text",
      constraints: ["模板主标题，替换内容后仍保持最高层级"],
      content: definition.title,
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slideId}-semantic-title`,
      priority: 1,
      role: "主标题",
      semanticType: "title"
    },
    {
      category: "text",
      constraints: ["承载模板核心结论或说明"],
      content: definition.body[0] ?? definition.visualIntent,
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slideId}-semantic-key-message`,
      priority: 2,
      role: "核心信息",
      semanticType: "subtitle"
    },
    visualElement,
    ...definition.body.slice(0, 5).map((point, index): SemanticSlideElement => ({
      category: "text",
      constraints: ["二级内容，可替换为业务要点"],
      content: point,
      elementType: "text",
      hierarchyLevel: 2,
      id: `${slideId}-semantic-point-${index + 1}`,
      priority: Math.min(5, 3 + index),
      role: `要点 ${index + 1}`,
      semanticType: "body"
    }))
  ];

  return elements.slice(0, 14);
}

function elementId(id: string) {
  return `template-${id}`;
}

function text(
  id: string,
  role: string,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  fontWeight: "regular" | "medium" | "semibold" | "bold",
  zIndex: number,
  semanticType: SlideElement["semanticType"],
  align: "left" | "center" | "right" = "left"
): SlideElement {
  return {
    id: elementId(id),
    type: "text",
    role,
    content,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: semanticType === "title" ? 1 : 2,
    semanticType,
    zIndex,
    styleNotes: "模板文本，可按业务内容替换。",
    requiresImageGeneration: false,
    textStyle: {
      align,
      fontSize,
      fontWeight,
      lineHeight: 1.25,
      maxLines: 6
    }
  };
}

function shape(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number
): SlideElement {
  return {
    id: elementId(id),
    type: "shape",
    role,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: 4,
    semanticType: "accentShape",
    zIndex,
    styleNotes: "强调形状，可作为背景、分隔线或信息卡底。",
    requiresImageGeneration: false
  };
}

function chart(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number
): SlideElement {
  return {
    id: elementId(id),
    type: "chartPlaceholder",
    role,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: 2,
    semanticType: "chart",
    zIndex,
    styleNotes: "图表占位，后续生成时替换为真实图表。",
    requiresImageGeneration: false
  };
}

function generatedImage(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  requestId: string
): SlideElement {
  return {
    id: elementId(id),
    type: "generatedImage",
    role,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: 2,
    imageRequestId: elementId(requestId),
    semanticType: requestId === "background" ? "background" : "heroVisual",
    zIndex: requestId === "background" ? 1 : 20,
    styleNotes: "图片图层占位，保存模板时保留图片生成请求。",
    requiresImageGeneration: true
  };
}

function imageRequest(
  id: string,
  elementIdValue: string,
  purpose: string,
  imageType: ImageLayerRequest["imageType"] = "illustration"
): ImageLayerRequest {
  return {
    id: elementId(id),
    elementId: elementId(elementIdValue),
    purpose,
    imageType,
    keywords: ["PPT模板", purpose],
    prompt: `为 PPT 模板生成${purpose}，画面简洁、专业、无文字。`,
    negativePrompt: "不要文字、不要水印、不要复杂背景、不要低清晰度",
    avoid: "不要文字、不要水印、不要复杂背景、不要低清晰度",
    transparentBackground: imageType !== "background",
    aspectRatio: "16:9",
    visualNotes: "保持专业演示风格，避免复杂文字。"
  };
}
