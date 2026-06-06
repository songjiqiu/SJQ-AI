import type { UnifiedVisualSpec } from "./schema";

export type SlideVisualColors = {
  accent: string;
  background: string;
  bodyText: string;
  borderDivider: string;
  chart: string;
  chartSeries: string[];
  decorative: string;
  highlight: string;
  mutedText: string;
  surface: string;
  titleText: string;
};

type ColorRoleKey = keyof UnifiedVisualSpec["colorRoles"];
type ColorPalette = UnifiedVisualSpec["colorPalette"];
type LegacyColorPalette = string[];

const safeDefaults: SlideVisualColors = {
  accent: "#246BFE",
  background: "#F6F8FB",
  bodyText: "#334155",
  borderDivider: "#D9E7FF",
  chart: "#246BFE",
  chartSeries: ["#246BFE"],
  decorative: "#16A085",
  highlight: "#D9E7FF",
  mutedText: "#7A8693",
  surface: "#DBE8FF",
  titleText: "#17202A"
};

const hexColorPattern = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;
const hexColorGlobalPattern = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const multiColorRoleKeys = new Set<ColorRoleKey>([
  "bodyText",
  "chart",
  "titleText"
]);
const allowedNonPaletteColors = new Set(["#000000", "#FFFFFF"]);
const rolePaletteFallbackGroups: Partial<Record<ColorRoleKey, keyof ColorPalette>> = {
  accent: "accent",
  background: "neutral",
  bodyText: "neutral",
  borderDivider: "neutral",
  chart: "chart",
  decorative: "secondary",
  highlight: "accent",
  surface: "neutral",
  titleText: "neutral"
};

export function resolveSlideVisualColors(
  unifiedVisualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">
): SlideVisualColors {
  const palette = extractPaletteHexColors(unifiedVisualSpec.colorPalette);
  const primaryPalette = extractPaletteGroupHexColors(
    unifiedVisualSpec.colorPalette,
    "primary"
  );
  const secondaryPalette = extractPaletteGroupHexColors(
    unifiedVisualSpec.colorPalette,
    "secondary"
  );
  const chartPalette = extractPaletteGroupHexColors(
    unifiedVisualSpec.colorPalette,
    "chart"
  );
  const neutralPalette = extractPaletteGroupHexColors(
    unifiedVisualSpec.colorPalette,
    "neutral"
  );
  const accentPalette = extractPaletteGroupHexColors(
    unifiedVisualSpec.colorPalette,
    "accent"
  );
  const role = unifiedVisualSpec.colorRoles;
  const accent = resolveRoleColor(
    role.accent,
    accentPalette[0] ?? primaryPalette[0] ?? palette[0],
    safeDefaults.accent,
    palette
  );
  const background = resolveRoleColor(
    role.background,
    neutralPalette[0] ?? palette[1],
    safeDefaults.background,
    palette
  );
  const bodyText = resolveRoleColor(
    role.bodyText,
    neutralPalette[1] ?? palette[2],
    safeDefaults.bodyText,
    palette
  );
  const decorative = resolveRoleColor(
    role.decorative,
    secondaryPalette[0] ?? palette[3],
    safeDefaults.decorative,
    palette
  );
  const highlight = resolveRoleColor(
    role.highlight,
    accentPalette[0] ?? primaryPalette[0] ?? palette[3],
    safeDefaults.highlight,
    palette
  );
  const chartSeries = resolveRoleColorSeries(
    role.chart,
    chartPalette.length > 0
      ? chartPalette
      : [primaryPalette[0], secondaryPalette[0], palette[0], palette[3]],
    [accent, highlight],
    palette
  );
  const chart = chartSeries[0] ?? accent;
  const surface = resolveRoleColor(
    role.surface,
    neutralPalette[0] ?? palette[1],
    safeDefaults.surface,
    palette
  );
  const titleText = resolveRoleColor(
    role.titleText,
    neutralPalette[1] ?? primaryPalette[0] ?? palette[2],
    safeDefaults.titleText,
    palette
  );
  const borderDivider = resolveRoleColor(
    role.borderDivider,
    neutralPalette[0] ?? secondaryPalette[0] ?? palette[1],
    safeDefaults.borderDivider,
    palette
  );

  return {
    accent,
    background,
    bodyText,
    borderDivider,
    chart,
    chartSeries,
    decorative,
    highlight,
    mutedText: decorative,
    surface,
    titleText
  };
}

export function extractHexColor(value: string | undefined): string | undefined {
  const match = value?.match(hexColorPattern)?.[0];

  return match ? normalizeHexColor(match) : undefined;
}

export function extractHexColors(value: string | undefined): string[] {
  return Array.from(
    new Set(
      (value?.match(hexColorGlobalPattern) ?? []).map((color) =>
        normalizeHexColor(color)
      )
    )
  );
}

export function extractPaletteHexColors(
  values: ColorPalette | LegacyColorPalette
): string[] {
  if (!Array.isArray(values)) {
    return Array.from(
      new Set(
        Object.values(values)
          .flat()
          .map((color) => normalizeHexColor(color.hex))
      )
    );
  }

  return Array.from(
    new Set(
      values.flatMap((value) => {
        const color = extractHexColor(value);

        return color ? [color] : [];
      })
    )
  );
}

export function extractPaletteGroupHexColors(
  values: ColorPalette | LegacyColorPalette,
  group: keyof ColorPalette
): string[] {
  if (Array.isArray(values)) {
    return extractPaletteHexColors(values);
  }

  return Array.from(
    new Set(values[group].map((color) => normalizeHexColor(color.hex)))
  );
}

export function formatColorPaletteForPrompt(
  values: ColorPalette | LegacyColorPalette
) {
  if (Array.isArray(values)) {
    return extractPaletteHexColors(values).join(", ");
  }

  return ([
    ["primary", "主色"],
    ["secondary", "辅助色"],
    ["chart", "图表色"],
    ["neutral", "中性色/表面色"],
    ["accent", "强调色/高亮色"]
  ] as const)
    .map(([key, label]) =>
      `${label}: ${values[key]
        .map((color) => `${color.name} ${color.hex}（${color.usage}）`)
        .join("；")}`
    )
    .join("\n");
}

export function extractPaletteRoleHexColors(
  roleValue: string,
  palette: ColorPalette | LegacyColorPalette
): string[] {
  const paletteSet = new Set([
    ...extractPaletteHexColors(palette),
    ...allowedNonPaletteColors
  ]);

  return extractHexColors(roleValue).filter((color) => paletteSet.has(color));
}

export function stripHexColorsFromText(value: string): string {
  return value
    .replace(hexColorGlobalPattern, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([,，、;；。])\s*/g, "$1")
    .replace(/^[\s,，、;；。/]+/, "")
    .trim();
}

export function sanitizeColorRoleText({
  fallback,
  maxLength = 180,
  palette,
  role,
  value
}: {
  fallback: string;
  maxLength?: number;
  palette: ColorPalette | LegacyColorPalette;
  role: ColorRoleKey;
  value: string;
}): string {
  if (role === "contrastRequirement") {
    return truncateRoleText(value, maxLength);
  }

  const paletteColors = extractPaletteHexColors(palette);
  const validColors = extractPaletteRoleHexColors(value, palette);
  const fallbackColors = extractPaletteRoleHexColors(fallback, palette);
  const fallbackPaletteColor = pickFallbackPaletteColor(palette, role) ?? paletteColors[0];
  const roleColors = multiColorRoleKeys.has(role)
    ? validColors
    : validColors.slice(0, 1);
  const selectedColors =
    roleColors.length > 0
      ? roleColors
      : multiColorRoleKeys.has(role)
        ? fallbackColors
        : fallbackColors.slice(0, 1);
  const colors =
    selectedColors.length > 0
      ? selectedColors
      : fallbackPaletteColor
        ? [fallbackPaletteColor]
        : [];
  const description =
    stripHexColorsFromText(value) || stripHexColorsFromText(fallback) || value;
  const normalized = [colors.join(" / "), description]
    .filter(Boolean)
    .join(" ")
    .trim();

  return truncateRoleText(normalized, maxLength);
}

function resolveRoleColor(
  roleValue: string,
  paletteValue: string | undefined,
  fallback: string,
  palette: string[]
) {
  return (
    extractPaletteRoleHexColors(roleValue, palette)[0] ??
    paletteValue ??
    fallback
  );
}

function resolveRoleColorSeries(
  roleValue: string,
  paletteValues: Array<string | undefined>,
  fallbacks: string[],
  palette: string[]
) {
  const roleColors = extractPaletteRoleHexColors(roleValue, palette);
  const colors = roleColors.length > 0 ? roleColors : paletteValues;
  const resolved = colors.filter((color): color is string => Boolean(color));

  if (resolved.length > 0) {
    return Array.from(new Set(resolved)).slice(0, 6);
  }

  return Array.from(
    new Set(fallbacks.length > 0 ? fallbacks : safeDefaults.chartSeries)
  );
}

export function normalizeHexColor(value: string) {
  const hex = value.slice(1);

  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((item) => item + item)
      .join("")
      .toUpperCase()}`;
  }

  return `#${hex.toUpperCase()}`;
}

function pickFallbackPaletteColor(
  palette: ColorPalette | LegacyColorPalette,
  role: ColorRoleKey
) {
  if (Array.isArray(palette)) {
    const paletteColors = extractPaletteHexColors(palette);
    const legacyIndexes: Partial<Record<ColorRoleKey, number>> = {
      accent: 0,
      background: 1,
      bodyText: 2,
      borderDivider: 1,
      chart: 0,
      decorative: 3,
      highlight: 0,
      surface: 1,
      titleText: 2
    };

    return paletteColors[legacyIndexes[role] ?? 0];
  }

  const group = rolePaletteFallbackGroups[role] ?? "primary";

  return palette[group][0]?.hex;
}

function truncateRoleText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
