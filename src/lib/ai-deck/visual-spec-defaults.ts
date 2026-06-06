import { getPptTypeVisualTone } from "@/lib/create-deck/visual-tone";

import type { AnalyzeDeckRequest, UnifiedVisualSpec } from "./schema";

type PaletteSeed = {
  accent: string[];
  chart: string[];
  neutral: string[];
  primary: string[];
  secondary: string[];
};

export const fallbackPaletteSeeds: Record<AnalyzeDeckRequest["palette"], string[]> = {
  "star-map": [
    "#246BFE",
    "#5B8DFF",
    "#16A085",
    "#3B82F6",
    "#22C55E",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#F6F8FB",
    "#D9E7FF",
    "#17202A",
    "#64748B",
    "#FFB020",
    "#00C2A8"
  ],
  matrix: [
    "#13966A",
    "#2DD4BF",
    "#2563EB",
    "#16A34A",
    "#06B6D4",
    "#84CC16",
    "#F59E0B",
    "#7C3AED",
    "#F3FBF7",
    "#D9F3E9",
    "#17202A",
    "#64748B",
    "#22C55E",
    "#0EA5E9"
  ],
  "deep-space": [
    "#7C3AED",
    "#14B8A6",
    "#2563EB",
    "#8B5CF6",
    "#06B6D4",
    "#F59E0B",
    "#EF4444",
    "#22C55E",
    "#F7F3FF",
    "#EADCFF",
    "#171F2A",
    "#64748B",
    "#A78BFA",
    "#2DD4BF"
  ],
  "morning-mist": [
    "#C05621",
    "#2563EB",
    "#16A085",
    "#D97706",
    "#3B82F6",
    "#22C55E",
    "#EF4444",
    "#8B5CF6",
    "#FFFAF4",
    "#F7E5D6",
    "#17202A",
    "#64748B",
    "#F59E0B",
    "#0EA5E9"
  ],
  "moon-white": [
    "#5B7C99",
    "#8BA6BC",
    "#2F7D5B",
    "#5B7C99",
    "#7FA3B8",
    "#2F7D5B",
    "#A56A15",
    "#B73756",
    "#384252",
    "#F7FAFC",
    "#E6EEF5",
    "#1F2937",
    "#64748B",
    "#C9A46A"
  ],
  "bamboo-green": [
    "#2F7D5B",
    "#6EA886",
    "#5B7C99",
    "#2F7D5B",
    "#6BAF92",
    "#5B7C99",
    "#A56A15",
    "#284B7A",
    "#B73756",
    "#F6FAF7",
    "#E1F0E8",
    "#17251E",
    "#5F6F67",
    "#C9A46A"
  ],
  "dai-blue": [
    "#284B7A",
    "#5B7C99",
    "#A56A15",
    "#284B7A",
    "#4F6F9F",
    "#2F7D5B",
    "#A56A15",
    "#B73756",
    "#6B7280",
    "#F5F8FC",
    "#DFE9F4",
    "#172033",
    "#64748B",
    "#C9A46A"
  ],
  rouge: [
    "#B73756",
    "#D46A7C",
    "#2F7D5B",
    "#B73756",
    "#C95C70",
    "#284B7A",
    "#A56A15",
    "#2F7D5B",
    "#5B7C99",
    "#FFF7F8",
    "#F5DDE4",
    "#2D1720",
    "#705B62",
    "#C9A46A"
  ],
  "gilded-gold": [
    "#A56A15",
    "#C9A46A",
    "#284B7A",
    "#A56A15",
    "#C2872A",
    "#2F7D5B",
    "#284B7A",
    "#B73756",
    "#7C6A4B",
    "#FFF9EF",
    "#F3E8D2",
    "#2B2114",
    "#756756",
    "#8F5B16"
  ],
  "ink-black": [
    "#384252",
    "#64748B",
    "#2F7D5B",
    "#384252",
    "#64748B",
    "#284B7A",
    "#A56A15",
    "#B73756",
    "#6B7280",
    "#F7F8FA",
    "#E5E8ED",
    "#111827",
    "#6B7280",
    "#C9A46A"
  ]
};

const fallbackGroupedPaletteSeeds: Record<AnalyzeDeckRequest["palette"], PaletteSeed> = {
  "star-map": {
    accent: ["#FFB020", "#00C2A8"],
    chart: ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"],
    neutral: ["#F6F8FB", "#D9E7FF", "#17202A", "#64748B"],
    primary: ["#246BFE"],
    secondary: ["#5B8DFF", "#16A085"]
  },
  matrix: {
    accent: ["#22C55E", "#0EA5E9"],
    chart: ["#16A34A", "#06B6D4", "#84CC16", "#F59E0B", "#7C3AED"],
    neutral: ["#F3FBF7", "#D9F3E9", "#17202A", "#64748B"],
    primary: ["#13966A"],
    secondary: ["#2DD4BF", "#2563EB"]
  },
  "deep-space": {
    accent: ["#A78BFA", "#2DD4BF"],
    chart: ["#8B5CF6", "#06B6D4", "#F59E0B", "#EF4444", "#22C55E"],
    neutral: ["#F7F3FF", "#EADCFF", "#171F2A", "#64748B"],
    primary: ["#7C3AED"],
    secondary: ["#14B8A6", "#2563EB"]
  },
  "morning-mist": {
    accent: ["#F59E0B", "#0EA5E9"],
    chart: ["#D97706", "#3B82F6", "#22C55E", "#EF4444", "#8B5CF6"],
    neutral: ["#FFFAF4", "#F7E5D6", "#17202A", "#64748B"],
    primary: ["#C05621"],
    secondary: ["#2563EB", "#16A085"]
  },
  "moon-white": {
    accent: ["#C9A46A"],
    chart: ["#5B7C99", "#7FA3B8", "#2F7D5B", "#A56A15", "#B73756"],
    neutral: ["#F7FAFC", "#E6EEF5", "#1F2937", "#64748B"],
    primary: ["#5B7C99"],
    secondary: ["#8BA6BC", "#2F7D5B"]
  },
  "bamboo-green": {
    accent: ["#C9A46A"],
    chart: ["#2F7D5B", "#6BAF92", "#5B7C99", "#A56A15", "#284B7A", "#B73756"],
    neutral: ["#F6FAF7", "#E1F0E8", "#17251E", "#5F6F67"],
    primary: ["#2F7D5B"],
    secondary: ["#6EA886", "#5B7C99"]
  },
  "dai-blue": {
    accent: ["#C9A46A"],
    chart: ["#284B7A", "#4F6F9F", "#2F7D5B", "#A56A15", "#B73756", "#6B7280"],
    neutral: ["#F5F8FC", "#DFE9F4", "#172033", "#64748B"],
    primary: ["#284B7A"],
    secondary: ["#5B7C99", "#A56A15"]
  },
  rouge: {
    accent: ["#C9A46A"],
    chart: ["#B73756", "#C95C70", "#284B7A", "#A56A15", "#2F7D5B", "#5B7C99"],
    neutral: ["#FFF7F8", "#F5DDE4", "#2D1720", "#705B62"],
    primary: ["#B73756"],
    secondary: ["#D46A7C", "#2F7D5B"]
  },
  "gilded-gold": {
    accent: ["#8F5B16"],
    chart: ["#A56A15", "#C2872A", "#2F7D5B", "#284B7A", "#B73756", "#7C6A4B"],
    neutral: ["#FFF9EF", "#F3E8D2", "#2B2114", "#756756"],
    primary: ["#A56A15"],
    secondary: ["#C9A46A", "#284B7A"]
  },
  "ink-black": {
    accent: ["#C9A46A"],
    chart: ["#384252", "#64748B", "#284B7A", "#A56A15", "#B73756", "#6B7280"],
    neutral: ["#F7F8FA", "#E5E8ED", "#111827", "#6B7280"],
    primary: ["#384252"],
    secondary: ["#64748B", "#2F7D5B"]
  }
};

export function buildFallbackColorPalette(
  paletteId: AnalyzeDeckRequest["palette"],
  locale: AnalyzeDeckRequest["locale"]
): UnifiedVisualSpec["colorPalette"] {
  return buildColorPaletteFromGroupedSeed(
    fallbackGroupedPaletteSeeds[paletteId],
    locale
  );
}

export function buildColorPaletteFromGroupedSeed(
  seed: PaletteSeed,
  locale: AnalyzeDeckRequest["locale"]
): UnifiedVisualSpec["colorPalette"] {
  const isChinese = locale === "zh-CN";
  const label = (zh: string, en: string) => (isChinese ? zh : en);
  const normalizeGroup = (
    values: string[],
    fallbackValues: string[],
    minItems: number,
    maxItems: number
  ) => {
    const normalized = Array.from(
      new Set(
        [...values, ...fallbackValues]
          .map((color) => normalizeHex(color))
          .filter(Boolean)
      )
    );

    return normalized.length >= minItems
      ? normalized.slice(0, maxItems)
      : fallbackValues
          .map((color) => normalizeHex(color))
          .filter(Boolean)
          .slice(0, maxItems);
  };
  const fallbackSeed = fallbackGroupedPaletteSeeds["star-map"];
  const primary = normalizeGroup(seed.primary, fallbackSeed.primary, 1, 1);
  const secondary = normalizeGroup(seed.secondary, fallbackSeed.secondary, 2, 3);
  const chart = normalizeGroup(seed.chart, fallbackSeed.chart, 4, 8);
  const neutral = normalizeGroup(seed.neutral, fallbackSeed.neutral, 2, 4);
  const accent = normalizeGroup(seed.accent, fallbackSeed.accent, 1, 2);

  return {
    primary: primary.map((hex) => ({
      name: label("主色", "Primary"),
      hex,
      usage: label("用于品牌主视觉、关键动作和图表主序列。", "For brand anchors, key actions, and primary chart series.")
    })),
    secondary: secondary.slice(0, 3).map((hex, index) => ({
      name: label(`辅助色 ${index + 1}`, `Secondary ${index + 1}`),
      hex,
      usage:
        index === 0
          ? label("用于次级强调、图标和轻量装饰。", "For secondary emphasis, icons, and light decoration.")
          : label("用于辅助标签、线条和流程节点。", "For auxiliary tags, lines, and process nodes.")
    })),
    chart: chart.slice(0, 8).map((hex, index) => ({
      name: label(`图表色 ${index + 1}`, `Chart ${index + 1}`),
      hex,
      usage: label("仅用于图表系列、排名和数据对比。", "Only for chart series, ranking, and data comparison.")
    })),
    neutral: neutral.slice(0, 4).map((hex, index) => ({
      name: label(`中性色 ${index + 1}`, `Neutral ${index + 1}`),
      hex,
      usage:
        index < 2
          ? label("用于背景、卡片、表格底色和弱分区。", "For backgrounds, cards, table fills, and subtle sections.")
          : label("用于标题、正文、注释和分隔线。", "For titles, body text, notes, and dividers.")
    })),
    accent: accent.slice(0, 2).map((hex, index) => ({
      name: label(index === 0 ? "强调色" : "高亮色", index === 0 ? "Accent" : "Highlight"),
      hex,
      usage: label("用于关键数字、重点标签和局部高亮，不可大面积使用。", "For key numbers, priority tags, and local highlights; avoid large areas.")
    }))
  };
}

export function buildColorPaletteFromHexes(
  seed: string[],
  locale: AnalyzeDeckRequest["locale"]
): UnifiedVisualSpec["colorPalette"] {
  const isChinese = locale === "zh-CN";
  const colors = ensurePaletteSeed(seed);
  const label = (zh: string, en: string) => (isChinese ? zh : en);

  return {
    primary: [
      {
        name: label("主色", "Primary"),
        hex: colors[0],
        usage: label("用于品牌主视觉、关键动作和图表主序列。", "For brand anchors, key actions, and primary chart series.")
      }
    ],
    secondary: [
      {
        name: label("辅助色一", "Secondary 1"),
        hex: colors[1],
        usage: label("用于次级强调、图标和轻量装饰。", "For secondary emphasis, icons, and light decoration.")
      },
      {
        name: label("辅助色二", "Secondary 2"),
        hex: colors[2],
        usage: label("用于辅助标签、线条和流程节点。", "For auxiliary tags, lines, and process nodes.")
      }
    ],
    chart: colors.slice(3, 9).map((hex, index) => ({
      name: label(`图表色 ${index + 1}`, `Chart ${index + 1}`),
      hex,
      usage: label("仅用于图表系列、排名和数据对比。", "Only for chart series, ranking, and data comparison.")
    })),
    neutral: colors.slice(9, 13).map((hex, index) => ({
      name: label(`中性色 ${index + 1}`, `Neutral ${index + 1}`),
      hex,
      usage:
        index < 2
          ? label("用于背景、卡片、表格底色和弱分区。", "For backgrounds, cards, table fills, and subtle sections.")
          : label("用于标题、正文、注释和分隔线。", "For titles, body text, notes, and dividers.")
    })),
    accent: colors.slice(13, 15).map((hex, index) => ({
      name: label(index === 0 ? "强调色" : "高亮色", index === 0 ? "Accent" : "Highlight"),
      hex,
      usage: label("用于关键数字、重点标签和局部高亮，不可大面积使用。", "For key numbers, priority tags, and local highlights; avoid large areas.")
    }))
  };
}

export function buildFallbackUnifiedVisualSpec(
  input: AnalyzeDeckRequest
): UnifiedVisualSpec {
  const isChinese = input.locale === "zh-CN";
  const palette = buildFallbackColorPalette(input.palette, input.locale);
  const primary = palette.primary[0].hex;
  const secondary = palette.secondary[0].hex;
  const neutralBg = palette.neutral[0].hex;
  const neutralSurface = palette.neutral[1].hex;
  const neutralText = palette.neutral[2].hex;
  const accent = palette.accent[0].hex;
  const highlight = palette.accent[1]?.hex ?? palette.secondary[1].hex;
  const tone = getDeckTypeToneFallback(input);

  return {
    themeName: isChinese ? "统一视觉方案" : "Unified visual system",
    visualStyle: isChinese
      ? `围绕“${compactText(input.goal, 48)}”保持清晰层级、统一色板和克制装饰。`
      : `Keep clear hierarchy, one palette, and restrained decoration around "${compactText(input.goal, 58)}".`,
    designIntent: isChinese
      ? "让观众快速识别主题、理解层级并记住每页核心判断。"
      : "Help viewers quickly identify the topic, hierarchy, and core judgment on each slide.",
    usageConvenience: isChinese
      ? "便于后续页面编排、图片生成、PPTX 导出和人工编辑复用。"
      : "Designed for page layout, image generation, PPTX export, and manual editing reuse.",
    colorPalette: palette,
    typography: isChinese
      ? "标题醒目有层级，正文保持高可读性和稳定行距。"
      : "Use clear title hierarchy and readable body text with stable line height.",
    imageStyle: isChinese
      ? "图片图层保持干净边缘、低噪声背景，并避免密集文字。"
      : "Keep image layers clean-edged, low-noise, and free of dense text.",
    consistencyRules: isChinese
      ? ["所有页面沿用同一色板", "标题和正文层级保持一致", "每页聚焦一个中心观点"]
      : ["Reuse one palette across slides", "Keep title and body hierarchy consistent", "Focus each slide on one key point"],
    forbiddenRules: isChinese
      ? ["不要生成密集小字图片", "不要使用与主题无关的装饰", "不要使用未声明颜色"]
      : ["Do not generate dense text inside images", "Do not use unrelated decoration", "Do not use undeclared colors"],
    pageSpec: {
      aspectRatio: "16:9",
      canvasPixels: {
        height: 1080,
        width: 1920
      },
      gridColumns: 12,
      gridGutterPx: 24,
      height: 7.5,
      layoutInstruction: isChinese
        ? "这是一页 16:9 的 PPT，宽 13.333 英寸、高 7.5 英寸，内容避开四周 0.5 英寸安全边距，并基于 12 栏栅格自动排版。"
        : "Use a 16:9 PPT slide, 13.333 inches wide and 7.5 inches high. Keep content away from the 0.5-inch safe margin and align layout to a 12-column grid.",
      safeMargin: 0.5,
      safeMarginPxRange: {
        horizontal: "48-72px",
        vertical: "40-64px"
      },
      unit: "inch",
      width: 13.333
    },
    typographyRules: {
      defaultFontSize: 15,
      fontFallback: isChinese
        ? ["PingFang SC", "Microsoft YaHei", "Arial", "sans-serif"]
        : ["Arial", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      lineHeight: 1.25,
      maxLines: 8,
      minFontSize: 8,
      scale: buildTypographyScaleFallback(isChinese),
      textLimits: {
        bodyBulletMaxChineseChars: 24,
        bodyModuleBulletCount: isChinese ? "每个正文模块建议 3-5 条 bullet。" : "Each body module should usually contain 3-5 bullets.",
        coverTitleMaxLines: 2,
        iconLabelMaxChineseChars: 10,
        noteMaxChineseChars: 32,
        pageTitleMaxLines: 2,
        sectionTitleMaxLines: isChinese ? "小节标题最多 1-2 行。" : "Section titles use at most 1-2 lines.",
        textBoxRule: isChinese ? "不允许在单个文本框中输出大段连续正文。" : "Do not output long continuous paragraphs in a single text box."
      }
    },
    colorRoles: {
      accent: `${accent} ${isChinese ? "用于关键数字、核心结论和重点标签。" : "for key numbers, core conclusions, and priority tags."}`,
      background: `${neutralBg} ${isChinese ? "用于页面主背景。" : "for main slide backgrounds."}`,
      bodyText: `${neutralText} ${isChinese ? "用于正文和主要信息，正文色和背景色对比度不得低于 4.5:1。" : "for body copy and primary information with at least 4.5:1 contrast."}`,
      borderDivider: `${neutralSurface} ${isChinese ? "用于边框、分隔线和低权重网格线。" : "for borders, dividers, and low-emphasis gridlines."}`,
      chart: `${palette.chart.map((color) => color.hex).join(" / ")} ${isChinese ? "用于图表序列，同一页图表颜色不可超过 6 个。" : "for chart series, with no more than 6 chart colors per slide."}`,
      contrastRequirement: isChinese
        ? "正文与背景对比度不得低于 4.5:1；大标题不得低于 3:1；关键数字、按钮和标签文字不得低于 4.5:1。"
        : "Body/background contrast must be at least 4.5:1; large titles at least 3:1; key numbers, buttons, and tags at least 4.5:1.",
      decorative: `${secondary} ${isChinese ? "仅用于线条、角标和轻量背景块，不承载大段正文。" : "only for lines, corner markers, and light background blocks, not long body copy."}`,
      highlight: `${highlight} ${isChinese ? "每页最多使用 1-2 处，用于提醒、选中态或局部重点。" : "use at most 1-2 times per slide for alerts, selected states, or local focus."}`,
      surface: `${neutralSurface} ${isChinese ? "用于卡片、内容容器、表格底色和信息分区。" : "for cards, content containers, table fills, and information sections."}`,
      titleText: `${neutralText} / ${primary} ${isChinese ? "用于标题、结论句和层级区分。" : "for titles, conclusion lines, and hierarchy separation."}`
    },
    transparencyRules: [
      {
        baseHex: neutralSurface,
        opacity: 0.35,
        usage: isChinese ? "用于弱背景、表格斑马纹和轻量分区。" : "For weak backgrounds, zebra rows, and subtle sections."
      },
      {
        baseHex: neutralText,
        opacity: 0.12,
        usage: isChinese ? "用于分隔线、悬浮层边框和轻量遮罩。" : "For dividers, floating borders, and light overlays."
      },
      {
        baseHex: primary,
        opacity: 0.16,
        usage: isChinese ? "用于选中态或强调标签弱底色。" : "For selected states or soft emphasis tag fills."
      }
    ],
    imageRules: {
      aspectRatio: "16:9",
      backgroundAvoidsHighContrastTextArea: true,
      forbiddenItems: isChinese
        ? ["不要密集文字", "不要水印", "不要复杂背景", "不要主体压住标题区"]
        : ["No dense text", "No watermarks", "No complex backgrounds", "Do not place subjects over the title area"],
      imagePromptStyle: isChinese
        ? `${tone}，专业演示素材，低噪声背景，主体清晰，避开标题区，颜色只参考统一色板。`
        : `${tone}, professional presentation asset, low-noise background, clear subject, avoid title area, colors only from the unified palette.`,
      imageType: "illustration",
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
    pptTypeVisualTone: getPptTypeVisualTone(input.deckType, input.locale),
    informationDensityRules: buildInformationDensityRulesFallback(input, isChinese),
    layoutRules: buildLayoutRulesFallback(isChinese),
    chartVisualRules: buildChartVisualRulesFallback(isChinese),
    imageIllustrationRules: {
      style: isChinese
        ? `${tone} 图片/插画保持干净、统一、低噪声，不生成含文字的复杂素材。`
        : `${tone} Images/illustrations stay clean, unified, low-noise, and free of dense text.`,
      composition: isChinese
        ? "主视觉每页最多一个，主体避开标题区和关键文字区。"
        : "Use at most one hero visual per slide and keep subjects away from title and key text areas.",
      background: isChinese
        ? "背景图必须低对比、可承托文字，不使用复杂纹理或高亮文字块。"
        : "Background images must be low-contrast and text-supporting, without complex texture or bright text blocks.",
      consistency: isChinese
        ? "整套素材保持同一摄影/插画风格、光线、透视和边缘处理。"
        : "Keep one photo/illustration style, lighting, perspective, and edge treatment across the deck."
    },
    iconStyleRules: {
      style: "line",
      stroke: isChinese
        ? "线性图标使用 1.5-2px 等效线宽，圆角和端点保持一致。"
        : "Line icons use an equivalent 1.5-2px stroke with consistent corners and caps.",
      usage: isChinese
        ? "图标只辅助识别概念或步骤，不替代正文结论。"
        : "Icons support concept or step recognition and never replace the main conclusion.",
      consistency: isChinese
        ? "整套图标保持单色或双色体系，不混用线性、面性和复杂插画图标。"
        : "Keep icons monochrome or duotone and do not mix line, filled, and complex illustration icons."
    },
    emphasisRules: {
      highlight: isChinese
        ? "高亮只用于真正需要聚焦的信息，每页最多 1-2 处。"
        : "Highlight only truly focal information, at most 1-2 instances per slide.",
      keyNumbers: isChinese
        ? "重点数字使用更大字号、强调色或指标卡承载，并补充单位和口径。"
        : "Key numbers use larger type, accent color, or metric cards with units and definitions.",
      keywords: isChinese
        ? "关键词可用加粗、强调色或浅底标签，不使用大面积荧光色。"
        : "Keywords may use bold, accent color, or soft tags without large fluorescent areas.",
      conclusion: isChinese
        ? "结论句优先放在标题下或正文起始位置，形成清晰阅读入口。"
        : "Place conclusion statements under titles or at the start of body copy for a clear entry point."
    },
    componentRules: {
      card: isChinese
        ? "卡片圆角 6-8px，边框使用边框/分隔线色，内边距 20-32px，同页等高或统一对齐。"
        : "Cards use 6-8px radius, divider-color borders, 20-32px padding, and aligned heights/baselines on the same slide.",
      tag: isChinese
        ? "标签使用强调色、高亮色或透明版本，字号 14-18px，文字不超过 10 个中文字符，同页不超过 6 个。"
        : "Tags use accent/highlight colors or transparent variants, 14-18px type, short labels, and no more than 6 per slide.",
      metric: isChinese
        ? "核心数字每页 1-4 个，数字 48-72px，单位为数字的 40%-55%，必须配简短说明。"
        : "Use 1-4 key metrics per slide, 48-72px numbers, units at 40%-55%, and concise explanations.",
      table: isChinese
        ? "单页表格不超过 6 列 8 行，表头区分清楚，分隔线使用色板或透明版本，重要列最多强调 3 项。"
        : "Tables stay within 6 columns and 8 rows, use clear headers, palette/transparent dividers, and at most 3 emphasized values.",
      chart: isChinese
        ? "图表颜色来自图表色组，同一页不超过 6 个；网格线低权重，图例不得遮挡主体，标题和来源层级清晰。"
        : "Charts use the chart palette, max 6 colors per slide; gridlines stay subtle, legends avoid data, and titles/sources are clear.",
      icon: isChinese
        ? "图标尺寸 20-32px，关键视觉可到 40-56px；不混用线性、填充和 3D 图标。"
        : "Icons use 20-32px sizes, hero icons may reach 40-56px, and line/filled/3D styles are not mixed."
    },
    forbiddenVisualRules: isChinese
      ? [
          "避免高饱和大面积撞色。",
          "避免过度阴影、厚重发光和复杂背景。",
          "避免在图片内生成密集文字、Logo 水印或不可读标签。",
          "避免动画滥用；本阶段只记录动效计划，不影响静态 PPTX。",
          "避免自由漂浮式布局，除封面或章节视觉页外必须对齐栅格。",
          "避免低对比度文字直接叠加在图片上。"
        ]
      : [
          "Avoid large areas of high-saturation clashing colors.",
          "Avoid excessive shadows, heavy glows, and complex backgrounds.",
          "Avoid dense text, logo watermarks, or unreadable labels inside images.",
          "Avoid overusing animation; this stage records motion plans but PPTX remains static.",
          "Avoid free-floating layouts except cover or chapter visual slides; align to the grid.",
          "Avoid low-contrast text directly over images."
        ]
  };
}

export function buildTypographyScaleFallback(
  isChinese: boolean
): UnifiedVisualSpec["typographyRules"]["scale"] {
  return {
    coverTitle: {
      fontSize: 60,
      fontWeight: "bold",
      lineHeight: 1.1,
      usage: isChinese ? "封面主标题，最多两行。" : "Cover title, two lines maximum."
    },
    coverSubtitle: {
      fontSize: 28,
      fontWeight: "medium",
      lineHeight: 1.35,
      usage: isChinese ? "封面说明、日期、作者。" : "Cover subtitle, date, and author."
    },
    pageTitle: {
      fontSize: 40,
      fontWeight: "semibold",
      lineHeight: 1.2,
      usage: isChinese ? "内容页主标题，最多两行。" : "Main content slide title, two lines maximum."
    },
    sectionTitle: {
      fontSize: 28,
      fontWeight: "semibold",
      lineHeight: 1.28,
      usage: isChinese ? "模块标题和卡片标题。" : "Section and card titles."
    },
    body: {
      fontSize: 20,
      fontWeight: "regular",
      lineHeight: 1.45,
      usage: isChinese ? "正文要点、说明段落和卡片内容。" : "Body bullets, explanation copy, and card content."
    },
    annotation: {
      fontSize: 14,
      fontWeight: "regular",
      lineHeight: 1.4,
      usage: isChinese ? "来源、脚注、单位和风险提示。" : "Sources, footnotes, units, and risk notes."
    },
    chartLabel: {
      fontSize: 15,
      fontWeight: "medium",
      lineHeight: 1.3,
      usage: isChinese ? "图表坐标、标签、图例和数据标注。" : "Chart axes, labels, legends, and data callouts."
    },
    iconLabel: {
      fontSize: 16,
      fontWeight: "medium",
      lineHeight: 1.3,
      usage: isChinese ? "图标说明和流程标签。" : "Icon captions and process labels."
    }
  };
}

function buildInformationDensityRulesFallback(
  input: AnalyzeDeckRequest,
  isChinese: boolean
): UnifiedVisualSpec["informationDensityRules"] {
  return isChinese
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
      };
}

function buildLayoutRulesFallback(
  isChinese: boolean
): UnifiedVisualSpec["layoutRules"] {
  return isChinese
    ? {
        pageMargin: "重要内容保持在 0.5 英寸安全边距内，标题区与正文区分离。",
        sectionGap: "标题与正文间距 24-40px，模块之间 24-48px，图表与说明 12-20px。",
        elementGap: "同类元素保持一致间距，按 12 栏栅格和 16/24px 栏间距对齐。",
        whitespace: "留白用于强调层级，避免拥挤或松散。"
      }
    : {
        pageMargin: "Keep important content inside the 0.5-inch safe margin and separate title and body zones.",
        sectionGap: "Use 24-40px title/body gaps, 24-48px module gaps, and 12-20px chart/note gaps.",
        elementGap: "Keep similar elements consistently spaced and aligned to the 12-column grid with 16/24px gutters.",
        whitespace: "Use whitespace to clarify hierarchy without crowding or looseness."
      };
}

function buildChartVisualRulesFallback(
  isChinese: boolean
): UnifiedVisualSpec["chartVisualRules"] {
  return isChinese
    ? {
        chartTypes: "按数据关系选择柱状、折线、饼图/环形、矩阵、表格或指标卡，不为装饰而画图。",
        axisAndGrid: "坐标轴和网格线使用分隔线色或透明版本，视觉权重必须低于数据本身。",
        labelRules: "图表标签使用统一字号，单位、时间范围和口径靠近数据，图例优先右侧或底部。",
        colorUsage: "图表颜色必须来自图表色组，同一页图表颜色不可超过 6 个。",
        sourceNotes: "外部数据、引用和研究结论需在图表下方或页脚标注来源。"
      }
    : {
        chartTypes: "Choose bars, lines, pie/donut, matrices, tables, or metric cards by data relationship, not decoration.",
        axisAndGrid: "Axes and gridlines use divider colors or transparent variants and stay visually lighter than data.",
        labelRules: "Use consistent label sizes, keep units/ranges/definitions near data, and place legends right or bottom.",
        colorUsage: "Chart colors must come from the chart palette, with no more than 6 chart colors per slide.",
        sourceNotes: "External data, quotes, and research claims need source notes under charts or in footers."
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

function ensurePaletteSeed(seed: string[]) {
  const normalized = Array.from(
    new Set(seed.map((color) => normalizeHex(color)).filter(Boolean))
  );
  const defaults = [
    "#246BFE",
    "#5B8DFF",
    "#16A085",
    "#3B82F6",
    "#22C55E",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#F6F8FB",
    "#D9E7FF",
    "#17202A",
    "#64748B",
    "#FFB020",
    "#00C2A8"
  ];

  return [...normalized, ...defaults]
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 14);
}

function normalizeHex(value: string) {
  const match = value.match(/^#?[0-9a-fA-F]{6}$/);

  return match ? `#${value.replace("#", "").toUpperCase()}` : "";
}

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}
