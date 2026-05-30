export const deckTypeIds = [
  "business-report",
  "fundraising-pitch",
  "proposal",
  "project-plan",
  "retrospective-summary",
  "product-launch",
  "sales-proposal",
  "brand-marketing",
  "event-promotion",
  "training-course",
  "knowledge-sharing",
  "teaching-deck",
  "research-report",
  "data-analysis",
  "industry-insight",
  "operation-plan",
  "growth-experiment",
  "portfolio",
  "personal-review",
  "community-sharing"
] as const;

export const deckTypeGroups = [
  {
    id: "business",
    types: [
      "business-report",
      "fundraising-pitch",
      "proposal",
      "project-plan",
      "retrospective-summary"
    ]
  },
  {
    id: "salesMarketing",
    types: [
      "product-launch",
      "sales-proposal",
      "brand-marketing",
      "event-promotion"
    ]
  },
  {
    id: "education",
    types: ["training-course", "knowledge-sharing", "teaching-deck"]
  },
  {
    id: "research",
    types: ["research-report", "data-analysis", "industry-insight"]
  },
  {
    id: "operations",
    types: ["operation-plan", "growth-experiment"]
  },
  {
    id: "personal",
    types: ["portfolio", "personal-review", "community-sharing"]
  }
] as const satisfies Array<{
  id: string;
  types: readonly (typeof deckTypeIds)[number][];
}>;

export const deckStyleIds = [
  "strategic",
  "data",
  "story",
  "problem-solution",
  "minimal",
  "teaching",
  "visual-proposal",
  "retrospective"
] as const;

export const legacyDeckStyleIds = ["product"] as const;
export const deckStyleSchemaIds = [
  ...deckStyleIds,
  ...legacyDeckStyleIds
] as const;

export const paletteIds = [
  "star-map",
  "matrix",
  "deep-space",
  "morning-mist"
] as const;

export type DeckTypeId = (typeof deckTypeIds)[number];
export type DeckTypeGroupId = (typeof deckTypeGroups)[number]["id"];
export type DeckStyleId = (typeof deckStyleIds)[number];
export type DeckStyleSchemaId = (typeof deckStyleSchemaIds)[number];
export type PaletteId = (typeof paletteIds)[number];
