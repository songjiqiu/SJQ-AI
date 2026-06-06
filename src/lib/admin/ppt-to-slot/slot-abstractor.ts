import type {
  PptLayoutAnalysis,
  PptRawSlide,
  PptSlotTemplateJson,
  PptSlotTemplateSlot
} from "@/lib/admin/ppt-to-slot/types";

export type SlotSemanticEnhancement = {
  layoutPattern?: string;
  pageTypes?: string[];
  slotLabels?: Record<
    string,
    {
      roles?: string[];
      slotName?: string;
    }
  >;
  usage?: {
    notSuitableFor?: string[];
    suitableFor?: string[];
  };
};

export function abstractSlideToSlotTemplate({
  analysis,
  enhancement,
  slide,
  sourceFile
}: {
  analysis: PptLayoutAnalysis;
  enhancement?: SlotSemanticEnhancement | null;
  slide: PptRawSlide;
  sourceFile: string;
}): PptSlotTemplateJson {
  const slots: Record<string, PptSlotTemplateSlot> = {};

  for (const region of analysis.regions) {
    const llmLabel = enhancement?.slotLabels?.[region.regionId];
    const slotId = normalizeSlotId(llmLabel?.slotName ?? defaultSlotName(region.regionId));
    const roles = normalizeRoles(llmLabel?.roles ?? region.possibleRoles);

    slots[slotId] = {
      constraints: buildConstraints(slotId, roles),
      frame: region.frame,
      id: slotId,
      layout: region.layout
        ? {
            ...region.layout,
            padding: {
              x: 0.18,
              y: 0.18
            }
          }
        : undefined,
      placeholder: buildPlaceholder(slotId, roles),
      required: slotId !== "footer",
      roles
    };
  }

  const layoutPattern = normalizeKey(
    enhancement?.layoutPattern ?? analysis.layoutPattern,
    "single_main"
  );
  const pageTypes =
    enhancement?.pageTypes?.map((pageType) => normalizeKey(pageType, "content")).filter(Boolean) ??
    analysis.pageTypes;

  return {
    alignmentLines: analysis.alignmentLines,
    canvas: slide.canvas,
    id: `${layoutPattern}_${String(slide.slideIndex).padStart(2, "0")}`,
    layoutPattern,
    name: buildTemplateName(layoutPattern, slide.slideIndex),
    pageTypes: pageTypes.length > 0 ? [...new Set(pageTypes)].slice(0, 6) : ["content"],
    rules: {
      allowSplit: true,
      density: inferDensity(slots),
      maxContentAreaRatio: 0.78
    },
    safeArea: analysis.safeArea,
    slots,
    source: {
      file: sourceFile,
      slideIndex: slide.slideIndex
    },
    styleTokens: extractStyleTokens(slide),
    usage: {
      notSuitableFor:
        enhancement?.usage?.notSuitableFor?.slice(0, 4) ?? defaultNotSuitableFor(layoutPattern),
      suitableFor:
        enhancement?.usage?.suitableFor?.slice(0, 4) ?? defaultSuitableFor(layoutPattern)
    },
    version: "1.0.0"
  };
}

function defaultSlotName(regionId: string) {
  if (regionId.includes("header")) {
    return "header";
  }

  if (regionId.includes("left")) {
    return "insights";
  }

  if (regionId.includes("right")) {
    return "visual";
  }

  if (regionId.includes("cards")) {
    return "cards";
  }

  return "main";
}

function buildConstraints(slotId: string, roles: string[]) {
  if (slotId === "header" || roles.includes("page_title")) {
    return {
      maxLines: 2,
      minFontSize: 22,
      overflow: "shrink_or_error"
    };
  }

  if (roles.includes("chart") || roles.includes("image") || roles.includes("table")) {
    return {
      fit: "contain",
      minH: 2,
      minW: 2
    };
  }

  if (slotId === "cards") {
    return {
      maxItems: 4,
      minItems: 3,
      minFontSize: 12,
      overflow: "shrink_or_split"
    };
  }

  return {
    maxItems: 4,
    minItems: 1,
    minFontSize: 12,
    overflow: "shrink_or_split"
  };
}

function buildPlaceholder(slotId: string, roles: string[]) {
  if (slotId === "header" || roles.includes("page_title")) {
    return "请输入页面标题";
  }

  if (roles.includes("chart")) {
    return "请放置图表或数据可视化";
  }

  if (roles.includes("image")) {
    return "请放置图片或主视觉";
  }

  if (roles.includes("table")) {
    return "请放置表格内容";
  }

  return "请填充内容";
}

function extractStyleTokens(slide: PptRawSlide) {
  const fonts = [
    ...new Set(
      slide.layers
        .map((layer) => layer.style.fontFace)
        .filter((font): font is string => Boolean(font))
    )
  ].slice(0, 6);
  const colors = [
    ...new Set(
      slide.layers
        .flatMap((layer) => [layer.style.color, layer.style.fill, layer.style.line])
        .filter((color): color is string => Boolean(color))
    )
  ].slice(0, 12);

  return {
    colors,
    fonts
  };
}

function inferDensity(slots: Record<string, PptSlotTemplateSlot>) {
  const count = Object.keys(slots).length;

  if (count >= 5) {
    return "high";
  }

  if (count >= 3) {
    return "medium";
  }

  return "low";
}

function buildTemplateName(layoutPattern: string, slideIndex: number) {
  const names: Record<string, string> = {
    "3_column_cards": "三列卡片 Slot 模板",
    "4_column_cards": "四列卡片 Slot 模板",
    left_insights_right_chart: "左洞察右图表 Slot 模板",
    left_text_right_image: "左文右图 Slot 模板",
    single_main: "单主内容 Slot 模板",
    two_column: "双栏 Slot 模板"
  };

  return `${names[layoutPattern] ?? "PPT Slot 模板"} ${slideIndex}`;
}

function defaultSuitableFor(layoutPattern: string) {
  if (layoutPattern.includes("cards")) {
    return ["功能点、指标或对比项并列展示", "三到四个同级内容模块"];
  }

  if (layoutPattern.includes("chart")) {
    return ["一页包含主图表和关键洞察", "数据分析页或业务复盘页"];
  }

  return ["标题与主体内容清晰分区的通用内容页"];
}

function defaultNotSuitableFor(layoutPattern: string) {
  if (layoutPattern.includes("cards")) {
    return ["超过四个并列模块", "需要大面积图表或表格的页面"];
  }

  if (layoutPattern.includes("chart")) {
    return ["多个图表并列页面", "超长表格页面"];
  }

  return ["复杂动画页", "需要精确保留母版装饰的页面"];
}

function normalizeRoles(roles: string[]) {
  const normalized = roles
    .map((role) => normalizeKey(role, "main"))
    .filter(Boolean);

  return [...new Set(normalized)].slice(0, 8);
}

function normalizeSlotId(value: string) {
  return normalizeKey(value, "main").slice(0, 80);
}

function normalizeKey(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}
