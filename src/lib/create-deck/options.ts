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
      "event-promotion",
      "operation-plan",
      "growth-experiment"
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
    id: "personal",
    types: ["portfolio", "personal-review", "community-sharing"]
  }
] as const satisfies Array<{
  id: string;
  types: readonly (typeof deckTypeIds)[number][];
}>;

export const paletteIds = [
  "star-map",
  "matrix",
  "deep-space",
  "morning-mist",
  "moon-white",
  "bamboo-green",
  "dai-blue",
  "rouge",
  "gilded-gold",
  "ink-black"
] as const;

export type DeckTypeId = (typeof deckTypeIds)[number];
export type DeckTypeGroupId = (typeof deckTypeGroups)[number]["id"];
export type PaletteId = (typeof paletteIds)[number];
