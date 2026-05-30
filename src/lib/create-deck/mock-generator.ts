import type { CreateDeckForm } from "./schema";
import type { DeckStyleSchemaId, DeckTypeId, PaletteId } from "./options";

export type GeneratedSlide = {
  id: string;
  index: number;
  title: string;
  body: string;
};

export type GeneratedDeckDraft = {
  mode: "mock";
  title: string;
  summary: string;
  slides: GeneratedSlide[];
};

export type MockSlideTemplate = {
  title: string;
  body: string;
};

export type MockDeckCopy = {
  titlePattern: string;
  summaryPattern: string;
  slideTemplates: MockSlideTemplate[];
  deckTypeNames: Record<DeckTypeId, string>;
  styleNames: Record<DeckStyleSchemaId, string>;
  paletteNames: Record<PaletteId, string>;
};

type TemplateValues = Record<string, string | number>;

function formatTemplate(template: string, values: TemplateValues) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? "")
  );
}

export function generateMockDeckDraft(
  input: CreateDeckForm,
  copy: MockDeckCopy
): GeneratedDeckDraft {
  const style = copy.styleNames[input.style];
  const deckType = copy.deckTypeNames[input.deckType];
  const palette = copy.paletteNames[input.palette];
  const baseValues = {
    idea: input.idea.trim(),
    audience: input.audience.trim(),
    goal: input.goal.trim(),
    count: input.pageCount,
    deckType,
    style,
    palette
  };

  const slides = Array.from({ length: input.pageCount }, (_, slideIndex) => {
    const index = slideIndex + 1;
    const template =
      copy.slideTemplates[slideIndex] ??
      copy.slideTemplates[copy.slideTemplates.length - 1];
    const values = { ...baseValues, index };

    return {
      id: `slide-${index}`,
      index,
      title: formatTemplate(template.title, values),
      body: formatTemplate(template.body, values)
    };
  });

  return {
    mode: "mock",
    title: formatTemplate(copy.titlePattern, baseValues),
    summary: formatTemplate(copy.summaryPattern, baseValues),
    slides
  };
}
