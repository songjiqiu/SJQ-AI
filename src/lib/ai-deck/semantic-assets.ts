import { TemplateElementAssetKind } from "@prisma/client";

import {
  searchTemplateContainerAssetsForAi,
  searchTemplateIconAssetsForAi,
  searchTemplateLineAssetsForAi,
  searchTemplateNavigationAssetsForAi,
  searchTemplateShapeAssetsForAi,
  searchTemplateTextStyleAssetsForAi
} from "@/lib/admin/template-assets/service";
import type {
  TemplateElementAssetAiResult,
  TemplateElementAssetDto
} from "@/lib/admin/template-assets/types";
import { isMissingPrismaModelStorageError } from "@/lib/db/prisma-errors";

import {
  slideCompositionPlanSchema,
  type AnalyzeDeckRequest,
  type SlideCompositionPlan,
  type SlideElement,
  type UnifiedVisualSpec
} from "./schema";
import { bindSlideElementColorsToVisualSpec } from "./visual-element-colors";

const maxSlideElements = 24;

type SemanticAssetKind = keyof typeof TemplateElementAssetKind;
type AssetBuckets = Partial<Record<SemanticAssetKind, TemplateElementAssetAiResult[]>>;

export async function enhanceSlideWithSemanticAssets({
  input,
  slide,
  templateTags = [],
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  slide: SlideCompositionPlan;
  templateTags?: string[];
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  try {
    const assets = await searchSemanticAssetsForSlide({
      input,
      slide,
      templateTags,
      unifiedVisualSpec
    });

    return applySemanticAssetsToSlide({
      assets,
      input,
      slide,
      unifiedVisualSpec
    });
  } catch (error) {
    if (isMissingTemplateAssetStorageError(error)) {
      return withSemanticAssetWarning(
        slide,
        input.locale === "zh-CN"
          ? "语义元素资产未应用：TemplateAsset 及详情表尚未迁移。"
          : "Semantic element assets were not applied: TemplateAsset storage is missing."
      );
    }

    return withSemanticAssetWarning(
      slide,
      input.locale === "zh-CN"
        ? `语义元素资产未应用：${compactText(formatErrorMessage(error), 80)}`
        : `Semantic element assets were not applied: ${compactText(formatErrorMessage(error), 90)}`
    );
  }
}

export async function searchSemanticAssetsForSlide({
  input,
  slide,
  templateTags = [],
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  slide: SlideCompositionPlan;
  templateTags?: string[];
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  const setKey = inferTemplateAssetSetKey(templateTags);
  const pageType = slide.layoutSelection.selectedLayoutType;
  const pageSemantic = [
    slide.pageIntent.pageRole,
    slide.pageIntent.primaryGoal,
    slide.pageIntent.contentDensity,
    slide.pageIntent.coreMessage
  ].join(" ");
  const semanticTags = uniqueStrings([
    slide.pageIntent.pageRole,
    slide.pageIntent.primaryGoal,
    slide.pageIntent.contentDensity,
    pageType,
    ...slide.semanticElements.flatMap((element) => [
      element.category,
      element.elementType,
      element.semanticType,
      element.role
    ])
  ]);
  const styleTags = uniqueStrings([
    input.deckType,
    unifiedVisualSpec.visualStyle,
    unifiedVisualSpec.pptTypeVisualTone.recommendedTone,
    ...unifiedVisualSpec.pptTypeVisualTone.visualKeywords,
    ...templateTags
  ]);
  const backgroundMode = inferBackgroundMode(unifiedVisualSpec);
  const searchInput = {
    backgroundMode,
    limit: 6,
    pageSemantic,
    pageType,
    semanticTags,
    setKey,
    styleTags
  };
  const entries = await Promise.all([
    searchTemplateTextStyleAssetsForAi(searchInput).then((assets) => [
      TemplateElementAssetKind.TEXT_STYLE,
      assets
    ] as const),
    searchTemplateContainerAssetsForAi(searchInput).then((assets) => [
      TemplateElementAssetKind.CONTAINER,
      assets
    ] as const),
    searchTemplateLineAssetsForAi(searchInput).then((assets) => [
      TemplateElementAssetKind.LINE,
      assets
    ] as const),
    searchTemplateShapeAssetsForAi(searchInput).then((assets) => [
      TemplateElementAssetKind.SHAPE,
      assets
    ] as const),
    searchTemplateIconAssetsForAi(searchInput).then((assets) => [
      TemplateElementAssetKind.ICON,
      assets
    ] as const),
    searchTemplateNavigationAssetsForAi(searchInput).then((assets) => [
      TemplateElementAssetKind.NAVIGATION,
      assets
    ] as const)
  ] as const);

  return Object.fromEntries(entries) as AssetBuckets;
}

export function applySemanticAssetsToSlide({
  assets,
  input,
  slide,
  unifiedVisualSpec
}: {
  assets: AssetBuckets;
  input: AnalyzeDeckRequest;
  slide: SlideCompositionPlan;
  unifiedVisualSpec?: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">;
}) {
  const appliedAssetNames = new Set<string>();
  let elements = slide.elements.map((element) =>
    applyAssetsToElement({
      appliedAssetNames,
      assets,
      element,
      slide
    })
  );

  elements = addMissingContainerElement({
    appliedAssetNames,
    assets,
    elements,
    input,
    slide
  });
  elements = addMissingIconElement({
    appliedAssetNames,
    assets,
    elements,
    input,
    slide
  });
  elements = addMissingNavigationElement({
    appliedAssetNames,
    assets,
    elements,
    input,
    slide
  });

  if (appliedAssetNames.size === 0) {
    return unifiedVisualSpec
      ? bindSlideElementColorsToVisualSpec(slide, unifiedVisualSpec)
      : slide;
  }

  const enhanced = slideCompositionPlanSchema.parse({
    ...slide,
    designPlan: {
      ...slide.designPlan,
      visualStrategy: appendText(
        slide.designPlan.visualStrategy,
        input.locale === "zh-CN"
          ? "已接入语义元素资产库增强图层。"
          : "Semantic element assets were applied to enhance slide layers."
      )
    },
    elements,
    layoutDiagnostics: {
      ...slide.layoutDiagnostics,
      warnings: appendWarning(
        slide.layoutDiagnostics.warnings,
        input.locale === "zh-CN"
          ? `已应用语义元素资产：${Array.from(appliedAssetNames).slice(0, 4).join("、")}。`
          : `Applied semantic element assets: ${Array.from(appliedAssetNames).slice(0, 4).join(", ")}.`
      )
    }
  });

  return unifiedVisualSpec
    ? bindSlideElementColorsToVisualSpec(enhanced, unifiedVisualSpec, {
        addDiagnostic: true
      })
    : enhanced;
}

function applyAssetsToElement({
  appliedAssetNames,
  assets,
  element,
  slide
}: {
  appliedAssetNames: Set<string>;
  assets: AssetBuckets;
  element: SlideElement;
  slide: SlideCompositionPlan;
}) {
  if (element.type === "text") {
    const textStyleAsset = pickAssetForElement(
      assets.TEXT_STYLE ?? [],
      element,
      slide
    );

    if (textStyleAsset) {
      appliedAssetNames.add(textStyleAsset.name);
      return bindAssetToElement(element, textStyleAsset, {
        textStyle: mergeTextStyle(element, textStyleAsset)
      });
    }
  }

  if (element.type === "icon") {
    const iconAsset = pickAssetForElement(assets.ICON ?? [], element, slide);

    if (iconAsset) {
      appliedAssetNames.add(iconAsset.name);
      return bindAssetToElement(element, iconAsset);
    }
  }

  if (isNavigationElement(element)) {
    const navigationAsset = pickAssetForElement(
      assets.NAVIGATION ?? [],
      element,
      slide
    );

    if (navigationAsset) {
      appliedAssetNames.add(navigationAsset.name);
      return bindAssetToElement(element, navigationAsset);
    }
  }

  if (isLineElement(element)) {
    const lineAsset = pickAssetForElement(assets.LINE ?? [], element, slide);

    if (lineAsset) {
      appliedAssetNames.add(lineAsset.name);
      return bindAssetToElement(element, lineAsset);
    }
  }

  if (element.type === "shape") {
    const containerAsset = isContainerElement(element)
      ? pickAssetForElement(assets.CONTAINER ?? [], element, slide)
      : null;
    const shapeAsset =
      containerAsset ?? pickAssetForElement(assets.SHAPE ?? [], element, slide);

    if (shapeAsset) {
      appliedAssetNames.add(shapeAsset.name);
      return bindAssetToElement(element, shapeAsset);
    }
  }

  return element;
}

function addMissingContainerElement({
  appliedAssetNames,
  assets,
  elements,
  input,
  slide
}: {
  appliedAssetNames: Set<string>;
  assets: AssetBuckets;
  elements: SlideElement[];
  input: AnalyzeDeckRequest;
  slide: SlideCompositionPlan;
}) {
  if (
    elements.length >= maxSlideElements ||
    elements.some((element) => isContainerElement(element)) ||
    (assets.CONTAINER ?? []).length === 0
  ) {
    return elements;
  }

  const body = elements.find(
    (element) => element.type === "text" && element.semanticType === "body"
  );

  if (!body) {
    return elements;
  }

  const asset = pickAssetForElement(assets.CONTAINER ?? [], body, slide);

  if (!asset) {
    return elements;
  }

  appliedAssetNames.add(asset.name);

  return [
    ...elements,
    bindAssetToElement(
      {
        bounds: expandBounds(body.bounds, 0.18),
        editable: true,
        hierarchyLevel: 3,
        id: `${slide.slideId}-asset-body-container`,
        requiresImageGeneration: false,
        role: input.locale === "zh-CN" ? "正文资产容器" : "Body asset container",
        semanticType: "card",
        styleNotes:
          input.locale === "zh-CN"
            ? "由语义元素资产库补充的正文容器。"
            : "Body container added from the semantic element asset library.",
        type: "shape",
        zIndex: Math.max(0, body.zIndex - 3)
      },
      asset
    )
  ];
}

function addMissingIconElement({
  appliedAssetNames,
  assets,
  elements,
  input,
  slide
}: {
  appliedAssetNames: Set<string>;
  assets: AssetBuckets;
  elements: SlideElement[];
  input: AnalyzeDeckRequest;
  slide: SlideCompositionPlan;
}) {
  if (
    elements.length >= maxSlideElements ||
    elements.some((element) => element.type === "icon") ||
    (assets.ICON ?? []).length === 0 ||
    !shouldAddIcon(slide)
  ) {
    return elements;
  }

  const anchor =
    elements.find((element) => element.semanticType === "badge") ??
    elements.find((element) => element.semanticType === "title");
  const asset = pickAssetForElement(assets.ICON ?? [], anchor ?? elements[0], slide);

  if (!anchor || !asset) {
    return elements;
  }

  appliedAssetNames.add(asset.name);

  return [
    ...elements,
    bindAssetToElement(
      {
        bounds: {
          height: 0.34,
          width: 0.34,
          x: clamp(anchor.bounds.x - 0.46, 0.5, 12.4),
          y: clamp(anchor.bounds.y + 0.05, 0.5, 6.7)
        },
        editable: true,
        hierarchyLevel: Math.min(5, anchor.hierarchyLevel + 1),
        id: `${slide.slideId}-asset-icon`,
        requiresImageGeneration: false,
        role: input.locale === "zh-CN" ? "语义图标" : "Semantic icon",
        semanticType: "icon",
        styleNotes:
          input.locale === "zh-CN"
            ? "由语义元素资产库补充的图标。"
            : "Icon added from the semantic element asset library.",
        type: "icon",
        zIndex: Math.min(100, anchor.zIndex + 1)
      },
      asset
    )
  ];
}

function addMissingNavigationElement({
  appliedAssetNames,
  assets,
  elements,
  input,
  slide
}: {
  appliedAssetNames: Set<string>;
  assets: AssetBuckets;
  elements: SlideElement[];
  input: AnalyzeDeckRequest;
  slide: SlideCompositionPlan;
}) {
  if (
    elements.length >= maxSlideElements ||
    elements.some((element) => isNavigationElement(element)) ||
    (assets.NAVIGATION ?? []).length === 0
  ) {
    return elements;
  }

  const asset = pickAssetForElement(assets.NAVIGATION ?? [], elements[0], slide);

  if (!asset) {
    return elements;
  }

  appliedAssetNames.add(asset.name);

  return [
    ...elements,
    bindAssetToElement(
      {
        bounds: {
          height: 0.22,
          width: 0.74,
          x: 12.02,
          y: 6.82
        },
        content: String(slide.index).padStart(2, "0"),
        editable: true,
        hierarchyLevel: 3,
        id: `${slide.slideId}-asset-navigation`,
        requiresImageGeneration: false,
        role: input.locale === "zh-CN" ? "页码导航" : "Page navigation",
        semanticType: "footer",
        styleNotes:
          input.locale === "zh-CN"
            ? "由语义元素资产库补充的导航组件。"
            : "Navigation element added from the semantic element asset library.",
        textStyle: {
          align: "right",
          fontSize: 9,
          fontWeight: "medium",
          lineHeight: 1.1,
          maxLines: 1
        },
        type: "text",
        zIndex: 40
      },
      asset,
      {
        textStyle: mergeTextStyle(
          {
            content: String(slide.index).padStart(2, "0"),
            textStyle: {
              align: "right",
              fontSize: 9,
              fontWeight: "medium",
              lineHeight: 1.1,
              maxLines: 1
            },
            type: "text"
          } as SlideElement,
          asset
        )
      }
    )
  ];
}

function bindAssetToElement(
  element: SlideElement,
  asset: TemplateElementAssetAiResult,
  overrides: Partial<SlideElement> = {}
): SlideElement {
  return {
    ...element,
    ...overrides,
    assetBinding: buildAssetBinding(asset),
    assetStyle: buildAssetStyle(asset),
    styleNotes: compactText(
      `${element.styleNotes} 语义资产：${asset.name}（${asset.id}）。`,
      220
    )
  };
}

function buildAssetBinding(asset: TemplateElementAssetAiResult) {
  const semanticKey = readString(asset.resource.semanticKey);

  return {
    assetId: asset.id,
    kind: asset.kind,
    matchScore: asset.matchScore,
    name: asset.name,
    ...(semanticKey ? { semanticKey } : {}),
    setKey: asset.setKey,
    setKind: asset.setKind,
    usageSuggestion: asset.usageSuggestion,
    ...(asset.variantKey ? { variantKey: asset.variantKey } : {})
  };
}

function buildAssetStyle(asset: TemplateElementAssetDto) {
  const style = asset.style;
  const resource = asset.resource;
  const preview = asset.preview;
  const shapeType =
    readString(resource.shapeType) ??
    readString(style.shapeType) ??
    readString(preview.shape);
  const lineType =
    readString(preview.lineType) ??
    readString(resource.connectorType) ??
    readString(style.connectorType) ??
    readString(asset.variantKey);
  const iconName =
    readString(preview.iconName) ??
    readString(resource.semanticKey) ??
    readString(asset.variantKey);
  const textRole =
    readString(resource.textRole) ??
    readString(style.textRole) ??
    readString(preview.textRole) ??
    readString(asset.variantKey);
  const containerRole =
    readString(resource.containerRole) ??
    readString(style.containerRole) ??
    readString(preview.containerRole) ??
    readString(asset.variantKey);
  const navigationRole =
    readString(resource.navigationRole) ??
    readString(style.navigationRole) ??
    readString(preview.navigationRole) ??
    readString(asset.variantKey);

  return removeUndefined({
    activeColor: readString(style.activeColor),
    containerRole,
    cornerRadius: clampOptional(readNumber(style.cornerRadius), 0, 80),
    dash: normalizeDash(readString(style.dash) ?? readString(preview.dash)),
    displayMode:
      readString(style.displayMode) ??
      readString(preview.displayMode) ??
      readString(resource.displayMode),
    endArrowType:
      readString(style.endArrowType) ??
      readString(resource.endArrowType) ??
      readString(preview.endArrowType),
    fillColor: readString(style.fillColor),
    iconName,
    inactiveColor: readString(style.inactiveColor),
    lineHeight: clampOptional(readNumber(style.lineHeight), 1, 1.8),
    lineType,
    navigationRole,
    opacity: clampOptional(readNumber(style.opacity), 0, 1),
    shapeType,
    startArrowType:
      readString(style.startArrowType) ??
      readString(resource.startArrowType) ??
      readString(preview.startArrowType),
    strokeColor: readString(style.strokeColor),
    strokeWidth: clampOptional(readNumber(style.strokeWidth), 0, 12),
    textRole
  });
}

function mergeTextStyle(
  element: SlideElement,
  asset: TemplateElementAssetDto
): SlideElement["textStyle"] {
  const style = asset.style;
  const fontWeight = normalizeFontWeight(style.fontWeight);
  const maxLines = clampOptional(readNumber(style.maxLines), 1, 9);

  return {
    align: element.textStyle?.align ?? inferTextAlign(asset),
    color: readString(style.color) ?? element.textStyle?.color,
    fontSize:
      clampOptional(readNumber(style.fontSize), 8, 40) ??
      element.textStyle?.fontSize ??
      14,
    fontWeight: fontWeight ?? element.textStyle?.fontWeight ?? "regular",
    lineHeight:
      clampOptional(readNumber(style.lineHeight), 1, 1.8) ??
      element.textStyle?.lineHeight ??
      1.25,
    maxLines:
      maxLines !== undefined
        ? Math.round(maxLines)
        : element.textStyle?.maxLines
  };
}

function pickAssetForElement(
  assets: TemplateElementAssetAiResult[],
  element: SlideElement | undefined,
  slide: SlideCompositionPlan
) {
  if (assets.length === 0) {
    return null;
  }

  if (!element) {
    return assets[0];
  }

  return [...assets].sort(
    (first, second) =>
      scoreAssetForElement(second, element, slide) -
        scoreAssetForElement(first, element, slide) ||
      second.matchScore - first.matchScore ||
      first.sortOrder - second.sortOrder
  )[0];
}

function scoreAssetForElement(
  asset: TemplateElementAssetAiResult,
  element: SlideElement,
  slide: SlideCompositionPlan
) {
  const corpus = normalizeSearchText([
    element.id,
    element.role,
    element.semanticType,
    element.type,
    slide.pageIntent.pageRole,
    slide.pageIntent.primaryGoal,
    slide.layoutSelection.selectedLayoutType
  ]);
  const terms = normalizeSearchText([
    asset.name,
    asset.primaryCategory ?? "",
    asset.secondaryCategory ?? "",
    asset.variantKey ?? "",
    ...asset.semanticTags,
    ...asset.keywords,
    ...asset.synonyms,
    ...asset.tags
  ]).split(" ");
  let score = asset.matchScore;

  for (const term of terms) {
    if (term.length >= 2 && corpus.includes(term)) {
      score += 12;
    }
  }

  if (asset.pageTypes.includes(slide.layoutSelection.selectedLayoutType)) {
    score += 10;
  }

  if (
    asset.kind === TemplateElementAssetKind.TEXT_STYLE &&
    textRoleMatchesElement(asset, element)
  ) {
    score += 28;
  }

  if (
    asset.kind === TemplateElementAssetKind.CONTAINER &&
    isContainerElement(element)
  ) {
    score += 24;
  }

  if (asset.kind === TemplateElementAssetKind.LINE && isLineElement(element)) {
    score += 24;
  }

  return score;
}

function textRoleMatchesElement(
  asset: TemplateElementAssetDto,
  element: SlideElement
) {
  const textRole = normalizeSearchText([
    readString(asset.resource.textRole) ?? "",
    readString(asset.style.textRole) ?? "",
    readString(asset.preview.textRole) ?? "",
    asset.variantKey ?? ""
  ]);

  if (element.semanticType === "title") {
    return textRole.includes("title") || textRole.includes("heading");
  }

  if (element.semanticType === "subtitle") {
    return textRole.includes("subtitle");
  }

  if (element.semanticType === "footer") {
    return textRole.includes("footer") || textRole.includes("source");
  }

  if (element.semanticType === "badge") {
    return textRole.includes("number") || textRole.includes("tag");
  }

  if (element.semanticType === "body" || element.semanticType === "card") {
    return textRole.includes("body") || textRole.includes("bullet");
  }

  return false;
}

function inferTemplateAssetSetKey(templateTags: string[]) {
  for (const tag of templateTags) {
    const match = tag.match(/^set:([a-z0-9_-]+)$/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function inferBackgroundMode(unifiedVisualSpec: UnifiedVisualSpec) {
  const background = unifiedVisualSpec.colorPalette.neutral.at(-1)?.hex ?? "#ffffff";
  const rgb = background.match(/[0-9a-f]{2}/gi)?.map((part) => parseInt(part, 16));

  if (!rgb || rgb.length < 3) {
    return "light";
  }

  const [red, green, blue] = rgb;
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance < 0.45 ? "dark" : "light";
}

function shouldAddIcon(slide: SlideCompositionPlan) {
  return (
    slide.pageIntent.pageRole === "data" ||
    slide.pageIntent.pageRole === "process" ||
    slide.pageIntent.pageRole === "agenda" ||
    slide.elements.some((element) => element.semanticType === "badge") ||
    slide.semanticElements.some(
      (element) =>
        element.semanticType === "icon" ||
        element.category === "navigation"
    )
  );
}

function isLineElement(element: SlideElement) {
  return (
    element.type === "shape" &&
    (element.bounds.height <= 0.18 ||
      element.bounds.width <= 0.18 ||
      /line|axis|connector|divider|underline|emphasis|timeline|强调线|分隔线|连接线|轴线|线/i.test(
        `${element.id} ${element.role} ${element.styleNotes}`
      ))
  );
}

function isContainerElement(element: SlideElement) {
  return (
    element.type === "shape" &&
    !isLineElement(element) &&
    (element.semanticType === "card" ||
      /card|panel|container|overlay|mask|box|placeholder|卡片|容器|面板|遮罩|信息框/i.test(
        `${element.id} ${element.role} ${element.styleNotes}`
      ))
  );
}

function isNavigationElement(element: SlideElement) {
  return (
    element.semanticType === "footer" ||
    /page|footer|navigation|progress|toc|目录|页码|导航|进度/i.test(
      `${element.id} ${element.role} ${element.styleNotes}`
    )
  );
}

function expandBounds(bounds: SlideElement["bounds"], amount: number) {
  const x = clamp(bounds.x - amount, 0, 13.333);
  const y = clamp(bounds.y - amount, 0, 7.5);
  const width = clamp(bounds.width + amount * 2, 0.05, 13.333 - x);
  const height = clamp(bounds.height + amount * 2, 0.05, 7.5 - y);

  return {
    height: round(height),
    width: round(width),
    x: round(x),
    y: round(y)
  };
}

function withSemanticAssetWarning(
  slide: SlideCompositionPlan,
  warning: string
) {
  return slideCompositionPlanSchema.parse({
    ...slide,
    layoutDiagnostics: {
      ...slide.layoutDiagnostics,
      warnings: appendWarning(slide.layoutDiagnostics.warnings, warning)
    }
  });
}

function appendWarning(warnings: string[], warning: string) {
  return Array.from(new Set([...warnings, compactText(warning, 180)])).slice(0, 8);
}

function appendText(value: string, suffix: string) {
  return compactText(`${value} ${suffix}`, 260);
}

function normalizeFontWeight(value: unknown) {
  if (typeof value === "number") {
    if (value >= 700) {
      return "bold" as const;
    }

    if (value >= 600) {
      return "semibold" as const;
    }

    if (value >= 500) {
      return "medium" as const;
    }

    return "regular" as const;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  if (/bold|700|800|900/i.test(value)) {
    return "bold" as const;
  }

  if (/semi|600/i.test(value)) {
    return "semibold" as const;
  }

  if (/medium|500/i.test(value)) {
    return "medium" as const;
  }

  if (/regular|normal|400/i.test(value)) {
    return "regular" as const;
  }

  return undefined;
}

function inferTextAlign(asset: TemplateElementAssetDto) {
  const textRole = normalizeSearchText([
    readString(asset.resource.textRole) ?? "",
    readString(asset.style.textRole) ?? "",
    asset.variantKey ?? ""
  ]);

  if (textRole.includes("footer") || textRole.includes("source")) {
    return "right" as const;
  }

  if (textRole.includes("title") || textRole.includes("quote")) {
    return "center" as const;
  }

  return "left" as const;
}

function normalizeDash(value: string | undefined) {
  if (value === "dashed" || value === "dotted" || value === "solid") {
    return value;
  }

  if (value?.includes("dash")) {
    return "dashed" as const;
  }

  if (value?.includes("dot")) {
    return "dotted" as const;
  }

  return value ? "solid" as const : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function clampOptional(value: number | undefined, min: number, max: number) {
  if (value === undefined) {
    return undefined;
  }

  return clamp(value, min, max);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).slice(0, 16);
}

function normalizeSearchText(values: Array<string | undefined>) {
  return values
    .map((value) => value?.toLowerCase() ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized;
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingTemplateAssetStorageError(error: unknown) {
  return [
    "TemplateAsset",
    "TemplateIconAsset",
    "TemplateShapeAsset",
    "TemplateLineAsset",
    "TemplateTextStyleAsset",
    "TemplateContainerAsset",
    "TemplateNavigationAsset",
    "TemplateElementAsset"
  ].some((modelName) => isMissingPrismaModelStorageError(error, modelName));
}
