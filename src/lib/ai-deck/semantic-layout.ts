import {
  slideCanvasHeight,
  slideCanvasSafeMargin,
  slideCanvasUnit,
  slideCanvasWidth,
  type AnalyzeDeckRequest,
  type ImageLayerRequest,
  type SemanticSlideElement,
  type SemanticSlidePlan,
  type SlideDesignConstraints,
  type SlideLayoutSelection,
  type SlideLayoutType,
  type SlideCompositionPlan,
  type SlideContent,
  type SlideElement,
  type SlidePageIntent,
  type UnifiedVisualSpec
} from "./schema";
import type { PptTemplateDto } from "@/lib/admin/templates/types";

type SlideLayoutKind =
  | "cover"
  | "chapter"
  | "background"
  | "imageLeft"
  | "chartSplit"
  | "bigChart"
  | "data"
  | "comparison"
  | "process"
  | "quote"
  | "timeline"
  | "metrics"
  | "matrix"
  | "compact"
  | "summary"
  | "standard";

const textFallbacks = {
  "zh-CN": {
    audienceTakeaway: "观众应记住本页的核心判断与行动含义。",
    keyMessage: "核心结论",
    mainVisual: "主视觉",
    supportingVisual: "辅助视觉",
    title: "主标题"
  },
  "en-US": {
    audienceTakeaway: "The audience should remember the core judgment and action meaning.",
    keyMessage: "Key message",
    mainVisual: "Hero visual",
    supportingVisual: "Supporting visual",
    title: "Title"
  }
};

function slideContentBlockText(block: SlideContent["contentBlocks"][number]) {
  return block.content ?? block.text;
}

function contentLayerTexts(
  slide: SlideContent,
  group: keyof SlideContent["contentLayers"]
) {
  return slide.contentLayers?.[group].flatMap((index) => {
    const block = slide.contentBlocks[index];

    return block ? [slideContentBlockText(block)] : [];
  }) ?? [];
}

export function buildFallbackPageIntent({
  input,
  slide
}: {
  input: AnalyzeDeckRequest;
  slide: SlideContent;
}): SlidePageIntent {
  const bodyText = slide.bodyPoints.join(" ");
  const pageRole = inferPageRole(slide, bodyText);
  const primaryGoal = inferPrimaryGoal(pageRole, slide, input);
  const contentDensity =
    slide.bodyPoints.length >= 5 || bodyText.length > 220
      ? "high"
      : slide.bodyPoints.length <= 2 && bodyText.length < 120
        ? "low"
        : "medium";

  return {
    audienceTakeaway:
      slide.viewerObjective?.description ||
      slide.speakerGoal ||
      textFallbacks[input.locale].audienceTakeaway,
    contentDensity,
    coreMessage: slide.coreStatement || slide.bodyPoints[0] || slide.title,
    pageRole,
    primaryGoal
  };
}

export function buildFallbackContentHierarchy({
  input,
  pageIntent,
  slide
}: {
  input: AnalyzeDeckRequest;
  pageIntent: SlidePageIntent;
  slide: SlideContent;
}): SlideCompositionPlan["contentHierarchy"] {
  const titleLabel = textFallbacks[input.locale].title;
  const keyMessageLabel = textFallbacks[input.locale].keyMessage;
  const supportingLayerItems = contentLayerTexts(slide, "supporting");
  const primaryLayerItems = contentLayerTexts(slide, "primary");
  const supplementaryLayerItems = contentLayerTexts(slide, "supplementary");
  const supportingItems =
    supportingLayerItems.length > 0
      ? supportingLayerItems
      : slide.bodyPoints;
  const tierTwoItems = supportingItems.slice(0, 5).map((point, index) => ({
    content: point,
    role: input.locale === "zh-CN" ? `要点 ${index + 1}` : `Point ${index + 1}`
  }));
  const tierThreeItems = [
    slide.subtitle
      ? {
          content: slide.subtitle,
          role: input.locale === "zh-CN" ? "副标题" : "Subtitle"
        }
      : null,
    ...supplementaryLayerItems.slice(0, 2).map((item, index) => ({
      content: item,
      role: input.locale === "zh-CN" ? `补充信息 ${index + 1}` : `Supplement ${index + 1}`
    })),
    {
      content: slide.sourceRequirement?.note ?? slide.speakerGoal,
      role: input.locale === "zh-CN" ? "来源/讲解要求" : "Source/speaker note"
    }
  ].filter(Boolean) as Array<{ content: string; role: string }>;

  return {
    primaryMessage: pageIntent.coreMessage,
    levels: [
      {
        label: slide.title,
        level: 1,
        summary: pageIntent.coreMessage
      },
      ...slide.bodyPoints.slice(0, 5).map((point, pointIndex) => ({
        label:
          input.locale === "zh-CN"
            ? `要点 ${pointIndex + 1}`
            : `Point ${pointIndex + 1}`,
        level: 2,
        summary: point
      }))
    ],
    tiers: [
      {
        label: input.locale === "zh-CN" ? "一级信息" : "Tier 1",
        level: 1,
        items: [
          {
            content: slide.title,
            role: titleLabel
          },
          {
            content: primaryLayerItems[0] ?? pageIntent.coreMessage,
            role: keyMessageLabel
          }
        ]
      },
      {
        label: input.locale === "zh-CN" ? "二级信息" : "Tier 2",
        level: 2,
        items: tierTwoItems.length > 0 ? tierTwoItems : [
          {
            content: pageIntent.audienceTakeaway,
            role: keyMessageLabel
          }
        ]
      },
      {
        label: input.locale === "zh-CN" ? "三级信息" : "Tier 3",
        level: 3,
        items:
          tierThreeItems.length > 0
            ? tierThreeItems.slice(0, 4)
            : [
                {
                  content: slide.speakerGoal,
                  role: input.locale === "zh-CN" ? "讲解备注" : "Speaker note"
                }
              ]
      }
    ]
  };
}

export function buildFallbackSemanticElements({
  input,
  pageIntent,
  slide
}: {
  input: AnalyzeDeckRequest;
  pageIntent: SlidePageIntent;
  slide: SlideContent;
}): SemanticSlideElement[] {
  const copy = textFallbacks[input.locale];
  const base: SemanticSlideElement[] = slide.contentBlocks.map((block, index) => ({
    category: semanticElementCategoryForContentBlock(contentBlockSemanticType(block)),
    constraints:
      contentBlockSemanticType(block) === "heading"
        ? ["必须位于安全边距内", "作为页面最高层级信息"]
        : ["必须完整落版为可见元素", "内容文本必须与可展示内容块一致"],
    content: contentBlockText(block),
    contentBlockIndex: index,
    elementType: semanticElementTypeForContentBlock(contentBlockSemanticType(block)),
    hierarchyLevel: block.priority <= 1 ? 1 : block.priority <= 3 ? 2 : 3,
    id:
      contentBlockSemanticType(block) === "heading"
        ? `${slide.slideId}-semantic-title`
        : `${slide.slideId}-semantic-content-block-${index + 1}`,
    priority: block.priority,
    role:
      contentBlockSemanticType(block) === "heading"
        ? copy.title
        : contentBlockSemanticRole(contentBlockSemanticType(block), input.locale, index),
    semanticType: semanticTypeForContentBlock(contentBlockSemanticType(block)),
    styleRole: styleRoleForContentBlock(contentBlockSemanticType(block))
  }));

  if (!base.some((element) => element.semanticType === "title")) {
    base.unshift({
      category: "text",
      constraints: ["必须位于安全边距内", "作为页面最高层级信息"],
      content: slide.title,
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slide.slideId}-semantic-title`,
      priority: 1,
      role: copy.title,
      semanticType: "title",
      styleRole: "page-title"
    });
  }

  if (
    !base.some((element) => element.semanticType === "subtitle") &&
    (slide.coreStatement || pageIntent.coreMessage)
  ) {
    base.push({
      category: "text",
      constraints: ["强化页面核心结论"],
      content: slide.coreStatement || pageIntent.coreMessage,
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slide.slideId}-semantic-key-message`,
      priority: 2,
      role: copy.keyMessage,
      semanticType: "subtitle",
      styleRole: "key-message"
    });
  }

  if (pageIntent.pageRole === "data") {
    base.push({
      category: "infographic",
      constraints: ["突出指标、维度、趋势或对比关系", "避免密集小字"],
      content: contentLayerTexts(slide, "supporting").join("\n") || slide.bodyPoints.join("\n"),
      elementType: "chartPlaceholder",
      hierarchyLevel: 2,
      id: `${slide.slideId}-semantic-chart`,
      priority: 3,
      role: input.locale === "zh-CN" ? "数据图表" : "Data chart",
      semanticType: "chart",
      styleRole: "chart"
    });
  } else if (pageIntent.pageRole === "comparison") {
    base.push({
      category: "infographic",
      constraints: ["识别比较对象、比较维度和差异结论", "左右结构必须对称"],
      content: contentLayerTexts(slide, "supporting").join("\n") || slide.bodyPoints.join("\n"),
      elementType: "shape",
      hierarchyLevel: 2,
      id: `${slide.slideId}-semantic-comparison`,
      priority: 3,
      role: input.locale === "zh-CN" ? "对比容器" : "Comparison container",
      semanticType: "card",
      styleRole: "comparison"
    });
  } else if (pageIntent.pageRole === "process") {
    base.push({
      category: "infographic",
      constraints: ["识别步骤、顺序、输入输出和依赖关系", "保持阅读顺序清晰"],
      content: contentLayerTexts(slide, "supporting").join("\n") || slide.bodyPoints.join("\n"),
      elementType: "shape",
      hierarchyLevel: 2,
      id: `${slide.slideId}-semantic-process`,
      priority: 3,
      role: input.locale === "zh-CN" ? "流程图" : "Process flow",
      semanticType: "card",
      styleRole: "steps"
    });
  } else {
    base.push({
      category: "visual",
      constraints: ["每页只能有一个主视觉中心", "不得遮挡标题"],
      content: slide.visualIntent,
      elementType:
        pageIntent.contentDensity === "high" ? "shape" : "generatedImage",
      hierarchyLevel: 2,
      id: `${slide.slideId}-semantic-visual`,
      priority: 3,
      role:
        pageIntent.contentDensity === "high"
          ? copy.supportingVisual
          : copy.mainVisual,
      semanticType:
        pageIntent.contentDensity === "high" ? "accentShape" : "heroVisual",
      styleRole:
        pageIntent.contentDensity === "high" ? "supporting-visual" : "hero-visual"
    });
  }

  base.push({
    category: "navigation",
    constraints: ["低层级辅助信息", "不得干扰主体内容"],
    content: String(slide.index).padStart(2, "0"),
    elementType: "text",
    hierarchyLevel: 3,
    id: `${slide.slideId}-semantic-page-number`,
    priority: 5,
    role: input.locale === "zh-CN" ? "页码" : "Page number",
    semanticType: "footer",
    styleRole: "source-note"
  });

  return dedupeSemanticElements(base).slice(0, 14);
}

export function buildSemanticPlanFromSlide({
  input,
  slide,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  slide: SlideContent;
  unifiedVisualSpec: UnifiedVisualSpec;
}): SemanticSlidePlan {
  const pageIntent = buildFallbackPageIntent({ input, slide });
  const contentHierarchy = buildFallbackContentHierarchy({
    input,
    pageIntent,
    slide
  });
  const semanticElements = buildFallbackSemanticElements({
    input,
    pageIntent,
    slide
  });

  return {
    slideId: slide.slideId,
    index: slide.index,
    content: slide,
    contentHierarchy,
    layoutSelection: buildFallbackLayoutSelection({
      input,
      pageIntent,
      slide
    }),
    constraints: buildFallbackDesignConstraints({
      input,
      pageIntent,
      slide
    }),
    designPlan: {
      expressionIntent:
        input.locale === "zh-CN"
          ? `先表达“${compactText(pageIntent.coreMessage, 48)}”，再用页面元素支撑理解。`
          : `Lead with "${compactText(pageIntent.coreMessage, 58)}", then support it with page elements.`,
      layoutTemplate: chooseLayoutKind(pageIntent),
      readingOrder: semanticElements.map((element) => element.id),
      visualStrategy: unifiedVisualSpec.imageStyle
    },
    expressionIntent:
      input.locale === "zh-CN"
        ? `让观众理解并记住：${compactText(pageIntent.audienceTakeaway, 80)}`
        : `Help the audience remember: ${compactText(pageIntent.audienceTakeaway, 90)}`,
    layoutDiagnostics: {
      density: pageIntent.contentDensity === "high" ? 0.78 : pageIntent.contentDensity === "low" ? 0.42 : 0.58,
      hasOverflow: false,
      needsUserConfirmation: pageIntent.contentDensity === "high",
      overflowFixes:
        pageIntent.contentDensity === "high"
          ? ["compress-copy", "adjust-layout"]
          : [],
      warnings:
        pageIntent.contentDensity === "high"
          ? [
              input.locale === "zh-CN"
                ? "页面内容密度较高，已优先采用紧凑信息图版式。"
                : "Content density is high, so a compact infographic layout is preferred."
            ]
          : []
    },
    pageIntent,
    semanticElements
  };
}

export function composeSlideFromSemanticPlan({
  input,
  semanticPlan,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  semanticPlan: SemanticSlidePlan;
  unifiedVisualSpec: UnifiedVisualSpec;
}): SlideCompositionPlan {
  const pageIntent = semanticPlan.pageIntent;
  const layoutKind = chooseLayoutKind(
    pageIntent,
    semanticPlan.layoutSelection.selectedLayoutType
  );
  const titleElement = findSemanticElement(
    semanticPlan.semanticElements,
    "title"
  );
  const keyMessageElement = findSemanticElement(
    semanticPlan.semanticElements,
    "subtitle"
  );
  const bodyElements = semanticPlan.semanticElements
    .filter((element) => element.category === "text" && element.semanticType === "body")
    .sort((first, second) => first.priority - second.priority);
  const textBody =
    bodyElements.map((element) => element.content).filter(Boolean).join("\n") ||
    semanticPlan.content.bodyPoints.join("\n");
  const elements = buildRenderableElements({
    input,
    keyMessage: keyMessageElement?.content ?? pageIntent.coreMessage,
    layoutKind,
    semanticPlan,
    textBody,
    title: titleElement?.content ?? semanticPlan.content.title,
    unifiedVisualSpec
  });
  const imageLayerRequests = buildImageLayerRequests({
    input,
    layoutKind,
    semanticPlan,
    unifiedVisualSpec
  });
  const imageRequestIds = new Set(imageLayerRequests.map((request) => request.id));

  return {
    slideId: semanticPlan.slideId,
    index: semanticPlan.index,
    content: semanticPlan.content,
    contentHierarchy: semanticPlan.contentHierarchy,
    layoutSelection: semanticPlan.layoutSelection,
    constraints: semanticPlan.constraints,
    designQualityScore: emptyDesignQualityScore(input.locale),
    designPlan: {
      ...semanticPlan.designPlan,
      layoutTemplate:
        semanticPlan.layoutSelection.selectedLayoutType ||
        semanticPlan.designPlan.layoutTemplate ||
        layoutKind,
      readingOrder:
        semanticPlan.designPlan.readingOrder.length > 0
          ? semanticPlan.designPlan.readingOrder
          : elements.map((element) => element.id)
    },
    expressionIntent: semanticPlan.expressionIntent,
    layoutDiagnostics: mergeSemanticDiagnostics(
      semanticPlan.layoutDiagnostics,
      pageIntent
    ),
    pageIntent,
    semanticElements: semanticPlan.semanticElements,
    canvas: {
      aspectRatio: "16:9",
      height: slideCanvasHeight,
      safeMargin: slideCanvasSafeMargin,
      unit: slideCanvasUnit,
      width: slideCanvasWidth
    },
    elements: elements.map((element) =>
      element.type === "generatedImage" && element.imageRequestId && !imageRequestIds.has(element.imageRequestId)
        ? {
            ...element,
            type: "shape" as const,
            imageRequestId: undefined,
            requiresImageGeneration: false,
            semanticType: "accentShape" as const
          }
        : element
    ),
    imageLayerRequests
  };
}

export function composeSlideFromTemplate({
  input,
  semanticPlan,
  template,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  semanticPlan: SemanticSlidePlan;
  template: PptTemplateDto;
  unifiedVisualSpec: UnifiedVisualSpec;
}): SlideCompositionPlan {
  const contentMap = buildTemplateContentMap({ input, semanticPlan });
  const elementIdMap = new Map(
    template.slide.elements.map((element) => [
      element.id,
      `${semanticPlan.slideId}-${element.id}`
    ])
  );
  const requestIdMap = new Map(
    template.slide.imageLayerRequests.map((request) => [
      request.id,
      `${semanticPlan.slideId}-${request.id}`
    ])
  );
  const imageLayerRequests = template.slide.imageLayerRequests.map((request) => ({
    ...request,
    elementId: elementIdMap.get(request.elementId) ?? `${semanticPlan.slideId}-${request.elementId}`,
    id: requestIdMap.get(request.id) ?? `${semanticPlan.slideId}-${request.id}`,
    keywords: [
      semanticPlan.content.title,
      semanticPlan.pageIntent.pageRole,
      input.deckType,
      ...semanticPlan.content.bodyPoints
    ].slice(0, 8),
    prompt: buildTemplateImagePrompt({
      input,
      semanticPlan,
      template,
      unifiedVisualSpec
    }),
    purpose: normalizeImagePurpose(
      request.purpose,
      input.locale === "zh-CN"
        ? "生成本页模板主视觉"
        : "Generate this slide's template visual"
    ),
    visualNotes: unifiedVisualSpec.imageStyle
  }));
  const imageRequestIds = new Set(imageLayerRequests.map((request) => request.id));
  const bodyTextElements = getTemplateBodyTextElements(template.slide.elements);
  const elements = template.slide.elements.map((element, index) => {
    const id = elementIdMap.get(element.id) ?? `${semanticPlan.slideId}-${element.id}`;
    const imageRequestId = element.imageRequestId
      ? requestIdMap.get(element.imageRequestId) ?? `${semanticPlan.slideId}-${element.imageRequestId}`
      : undefined;
    const content =
      element.type === "text"
        ? getTemplateTextContent({
            bodyTextElements,
            contentMap,
            element,
            index,
            input,
            semanticPlan
          })
        : element.content;
    const nextElement: SlideElement = {
      ...element,
      content,
      id,
      imageRequestId,
      requiresImageGeneration:
        element.type === "generatedImage" && imageRequestId
          ? true
          : element.requiresImageGeneration,
      role: getTemplateElementRole({
        content,
        contentMap,
        element,
        input
      }),
      styleNotes: `${element.styleNotes} 使用模板：${template.name}。`
    };

    if (
      nextElement.type === "generatedImage" &&
      nextElement.imageRequestId &&
      !imageRequestIds.has(nextElement.imageRequestId)
    ) {
      return {
        ...nextElement,
        imageRequestId: undefined,
        requiresImageGeneration: false,
        semanticType: "accentShape" as const,
        type: "shape" as const
      };
    }

    return nextElement;
  });

  return {
    slideId: semanticPlan.slideId,
    index: semanticPlan.index,
    content: semanticPlan.content,
    contentHierarchy: semanticPlan.contentHierarchy,
    layoutSelection: semanticPlan.layoutSelection,
    constraints: semanticPlan.constraints,
    designQualityScore: emptyDesignQualityScore(input.locale),
    designPlan: {
      ...semanticPlan.designPlan,
      layoutTemplate: template.category,
      readingOrder:
        semanticPlan.designPlan.readingOrder.length > 0
          ? semanticPlan.designPlan.readingOrder
          : elements.map((element) => element.id).slice(0, 24),
      visualStrategy: `${semanticPlan.designPlan.visualStrategy} 已套用模板“${template.name}”（${template.id}）。`
    },
    expressionIntent: semanticPlan.expressionIntent,
    layoutDiagnostics: mergeSemanticDiagnostics(
      {
        ...semanticPlan.layoutDiagnostics,
        warnings: [
          ...semanticPlan.layoutDiagnostics.warnings,
          `已套用模板：${template.name}（${template.id}）。`
        ]
      },
      semanticPlan.pageIntent
    ),
    pageIntent: semanticPlan.pageIntent,
    semanticElements: semanticPlan.semanticElements,
    canvas: template.slide.canvas,
    elements,
    imageLayerRequests
  };
}

function buildRenderableElements({
  input,
  keyMessage,
  layoutKind,
  semanticPlan,
  textBody,
  title,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  keyMessage: string;
  layoutKind: SlideLayoutKind;
  semanticPlan: SemanticSlidePlan;
  textBody: string;
  title: string;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  const slideId = semanticPlan.slideId;
  const elements: SlideElement[] = [];
  const titleHeight = layoutKind === "cover" || layoutKind === "chapter" ? 0.92 : 0.62;
  const titleFont = layoutKind === "cover" || layoutKind === "chapter" ? 34 : 28;

  elements.push(
    textElement({
      id: `${slideId}-title`,
      role: input.locale === "zh-CN" ? "主标题" : "Title",
      content: title,
      x: layoutKind === "cover" || layoutKind === "chapter" ? 0.88 : 0.76,
      y: layoutKind === "cover" || layoutKind === "chapter" ? 0.92 : 0.62,
      width: layoutKind === "cover" || layoutKind === "chapter" ? 6.25 : 7.25,
      height: titleHeight,
      fontSize: titleFont,
      fontWeight: "bold",
      hierarchyLevel: 1,
      semanticType: "title",
      zIndex: 35,
      maxLines: 2
    })
  );

  if (layoutKind === "cover" || layoutKind === "chapter") {
    elements.push(
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "核心信息" : "Key message",
        content: keyMessage,
        x: 0.92,
        y: 2.15,
        width: 5.85,
        height: 0.85,
        fontSize: 18,
        fontWeight: "medium",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 3
      })
    );
    elements.push(
      generatedImageElement({
        id: `${slideId}-visual`,
        requestId: `${slideId}-image-main`,
        role: input.locale === "zh-CN" ? "封面主视觉" : "Cover hero visual",
        x: 7.15,
        y: 0.82,
        width: 4.9,
        height: 5.05,
        semanticType: "heroVisual",
        styleNotes: unifiedVisualSpec.imageStyle
      })
    );
    elements.push(accentShape(`${slideId}-accent`, 0.94, 3.42, 1.42, 0.15, 15));

    return elements;
  }

  if (layoutKind === "background") {
    elements.push(
      generatedImageElement({
        id: `${slideId}-visual`,
        requestId: `${slideId}-image-main`,
        role: input.locale === "zh-CN" ? "大图背景" : "Full image background",
        x: 0,
        y: 0,
        width: 13.333,
        height: 7.5,
        semanticType: "background",
        styleNotes: unifiedVisualSpec.imageStyle
      }),
      cardShape(`${slideId}-overlay`, input.locale === "zh-CN" ? "文字遮罩" : "Text overlay", 0.66, 0.82, 5.95, 5.52, 12),
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "核心信息" : "Key message",
        content: keyMessage,
        x: 1.02,
        y: 1.72,
        width: 4.95,
        height: 0.84,
        fontSize: 18,
        fontWeight: "semibold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 3
      }),
      textElement({
        id: `${slideId}-body`,
        role: input.locale === "zh-CN" ? "正文说明" : "Body notes",
        content: textBody,
        x: 1.04,
        y: 2.88,
        width: 4.82,
        height: 2.2,
        fontSize: 15,
        fontWeight: "regular",
        hierarchyLevel: 2,
        semanticType: "body",
        zIndex: 35,
        maxLines: 6
      })
    );

    return elements;
  }

  if (layoutKind === "imageLeft") {
    elements.push(
      generatedImageElement({
        id: `${slideId}-visual`,
        requestId: `${slideId}-image-main`,
        role: input.locale === "zh-CN" ? "左侧主视觉" : "Left hero visual",
        x: 0.82,
        y: 1,
        width: 5.4,
        height: 4.95,
        semanticType: "heroVisual",
        styleNotes: unifiedVisualSpec.imageStyle
      }),
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "核心信息" : "Key message",
        content: keyMessage,
        x: 7.05,
        y: 1.42,
        width: 4.85,
        height: 0.72,
        fontSize: 17,
        fontWeight: "semibold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 2
      }),
      textElement({
        id: `${slideId}-body`,
        role: input.locale === "zh-CN" ? "正文要点" : "Body points",
        content: textBody,
        x: 7.08,
        y: 2.38,
        width: 4.68,
        height: 2.72,
        fontSize: 15,
        fontWeight: "regular",
        hierarchyLevel: 2,
        semanticType: "body",
        zIndex: 35,
        maxLines: 7
      }),
      accentShape(`${slideId}-accent`, 7.08, 5.46, 2.4, 0.12, 15)
    );

    return elements;
  }

  if (layoutKind === "data" || layoutKind === "chartSplit") {
    elements.push(
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "数据结论" : "Data conclusion",
        content: keyMessage,
        x: 0.82,
        y: 1.35,
        width: 5.55,
        height: 0.68,
        fontSize: 17,
        fontWeight: "semibold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 2
      }),
      chartElement(`${slideId}-chart`, input.locale === "zh-CN" ? "图表区域" : "Chart area", 6.72, 1.28, 5.35, 4.55, 22),
      textElement({
        id: `${slideId}-body`,
        role: input.locale === "zh-CN" ? "指标说明" : "Metric notes",
        content: textBody,
        x: 0.86,
        y: 2.3,
        width: 4.95,
        height: 3.05,
        fontSize: 15,
        fontWeight: "regular",
        hierarchyLevel: 2,
        semanticType: "body",
        zIndex: 35,
        maxLines: 8
      }),
      accentShape(`${slideId}-chart-line`, 7.04, 5.48, 4.65, 0.1, 24)
    );

    return elements;
  }

  if (layoutKind === "bigChart") {
    elements.push(
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "图表结论" : "Chart conclusion",
        content: keyMessage,
        x: 0.82,
        y: 1.24,
        width: 9.5,
        height: 0.55,
        fontSize: 16,
        fontWeight: "semibold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 2
      }),
      chartElement(`${slideId}-chart`, input.locale === "zh-CN" ? "大图表" : "Large chart", 0.9, 1.95, 11.5, 4.3, 22),
      textElement({
        id: `${slideId}-caption`,
        role: input.locale === "zh-CN" ? "图表注释" : "Chart note",
        content: semanticPlan.content.sourceRequirement.note,
        x: 0.92,
        y: 6.43,
        width: 5.5,
        height: 0.35,
        fontSize: 10,
        fontWeight: "regular",
        hierarchyLevel: 3,
        semanticType: "footer",
        zIndex: 35,
        maxLines: 1
      })
    );

    return elements;
  }

  if (layoutKind === "comparison" || layoutKind === "matrix") {
    const points = semanticPlan.content.bodyPoints;

    if (layoutKind === "matrix") {
      const quadrants = points.slice(0, 4);

      elements.push(
        textElement({
          id: `${slideId}-key-message`,
          role: input.locale === "zh-CN" ? "矩阵结论" : "Matrix conclusion",
          content: keyMessage,
          x: 0.82,
          y: 1.28,
          width: 9.2,
          height: 0.55,
          fontSize: 16,
          fontWeight: "semibold",
          hierarchyLevel: 1,
          semanticType: "subtitle",
          zIndex: 35,
          maxLines: 2
        }),
        cardShape(`${slideId}-matrix`, input.locale === "zh-CN" ? "矩阵底" : "Matrix base", 2.35, 2.02, 8.6, 4.18, 8),
        accentShape(`${slideId}-vertical-axis`, 6.62, 2.18, 0.08, 3.86, 18),
        accentShape(`${slideId}-horizontal-axis`, 2.52, 4.05, 8.26, 0.08, 18)
      );

      quadrants.forEach((point, index) => {
        const positions = [
          [3.05, 2.62],
          [7.45, 2.62],
          [3.05, 4.62],
          [7.45, 4.62]
        ] as const;
        const [x, y] = positions[index] ?? positions[0];

        elements.push(
          textElement({
            id: `${slideId}-quadrant-${index + 1}`,
            role: input.locale === "zh-CN" ? `象限 ${index + 1}` : `Quadrant ${index + 1}`,
            content: point,
            x,
            y,
            width: 2.55,
            height: 0.72,
            fontSize: 14,
            fontWeight: "semibold",
            hierarchyLevel: 2,
            semanticType: "card",
            zIndex: 30,
            maxLines: 3,
            align: "center"
          })
        );
      });

      return elements;
    }

    elements.push(
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "差异结论" : "Difference conclusion",
        content: keyMessage,
        x: 0.82,
        y: 1.35,
        width: 8.2,
        height: 0.56,
        fontSize: 16,
        fontWeight: "semibold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 2
      }),
      cardShape(`${slideId}-left-card`, input.locale === "zh-CN" ? "对比对象 A" : "Comparison A", 0.9, 2.08, 5.45, 3.7, 10),
      cardShape(`${slideId}-right-card`, input.locale === "zh-CN" ? "对比对象 B" : "Comparison B", 7, 2.08, 5.45, 3.7, 10),
      textElement({
        id: `${slideId}-left`,
        role: input.locale === "zh-CN" ? "左侧对比" : "Left comparison",
        content: points.slice(0, Math.ceil(points.length / 2)).join("\n") || keyMessage,
        x: 1.28,
        y: 2.52,
        width: 4.58,
        height: 2.7,
        fontSize: 16,
        fontWeight: "medium",
        hierarchyLevel: 2,
        semanticType: "card",
        zIndex: 30,
        maxLines: 7
      }),
      textElement({
        id: `${slideId}-right`,
        role: input.locale === "zh-CN" ? "右侧对比" : "Right comparison",
        content: points.slice(Math.ceil(points.length / 2)).join("\n") || textBody,
        x: 7.38,
        y: 2.52,
        width: 4.58,
        height: 2.7,
        fontSize: 16,
        fontWeight: "medium",
        hierarchyLevel: 2,
        semanticType: "card",
        zIndex: 30,
        maxLines: 7
      })
    );

    return elements;
  }

  if (layoutKind === "process" || layoutKind === "timeline") {
    const steps = semanticPlan.content.bodyPoints.slice(0, layoutKind === "timeline" ? 4 : 3);
    const cardWidth = steps.length >= 4 ? 2.55 : 3.25;
    const gap = steps.length >= 4 ? 0.3 : 0.88;
    const startX = steps.length >= 4 ? 0.88 : 1.08;

    elements.push(
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "流程目标" : "Process goal",
        content: keyMessage,
        x: 0.82,
        y: 1.35,
        width: 8.2,
        height: 0.58,
        fontSize: 16,
        fontWeight: "semibold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 2
      })
    );
    if (layoutKind === "timeline") {
      elements.push(accentShape(`${slideId}-timeline-line`, 1.1, 3.68, 11.1, 0.1, 18));
    }
    steps.forEach((step, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = layoutKind === "timeline" && index % 2 === 1 ? 4.08 : 2.25;

      elements.push(
        cardShape(`${slideId}-step-card-${index + 1}`, input.locale === "zh-CN" ? `步骤 ${index + 1}` : `Step ${index + 1}`, x, y, cardWidth, 2.1, 10),
        textElement({
          id: `${slideId}-step-${index + 1}`,
          role: input.locale === "zh-CN" ? `步骤 ${index + 1}` : `Step ${index + 1}`,
          content: `${String(index + 1).padStart(2, "0")}\n${step}`,
          x: x + 0.28,
          y: y + 0.42,
          width: cardWidth - 0.56,
          height: 1.25,
          fontSize: 15,
          fontWeight: "bold",
          hierarchyLevel: 2,
          semanticType: "card",
          zIndex: 30,
          maxLines: 4,
          align: "center"
        })
      );

      if (index < steps.length - 1) {
        elements.push(
          accentShape(`${slideId}-connector-${index + 1}`, x + cardWidth + 0.08, 3.42, Math.max(0.18, gap - 0.16), 0.1, 25)
        );
      }
    });

    return elements;
  }

  if (layoutKind === "quote") {
    elements.push(
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "引用金句" : "Quote",
        content: keyMessage,
        x: 2.05,
        y: 2,
        width: 9.25,
        height: 1.15,
        fontSize: 30,
        fontWeight: "bold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 3,
        align: "center"
      }),
      textElement({
        id: `${slideId}-source`,
        role: input.locale === "zh-CN" ? "来源说明" : "Source",
        content: semanticPlan.content.sourceRequirement.note,
        x: 4.1,
        y: 3.58,
        width: 5.1,
        height: 0.42,
        fontSize: 12,
        fontWeight: "regular",
        hierarchyLevel: 3,
        semanticType: "footer",
        zIndex: 35,
        maxLines: 2,
        align: "center"
      }),
      accentShape(`${slideId}-quote-left`, 1.45, 1.45, 0.55, 0.55, 10),
      accentShape(`${slideId}-quote-right`, 11.35, 4.1, 0.55, 0.55, 10)
    );

    return elements;
  }

  if (layoutKind === "metrics") {
    const metric = extractMetric(textBody) ?? compactText(keyMessage, 12);

    elements.push(
      textElement({
        id: `${slideId}-metric`,
        role: input.locale === "zh-CN" ? "关键指标" : "Key metric",
        content: metric,
        x: 0.95,
        y: 1.35,
        width: 5.15,
        height: 1.35,
        fontSize: 40,
        fontWeight: "bold",
        hierarchyLevel: 1,
        semanticType: "badge",
        zIndex: 35,
        maxLines: 1
      }),
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "指标结论" : "Metric conclusion",
        content: keyMessage,
        x: 0.98,
        y: 3.05,
        width: 5.9,
        height: 0.62,
        fontSize: 22,
        fontWeight: "bold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 2
      }),
      textElement({
        id: `${slideId}-body`,
        role: input.locale === "zh-CN" ? "指标解释" : "Metric explanation",
        content: textBody,
        x: 1.02,
        y: 4.05,
        width: 5.8,
        height: 1.3,
        fontSize: 15,
        fontWeight: "regular",
        hierarchyLevel: 2,
        semanticType: "body",
        zIndex: 35,
        maxLines: 5
      }),
      cardShape(`${slideId}-panel`, input.locale === "zh-CN" ? "右侧背景" : "Right panel", 7.5, 0.9, 4.4, 5.4, 8)
    );

    return elements;
  }

  if (layoutKind === "compact") {
    elements.push(
      textElement({
        id: `${slideId}-key-message`,
        role: input.locale === "zh-CN" ? "核心结论" : "Core conclusion",
        content: keyMessage,
        x: 0.82,
        y: 1.32,
        width: 10.8,
        height: 0.58,
        fontSize: 16,
        fontWeight: "semibold",
        hierarchyLevel: 1,
        semanticType: "subtitle",
        zIndex: 35,
        maxLines: 2
      }),
      textElement({
        id: `${slideId}-body`,
        role: input.locale === "zh-CN" ? "紧凑要点" : "Compact points",
        content: textBody,
        x: 0.92,
        y: 2.12,
        width: 10.95,
        height: 3.72,
        fontSize: 14,
        fontWeight: "regular",
        hierarchyLevel: 2,
        semanticType: "body",
        zIndex: 35,
        maxLines: 9
      }),
      cardShape(`${slideId}-body-panel`, input.locale === "zh-CN" ? "信息框" : "Info container", 0.72, 1.95, 11.62, 4.18, 8)
    );

    return elements;
  }

  elements.push(
    textElement({
      id: `${slideId}-key-message`,
      role: input.locale === "zh-CN" ? "核心结论" : "Core conclusion",
      content: keyMessage,
      x: 0.82,
      y: 1.42,
      width: 5.7,
      height: 0.72,
      fontSize: 17,
      fontWeight: "semibold",
      hierarchyLevel: 1,
      semanticType: "subtitle",
      zIndex: 35,
      maxLines: 3
    }),
    textElement({
      id: `${slideId}-body`,
      role: input.locale === "zh-CN" ? "正文要点" : "Body points",
      content: textBody,
      x: 0.86,
      y: 2.36,
      width: 5.55,
      height: 2.96,
      fontSize: 15,
      fontWeight: "regular",
      hierarchyLevel: 2,
      semanticType: "body",
      zIndex: 35,
      maxLines: 8
    }),
    generatedImageElement({
      id: `${slideId}-visual`,
      requestId: `${slideId}-image-main`,
      role: input.locale === "zh-CN" ? "主视觉图层" : "Hero visual layer",
      x: 7.22,
      y: 1.22,
      width: 4.72,
      height: 3.68,
      semanticType: "heroVisual",
      styleNotes: unifiedVisualSpec.imageStyle
    }),
    accentShape(`${slideId}-accent`, 0.76, 6.62, 11.82, 0.16, 15)
  );

  return elements;
}

function buildImageLayerRequests({
  input,
  layoutKind,
  semanticPlan,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  layoutKind: SlideLayoutKind;
  semanticPlan: SemanticSlidePlan;
  unifiedVisualSpec: UnifiedVisualSpec;
}): ImageLayerRequest[] {
  if (!["cover", "chapter", "background", "imageLeft", "standard", "summary"].includes(layoutKind)) {
    return [];
  }

  const visual = semanticPlan.semanticElements.find(
    (element) =>
      element.category === "visual" && element.elementType === "generatedImage"
  );
  const requestId = `${semanticPlan.slideId}-image-main`;
  const elementId = `${semanticPlan.slideId}-visual`;

  const requests: ImageLayerRequest[] = [
    {
      id: requestId,
      elementId,
      purpose: normalizeImagePurpose(
        visual?.role,
        input.locale === "zh-CN"
          ? "生成本页主视觉透明图层"
          : "Generate the slide hero visual layer"
      ),
      imageType: "illustration",
      keywords: [
        semanticPlan.content.title,
        semanticPlan.pageIntent.pageRole,
        input.deckType
      ].slice(0, 8),
      prompt:
        input.locale === "zh-CN"
          ? `为 PPT 第 ${semanticPlan.index} 页生成透明背景主视觉。页面核心信息：${semanticPlan.pageIntent.coreMessage}。视觉意图：${semanticPlan.content.visualIntent}。统一风格：${unifiedVisualSpec.visualStyle}`
          : `Generate a transparent-background hero visual for slide ${semanticPlan.index}. Core message: ${semanticPlan.pageIntent.coreMessage}. Visual intent: ${semanticPlan.content.visualIntent}. Unified style: ${unifiedVisualSpec.visualStyle}`,
      negativePrompt:
        input.locale === "zh-CN"
          ? "不要文字、不要水印、不要复杂背景、不要低清晰度"
          : "No text, no watermark, no complex background, no low-resolution artifacts",
      avoid:
        input.locale === "zh-CN"
          ? "不要文字、不要水印、不要复杂背景、不要低清晰度"
          : "No text, no watermark, no complex background, no low-resolution artifacts",
      transparentBackground: true,
      aspectRatio: "16:9",
      visualNotes: unifiedVisualSpec.imageStyle
    }
  ];

  if (layoutKind === "background") {
    return [
      {
        ...requests[0],
        imageType: "background",
        purpose:
          input.locale === "zh-CN"
            ? "生成本页大图背景"
            : "Generate the slide background image",
        prompt:
          input.locale === "zh-CN"
            ? `为 PPT 第 ${semanticPlan.index} 页生成低对比大图背景。页面核心信息：${semanticPlan.pageIntent.coreMessage}。背景必须留出文字安全区域，不包含文字、水印或复杂高对比纹理。统一风格：${unifiedVisualSpec.visualStyle}`
            : `Generate a low-contrast full-slide background for slide ${semanticPlan.index}. Core message: ${semanticPlan.pageIntent.coreMessage}. Reserve clean text-safe areas and avoid text, watermarks, or complex high-contrast textures. Unified style: ${unifiedVisualSpec.visualStyle}`,
        transparentBackground: false
      }
    ];
  }

  return requests;
}

function buildTemplateContentMap({
  input,
  semanticPlan
}: {
  input: AnalyzeDeckRequest;
  semanticPlan: SemanticSlidePlan;
}) {
  const sourceNote = semanticPlan.content.sourceRequirement.note;
  const bodyPoints = displayableTemplateBodyItems(semanticPlan);

  return {
    badge:
      input.locale === "zh-CN"
        ? templateBadgeForPageRole(semanticPlan.pageIntent.pageRole)
        : semanticPlan.pageIntent.pageRole.toUpperCase(),
    body: bodyPoints,
    footer:
      semanticPlan.content.sourceRequirement.required
        ? sourceNote
        : String(semanticPlan.index).padStart(2, "0"),
    subtitle:
      semanticPlan.content.subtitle ||
      semanticPlan.content.coreStatement ||
      semanticPlan.pageIntent.coreMessage ||
      bodyPoints[0] ||
      semanticPlan.content.title,
    title: semanticPlan.content.title
  };
}

function getTemplateTextContent({
  bodyTextElements,
  contentMap,
  element,
  index,
  input,
  semanticPlan
}: {
  bodyTextElements: SlideElement[];
  contentMap: ReturnType<typeof buildTemplateContentMap>;
  element: SlideElement;
  index: number;
  input: AnalyzeDeckRequest;
  semanticPlan: SemanticSlidePlan;
}) {
  if (element.semanticType === "title") {
    return contentMap.title;
  }

  if (element.semanticType === "subtitle") {
    return contentMap.subtitle;
  }

  if (element.semanticType === "footer") {
    return contentMap.footer;
  }

  if (element.semanticType === "badge") {
    const existing = element.content?.trim();

    return existing && existing.length <= 32 ? existing : contentMap.badge;
  }

  if (element.semanticType === "body" || element.semanticType === "card") {
    if (bodyTextElements.length === 1) {
      return contentMap.body[0] ?? contentMap.subtitle;
    }

    const pointIndex = inferBodyTextPointIndex({
      bodyTextElements,
      element,
      fallbackIndex: index
    });
    const point = contentMap.body[pointIndex];

    return point ?? contentMap.body[0] ?? contentMap.subtitle;
  }

  if (element.role.includes("来源") || /source|caption|脚注/i.test(element.role)) {
    return contentMap.footer;
  }

  if (/页码|page/i.test(element.role)) {
    return String(semanticPlan.index).padStart(2, "0");
  }

  return (
    element.content ??
    (input.locale === "zh-CN" ? "模板文本" : "Template text")
  );
}

function displayableTemplateBodyItems(semanticPlan: SemanticSlidePlan) {
  const nonTitleBlocks = semanticPlan.content.contentBlocks
    .filter((block) => contentBlockSemanticType(block) !== "heading")
    .sort((first, second) => first.priority - second.priority)
    .map((block) => contentBlockText(block));

  return nonTitleBlocks.length > 0 ? nonTitleBlocks : semanticPlan.content.bodyPoints;
}

function getTemplateBodyTextElements(elements: SlideElement[]) {
  return elements.filter(
    (element) =>
      element.type === "text" &&
      (element.semanticType === "body" || element.semanticType === "card")
  );
}

function inferBodyTextPointIndex({
  bodyTextElements,
  element,
  fallbackIndex
}: {
  bodyTextElements: SlideElement[];
  element: SlideElement;
  fallbackIndex: number;
}) {
  const textIndex = bodyTextElements.findIndex((item) => item.id === element.id);

  if (textIndex >= 0) {
    return textIndex;
  }

  return inferPointIndex(element, fallbackIndex);
}

function getTemplateElementRole({
  content,
  contentMap,
  element,
  input
}: {
  content?: string;
  contentMap: ReturnType<typeof buildTemplateContentMap>;
  element: SlideElement;
  input: AnalyzeDeckRequest;
}) {
  if (element.type !== "text") {
    return element.role;
  }

  if (element.semanticType === "title") {
    return input.locale === "zh-CN" ? "标题" : "Title";
  }

  if (element.semanticType === "subtitle") {
    return input.locale === "zh-CN" ? "副标题" : "Subtitle";
  }

  if (element.semanticType === "body" || element.semanticType === "card") {
    return compactText(
      content ?? contentMap.body.join(" "),
      input.locale === "zh-CN" ? 28 : 36
    );
  }

  return element.role;
}

function buildTemplateImagePrompt({
  input,
  semanticPlan,
  template,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  semanticPlan: SemanticSlidePlan;
  template: PptTemplateDto;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  return input.locale === "zh-CN"
    ? `为 PPT 第 ${semanticPlan.index} 页生成适配模板“${template.name}”的视觉图层。页面标题：${semanticPlan.content.title}。核心信息：${semanticPlan.pageIntent.coreMessage}。视觉意图：${semanticPlan.content.visualIntent}。统一风格：${unifiedVisualSpec.visualStyle}。不要文字、不要水印，主体避开标题区。`
    : `Generate a visual layer for slide ${semanticPlan.index} using template "${template.name}". Title: ${semanticPlan.content.title}. Core message: ${semanticPlan.pageIntent.coreMessage}. Visual intent: ${semanticPlan.content.visualIntent}. Unified style: ${unifiedVisualSpec.visualStyle}. No text or watermark; keep the subject away from the title area.`;
}

function templateBadgeForPageRole(pageRole: SlidePageIntent["pageRole"]) {
  const badges: Record<SlidePageIntent["pageRole"], string> = {
    agenda: "目录",
    comparison: "对比",
    content: "要点",
    cover: "封面",
    data: "数据",
    process: "流程",
    section: "章节",
    summary: "总结"
  };

  return badges[pageRole];
}

function inferPointIndex(element: SlideElement, fallbackIndex: number) {
  const corpus = `${element.id} ${element.role}`;
  const matched =
    corpus.match(/(?:p|point|要点|卡片|步骤|step|card)[^\d一二三四五六七八九]*(\d+)/i)?.[1] ??
    corpus.match(/([一二三四五六七八九])/u)?.[1];

  if (!matched) {
    return Math.max(0, fallbackIndex - 2);
  }

  const numeric = Number(matched);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric - 1;
  }

  return Math.max(
    0,
    "一二三四五六七八九".indexOf(matched)
  );
}

function normalizeImagePurpose(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();

  return trimmed && trimmed.length >= 4 ? trimmed : fallback;
}

function buildFallbackLayoutSelection({
  input,
  pageIntent,
  slide
}: {
  input: AnalyzeDeckRequest;
  pageIntent: SlidePageIntent;
  slide: SlideContent;
}): SlideLayoutSelection {
  const candidates = inferLayoutCandidates(pageIntent, slide);
  const selectedLayoutType = candidates[0];

  return {
    candidates: candidates.map((layoutType, index) => ({
      fitReason:
        input.locale === "zh-CN"
          ? `${layoutType} 匹配本页 ${pageIntent.pageRole} 角色和 ${pageIntent.contentDensity} 信息密度。`
          : `${layoutType} matches the slide role ${pageIntent.pageRole} and ${pageIntent.contentDensity} density.`,
      layoutType,
      risk:
        input.locale === "zh-CN"
          ? index === 0
            ? "风险较低，保持信息层级清晰。"
            : "需要控制正文长度和视觉遮挡。"
          : index === 0
            ? "Low risk with clear hierarchy."
            : "Requires careful copy length and visual overlap control.",
      score: Math.max(70, 94 - index * 8)
    })),
    selectedLayoutType,
    selectionReason:
      input.locale === "zh-CN"
        ? `优先选择 ${selectedLayoutType}，因为它最能承载“${compactText(pageIntent.coreMessage, 60)}”。`
        : `Choose ${selectedLayoutType} because it best carries "${compactText(pageIntent.coreMessage, 70)}".`
  };
}

function buildFallbackDesignConstraints({
  input,
  pageIntent,
  slide
}: {
  input: AnalyzeDeckRequest;
  pageIntent: SlidePageIntent;
  slide: SlideContent;
}): SlideDesignConstraints {
  return {
    coreMessagePresent: Boolean(pageIntent.coreMessage || slide.coreStatement),
    densityLimit: pageIntent.contentDensity,
    maxHeroVisuals: 1,
    renderNotes:
      input.locale === "zh-CN"
        ? [
            "主标题必须唯一并位于安全边距内。",
            "核心信息必须作为一级信息出现。",
            "图片主体避开标题区，避免遮挡正文。"
          ]
        : [
            "Keep exactly one primary title inside the safe margin.",
            "The core message must appear as tier-one information.",
            "Keep image subjects away from the title area and body text."
          ],
    safeMargin: {
      appliesTo:
        input.locale === "zh-CN"
          ? ["主标题", "核心信息", "正文", "图表标签"]
          : ["title", "core message", "body", "chart labels"],
      unit: slideCanvasUnit,
      value: slideCanvasSafeMargin
    },
    subjectAvoidsTitleArea: true,
    titleUnique: true
  };
}

export function buildDefaultLayoutSelection({
  input,
  pageIntent,
  slide
}: {
  input: AnalyzeDeckRequest;
  pageIntent: SlidePageIntent;
  slide: SlideContent;
}) {
  return buildFallbackLayoutSelection({ input, pageIntent, slide });
}

export function buildDefaultDesignConstraints({
  input,
  pageIntent,
  slide
}: {
  input: AnalyzeDeckRequest;
  pageIntent: SlidePageIntent;
  slide: SlideContent;
}) {
  return buildFallbackDesignConstraints({ input, pageIntent, slide });
}

function inferLayoutCandidates(
  pageIntent: SlidePageIntent,
  slide: SlideContent
): SlideLayoutType[] {
  const corpus = `${slide.title} ${slide.subtitle ?? ""} ${slide.bodyPoints.join(" ")} ${slide.coreStatement} ${slide.visualIntent}`;

  if (pageIntent.pageRole === "cover") {
    return ["cover-title", "big-image-background", "left-text-right-image"];
  }

  if (pageIntent.pageRole === "section") {
    return ["chapter", "quote", "big-image-background"];
  }

  if (pageIntent.pageRole === "agenda") {
    return ["title-body-points", "process-steps", "chapter"];
  }

  if (pageIntent.pageRole === "data") {
    return /%|\d|指标|metric|kpi/i.test(corpus)
      ? ["key-metrics", "big-chart", "left-text-right-chart"]
      : ["big-chart", "left-text-right-chart", "key-metrics"];
  }

  if (pageIntent.pageRole === "comparison") {
    return /象限|matrix|quadrant|优先级/i.test(corpus)
      ? ["quadrant-matrix", "two-column-compare", "title-body-points"]
      : ["two-column-compare", "quadrant-matrix", "title-body-points"];
  }

  if (pageIntent.pageRole === "process") {
    return /时间|阶段|年份|timeline|202\d/i.test(corpus)
      ? ["time-axis", "process-steps", "title-body-points"]
      : ["process-steps", "time-axis", "title-body-points"];
  }

  if (pageIntent.pageRole === "summary") {
    return ["ending", "quote", "title-body-points"];
  }

  if (/引用|金句|quote/i.test(corpus)) {
    return ["quote", "title-body-points", "big-image-background"];
  }

  if (pageIntent.contentDensity === "high") {
    return ["title-body-points", "left-text-right-chart", "two-column-compare"];
  }

  return ["left-text-right-image", "title-body-points", "left-image-right-text"];
}

function mergeSemanticDiagnostics(
  diagnostics: SlideCompositionPlan["layoutDiagnostics"],
  pageIntent: SlidePageIntent
) {
  const highDensity = pageIntent.contentDensity === "high";

  return {
    ...diagnostics,
    density:
      diagnostics.density > 0
        ? diagnostics.density
        : highDensity
          ? 0.78
          : pageIntent.contentDensity === "low"
            ? 0.42
            : 0.58,
    needsUserConfirmation: diagnostics.needsUserConfirmation || highDensity,
    overflowFixes: Array.from(
      new Set([
        ...diagnostics.overflowFixes,
        ...(highDensity ? ["compress-copy" as const, "adjust-layout" as const] : [])
      ])
    ),
    warnings: Array.from(
      new Set([
        ...diagnostics.warnings,
        ...(highDensity ? ["页面内容密度较高，已优先采用紧凑信息图版式。"] : [])
      ])
    ).slice(0, 8)
  };
}

function chooseLayoutKind(
  pageIntent: SlidePageIntent,
  selectedLayoutType?: SlideLayoutType
): SlideLayoutKind {
  if (selectedLayoutType) {
    return layoutKindFromType(selectedLayoutType);
  }

  if (pageIntent.pageRole === "cover" || pageIntent.pageRole === "section") {
    return "cover";
  }

  if (pageIntent.pageRole === "data") {
    return "data";
  }

  if (pageIntent.pageRole === "comparison") {
    return "comparison";
  }

  if (pageIntent.pageRole === "process") {
    return "process";
  }

  if (pageIntent.contentDensity === "high") {
    return "compact";
  }

  if (pageIntent.pageRole === "summary") {
    return "summary";
  }

  return "standard";
}

function layoutKindFromType(layoutType: SlideLayoutType): SlideLayoutKind {
  switch (layoutType) {
    case "chapter":
      return "chapter";
    case "cover-title":
      return "cover";
    case "big-image-background":
      return "background";
    case "left-image-right-text":
      return "imageLeft";
    case "left-text-right-chart":
      return "chartSplit";
    case "big-chart":
      return "bigChart";
    case "two-column-compare":
      return "comparison";
    case "quote":
      return "quote";
    case "time-axis":
      return "timeline";
    case "process-steps":
      return "process";
    case "key-metrics":
      return "metrics";
    case "quadrant-matrix":
      return "matrix";
    case "ending":
      return "summary";
    case "title-body-points":
      return "compact";
    case "left-text-right-image":
    default:
      return "standard";
  }
}

function emptyDesignQualityScore(
  locale: AnalyzeDeckRequest["locale"]
): SlideCompositionPlan["designQualityScore"] {
  const summary =
    locale === "zh-CN"
      ? "等待服务端质量评分。"
      : "Waiting for server-side quality scoring.";

  return {
    dimensions: {
      contentDensity: { score: 0, summary },
      expressionCompleteness: { score: 0, summary },
      informationHierarchy: { score: 0, summary },
      renderability: { score: 0, summary },
      visualConsistency: { score: 0, summary }
    },
    issues: [],
    repairStatus: "not-needed",
    suggestions: [],
    totalScore: 0
  };
}

function inferPageRole(
  slide: SlideContent,
  bodyText: string
): SlidePageIntent["pageRole"] {
  const corpus = `${slide.title} ${slide.subtitle ?? ""} ${bodyText} ${slide.coreStatement} ${slide.visualIntent}`;

  if (slide.index === 1) {
    return "cover";
  }

  if (/目录|agenda|contents|outline/i.test(corpus)) {
    return "agenda";
  }

  if (/章节|chapter|part\s*\d+/i.test(corpus)) {
    return "section";
  }

  if (/%|数据|指标|增长|趋势|同比|环比|chart|metric|data|trend/i.test(corpus)) {
    return "data";
  }

  if (/对比|比较|差异|方案\s*[AB]|compare|versus|vs\.?/i.test(corpus)) {
    return "comparison";
  }

  if (/流程|步骤|路径|阶段|step|process|timeline/i.test(corpus)) {
    return "process";
  }

  if (/总结|结论|下一步|复盘|summary|conclusion|next/i.test(corpus)) {
    return "summary";
  }

  return "content";
}

function inferPrimaryGoal(
  pageRole: SlidePageIntent["pageRole"],
  slide: SlideContent,
  input: AnalyzeDeckRequest
): SlidePageIntent["primaryGoal"] {
  if (slide.viewerObjective?.type === "act" || slide.viewerObjective?.type === "believe") {
    return "persuade";
  }

  if (slide.viewerObjective?.type === "remember") {
    return "spark-interest";
  }

  if (pageRole === "comparison") {
    return "compare";
  }

  if (pageRole === "summary") {
    return "summarize";
  }

  if (pageRole === "cover") {
    return "spark-interest";
  }

  if (
    pageRole === "process" ||
    input.deckType === "teaching-deck" ||
    input.deckType === "training-course" ||
    input.deckType === "knowledge-sharing"
  ) {
    return "explain";
  }

  if (
    input.deckType === "fundraising-pitch" ||
    input.deckType === "sales-proposal" ||
    input.deckType === "proposal"
  ) {
    return "persuade";
  }

  return "inform";
}

function findSemanticElement(
  elements: SemanticSlideElement[],
  semanticType: SemanticSlideElement["semanticType"]
) {
  return elements
    .filter((element) => element.semanticType === semanticType)
    .sort((first, second) => first.priority - second.priority)[0];
}

function dedupeSemanticElements(elements: SemanticSlideElement[]) {
  const seen = new Set<string>();

  return elements.filter((element) => {
    if (seen.has(element.id)) {
      return false;
    }

    seen.add(element.id);
    return true;
  });
}

function contentBlockText(block: SlideContent["contentBlocks"][number]) {
  return block.content ?? block.text;
}

function contentBlockSemanticType(
  block: SlideContent["contentBlocks"][number]
): NonNullable<SlideContent["contentBlocks"][number]["type"]> {
  return block.type ?? semanticContentBlockTypeForLegacy(block.blockType);
}

function semanticContentBlockTypeForLegacy(
  blockType: SlideContent["contentBlocks"][number]["blockType"]
): NonNullable<SlideContent["contentBlocks"][number]["type"]> {
  const map: Record<
    SlideContent["contentBlocks"][number]["blockType"],
    NonNullable<SlideContent["contentBlocks"][number]["type"]>
  > = {
    body: "text",
    chart: "chart",
    comparison: "comparison",
    conclusion: "conclusion",
    metric: "metric",
    note: "source",
    quote: "quote",
    step: "steps",
    tag: "callout",
    title: "heading"
  };

  return map[blockType];
}

function semanticTypeForContentBlock(
  blockType: NonNullable<SlideContent["contentBlocks"][number]["type"]>
): SemanticSlideElement["semanticType"] {
  if (blockType === "heading") {
    return "title";
  }

  if (blockType === "metric" || blockType === "callout") {
    return "badge";
  }

  if (blockType === "chart" || blockType === "table") {
    return "chart";
  }

  if (blockType === "quote" || blockType === "summary" || blockType === "conclusion") {
    return "subtitle";
  }

  if (blockType === "steps" || blockType === "timeline" || blockType === "comparison") {
    return "card";
  }

  return "body";
}

function semanticElementCategoryForContentBlock(
  blockType: NonNullable<SlideContent["contentBlocks"][number]["type"]>
): SemanticSlideElement["category"] {
  if (blockType === "chart" || blockType === "metric" || blockType === "table") {
    return "infographic";
  }

  if (blockType === "comparison" || blockType === "steps" || blockType === "timeline") {
    return "container";
  }

  return "text";
}

function semanticElementTypeForContentBlock(
  blockType: NonNullable<SlideContent["contentBlocks"][number]["type"]>
): SemanticSlideElement["elementType"] {
  if (blockType === "chart" || blockType === "table") {
    return "chartPlaceholder";
  }

  if (blockType === "comparison" || blockType === "steps" || blockType === "timeline") {
    return "shape";
  }

  return "text";
}

function styleRoleForContentBlock(
  blockType: NonNullable<SlideContent["contentBlocks"][number]["type"]>
) {
  const map: Record<
    NonNullable<SlideContent["contentBlocks"][number]["type"]>,
    string
  > = {
    callout: "callout",
    chart: "chart",
    comparison: "comparison",
    conclusion: "conclusion",
    heading: "page-title",
    image: "supporting-visual",
    list: "body-list",
    metric: "metric",
    quote: "quote",
    source: "source-note",
    steps: "steps",
    summary: "summary",
    table: "table",
    text: "body",
    timeline: "timeline"
  };

  return map[blockType];
}

function contentBlockSemanticRole(
  blockType: NonNullable<SlideContent["contentBlocks"][number]["type"]>,
  locale: AnalyzeDeckRequest["locale"],
  index: number
) {
  const zhRoles: Record<NonNullable<SlideContent["contentBlocks"][number]["type"]>, string> = {
    callout: "强调内容",
    chart: "图表说明",
    comparison: "对比内容",
    conclusion: "核心结论",
    heading: "主标题",
    image: "图片内容",
    list: "列表内容",
    metric: "关键指标",
    quote: "引用内容",
    source: "来源说明",
    steps: "步骤内容",
    summary: "摘要内容",
    table: "表格内容",
    text: "正文内容",
    timeline: "时间线内容"
  };
  const enRoles: Record<NonNullable<SlideContent["contentBlocks"][number]["type"]>, string> = {
    callout: "Callout",
    chart: "Chart note",
    comparison: "Comparison item",
    conclusion: "Conclusion",
    heading: "Title",
    image: "Image",
    list: "List",
    metric: "Key metric",
    quote: "Quote",
    source: "Source",
    steps: "Steps",
    summary: "Summary",
    table: "Table",
    text: "Body content",
    timeline: "Timeline"
  };

  return locale === "zh-CN"
    ? `${zhRoles[blockType]} ${index + 1}`
    : `${enRoles[blockType]} ${index + 1}`;
}

function textElement({
  align = "left",
  content,
  fontSize,
  fontWeight,
  height,
  hierarchyLevel,
  id,
  maxLines,
  role,
  semanticType,
  width,
  x,
  y,
  zIndex
}: {
  align?: "left" | "center" | "right";
  content: string;
  fontSize: number;
  fontWeight: "regular" | "medium" | "semibold" | "bold";
  height: number;
  hierarchyLevel: number;
  id: string;
  maxLines: number;
  role: string;
  semanticType: SlideElement["semanticType"];
  width: number;
  x: number;
  y: number;
  zIndex: number;
}): SlideElement {
  return {
    id,
    type: "text",
    role,
    content,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel,
    semanticType,
    zIndex,
    styleNotes: "由语义排版层生成的文本元素。",
    requiresImageGeneration: false,
    textStyle: {
      align,
      fontSize,
      fontWeight,
      lineHeight: 1.25,
      maxLines
    }
  };
}

function generatedImageElement({
  height,
  id,
  requestId,
  role,
  semanticType,
  styleNotes,
  width,
  x,
  y
}: {
  height: number;
  id: string;
  requestId: string;
  role: string;
  semanticType: SlideElement["semanticType"];
  styleNotes: string;
  width: number;
  x: number;
  y: number;
}): SlideElement {
  return {
    id,
    type: "generatedImage",
    role,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: 2,
    imageRequestId: requestId,
    semanticType,
    zIndex: 20,
    styleNotes,
    requiresImageGeneration: true
  };
}

function cardShape(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number
): SlideElement {
  return {
    id,
    type: "shape",
    role,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: 3,
    semanticType: "card",
    zIndex,
    styleNotes: "由语义排版层生成的信息容器。",
    requiresImageGeneration: false
  };
}

function chartElement(
  id: string,
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number
): SlideElement {
  return {
    id,
    type: "chartPlaceholder",
    role,
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: 2,
    semanticType: "chart",
    zIndex,
    styleNotes: "由语义排版层生成的数据图表占位。",
    requiresImageGeneration: false
  };
}

function accentShape(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number
): SlideElement {
  return {
    id,
    type: "shape",
    role: "Accent",
    bounds: { x, y, width, height },
    editable: true,
    hierarchyLevel: 4,
    semanticType: "accentShape",
    zIndex,
    styleNotes: "统一视觉节奏的强调形状。",
    requiresImageGeneration: false
  };
}

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

function extractMetric(text: string) {
  return text.match(/\b\d+(?:\.\d+)?%?\b/)?.[0];
}
