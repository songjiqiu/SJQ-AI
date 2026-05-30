import type {
  AnalyzedDeckResult,
  AnalyzeDeckRequest,
  ConsistencyReport,
  ContentReview,
  SlideCompositionPlan,
  SlideMotionPlan
} from "./schema";

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
  const paletteScore =
    deck.unifiedVisualSpec.colorPalette.length >= 3 &&
    deck.unifiedVisualSpec.colorPalette.length <= 6
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
      element.bounds.x + element.bounds.width > 100 ||
      element.bounds.y + element.bounds.height > 100
  ).length;
  const crowdedCount = slide.elements.filter(
    (element) => element.bounds.width * element.bounds.height > 5200
  ).length;

  return Math.max(60, 98 - overflowCount * 20 - crowdedCount * 4);
}
