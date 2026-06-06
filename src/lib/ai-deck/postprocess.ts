import type {
  AnalyzedDeckResult,
  AnalyzeDeckRequest,
  ConsistencyReport,
  ContentReview,
  SlideDesignQualityScore,
  SlideCompositionPlan,
  SlideElement,
  SlideMotionPlan,
  UnifiedVisualSpec
} from "./schema";
import {
  bindElementsToContentBlocks,
  completeElementsForContentBlocks,
  dedupeSlideContentBlocksForComposition,
  getMissingContentBlockIndexes
} from "./content-block-bindings";
import {
  slideCanvasHeight,
  slideCanvasSafeMargin,
  slideCanvasUnit,
  slideCanvasWidth
} from "./schema";
import { extractPaletteHexColors } from "./visual-colors";
import { bindSlideElementColorsToVisualSpec } from "./visual-element-colors";

const sensitivePatterns = [
  /违法|暴力|仇恨|歧视|色情|诈骗|洗钱|自杀|恐怖/i,
  /illegal|violence|hate|discrimination|porn|fraud|suicide|terror/i
];

function isChinese(locale: AnalyzeDeckRequest["locale"]) {
  return locale === "zh-CN";
}

export function buildContentReview(
  input: AnalyzeDeckRequest,
  deck: AnalyzedDeckResult
): ContentReview {
  const corpus = [
    input.sourceText,
    deck.deckTitle,
    deck.deckSummary,
    ...deck.slides.flatMap((slide) => [
      slide.content.title,
      slide.content.subtitle ?? "",
      ...slide.content.bodyPoints
    ])
  ].join("\n");
  const hasSensitiveText = sensitivePatterns.some((pattern) =>
    pattern.test(corpus)
  );
  const longTextSlides = deck.slides.filter(
    (slide) => slide.content.bodyPoints.join("").length > 260
  );
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const zh = isChinese(input.locale);

  if (hasSensitiveText) {
    warnings.push(
      zh
        ? "输入或页面文案包含潜在敏感表达，需要人工复核。"
        : "The input or slide copy contains potentially sensitive wording and needs review."
    );
  }

  if (longTextSlides.length > 0) {
    warnings.push(
      zh
        ? `${longTextSlides.length} 页正文偏长，可能影响演示阅读。`
        : `${longTextSlides.length} slides may contain too much body copy for presentation reading.`
    );
  }

  suggestions.push(
    zh
      ? "正式使用前建议人工确认数据来源、品牌表述和可公开信息边界。"
      : "Before formal use, manually confirm data sources, brand wording, and disclosure boundaries."
  );

  if (longTextSlides.length > 0) {
    suggestions.push(
      zh
        ? "将长句拆成更短的行动判断或关键数字。"
        : "Split long sentences into shorter decisions or key numbers."
    );
  }

  const score = Math.max(
    60,
    96 - (hasSensitiveText ? 24 : 0) - longTextSlides.length * 5
  );

  return {
    score,
    riskLevel: score >= 85 ? "low" : score >= 70 ? "medium" : "high",
    summary:
      score >= 85
        ? zh
          ? "内容风险较低，可进入预览和导出。"
          : "Content risk is low and ready for preview and export."
        : zh
          ? "内容存在需要复核的表达，但默认不阻断生成。"
          : "Some wording should be reviewed, but generation is not blocked by default.",
    warnings,
    suggestions
  };
}

export function buildConsistencyReport(
  input: AnalyzeDeckRequest,
  deck: AnalyzedDeckResult
): ConsistencyReport {
  const zh = isChinese(input.locale);
  const paletteColors = extractPaletteHexColors(deck.unifiedVisualSpec.colorPalette);
  const paletteScore =
    paletteColors.length >= 10 &&
    paletteColors.length <= 18
      ? 96
      : 78;
  const slideCountScore = deck.slides.length === input.pageCount ? 100 : 60;
  const layoutScore = Math.max(
    70,
    Math.round(
      deck.slides.reduce((sum, slide) => sum + scoreSlideLayout(slide), 0) /
        deck.slides.length
    )
  );
  const visualAnchorScore = Math.max(
    70,
    Math.round(
      deck.slides.reduce(
        (sum, slide) =>
          sum +
          (slide.elements.some((element) =>
            ["generatedImage", "chartPlaceholder", "shape"].includes(
              element.type
            )
          )
            ? 96
            : 76),
        0
      ) / deck.slides.length
    )
  );
  const score = Math.round(
    (paletteScore + slideCountScore + layoutScore + visualAnchorScore) / 4
  );

  return {
    score,
    summary:
      score >= 88
        ? zh
          ? "跨页视觉、页数和层级保持稳定。"
          : "Cross-slide visuals, count, and hierarchy are stable."
        : zh
          ? "整体一致性可用，但部分页面需要进一步统一。"
          : "Overall consistency is usable, with a few slides needing alignment.",
    checks: [
      {
        name: zh ? "页数契约" : "Slide Count Contract",
        score: slideCountScore,
        message:
          slideCountScore === 100
            ? zh
              ? "生成页数与用户目标一致。"
              : "The generated slide count matches the request."
            : zh
              ? "生成页数与目标不一致。"
              : "The generated slide count does not match the request."
      },
      {
        name: zh ? "配色约束" : "Palette Control",
        score: paletteScore,
        message:
          paletteScore >= 90
            ? zh
              ? "统一视觉说明提供了可复用色板。"
              : "The unified visual spec provides a reusable palette."
            : zh
              ? "色板数量或说明需要收敛。"
              : "The palette needs tighter control."
      },
      {
        name: zh ? "版式边界" : "Layout Bounds",
        score: layoutScore,
        message:
          layoutScore >= 88
            ? zh
              ? "页面元素基本遵守画布边界和层级。"
              : "Elements mostly follow canvas bounds and hierarchy."
            : zh
              ? "部分页面元素面积或层级需要复核。"
              : "Some element sizes or layers need review."
      },
      {
        name: zh ? "视觉锚点" : "Visual Anchor",
        score: visualAnchorScore,
        message:
          visualAnchorScore >= 88
            ? zh
              ? "每页都有明确视觉承托。"
              : "Each slide has a clear visual support."
            : zh
              ? "少数页面缺少明确视觉承托。"
              : "A few slides lack a clear visual support."
      }
    ],
    suggestions:
      score >= 88
        ? [
            zh
              ? "后续可增加跨页母版和图标体系检查。"
              : "Next, add master layout and icon-system checks."
          ]
        : [
            zh
              ? "优先统一标题区域、正文宽度和主视觉位置。"
              : "First align title areas, body widths, and hero visual placement."
          ]
  };
}

export function normalizeSlideCompositionPlan(
  slide: SlideCompositionPlan,
  options: {
    completeContentBlocks?: boolean;
    unifiedVisualSpec?: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">;
  } = {}
): SlideCompositionPlan {
  const dedupedSlide = normalizeCompositionContentLayers(
    dedupeSlideContentBlocksForComposition(slide)
  );
  const sourceElements = options.completeContentBlocks
    ? completeElementsForContentBlocks(dedupedSlide)
    : bindElementsToContentBlocks(dedupedSlide);
  const convertedElements = sourceElements.map((element) => ({
    ...element,
    bounds: normalizeBounds(element.bounds)
  }));
  const diagnostics = analyzeSlideLayout({
    elements: convertedElements
  });
  const normalizedSlide = {
    ...dedupedSlide,
    canvas: normalizedCanvas(),
    designPlan: {
      ...dedupedSlide.designPlan,
      readingOrder: mergeReadingOrder(
        dedupedSlide.designPlan.readingOrder.filter((id) =>
          convertedElements.some((element) => element.id === id)
        ),
        convertedElements.map((element) => element.id)
      )
    },
    elements: convertedElements.map((element) =>
      fitTextElementWithinBounds(element, diagnostics.hasOverflow)
    ),
    layoutDiagnostics: mergeLayoutDiagnostics(slide.layoutDiagnostics, diagnostics)
  };
  const colorBoundSlide = options.unifiedVisualSpec
    ? bindSlideElementColorsToVisualSpec(
        normalizedSlide,
        options.unifiedVisualSpec,
        {
          addDiagnostic: true
        }
      )
    : normalizedSlide;

  return {
    ...colorBoundSlide,
    designQualityScore: buildSlideDesignQualityScore(
      colorBoundSlide,
      slide.designQualityScore?.repairStatus ?? "not-needed"
    )
  };
}

function normalizeCompositionContentLayers(slide: SlideCompositionPlan): SlideCompositionPlan {
  const used = new Set<number>();
  const layers: SlideCompositionPlan["content"]["contentLayers"] = {
    primary: [],
    supporting: [],
    supplementary: []
  };

  for (const group of ["primary", "supporting", "supplementary"] as const) {
    const maxItems = group === "primary" ? 4 : group === "supporting" ? 6 : 5;

    for (const index of slide.content.contentLayers[group]) {
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < slide.content.contentBlocks.length &&
        !used.has(index) &&
        layers[group].length < maxItems
      ) {
        used.add(index);
        layers[group].push(index);
      }
    }
  }

  const ordered = slide.content.contentBlocks
    .map((block, index) => ({ index, priority: block.priority }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index);
  const add = (group: keyof SlideCompositionPlan["content"]["contentLayers"], index: number) => {
    const maxItems = group === "primary" ? 4 : group === "supporting" ? 6 : 5;

    if (used.has(index) || layers[group].length >= maxItems) {
      return false;
    }

    used.add(index);
    layers[group].push(index);
    return true;
  };

  if (layers.primary.length === 0) {
    ordered.some(({ index }) => add("primary", index));
  }

  if (layers.supporting.length === 0) {
    ordered.some(({ index }) => add("supporting", index));
  }

  for (const { index, priority } of ordered) {
    if (used.has(index)) {
      continue;
    }

    if (priority <= 1 && add("primary", index)) {
      continue;
    }

    if (priority <= 3 && add("supporting", index)) {
      continue;
    }

    if (add("supplementary", index)) {
      continue;
    }

    if (add("supporting", index)) {
      continue;
    }

    add("primary", index);
  }

  return {
    ...slide,
    content: {
      ...slide.content,
      contentLayers: layers
    }
  };
}

function mergeReadingOrder(current: string[], elementIds: string[]) {
  return Array.from(new Set([...current, ...elementIds])).slice(0, 24);
}

export function analyzeSlideLayout(slide: Pick<SlideCompositionPlan, "elements">) {
  const warnings: string[] = [];
  let hasOverflow = false;
  let overlapCount = 0;
  let textOverflowCount = 0;
  const elements = slide.elements;
  const usedArea = elements.reduce(
    (sum, element) => sum + element.bounds.width * element.bounds.height,
    0
  );
  const density = round(Math.min(1, usedArea / (slideCanvasWidth * slideCanvasHeight)));

  for (const element of elements) {
    const overflows =
      element.bounds.x < 0 ||
      element.bounds.y < 0 ||
      element.bounds.x + element.bounds.width > slideCanvasWidth ||
      element.bounds.y + element.bounds.height > slideCanvasHeight;

    if (overflows) {
      hasOverflow = true;
      warnings.push(`元素 ${element.id} 超出页面边界。`);
    }

    if (element.type === "text" && estimateTextOverflow(element)) {
      textOverflowCount += 1;
      hasOverflow = true;
      warnings.push(`文本元素 ${element.id} 可能溢出。`);
    }
  }

  for (let index = 0; index < elements.length; index += 1) {
    for (let next = index + 1; next < elements.length; next += 1) {
      if (elementsOverlap(elements[index], elements[next])) {
        overlapCount += 1;
      }
    }
  }

  if (overlapCount > 0) {
    warnings.push(`${overlapCount} 组元素存在重叠。`);
  }

  if (density > 0.82) {
    warnings.push("页面内容密度过高，需要用户确认。");
  } else if (density > 0.72) {
    warnings.push("页面内容密度偏高。");
  }

  const needsUserConfirmation = hasOverflow || overlapCount > 0 || density > 0.82;
  const overflowFixes: Array<
    "reduce-font-size" | "compress-copy" | "adjust-layout" | "suggest-split" | "needs-user-confirmation"
  > = [];

  if (textOverflowCount > 0 || hasOverflow) {
    overflowFixes.push("reduce-font-size", "compress-copy", "adjust-layout");
  }

  if (density > 0.82) {
    overflowFixes.push("suggest-split", "needs-user-confirmation");
  }

  return {
    density,
    hasOverflow,
    needsUserConfirmation,
    overflowFixes: Array.from(new Set(overflowFixes)),
    splitSuggestion: needsUserConfirmation
      ? "建议人工确认是否需要拆分页面；v1 不会自动增加页数。"
      : undefined,
    warnings: warnings.slice(0, 8)
  };
}

export function buildSlideMotionPlan(slide: SlideCompositionPlan): SlideMotionPlan {
  const preset = slide.index % 3 === 0 ? "focus" : slide.index % 2 === 0 ? "rise" : "fade";
  const baseDelay = 80;

  return {
    preset,
    durationMs: 520,
    delayMs: 0,
    staggerMs: 90,
    elements: slide.elements.map((element, index) => ({
      elementId: element.id,
      preset: element.type === "text" ? "rise" : preset,
      delayMs: baseDelay + index * 90,
      durationMs: element.type === "generatedImage" ? 680 : 480
    }))
  };
}

function scoreSlideLayout(slide: SlideCompositionPlan) {
  const overflowCount = slide.elements.filter(
    (element) =>
      element.bounds.x + element.bounds.width > slideCanvasWidth ||
      element.bounds.y + element.bounds.height > slideCanvasHeight
  ).length;
  const crowdedCount = slide.elements.filter(
    (element) => element.bounds.width * element.bounds.height > 5200
  ).length;

  return Math.max(60, 98 - overflowCount * 20 - crowdedCount * 4);
}

export function buildSlideDesignQualityScore(
  slide: SlideCompositionPlan,
  repairStatus: SlideDesignQualityScore["repairStatus"] = "not-needed"
): SlideDesignQualityScore {
  const diagnostics = analyzeSlideLayout(slide);
  const titleCount = slide.elements.filter(
    (element) => element.type === "text" && element.semanticType === "title"
  ).length;
  const hasCoreMessage = Boolean(
    slide.pageIntent.coreMessage.trim() &&
      slide.contentHierarchy.tiers.some(
        (tier) =>
          tier.level === 1 &&
          tier.items.some((item) =>
            normalizedIncludes(
              `${item.content} ${item.role}`,
              slide.pageIntent.coreMessage
            )
          )
      )
  );
  const hasVisualAnchor = slide.elements.some((element) =>
    ["generatedImage", "chartPlaceholder", "shape"].includes(element.type)
  );
  const bodyLength = slide.content.bodyPoints.join("").length;
  const densityPenalty =
    slide.pageIntent.contentDensity === "high"
      ? Math.max(0, bodyLength - 320) / 8
      : slide.pageIntent.contentDensity === "low"
        ? Math.max(0, bodyLength - 180) / 10
        : Math.max(0, bodyLength - 240) / 10;
  const renderPenalty =
    (diagnostics.hasOverflow || slide.layoutDiagnostics.hasOverflow ? 18 : 0) +
    diagnostics.warnings.filter((warning) => warning.includes("重叠")).length * 10 +
    diagnostics.warnings.filter((warning) => warning.includes("溢出")).length * 10 +
    slide.layoutDiagnostics.warnings.filter((warning) => warning.includes("溢出")).length * 10;
  const missingContentBlockCount = getMissingContentBlockIndexes(slide).length;
  const contentBlockPenalty =
    missingContentBlockCount > 0 ? Math.min(34, 14 + missingContentBlockCount * 6) : 0;
  const hierarchyScore = clampScore(
    96 -
      (titleCount === 1 ? 0 : 22) -
      (hasCoreMessage ? 0 : 18) -
      Math.max(0, slide.contentHierarchy.tiers[0]?.items.length ? 0 : 14)
  );
  const visualConsistencyScore = clampScore(
    94 -
      (hasVisualAnchor ? 0 : 14) -
      (slide.layoutSelection.candidates.length >= 2 ? 0 : 10) -
      (slide.constraints.subjectAvoidsTitleArea ? 0 : 12)
  );
  const contentDensityScore = clampScore(
    94 - densityPenalty - (diagnostics.density > 0.82 ? 20 : diagnostics.density > 0.72 ? 8 : 0)
  );
  const renderabilityScore = clampScore(96 - renderPenalty);
  const expressionScore = clampScore(
    94 -
      (slide.content.bodyPoints.length >= 2 ? 0 : 14) -
      (slide.pageIntent.audienceTakeaway.trim().length >= 4 ? 0 : 12) -
      (slide.content.viewerObjective.description.trim().length >= 4 ? 0 : 10) -
      contentBlockPenalty
  );
  const issues = [
    ...(titleCount === 1 ? [] : ["主标题数量不是唯一。"]),
    ...(hasCoreMessage ? [] : ["核心信息未稳定进入一级信息层级。"]),
    ...(hasVisualAnchor ? [] : ["页面缺少明确视觉锚点。"]),
    ...(missingContentBlockCount > 0
      ? [`页面可展示内容未完全落版：${missingContentBlockCount} 个内容块没有对应元素。`]
      : []),
    ...diagnostics.warnings,
    ...slide.layoutDiagnostics.warnings
  ].slice(0, 10);
  const suggestions = [
    ...(hierarchyScore < 80 ? ["强化主标题、核心结论和二级支撑的层级关系。"] : []),
    ...(visualConsistencyScore < 80 ? ["统一视觉锚点、图片避让和版式候选理由。"] : []),
    ...(contentDensityScore < 80 ? ["压缩正文或改用更紧凑的信息图结构。"] : []),
    ...(renderabilityScore < 80 ? ["调整元素位置、字号或卡片宽度，避免溢出和重叠。"] : []),
    ...(missingContentBlockCount > 0 ? ["为每个可展示内容块补充对应画布元素。"] : []),
    ...(expressionScore < 80 ? ["补足观众记忆点和表达完整性。"] : [])
  ].slice(0, 10);
  const dimensions = {
    contentDensity: {
      score: contentDensityScore,
      summary: contentDensityScore >= 80 ? "内容密度可控。" : "内容密度需要收敛。"
    },
    expressionCompleteness: {
      score: expressionScore,
      summary:
        missingContentBlockCount > 0
          ? "部分可展示内容未落版。"
          : expressionScore >= 80
            ? "表达链路完整。"
            : "表达目标或观众记忆点不够完整。"
    },
    informationHierarchy: {
      score: hierarchyScore,
      summary: hierarchyScore >= 80 ? "信息层级清晰。" : "主标题、核心信息和支撑层级需要强化。"
    },
    renderability: {
      score: renderabilityScore,
      summary: renderabilityScore >= 80 ? "页面可渲染性稳定。" : "页面存在溢出、重叠或边界风险。"
    },
    visualConsistency: {
      score: visualConsistencyScore,
      summary: visualConsistencyScore >= 80 ? "视觉约束一致。" : "视觉锚点或版式约束需要统一。"
    }
  };
  const totalScore = Math.round(
    (dimensions.informationHierarchy.score +
      dimensions.visualConsistency.score +
      dimensions.contentDensity.score +
      dimensions.renderability.score +
      dimensions.expressionCompleteness.score) /
      5
  );

  return {
    dimensions,
    issues,
    repairStatus,
    suggestions,
    totalScore
  };
}

export function needsSlideDesignRepair(score: SlideDesignQualityScore) {
  return (
    score.totalScore < 78 ||
    Object.values(score.dimensions).some((dimension) => dimension.score < 65)
  );
}

function normalizedCanvas() {
  return {
    aspectRatio: "16:9" as const,
    height: slideCanvasHeight as 7.5,
    safeMargin: slideCanvasSafeMargin as 0.5,
    unit: slideCanvasUnit as "inch",
    width: slideCanvasWidth as 13.333
  };
}

function normalizeBounds(bounds: SlideElement["bounds"]) {
  const isLegacyPercent =
    bounds.x > slideCanvasWidth ||
    bounds.y > slideCanvasHeight ||
    bounds.width > slideCanvasWidth ||
    bounds.height > slideCanvasHeight;
  const normalized = isLegacyPercent
    ? {
        x: (bounds.x / 100) * slideCanvasWidth,
        y: (bounds.y / 100) * slideCanvasHeight,
        width: (bounds.width / 100) * slideCanvasWidth,
        height: (bounds.height / 100) * slideCanvasHeight
      }
    : bounds;

  return {
    x: round(clamp(normalized.x, 0, slideCanvasWidth - 0.05)),
    y: round(clamp(normalized.y, 0, slideCanvasHeight - 0.05)),
    width: round(clamp(normalized.width, 0.05, slideCanvasWidth - normalized.x)),
    height: round(clamp(normalized.height, 0.05, slideCanvasHeight - normalized.y))
  };
}

function fitTextElementWithinBounds(element: SlideElement, hasOverflow: boolean) {
  if (element.type !== "text" || !element.textStyle || !hasOverflow) {
    return element;
  }

  return {
    ...element,
    textStyle: {
      ...element.textStyle,
      fontSize: Math.max(8, element.textStyle.fontSize - 2)
    }
  };
}

function estimateTextOverflow(element: SlideElement) {
  if (element.type !== "text" || !element.content) {
    return false;
  }

  const fontSize = element.textStyle?.fontSize ?? 14;
  const lineHeight = element.textStyle?.lineHeight ?? 1.25;
  const maxLines = element.textStyle?.maxLines ?? 6;
  const charsPerLine = Math.max(
    1,
    Math.floor(element.bounds.width / ((fontSize * 0.55) / 72))
  );
  const explicitLines = element.content.split(/\n/);
  const estimatedLines = explicitLines.reduce(
    (sum, line) => sum + Math.max(1, Math.ceil([...line].length / charsPerLine)),
    0
  );
  const requiredHeight = ((fontSize * lineHeight) / 72) * estimatedLines;

  return estimatedLines > maxLines || requiredHeight > element.bounds.height;
}

function elementsOverlap(a: SlideElement, b: SlideElement) {
  if (a.zIndex !== b.zIndex && (a.semanticType === "background" || b.semanticType === "background")) {
    return false;
  }

  const horizontal =
    a.bounds.x < b.bounds.x + b.bounds.width &&
    a.bounds.x + a.bounds.width > b.bounds.x;
  const vertical =
    a.bounds.y < b.bounds.y + b.bounds.height &&
    a.bounds.y + a.bounds.height > b.bounds.y;
  const area =
    Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width) -
    Math.max(a.bounds.x, b.bounds.x);
  const height =
    Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height) -
    Math.max(a.bounds.y, b.bounds.y);

  return horizontal && vertical && area * height > 0.04;
}

function mergeLayoutDiagnostics(
  original: SlideCompositionPlan["layoutDiagnostics"],
  computed: SlideCompositionPlan["layoutDiagnostics"]
) {
  return {
    ...original,
    density: computed.density,
    hasOverflow: original.hasOverflow || computed.hasOverflow,
    needsUserConfirmation:
      original.needsUserConfirmation || computed.needsUserConfirmation,
    overflowFixes: Array.from(
      new Set([...original.overflowFixes, ...computed.overflowFixes])
    ),
    splitSuggestion: computed.splitSuggestion ?? original.splitSuggestion,
    warnings: Array.from(new Set([...original.warnings, ...computed.warnings])).slice(0, 8)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizedIncludes(text: string, query: string) {
  const normalizedText = text.replace(/\s+/g, "").toLowerCase();
  const normalizedQuery = query.replace(/\s+/g, "").toLowerCase();

  return (
    normalizedText.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedText.slice(0, Math.min(12, normalizedText.length)))
  );
}
