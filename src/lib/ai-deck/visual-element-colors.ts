import type { SlideCompositionPlan, SlideElement, UnifiedVisualSpec } from "./schema";
import {
  extractHexColor,
  extractPaletteHexColors,
  normalizeHexColor,
  resolveSlideVisualColors
} from "./visual-colors";

type BindSlideElementColorOptions = {
  addDiagnostic?: boolean;
};

type RemapRole =
  | "accent"
  | "background"
  | "bodyText"
  | "borderDivider"
  | "chart"
  | "decorative"
  | "highlight"
  | "surface"
  | "titleText";

const colorFields = [
  "activeColor",
  "fillColor",
  "inactiveColor",
  "strokeColor"
] as const;

export function bindSlideElementColorsToVisualSpec(
  slide: SlideCompositionPlan,
  unifiedVisualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">,
  options: BindSlideElementColorOptions = {}
): SlideCompositionPlan {
  let remappedCount = 0;
  const elements = slide.elements.map((element) => {
    const nextElement = bindElementColorsToVisualSpec(
      element,
      unifiedVisualSpec
    );

    if (JSON.stringify(element.textStyle) !== JSON.stringify(nextElement.textStyle)) {
      remappedCount += 1;
    } else if (JSON.stringify(element.assetStyle) !== JSON.stringify(nextElement.assetStyle)) {
      remappedCount += 1;
    }

    return nextElement;
  });

  if (!options.addDiagnostic || remappedCount === 0) {
    return {
      ...slide,
      elements
    };
  }

  return {
    ...slide,
    elements,
    layoutDiagnostics: {
      ...slide.layoutDiagnostics,
      warnings: Array.from(
        new Set([
          ...slide.layoutDiagnostics.warnings,
          `已将 ${remappedCount} 个元素颜色绑定到统一色彩系统。`
        ])
      ).slice(0, 8)
    }
  };
}

export function bindElementColorsToVisualSpec(
  element: SlideElement,
  unifiedVisualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">
): SlideElement {
  const visualColors = resolveSlideVisualColors(unifiedVisualSpec);
  const textColorRole = textRoleForElement(element);
  const assetRoles = assetRolesForElement(element);
  const textStyle =
    element.type === "text" || element.textStyle
      ? {
          align: element.textStyle?.align ?? "left",
          color: remapColorToVisualSpec({
            fallbackRole: textColorRole,
            unifiedVisualSpec,
            value: element.textStyle?.color
          }),
          fontSize:
            element.textStyle?.fontSize ??
            (element.semanticType === "title" ? 32 : 14),
          fontWeight:
            element.textStyle?.fontWeight ??
            (element.semanticType === "title" ? "bold" : "regular"),
          lineHeight: element.textStyle?.lineHeight ?? 1.25,
          ...(element.textStyle?.maxLines
            ? { maxLines: element.textStyle.maxLines }
            : {})
        }
      : element.textStyle;
  const assetStyle = element.assetStyle
    ? {
        ...element.assetStyle
      }
    : element.type === "shape" || element.type === "icon" || element.type === "chartPlaceholder"
      ? {}
      : undefined;

  if (assetStyle) {
    for (const field of colorFields) {
      const role = assetRoles[field];
      const value = assetStyle[field];

      if (role) {
        assetStyle[field] = remapColorToVisualSpec({
          fallbackRole: role,
          unifiedVisualSpec,
          value
        });
      }
    }

    if (element.type === "chartPlaceholder") {
      assetStyle.fillColor ??= visualColors.surface;
      assetStyle.strokeColor ??= visualColors.chart;
    }
  }

  return {
    ...element,
    ...(textStyle ? { textStyle } : {}),
    ...(assetStyle ? { assetStyle } : {})
  };
}

export function remapColorToVisualSpec({
  fallbackRole,
  unifiedVisualSpec,
  value
}: {
  fallbackRole: RemapRole;
  unifiedVisualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">;
  value: string | undefined;
}) {
  const palette = extractPaletteHexColors(unifiedVisualSpec.colorPalette);
  const normalized = value ? extractHexColor(value) : undefined;

  if (normalized && palette.includes(normalized)) {
    return normalized;
  }

  if (normalized === "#000000" || normalized === "#FFFFFF") {
    const colors = resolveSlideVisualColors(unifiedVisualSpec);
    const contrastTarget =
      fallbackRole === "background" || fallbackRole === "surface"
        ? colors.bodyText
        : colors.background;

    if (contrastRatio(normalized, contrastTarget) >= 4.5) {
      return normalized;
    }
  }

  return colorForRole(fallbackRole, unifiedVisualSpec);
}

export function colorForRole(
  role: RemapRole,
  unifiedVisualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">
) {
  const colors = resolveSlideVisualColors(unifiedVisualSpec);

  return colors[role] ?? colors.accent;
}

export function sanitizeElementColorForPptx(
  value: string | undefined,
  fallbackRole: RemapRole,
  unifiedVisualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">
) {
  return remapColorToVisualSpec({
    fallbackRole,
    unifiedVisualSpec,
    value
  });
}

function textRoleForElement(element: SlideElement): RemapRole {
  if (element.semanticType === "title" || element.semanticType === "subtitle") {
    return "titleText";
  }

  if (element.semanticType === "footer") {
    return "decorative";
  }

  if (element.semanticType === "badge") {
    return "accent";
  }

  return "bodyText";
}

function assetRolesForElement(
  element: SlideElement
): Partial<Record<(typeof colorFields)[number], RemapRole>> {
  if (element.type === "icon") {
    return {
      fillColor: "background",
      strokeColor: "decorative",
      activeColor: "accent",
      inactiveColor: "decorative"
    };
  }

  if (element.type === "chartPlaceholder") {
    return {
      fillColor: "surface",
      strokeColor: "chart"
    };
  }

  if (isLineLikeElement(element)) {
    return {
      fillColor: "accent",
      strokeColor: "accent"
    };
  }

  if (element.semanticType === "badge") {
    return {
      fillColor: "highlight",
      strokeColor: "accent"
    };
  }

  if (element.semanticType === "background") {
    return {
      fillColor: "background",
      strokeColor: "background"
    };
  }

  return {
    fillColor: "surface",
    strokeColor: "borderDivider",
    activeColor: "accent",
    inactiveColor: "decorative"
  };
}

function isLineLikeElement(element: SlideElement) {
  return (
    element.bounds.height <= 0.18 ||
    element.bounds.width <= 0.18 ||
    /line|axis|connector|divider|underline|emphasis|timeline|强调线|分隔线|连接线|轴线|线/i.test(
      `${element.id} ${element.role} ${element.styleNotes}`
    )
  );
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string) {
  const normalized = normalizeHexColor(color);
  const match = normalized.match(/^#([0-9A-F]{6})$/i);

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
