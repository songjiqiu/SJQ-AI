export const pptTemplateCategoryIds = [
  "chapter",
  "cover-title",
  "title-body-points",
  "big-image-background",
  "left-image-right-text",
  "left-text-right-image",
  "left-text-right-chart",
  "big-chart",
  "two-column-compare",
  "quote",
  "time-axis",
  "process-steps",
  "key-metrics",
  "quadrant-matrix",
  "ending"
] as const;

export type PptTemplateCategoryId = (typeof pptTemplateCategoryIds)[number];

export const legacyPptTemplateCategoryMap: Readonly<
  Record<string, PptTemplateCategoryId>
> = {
  body: "title-body-points",
  cover: "cover-title",
  "big-number-conclusion": "key-metrics",
  timeline: "time-axis",
  title: "title-body-points"
};

export function isPptTemplateCategoryId(
  value: string
): value is PptTemplateCategoryId {
  return pptTemplateCategoryIds.includes(value as PptTemplateCategoryId);
}

export function normalizePptTemplateCategoryId(
  value: string
): PptTemplateCategoryId | null {
  if (isPptTemplateCategoryId(value)) {
    return value;
  }

  return legacyPptTemplateCategoryMap[value] ?? null;
}

export function getPptTemplateCategoryQueryValues(
  category: PptTemplateCategoryId
) {
  return [
    category,
    ...Object.entries(legacyPptTemplateCategoryMap)
      .filter(([, mappedCategory]) => mappedCategory === category)
      .map(([legacyCategory]) => legacyCategory)
  ];
}
