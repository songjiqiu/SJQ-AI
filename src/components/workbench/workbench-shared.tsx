"use client";

import {
  BookOpen,
  Check,
  ClipboardList,
  Download,
  FileJson,
  Gauge,
  GripVertical,
  Image as ImageIcon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Shapes,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
  Upload
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { resolveSlideContentBlockBindings } from "@/lib/ai-deck/content-block-bindings";
import type {
  GeneratedDeckResult,
  GeneratedSlideResult,
  SlideContent,
  SlideElement,
  UnifiedVisualSpec
} from "@/lib/ai-deck/schema";
import {
  extractPaletteRoleHexColors,
  normalizeHexColor,
  resolveSlideVisualColors,
  sanitizeColorRoleText,
  stripHexColorsFromText,
  type SlideVisualColors
} from "@/lib/ai-deck/visual-colors";
import { deckPageCountMax } from "@/lib/deck-input/schema";
import type { DeckOutlineDraft } from "@/lib/deck-outline/schema";
import { cn } from "@/lib/utils";

export type DeckHistoryItem = {
  id: string;
  createdAt: string;
  deckTitle: string;
  deckSummary: string;
  mode: "ai-json" | "mock";
  pptxUrl?: string;
  reviewScore: number;
  consistencyScore: number;
  slideCount: number;
  status: "GENERATING" | "READY" | "FAILED";
};

type DeckPreviewScoreItem = {
  icon: ReactNode;
  label: string;
  score: number;
  summary: string;
  testId: string;
};

type DeckPreviewProgress = {
  current: number;
  message: string;
  stage: string;
  total: number;
};

const boundsFieldLabels = {
  height: "H",
  width: "W",
  x: "X",
  y: "Y"
} as const satisfies Record<keyof SlideElement["bounds"], string>;

const imageIllustrationRuleFields = [
  "style",
  "composition",
  "background",
  "consistency"
] as const satisfies ReadonlyArray<
  keyof UnifiedVisualSpec["imageIllustrationRules"]
>;

const colorRolePreviewFields = [
  "background",
  "surface",
  "titleText",
  "bodyText",
  "accent",
  "highlight",
  "chart",
  "decorative",
  "borderDivider"
] as const satisfies ReadonlyArray<
  Exclude<keyof UnifiedVisualSpec["colorRoles"], "contrastRequirement">
>;

const typographyScaleFields = [
  "coverTitle",
  "coverSubtitle",
  "pageTitle",
  "sectionTitle",
  "body",
  "annotation",
  "chartLabel",
  "iconLabel"
] as const satisfies ReadonlyArray<
  keyof UnifiedVisualSpec["typographyRules"]["scale"]
>;

const compactTypographyScaleFields = [
  "coverTitle",
  "pageTitle",
  "body",
  "chartLabel"
] as const satisfies ReadonlyArray<
  keyof UnifiedVisualSpec["typographyRules"]["scale"]
>;

const baseColorHexes = ["#000000", "#FFFFFF"] as const;

type ColorSystemPreviewGroup = {
  colors: Array<{
    hex: string;
    name: string;
    roles: string[];
    usage: string;
  }>;
  key: keyof UnifiedVisualSpec["colorPalette"] | "base";
  label: string;
};

type ColorSystemPreviewColor = ColorSystemPreviewGroup["colors"][number];


function normalizeVisualRuleText(value: string) {
  return value.replace(/\s+/g, "").replace(/[。；;，,、/]+$/g, "").toLowerCase();
}

function dedupeVisualRuleTexts(values: string[]) {
  const seen = new Set<string>();

  return values.flatMap((value) => {
    const trimmed = value.trim();
    const key = normalizeVisualRuleText(trimmed);

    if (!trimmed || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [trimmed];
  });
}

function buildMergedForbiddenRules(
  visualSpec: Pick<UnifiedVisualSpec, "forbiddenRules" | "forbiddenVisualRules">
) {
  return dedupeVisualRuleTexts([
    ...visualSpec.forbiddenRules,
    ...visualSpec.forbiddenVisualRules
  ]);
}

function buildForbiddenRulePatch(value: string[]) {
  const merged = dedupeVisualRuleTexts(value).slice(0, 10);

  return {
    forbiddenRules: merged.slice(0, 6),
    forbiddenVisualRules: merged
  };
}

type RuleTagItem = {
  key: string;
  text: string;
};

function createRuleTagItem(key: string, text: string): RuleTagItem {
  return {
    key,
    text: text.trim()
  };
}

type RulePreviewItem = {
  label: string;
  value: string;
};

function createRulePreviewItem(
  label: string,
  value: string
): RulePreviewItem {
  return {
    label,
    value: value.trim()
  };
}

function RulePreviewCards({ items }: { items: RulePreviewItem[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {items.map((item) => (
        <OutlinePreviewColorText
          compact
          key={item.label}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
  );
}

function RuleTagGroupEditor({
  addPlaceholder,
  disabled = false,
  items,
  label,
  onAdd,
  onRemove
}: {
  addPlaceholder: string;
  disabled?: boolean;
  items: RuleTagItem[];
  label: string;
  onAdd: (value: string) => void;
  onRemove: (key: string) => void;
}) {
  const [draftValue, setDraftValue] = useState("");

  const commitDraft = () => {
    const nextValue = draftValue.trim();

    if (!nextValue) {
      setDraftValue("");
      return;
    }

    onAdd(nextValue);
    setDraftValue("");
  };

  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="grid gap-2 rounded-lg border border-border bg-background p-3">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium leading-5 text-foreground transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent-soft",
                disabled && "cursor-not-allowed opacity-70"
              )}
              disabled={disabled}
              key={item.key}
              onClick={() => onRemove(item.key)}
              type="button"
            >
              <span>{item.text}</span>
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
        <input
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
          disabled={disabled}
          onBlur={commitDraft}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }

            event.preventDefault();
            commitDraft();
          }}
          placeholder={addPlaceholder}
          value={draftValue}
        />
      </div>
    </label>
  );
}

function buildLabeledRuleTagItems<
  T extends Record<string, string>,
  K extends readonly (Extract<keyof T, string>)[]
>(
  fields: K,
  labelForField: (field: K[number]) => string,
  values: T
) {
  return fields.flatMap((field) => {
    const value = values[field]?.trim();

    if (!value) {
      return [];
    }

    return [
      createRuleTagItem(
        String(field),
        `${labelForField(field)}: ${value}`
      )
    ];
  });
}

export function WorkbenchStepNav({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations("workbench.steps");
  const steps = [
    {
      id: 1,
      label: t("input")
    },
    {
      id: 2,
      label: t("outline")
    },
    {
      id: 3,
      label: t("preview")
    }
  ] as const;

  return (
    <nav
      aria-label={t("aria")}
      className="sticky top-0 z-20 border-b border-border bg-background/92 px-4 py-4 backdrop-blur"
    >
      <ol className="mx-auto flex max-w-3xl items-center justify-center gap-3 text-base font-medium text-muted sm:gap-5">
        {steps.map((step, index) => {
          const completed = step.id < current;
          const active = step.id === current;

          return (
            <li className="flex items-center gap-2" key={step.id}>
              {index > 0 ? (
                <span className="hidden h-px w-12 bg-border sm:block" />
              ) : null}
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border border-border bg-surface text-sm",
                  completed && "border-accent bg-accent-soft text-accent-strong",
                  active && "border-accent bg-accent text-white"
                )}
              >
                {completed ? <Check className="size-4" aria-hidden="true" /> : step.id}
              </span>
              <span className={cn(active && "text-foreground")}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function OutlineDraftEditor({
  draft,
  selectedSlide,
  selectedSlideIndex,
  setDraft,
  setSelectedSlideIndex,
  variant = "detailed"
}: {
  draft: DeckOutlineDraft;
  selectedSlide: DeckOutlineDraft["slides"][number];
  selectedSlideIndex: number;
  setDraft: (draft: DeckOutlineDraft) => void;
  setSelectedSlideIndex: (index: number) => void;
  variant?: "cards" | "detailed";
}) {
  const t = useTranslations("workbench");

  const updateDraft = (patch: Partial<DeckOutlineDraft>) => {
    setDraft({
      ...draft,
      ...patch
    });
  };
  const updateSlide = (
    field: keyof DeckOutlineDraft["slides"][number],
    value: DeckOutlineDraft["slides"][number][keyof DeckOutlineDraft["slides"][number]]
  ) => {
    updateDraft({
      slides: draft.slides.map((slide, index) =>
        index === selectedSlideIndex
          ? {
              ...slide,
              [field]: value
            }
          : slide
      )
    });
  };

  if (variant === "cards") {
    return (
      <div className="grid gap-4 lg:grid-cols-[72px_minmax(0,1fr)]">
        <aside className="hidden content-start gap-2 lg:grid">
          {draft.slides.map((slide, index) => (
            <button
              className={cn(
                "grid h-20 place-items-center rounded-lg border border-border bg-surface text-sm font-semibold text-muted shadow-sm transition hover:border-accent",
                selectedSlideIndex === index &&
                  "border-accent bg-accent text-white"
              )}
              key={slide.slideId}
              onClick={() => setSelectedSlideIndex(index)}
              type="button"
            >
              <span>{slide.index}</span>
              <span className="text-[10px] font-medium">
                {index === 0 ? t("outline.cover") : t("outline.content")}
              </span>
            </button>
          ))}
        </aside>

        <section className="grid gap-4">
          <article className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
                {t("outline.cover")}
              </span>
              <span className="text-sm text-muted">
                {t("outline.slideCount", { count: draft.slides.length })}
              </span>
            </div>
            <EditableField
              label={t("outline.fields.deckTitle")}
              onChange={(value) => updateDraft({ deckTitle: value })}
              value={draft.deckTitle}
            />
            <EditableField
              label={t("outline.fields.deckSummary")}
              multiline
              onChange={(value) => updateDraft({ deckSummary: value })}
              value={draft.deckSummary}
            />
          </article>

          <article className="rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
            <div className="mb-3 text-base font-semibold text-foreground">
              {t("outline.directory")}
            </div>
            <ol className="grid gap-2 md:grid-cols-2">
              {draft.slides.map((slide) => (
                <li
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
                  key={slide.slideId}
                >
                  <span className="mr-2 text-accent-strong">
                    {slide.index}.
                  </span>
                  {slide.title}
                </li>
              ))}
            </ol>
          </article>

          {draft.slides.map((slide, index) => (
            <article
              className={cn(
                "grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5",
                selectedSlideIndex === index && "border-accent"
              )}
              key={slide.slideId}
              onFocus={() => setSelectedSlideIndex(index)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-lg font-semibold text-white">
                    {slide.index}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-muted">
                      {index === 0 ? t("outline.cover") : t("outline.content")}
                    </p>
                    <h3 className="text-base font-semibold text-foreground">
                      {slide.title}
                    </h3>
                  </div>
                </div>
                <Button
                  onClick={() => setSelectedSlideIndex(index)}
                  type="button"
                  variant={selectedSlideIndex === index ? "secondary" : "ghost"}
                >
                  {t("outline.selectSlide")}
                </Button>
              </div>

              <EditableField
                label={t("outline.fields.slideTitle")}
                onChange={(value) =>
                  updateSlideAt(index, { field: "title", value })
                }
                value={slide.title}
              />
              <EditableField
                label={t("outline.fields.subtitle")}
                onChange={(value) =>
                  updateSlideAt(index, { field: "subtitle", value })
                }
                value={slide.subtitle ?? ""}
              />
              <ListEditor
                label={t("outline.fields.bodyPoints")}
                onChange={(value) =>
                  updateSlideAt(index, { field: "bodyPoints", value })
                }
                value={slide.bodyPoints}
              />
              <ContentBlocksEditor
                label={t("outline.fields.contentBlocks")}
                onChange={(value) =>
                  updateSlideAt(index, { field: "contentBlocks", value })
                }
                value={slide.contentBlocks}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <EditableField
                  label={t("outline.fields.speakerGoal")}
                  multiline
                  onChange={(value) =>
                    updateSlideAt(index, { field: "speakerGoal", value })
                  }
                  value={slide.speakerGoal}
                />
                <EditableField
                  label={t("outline.fields.visualIntent")}
                  multiline
                  onChange={(value) =>
                    updateSlideAt(index, { field: "visualIntent", value })
                  }
                  value={slide.visualIntent}
                />
              </div>
              <SlideAdvancedFieldsEditor
                onChange={(slide) => updateSlideAt(index, slide)}
                slide={slide}
              />
            </article>
          ))}

          <details className="rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              {t("visualSpec.title")}
            </summary>
            <div className="mt-4 grid gap-3">
              <VisualSpecEditor
                onChange={(visualSpec) =>
                  updateDraft({ unifiedVisualSpec: visualSpec })
                }
                visualSpec={draft.unifiedVisualSpec}
              />
            </div>
          </details>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-lg border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="size-4 text-accent" aria-hidden="true" />
            {t("outline.title")}
          </div>
          <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-muted">
            {t("outline.slideCount", { count: draft.slides.length })}
          </span>
        </div>
        <EditableField
          label={t("outline.fields.deckTitle")}
          onChange={(value) => updateDraft({ deckTitle: value })}
          value={draft.deckTitle}
        />
        <EditableField
          label={t("outline.fields.deckSummary")}
          multiline
          onChange={(value) => updateDraft({ deckSummary: value })}
          value={draft.deckSummary}
        />
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileJson className="size-4 text-accent" aria-hidden="true" />
          {t("visualSpec.title")}
        </div>
        <VisualSpecEditor
          onChange={(visualSpec) => updateDraft({ unifiedVisualSpec: visualSpec })}
          visualSpec={draft.unifiedVisualSpec}
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <section className="grid content-start gap-2 rounded-lg border border-border bg-background p-3">
          <div className="text-sm font-semibold text-foreground">
            {t("outline.slides")}
          </div>
          <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
            {draft.slides.map((slide, index) => (
              <button
                key={slide.slideId}
                className={cn(
                  "grid gap-1 rounded-lg border border-border bg-surface p-3 text-left transition hover:border-accent",
                  selectedSlideIndex === index &&
                    "border-accent bg-accent-soft"
                )}
                onClick={() => setSelectedSlideIndex(index)}
                type="button"
              >
                <span className="text-xs font-medium text-muted">
                  {t("preview.slideLabel", { index: slide.index })}
                </span>
                <span className="line-clamp-2 text-sm font-semibold text-foreground">
                  {slide.title}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">
              {t("outline.slideEditor")}
            </div>
            <span className="rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-muted">
              {t("preview.slideLabel", { index: selectedSlide.index })}
            </span>
          </div>
          <EditableField
            label={t("outline.fields.slideTitle")}
            onChange={(value) => updateSlide("title", value)}
            value={selectedSlide.title}
          />
          <EditableField
            label={t("outline.fields.subtitle")}
            onChange={(value) => updateSlide("subtitle", value)}
            value={selectedSlide.subtitle ?? ""}
          />
          <ListEditor
            label={t("outline.fields.bodyPoints")}
            onChange={(value) => updateSlide("bodyPoints", value)}
            value={selectedSlide.bodyPoints}
          />
          <ContentBlocksEditor
            label={t("outline.fields.contentBlocks")}
            onChange={(value) => updateSlide("contentBlocks", value)}
            value={selectedSlide.contentBlocks}
          />
          <EditableField
            label={t("outline.fields.speakerGoal")}
            multiline
            onChange={(value) => updateSlide("speakerGoal", value)}
            value={selectedSlide.speakerGoal}
          />
          <EditableField
            label={t("outline.fields.visualIntent")}
            multiline
            onChange={(value) => updateSlide("visualIntent", value)}
            value={selectedSlide.visualIntent}
          />
          <SlideAdvancedFieldsEditor
            onChange={(slide) =>
              updateDraft({
                slides: draft.slides.map((item, index) =>
                  index === selectedSlideIndex ? slide : item
                )
              })
            }
            slide={selectedSlide}
          />
        </section>
      </div>
    </div>
  );

  function updateSlideAt(
    indexToUpdate: number,
    patch:
      | DeckOutlineDraft["slides"][number]
      | {
          field: keyof DeckOutlineDraft["slides"][number];
          value: DeckOutlineDraft["slides"][number][keyof DeckOutlineDraft["slides"][number]];
        }
  ) {
    setDraft({
      ...draft,
      slides: draft.slides.map((slide, index) =>
        index === indexToUpdate
          ? "field" in patch
            ? {
                ...slide,
                [patch.field]: patch.value
              }
            : patch
          : slide
      )
    });
  }
}

export function OutlineDraftPreview({ draft }: { draft: DeckOutlineDraft }) {
  const t = useTranslations("workbench");

  return (
    <section aria-label={t("outline.previewAria")} className="grid gap-4">
      <OutlinePreviewCard
        accent
        label={t("outline.cover")}
        number={1}
        tone="accent"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            <h2 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">
              {draft.deckTitle}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              {draft.deckSummary}
            </p>
          </div>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-strong">
            {t("outline.slideCount", { count: draft.slides.length })}
          </span>
        </div>
      </OutlinePreviewCard>

      <OutlinePreviewCard label={t("outline.directory")} number={2}>
        <p className="mb-4 text-sm leading-6 text-muted">
          {t("outline.readonlyHint")}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {draft.slides.map((slide) => (
            <div
              className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
              key={slide.slideId}
            >
              <span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-sm font-semibold text-accent-strong">
                {slide.index}
              </span>
              <span className="text-sm font-semibold leading-6 text-foreground">
                {slide.title}
              </span>
            </div>
          ))}
        </div>
      </OutlinePreviewCard>

      {draft.slides.map((slide, index) => (
        <OutlinePreviewCard
          label={index === 0 ? t("outline.chapter") : t("outline.content")}
          number={index + 3}
          key={slide.slideId}
          tone={index === 0 ? "accent" : "default"}
        >
          <div className="mb-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-lg font-semibold text-accent-strong">
                {formatOutlineSectionIndex(slide.index)}
              </span>
              <h3 className="text-xl font-semibold leading-tight text-foreground">
                {slide.title}
              </h3>
            </div>
            {slide.subtitle ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                {slide.subtitle}
              </p>
            ) : null}
          </div>
          <ul className="grid gap-2 text-sm leading-6 text-muted">
            {slide.bodyPoints.map((point, pointIndex) => (
              <li
                className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-3"
                key={`${slide.slideId}-${pointIndex}`}
              >
                <span
                  aria-hidden="true"
                  className="mt-2 size-1.5 rounded-full bg-border"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <OutlinePreviewContentBlocks slide={slide} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <OutlinePreviewNote
              label={t("outline.fields.speakerGoal")}
              value={slide.speakerGoal}
            />
            <OutlinePreviewNote
              label={t("outline.fields.visualIntent")}
              value={slide.visualIntent}
            />
          </div>
          <SlideAdvancedPreview slide={slide} />
        </OutlinePreviewCard>
      ))}

      <details className="rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {t("visualSpec.title")}
        </summary>
        <VisualSpecPreview visualSpec={draft.unifiedVisualSpec} />
      </details>
    </section>
  );
}

export function DeckPreviewScoreStrip({
  className,
  deck
}: {
  className?: string;
  deck: GeneratedDeckResult;
}) {
  const t = useTranslations("workbench");

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
        <CompactScorePanel
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          label={t("review.title")}
          score={deck.contentReview.score}
          summary={deck.contentReview.summary}
          testId="deck-preview-score-card-review"
        />
        <CompactScorePanel
          icon={<Gauge className="size-4" aria-hidden="true" />}
          label={t("consistency.title")}
          score={deck.consistencyReport.score}
          summary={deck.consistencyReport.summary}
          testId="deck-preview-score-card-consistency"
        />
      </div>
    </TooltipProvider>
  );
}

export function DeckPreview({
  deck,
  onDeckChange
}: {
  deck: GeneratedDeckResult;
  onDeckChange?: (deck: GeneratedDeckResult) => void;
}) {
  const t = useTranslations("workbench");
  const [editableDeck, setEditableDeck] = useState(deck);
  const [generationProgress, setGenerationProgress] =
    useState<DeckPreviewProgress | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isMotionPlaying, setIsMotionPlaying] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const selectedSlide =
    editableDeck.slides[selectedSlideIndex] ?? editableDeck.slides[0];
  const selectedElement = selectedSlide?.elements.find(
    (element) => element.id === selectedElementId
  );
  const isGenerating = editableDeck.status === "GENERATING";

  useEffect(() => {
    if (!isGenerating) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    async function refreshDeck() {
      try {
        const statusResponse = await fetch(`/api/decks/${editableDeck.id}/status`);
        const statusPayload = (await statusResponse.json()) as {
          progress?: DeckPreviewProgress;
          status?: GeneratedDeckResult["status"];
        };

        if (cancelled || !statusResponse.ok) {
          return;
        }

        if (statusPayload.progress) {
          setGenerationProgress(statusPayload.progress);
        }

        const deckResponse = await fetch(`/api/decks/${editableDeck.id}`);
        const deckPayload = (await deckResponse.json()) as GeneratedDeckResult;

        if (!cancelled && deckResponse.ok) {
          setEditableDeck(deckPayload);
          onDeckChange?.(deckPayload);
          setSelectedSlideIndex((index) =>
            Math.min(index, Math.max(deckPayload.slides.length - 1, 0))
          );
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(refreshDeck, 3000);
        }
      }
    }

    timer = window.setTimeout(refreshDeck, 1200);

    return () => {
      cancelled = true;

      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [editableDeck.id, isGenerating, onDeckChange]);

  return (
    <section
      aria-label={t("preview.aria")}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">
            {editableDeck.deckTitle}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("preview.generatedMeta", {
              count: editableDeck.slides.length,
              mode: t(`preview.modes.${editableDeck.mode}`)
            })}
          </p>
          {isGenerating ? (
            <div className="mt-3 grid max-w-xl gap-2">
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted">
                <span>
                  {generationProgress?.message ?? t("preview.lightweightReady")}
                </span>
                <span>
                  {t("preview.progressCount", {
                    current:
                      generationProgress?.current ?? editableDeck.slides.length,
                    total:
                      generationProgress?.total ?? editableDeck.input.pageCount
                  })}
                </span>
              </div>
              <div
                aria-label={t("preview.progressAria")}
                className="h-2 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={
                  generationProgress?.total ?? editableDeck.input.pageCount
                }
                aria-valuenow={
                  generationProgress?.current ?? editableDeck.slides.length
                }
              >
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        8,
                        ((generationProgress?.current ??
                          editableDeck.slides.length) /
                          Math.max(
                            1,
                            generationProgress?.total ??
                              editableDeck.input.pageCount
                          )) *
                          100
                      )
                    )}%`
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isGenerating}
            onClick={() => addBlankSlide()}
            type="button"
            variant="secondary"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("actions.addSlide")}
          </Button>
          <Button
            disabled={isGenerating}
            onClick={() => void regenerateCurrentSlide()}
            type="button"
            variant="secondary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.changeTemplate")}
          </Button>
          <Button
            onClick={() => setIsMotionPlaying((value) => !value)}
            type="button"
            variant="secondary"
          >
            {isMotionPlaying ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {isMotionPlaying ? t("actions.pauseMotion") : t("actions.playMotion")}
          </Button>
          <Button
            disabled={isSaving || isGenerating}
            onClick={() => void saveCurrentSlide()}
            type="button"
          >
            <Save className="size-4" aria-hidden="true" />
            {t("actions.saveCurrentSlide")}
          </Button>
          {editableDeck.pptxUrl ? (
            <a
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent"
              href={editableDeck.pptxUrl}
            >
              <Download className="size-4" aria-hidden="true" />
              {t("actions.download")}
            </a>
          ) : (
            <Button disabled type="button">
              <Download className="size-4" aria-hidden="true" />
              {t("preview.downloadPending")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[190px_minmax(0,1fr)_360px]">
        <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border bg-background p-3 xl:border-b-0 xl:border-r">
          <div className="mb-2 shrink-0 text-sm font-semibold text-foreground">
            {t("preview.thumbnails")}
          </div>
          <div className="flex min-h-0 gap-2 overflow-x-auto pb-1 xl:grid xl:flex-1 xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
            {editableDeck.slides.map((slide, index) => (
              <button
                key={slide.slideId}
                className={cn(
                  "grid w-36 shrink-0 gap-2 rounded-lg border border-border bg-surface p-2 text-left transition hover:border-accent xl:w-auto",
                  selectedSlideIndex === index &&
                    "border-accent bg-accent-soft"
                )}
                onClick={() => {
                  setSelectedSlideIndex(index);
                  setSelectedElementId(null);
                }}
                type="button"
              >
                <SlideCanvasPreview
                  compact
                  motionEnabled={false}
                  slide={slide}
                  unifiedVisualSpec={editableDeck.unifiedVisualSpec}
                />
                <span className="text-center text-xs font-medium text-muted">
                  {t("preview.slideLabel", { index: slide.index })}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden bg-surface-muted/55 p-4 md:p-5">
          <div className="grid min-h-0 justify-items-center overflow-hidden">
            {selectedSlide ? (
              <EditableSlideCanvas
                disabled={isGenerating}
                motionEnabled={isMotionPlaying}
                onChange={(slide) => updateSlide(slide)}
                onSelectElement={setSelectedElementId}
                selectedElementId={selectedElementId}
                slide={selectedSlide}
                unifiedVisualSpec={editableDeck.unifiedVisualSpec}
              />
            ) : null}
          </div>

          <div className="grid min-h-0 overflow-hidden">
            {selectedSlide ? (
              <div className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
                <SlideSelectedElementEditor
                  deck={editableDeck}
                  disabled={isGenerating}
                  onDeleteElement={deleteElement}
                  onElementChange={updateElement}
                  onSlideChange={(slide) => updateSlide(slide)}
                  selectedElement={selectedElement}
                  selectedSlide={selectedSlide}
                />
                <SlideMetaPanel
                  selectedElementId={selectedElementId}
                  slide={selectedSlide}
                />
              </div>
            ) : null}
          </div>
        </div>

        <aside className="grid min-h-0 min-w-0 overflow-hidden border-t border-border bg-background p-4 xl:border-l xl:border-t-0">
          {selectedSlide ? (
            <SlideEditingPanel
              onSelectElement={setSelectedElementId}
              onRegenerate={() => void regenerateCurrentSlide()}
              onSlideChange={(slide) => updateSlide(slide)}
              disabled={isGenerating}
              selectedElementId={selectedElementId}
              selectedSlide={selectedSlide}
            />
          ) : null}
        </aside>
      </div>
    </section>
  );

  function updateSlide(slide: GeneratedSlideResult) {
    setEditableDeck((value) => ({
      ...value,
      slides: value.slides.map((item, index) =>
        index === selectedSlideIndex ? slide : item
      )
    }));
  }

  function deleteElement(elementId: string) {
    if (!selectedSlide) {
      return;
    }

    const target = selectedSlide.elements.find((element) => element.id === elementId);

    if (!target) {
      return;
    }

    updateSlide({
      ...selectedSlide,
      elements: selectedSlide.elements.filter((element) => element.id !== elementId),
      generatedImageLayers: target.imageRequestId
        ? selectedSlide.generatedImageLayers.filter(
            (layer) => layer.requestId !== target.imageRequestId
          )
        : selectedSlide.generatedImageLayers,
      imageLayerRequests: target.imageRequestId
        ? selectedSlide.imageLayerRequests.filter(
            (request) => request.id !== target.imageRequestId
          )
        : selectedSlide.imageLayerRequests
    });
    setSelectedElementId(null);
  }

  function updateElement(
    elementId: string,
    patch: Partial<SlideElement>
  ) {
    if (!selectedSlide) {
      return;
    }

    updateSlide({
      ...selectedSlide,
      elements: selectedSlide.elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              ...patch
            }
          : element
      )
    });
  }

  async function saveCurrentSlide() {
    if (!selectedSlide) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/decks/${editableDeck.id}/slides/${selectedSlide.slideId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            content: selectedSlide.content,
            elements: selectedSlide.elements,
            generatedImageLayers: selectedSlide.generatedImageLayers,
            imageLayerRequests: selectedSlide.imageLayerRequests
          })
        }
      );
      const payload = (await response.json()) as GeneratedDeckResult;

      if (response.ok) {
        setEditableDeck(payload);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function regenerateCurrentSlide() {
    if (!selectedSlide) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/decks/${editableDeck.id}/slides/${selectedSlide.slideId}/regenerate`,
        {
          method: "POST"
        }
      );
      const payload = (await response.json()) as GeneratedDeckResult;

      if (response.ok) {
        setEditableDeck(payload);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function addBlankSlide() {
    const base = selectedSlide ?? editableDeck.slides[editableDeck.slides.length - 1];

    if (!base) {
      return;
    }

    const nextIndex = editableDeck.slides.length + 1;
    const slideId = `slide-${nextIndex}`;
    const nextSlide: GeneratedSlideResult = {
      ...base,
      slideId,
      index: nextIndex,
      content: {
        ...base.content,
        slideId,
        index: nextIndex,
        title: "新增页面",
        pageType: "content",
        subtitle: "",
        bodyPoints: ["输入本页要点"],
        contentBlocks: [
          {
            blockType: "title",
            content: "新增页面",
            priority: 1,
            sourceIds: [],
            text: "新增页面",
            type: "heading"
          },
          {
            blockType: "conclusion",
            content: "补充本页核心表达句",
            priority: 1,
            sourceIds: [],
            text: "补充本页核心表达句",
            type: "conclusion"
          },
          {
            blockType: "body",
            content: "输入本页要点",
            priority: 2,
            sourceIds: [],
            text: "输入本页要点",
            type: "text"
          }
        ],
        speakerGoal: "补充本页演讲目标",
        visualIntent: "补充本页视觉意图",
        coreStatement: "补充本页核心表达句",
        narrativeRole: "argument",
        contentLayers: {
          primary: [0, 1],
          supporting: [2],
          supplementary: []
        },
        slideTransition: {
          fromPrevious: "承接上一页内容继续展开。",
          toNext: "自然引出下一页内容。"
        },
        explanationDepth: "supporting",
        sourceRequirement: {
          required: false,
          categories: ["user-input"],
          note: "本页主要基于用户输入。"
        },
        adaptationRules: {
          splitWhen: "当要点超过 5 条时拆成独立页面。",
          splitCandidates: ["输入本页要点"],
          mergeWhen: "当只有一个辅助点时可与相邻页面合并。",
          mergeWith: "相邻页面"
        },
        audienceFocus: {
          lens: "general",
          focus: "确保观众理解本页与整体表达的关系。"
        },
        viewerObjective: {
          type: "understand",
          description: "看完本页后，观众应理解本页核心信息。"
        },
        contentBoundary: {
          inScope: "只展开本页核心信息和必要支撑。",
          outOfScope: ["不展开无关背景"]
        }
      },
      elements: base.elements.map((element) => ({
        ...element,
        id: `${slideId}-${element.semanticType}`,
        content: element.type === "text" ? "" : element.content,
        imageRequestId: undefined
      })),
      generatedImageLayers: [],
      imageLayerRequests: [],
      motionPlan: {
        ...base.motionPlan,
        elements: []
      }
    };

    setEditableDeck((value) => ({
      ...value,
      slides: [...value.slides, nextSlide]
    }));
    setSelectedSlideIndex(editableDeck.slides.length);
  }
}

function OutlinePreviewCard({
  accent = false,
  children,
  label,
  number,
  tone = "default"
}: {
  accent?: boolean;
  children: ReactNode;
  label: string;
  number: number;
  tone?: "accent" | "default";
}) {
  return (
    <article className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-sm lg:grid-cols-[72px_minmax(0,1fr)]">
      <aside
        className={cn(
          "grid grid-cols-[72px_minmax(0,1fr)] items-stretch border-b border-border lg:block lg:border-b-0 lg:border-r",
          accent ? "bg-accent text-white" : "bg-surface-muted text-foreground"
        )}
      >
        <div className="grid min-h-16 place-items-center gap-1 px-2 py-3 lg:min-h-full">
          <GripVertical
            className={cn(
              "hidden size-4 lg:block",
              accent ? "text-white/45" : "text-muted/35"
            )}
            aria-hidden="true"
          />
          <span className="text-2xl font-semibold leading-none">{number}</span>
          <span
            className={cn(
              "text-[11px] font-medium",
              accent ? "text-white/85" : "text-muted"
            )}
          >
            {label}
          </span>
          <BookOpen
            className={cn(
              "mt-auto hidden size-4 lg:block",
              accent ? "text-white/70" : "text-accent"
            )}
            aria-hidden="true"
          />
        </div>
      </aside>
      <div
        className={cn(
          "min-h-32 bg-[linear-gradient(color-mix(in_srgb,var(--border)_36%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--border)_36%,transparent)_1px,transparent_1px)] bg-[size:24px_24px] p-4 md:p-6",
          tone === "accent" && "bg-accent-soft/25"
        )}
      >
        {children}
      </div>
    </article>
  );
}

function OutlinePreviewNote({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/80 p-3">
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}

function OutlinePreviewColorText({
  compact = false,
  label,
  value
}: {
  compact?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-background/80",
      compact ? "p-2.5" : "p-3"
    )}>
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <ColorizedText compact={compact} value={value} />
    </div>
  );
}

function OutlinePreviewList({
  compact = false,
  label,
  value
}: {
  compact?: boolean;
  label: string;
  value: string[];
}) {
  return (
    <div>
      <div className={cn("text-xs font-medium text-muted", compact ? "mb-1" : "mb-2")}>
        {label}
      </div>
      <div className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
        {value.map((item, index) => (
          <ColorToken
            key={`${item}-${index}`}
            value={item}
            variant={compact ? "compact" : "inline"}
          />
        ))}
      </div>
    </div>
  );
}

function OutlinePreviewContentBlocks({ slide }: { slide: SlideContent }) {
  const t = useTranslations("workbench");

  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-muted">
          {t("outline.fields.contentBlocks")}
        </div>
        <span className="rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium text-muted">
          JSON
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {slide.contentBlocks.map((block, index) => (
          <div
            className="rounded-md border border-border bg-surface px-3 py-2 text-xs leading-5 text-muted"
            key={`${slide.slideId}-block-${index}`}
          >
            <div className="mb-1 flex min-w-0 items-center gap-2 font-medium text-foreground">
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-strong">
                {contentBlockTypeLabel(block)}
              </span>
              <span className="text-muted">P{block.priority}</span>
            </div>
            <div>{contentBlockText(block)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function resolveContentLayerTexts(
  slide: SlideContent,
  group: keyof SlideContent["contentLayers"]
) {
  return slide.contentLayers[group].flatMap((index) => {
    const block = slide.contentBlocks[index];

    return block ? [contentBlockText(block)] : [];
  });
}

function SlideAdvancedPreview({ slide }: { slide: SlideContent }) {
  const t = useTranslations("workbench");

  return (
    <div className="mt-5 grid gap-4 rounded-lg border border-border bg-background/70 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <OutlinePreviewNote
          label={t("outline.fields.coreStatement")}
          value={slide.coreStatement}
        />
        <OutlinePreviewNote
          label={t("outline.fields.narrativeRole")}
          value={t(`outline.values.narrativeRole.${slide.narrativeRole}`)}
        />
        <OutlinePreviewNote
          label={t("outline.fields.explanationDepth")}
          value={t(`outline.values.explanationDepth.${slide.explanationDepth}`)}
        />
        <OutlinePreviewNote
          label={t("outline.fields.audienceFocus")}
          value={`${t(`outline.values.audienceFocus.${slide.audienceFocus.lens}`)} · ${slide.audienceFocus.focus}`}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OutlinePreviewList
          label={t("outline.fields.contentLayersPrimary")}
          value={resolveContentLayerTexts(slide, "primary")}
        />
        <OutlinePreviewList
          label={t("outline.fields.contentLayersSupporting")}
          value={resolveContentLayerTexts(slide, "supporting")}
        />
        <OutlinePreviewList
          label={t("outline.fields.contentLayersSupplementary")}
          value={resolveContentLayerTexts(slide, "supplementary")}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <OutlinePreviewNote
          label={t("outline.fields.transitionFromPrevious")}
          value={slide.slideTransition.fromPrevious}
        />
        <OutlinePreviewNote
          label={t("outline.fields.transitionToNext")}
          value={slide.slideTransition.toNext}
        />
        <OutlinePreviewNote
          label={t("outline.fields.sourceRequirement")}
          value={`${slide.sourceRequirement.required ? t("outline.values.required") : t("outline.values.notRequired")} · ${slide.sourceRequirement.categories.map((category) => t(`outline.values.sourceCategory.${category}`)).join(" / ")} · ${slide.sourceRequirement.note}`}
        />
        <OutlinePreviewNote
          label={t("outline.fields.viewerObjective")}
          value={`${t(`outline.values.viewerObjective.${slide.viewerObjective.type}`)} · ${slide.viewerObjective.description}`}
        />
        <OutlinePreviewNote
          label={t("outline.fields.adaptationRules")}
          value={`${slide.adaptationRules.splitWhen} ${slide.adaptationRules.mergeWhen} ${slide.adaptationRules.mergeWith}`}
        />
        <OutlinePreviewNote
          label={t("outline.fields.contentBoundary")}
          value={`${slide.contentBoundary.inScope} ${slide.contentBoundary.outOfScope.join(" / ")}`}
        />
      </div>
    </div>
  );
}

export function VisualSpecPreview({
  visualSpec
}: {
  visualSpec: DeckOutlineDraft["unifiedVisualSpec"];
}) {
  const t = useTranslations("workbench");
  const mergedForbiddenRules = buildMergedForbiddenRules(visualSpec);
  const imageRuleItems = [
    createRulePreviewItem(
      t("outline.fields.imageType"),
      visualSpec.imageRules.imageType
    ),
    createRulePreviewItem(
      t("outline.fields.aspectRatio"),
      visualSpec.imageRules.aspectRatio
    ),
    createRulePreviewItem(
      t("outline.fields.imageStyle"),
      visualSpec.imageStyle
    ),
    createRulePreviewItem(
      t("outline.fields.imagePromptStyle"),
      visualSpec.imageRules.imagePromptStyle
    ),
    createRulePreviewItem(
      t("outline.fields.backgroundAvoidsHighContrastTextArea"),
      visualSpec.imageRules.backgroundAvoidsHighContrastTextArea
        ? t("outline.values.yes")
        : t("outline.values.no")
    ),
    createRulePreviewItem(
      t("outline.fields.subjectAvoidsTitleArea"),
      visualSpec.imageRules.subjectAvoidsTitleArea
        ? t("outline.values.yes")
        : t("outline.values.no")
    ),
    createRulePreviewItem(
      t("outline.fields.usageNotes"),
      dedupeVisualRuleTexts(visualSpec.imageRules.usageNotes).join(" / ")
    ),
    createRulePreviewItem(
      t("outline.fields.imageForbiddenItems"),
      dedupeVisualRuleTexts(visualSpec.imageRules.forbiddenItems).join(" / ")
    ),
    ...imageIllustrationRuleFields.map((field) =>
      createRulePreviewItem(
        t(`outline.fields.${field}`),
        visualSpec.imageIllustrationRules[field]
      )
    )
  ];
  const consistencyRuleItems = dedupeVisualRuleTexts(
    visualSpec.consistencyRules
  ).map((item, index) =>
    createRulePreviewItem(
      t("outline.fields.ruleNumber", {
        number: index + 1
      }),
      item
    )
  );
  const typographySummary = [
    `${t("outline.fields.defaultFontSize")}: ${visualSpec.typographyRules.defaultFontSize}`,
    `${t("outline.fields.minFontSize")}: ${visualSpec.typographyRules.minFontSize}`,
    `${t("outline.fields.maxLines")}: ${visualSpec.typographyRules.maxLines}`,
    `${t("outline.fields.lineHeight")}: ${visualSpec.typographyRules.lineHeight}`
  ].join(" / ");

  return (
    <div className="mt-3 grid gap-3">
      <VisualSpecSection title={t("outline.fields.basicInfo")}>
        <div className="grid gap-2 md:grid-cols-2">
          <OutlinePreviewColorText
            compact
            label={t("outline.fields.themeName")}
            value={visualSpec.themeName}
          />
          <OutlinePreviewColorText
            compact
            label={t("outline.fields.visualStyle")}
            value={visualSpec.visualStyle}
          />
          <OutlinePreviewColorText
            compact
            label={t("outline.fields.designIntent")}
            value={visualSpec.designIntent}
          />
          <OutlinePreviewColorText
            compact
            label={t("outline.fields.usageConvenience")}
            value={visualSpec.usageConvenience}
          />
        </div>
      </VisualSpecSection>

      <PptTypeVisualTonePreview visualSpec={visualSpec} />

      <VisualSpecSection title={t("outline.fields.colorSystem")}>
        <ColorSystemPreview visualSpec={visualSpec} />
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.layoutTypography")}>
        <div className="grid gap-2 md:grid-cols-2">
          <OutlinePreviewColorText
            compact
            label={t("outline.fields.typography")}
            value={visualSpec.typography}
          />
          <OutlinePreviewColorText
            compact
            label={t("outline.fields.pageSpec")}
            value={visualSpec.pageSpec.layoutInstruction}
          />
          <OutlinePreviewColorText
            compact
            label={t("outline.fields.typographyRules")}
            value={typographySummary}
          />
          <OutlinePreviewList
            compact
            label={t("outline.fields.fontFallback")}
            value={visualSpec.typographyRules.fontFallback}
          />
          {compactTypographyScaleFields.map((field) => {
            const item = visualSpec.typographyRules.scale[field];

            return (
              <OutlinePreviewColorText
                compact
                key={field}
                label={t(`outline.fields.${field}`)}
                value={`${item.fontSize}px / ${item.fontWeight} / ${item.lineHeight} · ${item.usage}`}
              />
            );
          })}
        </div>
        <details className="rounded-lg border border-border bg-background/70 p-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-foreground">
            {t("outline.fields.fullTypographyScale", {
              count: typographyScaleFields.length
            })}
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {typographyScaleFields.map((field) => {
              const item = visualSpec.typographyRules.scale[field];

              return (
                <OutlinePreviewColorText
                  compact
                  key={field}
                  label={t(`outline.fields.${field}`)}
                  value={`${item.fontSize}px / ${item.fontWeight} / ${item.lineHeight} · ${item.usage}`}
                />
              );
            })}
          </div>
        </details>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.imageRules")}>
        <RulePreviewCards items={imageRuleItems} />
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.rulesList")}>
        <RulePreviewCards items={consistencyRuleItems} />
      </VisualSpecSection>

      <AdvancedVisualSpecPreview
        forbiddenRules={mergedForbiddenRules}
        visualSpec={visualSpec}
      />
    </div>
  );
}

function PptTypeVisualTonePreview({
  visualSpec
}: {
  visualSpec: UnifiedVisualSpec;
}) {
  const t = useTranslations("workbench");

  return (
    <VisualSpecSection title={t("outline.fields.pptTypeVisualTone")}>
      <div className="grid gap-2 md:grid-cols-3">
        <OutlinePreviewColorText
          compact
          label={t("outline.fields.deckType")}
          value={visualSpec.pptTypeVisualTone.deckTypeName}
        />
        <OutlinePreviewColorText
          compact
          label={t("outline.fields.recommendedTone")}
          value={visualSpec.pptTypeVisualTone.recommendedTone}
        />
        <OutlinePreviewList
          compact
          label={t("outline.fields.visualKeywords")}
          value={visualSpec.pptTypeVisualTone.visualKeywords}
        />
      </div>
    </VisualSpecSection>
  );
}

function AdvancedVisualSpecPreview({
  forbiddenRules,
  visualSpec
}: {
  forbiddenRules: string[];
  visualSpec: UnifiedVisualSpec;
}) {
  const t = useTranslations("workbench");
  const advancedRuleGroups = [
    {
      label: t("outline.fields.informationDensityRules"),
      values: [
        `${t("outline.fields.defaultLevel")}: ${visualSpec.informationDensityRules.defaultLevel}`,
        visualSpec.informationDensityRules.businessReport,
        visualSpec.informationDensityRules.trainingCourse,
        visualSpec.informationDensityRules.brandMarketing,
        visualSpec.informationDensityRules.researchReport
      ]
    },
    {
      label: t("outline.fields.layoutRules"),
      values: Object.values(visualSpec.layoutRules)
    },
    {
      label: t("outline.fields.chartVisualRules"),
      values: Object.values(visualSpec.chartVisualRules)
    },
    {
      label: t("outline.fields.iconStyleRules"),
      values: [
        visualSpec.iconStyleRules.style,
        visualSpec.iconStyleRules.stroke,
        visualSpec.iconStyleRules.usage,
        visualSpec.iconStyleRules.consistency
      ]
    },
    {
      label: t("outline.fields.componentRules"),
      values: Object.values(visualSpec.componentRules)
    },
    {
      label: t("outline.fields.transparencyRules"),
      values: visualSpec.transparencyRules.map(
        (rule) => `${rule.baseHex} / ${rule.opacity} · ${rule.usage}`
      )
    },
    {
      label: t("outline.fields.emphasisRules"),
      values: Object.values(visualSpec.emphasisRules)
    },
    {
      label: t("outline.fields.forbiddenRulePreview"),
      values: forbiddenRules
    }
  ];
  const advancedRuleCount = advancedRuleGroups.reduce(
    (total, group) => total + group.values.length,
    0
  );

  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        {t("outline.fields.advancedRulesSummary", {
          count: advancedRuleCount,
          groups: advancedRuleGroups.length
        })}
      </summary>
      <div className="mt-3 grid gap-3">
        <RulePreviewCards
          items={advancedRuleGroups.map((group) =>
            createRulePreviewItem(group.label, group.values.join(" / "))
          )}
        />
      </div>
    </details>
  );
}

function VisualSpecSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function PptTypeVisualToneEditor({
  disabled = false,
  onChange,
  visualSpec
}: {
  disabled?: boolean;
  onChange: (visualSpec: DeckOutlineDraft["unifiedVisualSpec"]) => void;
  visualSpec: DeckOutlineDraft["unifiedVisualSpec"];
}) {
  const t = useTranslations("workbench");

  return (
    <VisualSpecSection title={t("outline.fields.pptTypeVisualTone")}>
      <div className="grid gap-3 md:grid-cols-2">
        <EditableField
          disabled
          label={t("outline.fields.deckType")}
          onChange={() => undefined}
          value={visualSpec.pptTypeVisualTone.deckTypeName}
        />
        <EditableField
          disabled={disabled}
          label={t("outline.fields.recommendedTone")}
          onChange={(value) =>
            onChange({
              ...visualSpec,
              pptTypeVisualTone: {
                ...visualSpec.pptTypeVisualTone,
                recommendedTone: value
              }
            })
          }
          value={visualSpec.pptTypeVisualTone.recommendedTone}
        />
        <ListEditor
          disabled={disabled}
          label={t("outline.fields.visualKeywords")}
          onChange={(value) =>
            onChange({
              ...visualSpec,
              pptTypeVisualTone: {
                ...visualSpec.pptTypeVisualTone,
                visualKeywords: value
              }
            })
          }
          value={visualSpec.pptTypeVisualTone.visualKeywords}
        />
      </div>
    </VisualSpecSection>
  );
}

function ColorSystemPreview({
  visualSpec
}: {
  visualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">;
}) {
  const t = useTranslations("workbench");
  const groups = buildColorSystemPreviewGroups(visualSpec, t);

  return (
    <div className="grid gap-3">
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">
          {t("outline.fields.colorPaletteWithRoles")}
        </div>
        <div className="grid gap-2">
          {groups.map((group) => (
            <div className="grid gap-1.5" key={group.key}>
              <div className="text-xs font-medium text-muted">
                {group.label}
              </div>
              <div className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
                {group.colors.map((color) => (
                  <ColorSystemColorCard
                    color={color}
                    key={`${group.key}-${color.hex}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-background/80 p-2.5">
        <div className="mb-1 text-xs font-medium text-muted">
          {t("outline.fields.contrastRequirement")}
        </div>
        <ColorizedText compact value={visualSpec.colorRoles.contrastRequirement} />
      </div>
    </div>
  );
}

function ColorSystemColorCard({
  color
}: {
  color: ColorSystemPreviewColor;
}) {
  const t = useTranslations("workbench");

  return (
    <div
      className="grid gap-1.5 rounded-lg border border-border bg-background/80 p-2.5"
      data-color-system-card={color.hex}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full border border-border"
          data-color-token={color.hex}
          style={{ backgroundColor: color.hex }}
        />
        <span className="min-w-0 truncate text-xs font-semibold text-foreground">
          {color.name}
        </span>
        <span className="shrink-0 rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs font-medium leading-4 text-foreground">
          {color.hex}
        </span>
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-foreground">
        {color.usage}
      </p>
      {color.roles.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted">
            {t("outline.fields.relatedRoles")}
          </span>
          {color.roles.map((role) => (
            <span
              className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs font-medium leading-4 text-foreground"
              key={role}
            >
              {role}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildColorSystemPreviewGroups(
  visualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">,
  t: ReturnType<typeof useTranslations<"workbench">>
): ColorSystemPreviewGroup[] {
  const roleLabelsByHex = buildColorRoleLabelsByHex(visualSpec, t);
  const paletteHexes = new Set<string>();
  const groups: ColorSystemPreviewGroup[] = getPaletteGroups(
    visualSpec.colorPalette,
    t
  ).map((group) => ({
    ...group,
    colors: group.colors.map((color) => {
      const hex = normalizeHexColor(color.hex);

      paletteHexes.add(hex);

      return {
        hex,
        name: color.name,
        roles: roleLabelsByHex.get(hex) ?? [],
        usage: color.usage
      };
    })
  }));
  const baseColors = baseColorHexes
    .filter((hex) => !paletteHexes.has(hex) && roleLabelsByHex.has(hex))
    .map((hex) => ({
      hex,
      name: hex,
      roles: roleLabelsByHex.get(hex) ?? [],
      usage: t("outline.values.baseColorUsage")
    }));

  if (baseColors.length > 0) {
    groups.push({
      colors: baseColors,
      key: "base",
      label: t("outline.paletteGroups.base")
    });
  }

  return groups;
}

function buildColorRoleLabelsByHex(
  visualSpec: Pick<UnifiedVisualSpec, "colorPalette" | "colorRoles">,
  t: ReturnType<typeof useTranslations<"workbench">>
) {
  const roleLabelsByHex = new Map<string, string[]>();

  colorRolePreviewFields.forEach((field) => {
    extractPaletteRoleHexColors(
      visualSpec.colorRoles[field],
      visualSpec.colorPalette
    ).forEach((hex) => {
      const normalizedHex = normalizeHexColor(hex);
      const labels = roleLabelsByHex.get(normalizedHex) ?? [];
      const label = t(`outline.fields.${field}`);

      if (!labels.includes(label)) {
        roleLabelsByHex.set(normalizedHex, [...labels, label]);
      }
    });
  });

  return roleLabelsByHex;
}

function ColorPaletteEditor({
  disabled = false,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: UnifiedVisualSpec["colorPalette"]) => void;
  value: UnifiedVisualSpec["colorPalette"];
}) {
  const t = useTranslations("workbench");
  const groups = getPaletteGroups(value, t);

  return (
    <div className="grid gap-3">
      {groups.map((group) => (
        <label className="grid gap-2" key={group.key}>
          <span className="text-xs font-medium text-muted">{group.label}</span>
          <textarea
            className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                [group.key]: parsePaletteGroupLines(
                  event.target.value,
                  value[group.key]
                )
              })
            }
            value={value[group.key]
              .map((color) => `${color.name} | ${color.hex} | ${color.usage}`)
              .join("\n")}
          />
        </label>
      ))}
    </div>
  );
}

function getPaletteGroups(
  colors: UnifiedVisualSpec["colorPalette"],
  t: ReturnType<typeof useTranslations<"workbench">>
) {
  return ([
    ["primary", "outline.paletteGroups.primary"],
    ["secondary", "outline.paletteGroups.secondary"],
    ["chart", "outline.paletteGroups.chart"],
    ["neutral", "outline.paletteGroups.neutral"],
    ["accent", "outline.paletteGroups.accent"]
  ] as const).map(([key, labelKey]) => ({
    colors: colors[key],
    key,
    label: t(labelKey)
  }));
}

function parsePaletteGroupLines(
  value: string,
  fallback: UnifiedVisualSpec["colorPalette"]["primary"]
) {
  const parsed = parseLines(value).flatMap((line, index) => {
    const [namePart, hexPart, usagePart] = line
      .split("|")
      .map((item) => item.trim());
    const hex = normalizePaletteInputHex(hexPart ?? namePart);
    const fallbackItem = fallback[index] ?? fallback[0];

    if (!hex) {
      return [];
    }

    return [
      {
        hex,
        name: namePart && namePart !== hexPart ? namePart : fallbackItem.name,
        usage: usagePart || fallbackItem.usage
      }
    ];
  });

  return parsed.length > 0 ? parsed : fallback;
}

function normalizePaletteInputHex(value: string | undefined) {
  const match = value?.match(/#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/)?.[0];

  return match ? normalizeHexColor(match.startsWith("#") ? match : `#${match}`) : "";
}

function sanitizeVisualSpecColorRoles(
  visualSpec: UnifiedVisualSpec
): UnifiedVisualSpec {
  return {
    ...visualSpec,
    colorRoles: {
      ...visualSpec.colorRoles,
      accent: sanitizeVisualSpecColorRole(visualSpec, "accent"),
      background: sanitizeVisualSpecColorRole(visualSpec, "background"),
      bodyText: sanitizeVisualSpecColorRole(visualSpec, "bodyText"),
      borderDivider: sanitizeVisualSpecColorRole(visualSpec, "borderDivider"),
      chart: sanitizeVisualSpecColorRole(visualSpec, "chart"),
      decorative: sanitizeVisualSpecColorRole(visualSpec, "decorative"),
      highlight: sanitizeVisualSpecColorRole(visualSpec, "highlight"),
      surface: sanitizeVisualSpecColorRole(visualSpec, "surface"),
      titleText: sanitizeVisualSpecColorRole(visualSpec, "titleText")
    }
  };
}

function updateVisualSpecColorRole(
  visualSpec: UnifiedVisualSpec,
  field: keyof UnifiedVisualSpec["colorRoles"],
  value: string
): UnifiedVisualSpec {
  if (field === "contrastRequirement") {
    return {
      ...visualSpec,
      colorRoles: {
        ...visualSpec.colorRoles,
        contrastRequirement: value
      }
    };
  }

  return {
    ...visualSpec,
    colorRoles: {
      ...visualSpec.colorRoles,
      [field]: sanitizeVisualSpecColorRole(
        {
          ...visualSpec,
          colorRoles: {
            ...visualSpec.colorRoles,
            [field]: value
          }
        },
        field
      )
    }
  };
}

function sanitizeVisualSpecColorRole(
  visualSpec: UnifiedVisualSpec,
  field: keyof UnifiedVisualSpec["colorRoles"]
) {
  return sanitizeColorRoleText({
    fallback: visualSpec.colorRoles[field],
    palette: visualSpec.colorPalette,
    role: field,
    value: visualSpec.colorRoles[field]
  });
}

function ColorizedText({
  compact = false,
  value
}: {
  compact?: boolean;
  value: string;
}) {
  const colors = extractHexColors(value);

  return (
    <div className={cn("grid", compact ? "gap-1.5" : "gap-2")}>
      {colors.length > 0 ? (
        <div className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
          {colors.map((color) => (
            <ColorToken
              key={color}
              value={color}
              variant={compact ? "compact" : "inline"}
            />
          ))}
        </div>
      ) : null}
      <p className={cn(
        "text-foreground",
        compact ? "text-xs leading-5" : "text-sm leading-6"
      )}>
        {value}
      </p>
    </div>
  );
}

function ColorRoleText({
  palette,
  value
}: {
  palette: UnifiedVisualSpec["colorPalette"];
  value: string;
}) {
  const colors = extractPaletteRoleHexColors(value, palette);
  const text = stripHexColorsFromText(value) || value;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-7 text-foreground">
      <span>{text}</span>
      {colors.map((color) => (
        <ColorToken key={color} value={color} />
      ))}
    </p>
  );
}

function ColorToken({
  value,
  variant = "inline"
}: {
  value: string;
  variant?: "compact" | "inline" | "palette";
}) {
  const color = extractHexColors(value)[0];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium leading-5 text-foreground",
        variant === "compact" && "gap-1.5 px-1.5 py-0.5 leading-4",
        variant === "palette" && "px-2.5 py-1.5"
      )}
      data-color-token={color ?? undefined}
    >
      {color ? (
        <span
          aria-hidden="true"
          className={cn(
            "rounded-full border border-border",
            variant === "compact" ? "size-3" : "size-3.5"
          )}
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span>{value}</span>
    </span>
  );
}

export function Field({
  children,
  error,
  label
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="text-sm text-warning">{error}</span> : null}
    </label>
  );
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 102.4) / 10} KB`;
  }

  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

function EditableField({
  disabled = false,
  label,
  multiline = false,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </label>
  );
}

function BoundsEditor({
  disabled = false,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (bounds: SlideElement["bounds"]) => void;
  value: SlideElement["bounds"];
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-6 gap-y-3">
      {(["x", "y", "width", "height"] as const).map((field) => (
        <label
          className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-2"
          key={field}
        >
          <span className="text-xs font-medium text-muted">
            {boundsFieldLabels[field]}
          </span>
          <input
            className="h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
            disabled={disabled}
            onChange={(event) =>
              onChange(
                clampBounds({
                  ...value,
                  [field]: Number(event.target.value)
                })
              )
            }
            step="0.05"
            type="number"
            value={value[field]}
          />
        </label>
      ))}
    </div>
  );
}

function NumberField({
  disabled = false,
  label,
  max,
  min,
  onChange,
  step = 1,
  value
}: {
  disabled?: boolean;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function CheckboxField({
  disabled = false,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground">
      <input
        checked={value}
        className="size-4 accent-[var(--accent)]"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function ListEditor({
  disabled = false,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <textarea
        className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        disabled={disabled}
        onChange={(event) => onChange(parseLines(event.target.value))}
        value={value.join("\n")}
      />
    </label>
  );
}

function ContentBlocksEditor({
  disabled = false,
  label,
  onChange,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: SlideContent["contentBlocks"]) => void;
  value: SlideContent["contentBlocks"];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <textarea
        className="min-h-32 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        disabled={disabled}
        onChange={(event) => onChange(parseContentBlockLines(event.target.value, value))}
        value={formatContentBlockLines(value)}
      />
    </label>
  );
}

function ContentLayerEditor({
  disabled = false,
  group,
  label,
  onChange,
  slide
}: {
  disabled?: boolean;
  group: keyof SlideContent["contentLayers"];
  label: string;
  onChange: (slide: SlideContent) => void;
  slide: SlideContent;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <textarea
        className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        disabled={disabled}
        onChange={(event) =>
          onChange(updateSlideContentLayerFromText(slide, group, event.target.value))
        }
        value={formatContentLayerLines(slide, group)}
      />
    </label>
  );
}

function formatContentBlockLines(value: SlideContent["contentBlocks"]) {
  return value
    .map((block) => {
      const sourceIds = block.sourceIds?.length
        ? ` | ${block.sourceIds.join(",")}`
        : "";

      return `${contentBlockTypeLabel(block)} | ${block.priority} | ${contentBlockText(block)}${sourceIds}`;
    })
    .join("\n");
}

function parseContentBlockLines(
  value: string,
  fallback: SlideContent["contentBlocks"]
): SlideContent["contentBlocks"] {
  const parsed = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      const [rawType, rawPriority, rawText = "", rawSourceIds = ""] = line
        .split("|")
        .map((item) => item.trim());
      const type = isSemanticContentBlockType(rawType)
        ? rawType
        : fallback[index]?.type ?? "text";
      const blockType = legacyContentBlockTypeForSemanticType(type);
      const priority = Number(rawPriority);
      const text = rawText.trim();

      if (text.length < 2) {
        return [];
      }

      return [
        {
          blockType,
          content: text.slice(0, 500),
          priority:
            Number.isFinite(priority) && priority >= 1 && priority <= 5
              ? Math.trunc(priority)
              : fallback[index]?.priority ?? Math.min(5, index + 1),
          sourceIds: rawSourceIds
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 24),
          text: text.slice(0, 500),
          type
        }
      ];
    });

  return parsed.length >= 3 ? parsed.slice(0, 12) : fallback;
}

function formatContentLayerLines(
  slide: SlideContent,
  group: keyof SlideContent["contentLayers"]
) {
  return slide.contentLayers[group]
    .flatMap((index) => {
      const block = slide.contentBlocks[index];

      return block ? [contentBlockText(block)] : [];
    })
    .join("\n");
}

function updateSlideContentLayerFromText(
  slide: SlideContent,
  group: keyof SlideContent["contentLayers"],
  value: string
): SlideContent {
  const lines = parseLines(value);
  let contentBlocks = [...slide.contentBlocks];
  const indexes: number[] = [];

  for (const line of lines) {
    const existingIndex = findContentBlockIndex(contentBlocks, line);

    if (existingIndex >= 0) {
      if (!indexes.includes(existingIndex)) {
        indexes.push(existingIndex);
      }
      continue;
    }

    if (contentBlocks.length >= 12) {
      continue;
    }

    contentBlocks = [
      ...contentBlocks,
      {
        blockType: "body",
        content: line.slice(0, 500),
        priority: group === "primary" ? 1 : group === "supporting" ? 3 : 5,
        sourceIds: [],
        text: line.slice(0, 500),
        type: "text"
      }
    ];
    indexes.push(contentBlocks.length - 1);
  }

  const contentLayers = normalizeSlideContentLayers({
    ...slide.contentLayers,
    [group]: indexes
  }, contentBlocks);

  return {
    ...slide,
    contentBlocks,
    contentLayers
  };
}

function findContentBlockIndex(
  blocks: SlideContent["contentBlocks"],
  text: string
) {
  const key = normalizeContentText(text);

  return blocks.findIndex((block) => normalizeContentText(contentBlockText(block)) === key);
}

function normalizeContentText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s'"“”‘’《》<>「」『』【】()[\]{}.,，。:：;；!！?？、/_\-—–|｜]+/g, "");
}

function normalizeSlideContentLayers(
  layers: SlideContent["contentLayers"],
  contentBlocks: SlideContent["contentBlocks"]
): SlideContent["contentLayers"] {
  const used = new Set<number>();
  const normalized: SlideContent["contentLayers"] = {
    primary: [],
    supporting: [],
    supplementary: []
  };

  for (const group of ["primary", "supporting", "supplementary"] as const) {
    const maxItems = group === "primary" ? 4 : group === "supporting" ? 6 : 5;

    for (const index of layers[group]) {
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < contentBlocks.length &&
        !used.has(index) &&
        normalized[group].length < maxItems
      ) {
        used.add(index);
        normalized[group].push(index);
      }
    }
  }

  const orderedIndexes = contentBlocks
    .map((block, index) => ({ index, priority: block.priority }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index);
  const add = (group: keyof SlideContent["contentLayers"], index: number) => {
    const maxItems = group === "primary" ? 4 : group === "supporting" ? 6 : 5;

    if (used.has(index) || normalized[group].length >= maxItems) {
      return false;
    }

    used.add(index);
    normalized[group].push(index);
    return true;
  };

  if (normalized.primary.length === 0) {
    for (const { index } of orderedIndexes) {
      if (add("primary", index)) {
        break;
      }
    }
  }

  if (normalized.supporting.length === 0) {
    for (const { index } of orderedIndexes) {
      if (add("supporting", index)) {
        break;
      }
    }
  }

  for (const { index, priority } of orderedIndexes) {
    if (used.has(index)) {
      continue;
    }

    if (priority <= 1 && add("primary", index)) {
      continue;
    }

    if (priority <= 3 && add("supporting", index)) {
      continue;
    }

    if (add("supplementary", index)) {
      continue;
    }

    if (add("supporting", index)) {
      continue;
    }

    add("primary", index);
  }

  return normalized;
}

const semanticContentBlockTypes = [
  "heading",
  "text",
  "list",
  "image",
  "table",
  "chart",
  "quote",
  "callout",
  "metric",
  "comparison",
  "timeline",
  "steps",
  "summary",
  "conclusion",
  "source"
] as const;

function isSemanticContentBlockType(
  value: string
): value is NonNullable<SlideContent["contentBlocks"][number]["type"]> {
  return (semanticContentBlockTypes as readonly string[]).includes(value);
}

function contentBlockText(block: SlideContent["contentBlocks"][number]) {
  return block.content ?? block.text;
}

function contentBlockTypeLabel(block: SlideContent["contentBlocks"][number]) {
  return block.type ?? semanticContentBlockTypeForLegacy(block.blockType);
}

function semanticContentBlockTypeForLegacy(
  blockType: SlideContent["contentBlocks"][number]["blockType"]
): NonNullable<SlideContent["contentBlocks"][number]["type"]> {
  const map: Record<
    SlideContent["contentBlocks"][number]["blockType"],
    NonNullable<SlideContent["contentBlocks"][number]["type"]>
  > = {
    body: "text",
    chart: "chart",
    comparison: "comparison",
    conclusion: "conclusion",
    metric: "metric",
    note: "source",
    quote: "quote",
    step: "steps",
    tag: "callout",
    title: "heading"
  };

  return map[blockType];
}

function legacyContentBlockTypeForSemanticType(
  type: NonNullable<SlideContent["contentBlocks"][number]["type"]>
): SlideContent["contentBlocks"][number]["blockType"] {
  const map: Record<
    NonNullable<SlideContent["contentBlocks"][number]["type"]>,
    SlideContent["contentBlocks"][number]["blockType"]
  > = {
    callout: "tag",
    chart: "chart",
    comparison: "comparison",
    conclusion: "conclusion",
    heading: "title",
    image: "note",
    list: "body",
    metric: "metric",
    quote: "quote",
    source: "note",
    steps: "step",
    summary: "conclusion",
    table: "chart",
    text: "body",
    timeline: "step"
  };

  return map[type];
}

function ObjectRuleTagEditor<
  T extends Record<string, string>,
  K extends readonly (Extract<keyof T, string>)[]
>({
  addPlaceholder,
  disabled = false,
  fields,
  label,
  labelForField,
  onChange,
  value
}: {
  addPlaceholder: string;
  disabled?: boolean;
  fields: K;
  label: string;
  labelForField: (field: K[number]) => string;
  onChange: (value: T) => void;
  value: T;
}) {
  const [selectedField, setSelectedField] = useState<K[number]>(fields[0]);
  const [draftValue, setDraftValue] = useState("");

  const commitDraft = () => {
    const nextValue = draftValue.trim();

    if (!nextValue) {
      setDraftValue("");
      return;
    }

    onChange({
      ...value,
      [selectedField]: nextValue
    });
    setDraftValue("");
  };

  const items = buildLabeledRuleTagItems(fields, labelForField, value);

  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="grid gap-2 rounded-lg border border-border bg-background p-3">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              className={cn(
                "inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium leading-5 text-foreground transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent-soft",
                disabled && "cursor-not-allowed opacity-70"
              )}
              disabled={disabled}
              key={item.key}
              onClick={() =>
                onChange({
                  ...value,
                  [item.key]: ""
                })
              }
              type="button"
            >
              <span>{item.text}</span>
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <select
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
            disabled={disabled}
            onChange={(event) => setSelectedField(event.target.value as K[number])}
            value={selectedField}
          >
            {fields.map((field) => (
              <option key={String(field)} value={String(field)}>
                {labelForField(field)}
              </option>
            ))}
          </select>
          <input
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
            disabled={disabled}
            onBlur={commitDraft}
            onChange={(event) => setDraftValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              event.preventDefault();
              commitDraft();
            }}
            placeholder={addPlaceholder}
            value={draftValue}
          />
        </div>
      </div>
    </label>
  );
}

function TransparencyRulesEditor({
  disabled = false,
  onChange,
  value
}: {
  disabled?: boolean;
  onChange: (value: UnifiedVisualSpec["transparencyRules"]) => void;
  value: UnifiedVisualSpec["transparencyRules"];
}) {
  const t = useTranslations("workbench");

  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">
        {t("outline.fields.transparencyRules")}
      </span>
      <textarea
        className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        disabled={disabled}
        onChange={(event) => onChange(parseTransparencyRuleLines(event.target.value, value))}
        value={value
          .map((rule) => `${rule.baseHex} | ${rule.opacity} | ${rule.usage}`)
          .join("\n")}
      />
    </label>
  );
}

function parseTransparencyRuleLines(
  value: string,
  fallback: UnifiedVisualSpec["transparencyRules"]
) {
  const parsed = parseLines(value).flatMap((line, index) => {
    const [hexPart, opacityPart, usagePart] = line
      .split("|")
      .map((item) => item.trim());
    const baseHex = normalizePaletteInputHex(hexPart);
    const fallbackItem = fallback[index] ?? fallback[0];
    const opacity = Number(opacityPart);

    if (!baseHex || !Number.isFinite(opacity)) {
      return [];
    }

    return [
      {
        baseHex,
        opacity: Math.min(0.95, Math.max(0.04, opacity)),
        usage: usagePart || fallbackItem.usage
      }
    ];
  });

  return parsed.length >= 2 ? parsed.slice(0, 8) : fallback;
}

function SelectField<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select
        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SlideAdvancedFieldsEditor({
  disabled = false,
  onChange,
  slide
}: {
  disabled?: boolean;
  onChange: (slide: SlideContent) => void;
  slide: SlideContent;
}) {
  const t = useTranslations("workbench");
  const update = (patch: Partial<SlideContent>) => onChange({ ...slide, ...patch });

  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        {t("outline.fields.advancedSlideInfo")}
      </summary>
      <div className="mt-4 grid gap-4">
        <EditableField
          disabled={disabled}
          label={t("outline.fields.coreStatement")}
          multiline
          onChange={(value) => update({ coreStatement: value })}
          value={slide.coreStatement}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            disabled={disabled}
            label={t("outline.fields.narrativeRole")}
            onChange={(value) => update({ narrativeRole: value })}
            options={([
              "setup",
              "argument",
              "turning-point",
              "climax",
              "summary",
              "call-to-action"
            ] as const).map((value) => ({
              label: t(`outline.values.narrativeRole.${value}`),
              value
            }))}
            value={slide.narrativeRole}
          />
          <SelectField
            disabled={disabled}
            label={t("outline.fields.explanationDepth")}
            onChange={(value) => update({ explanationDepth: value })}
            options={(["focus", "transition", "summary", "supporting"] as const).map((value) => ({
              label: t(`outline.values.explanationDepth.${value}`),
              value
            }))}
            value={slide.explanationDepth}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ContentLayerEditor
            disabled={disabled}
            group="primary"
            label={t("outline.fields.contentLayersPrimary")}
            onChange={onChange}
            slide={slide}
          />
          <ContentLayerEditor
            disabled={disabled}
            group="supporting"
            label={t("outline.fields.contentLayersSupporting")}
            onChange={onChange}
            slide={slide}
          />
          <ContentLayerEditor
            disabled={disabled}
            group="supplementary"
            label={t("outline.fields.contentLayersSupplementary")}
            onChange={onChange}
            slide={slide}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <EditableField
            disabled={disabled}
            label={t("outline.fields.transitionFromPrevious")}
            multiline
            onChange={(value) =>
              update({
                slideTransition: {
                  ...slide.slideTransition,
                  fromPrevious: value
                }
              })
            }
            value={slide.slideTransition.fromPrevious}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.transitionToNext")}
            multiline
            onChange={(value) =>
              update({
                slideTransition: {
                  ...slide.slideTransition,
                  toNext: value
                }
              })
            }
            value={slide.slideTransition.toNext}
          />
          <CheckboxField
            disabled={disabled}
            label={t("outline.fields.sourceRequired")}
            onChange={(value) =>
              update({
                sourceRequirement: {
                  ...slide.sourceRequirement,
                  required: value
                }
              })
            }
            value={slide.sourceRequirement.required}
          />
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.sourceCategories")}
            onChange={(value) =>
              update({
                sourceRequirement: {
                  ...slide.sourceRequirement,
                  categories: value as SlideContent["sourceRequirement"]["categories"]
                }
              })
            }
            value={slide.sourceRequirement.categories}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.sourceNote")}
            multiline
            onChange={(value) =>
              update({
                sourceRequirement: {
                  ...slide.sourceRequirement,
                  note: value
                }
              })
            }
            value={slide.sourceRequirement.note}
          />
          <SelectField
            disabled={disabled}
            label={t("outline.fields.audienceFocusLens")}
            onChange={(value) =>
              update({
                audienceFocus: {
                  ...slide.audienceFocus,
                  lens: value
                }
              })
            }
            options={([
              "business-conclusion",
              "teaching-understanding",
              "sales-value",
              "research-evidence",
              "general"
            ] as const).map((value) => ({
              label: t(`outline.values.audienceFocus.${value}`),
              value
            }))}
            value={slide.audienceFocus.lens}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.audienceFocus")}
            multiline
            onChange={(value) =>
              update({
                audienceFocus: {
                  ...slide.audienceFocus,
                  focus: value
                }
              })
            }
            value={slide.audienceFocus.focus}
          />
          <SelectField
            disabled={disabled}
            label={t("outline.fields.viewerObjectiveType")}
            onChange={(value) =>
              update({
                viewerObjective: {
                  ...slide.viewerObjective,
                  type: value
                }
              })
            }
            options={(["understand", "believe", "remember", "act"] as const).map((value) => ({
              label: t(`outline.values.viewerObjective.${value}`),
              value
            }))}
            value={slide.viewerObjective.type}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.viewerObjective")}
            multiline
            onChange={(value) =>
              update({
                viewerObjective: {
                  ...slide.viewerObjective,
                  description: value
                }
              })
            }
            value={slide.viewerObjective.description}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <EditableField
            disabled={disabled}
            label={t("outline.fields.splitWhen")}
            multiline
            onChange={(value) =>
              update({
                adaptationRules: {
                  ...slide.adaptationRules,
                  splitWhen: value
                }
              })
            }
            value={slide.adaptationRules.splitWhen}
          />
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.splitCandidates")}
            onChange={(value) =>
              update({
                adaptationRules: {
                  ...slide.adaptationRules,
                  splitCandidates: value
                }
              })
            }
            value={slide.adaptationRules.splitCandidates}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.mergeWhen")}
            multiline
            onChange={(value) =>
              update({
                adaptationRules: {
                  ...slide.adaptationRules,
                  mergeWhen: value
                }
              })
            }
            value={slide.adaptationRules.mergeWhen}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.mergeWith")}
            onChange={(value) =>
              update({
                adaptationRules: {
                  ...slide.adaptationRules,
                  mergeWith: value
                }
              })
            }
            value={slide.adaptationRules.mergeWith}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.inScope")}
            multiline
            onChange={(value) =>
              update({
                contentBoundary: {
                  ...slide.contentBoundary,
                  inScope: value
                }
              })
            }
            value={slide.contentBoundary.inScope}
          />
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.outOfScope")}
            onChange={(value) =>
              update({
                contentBoundary: {
                  ...slide.contentBoundary,
                  outOfScope: value
                }
              })
            }
            value={slide.contentBoundary.outOfScope}
          />
        </div>
      </div>
    </details>
  );
}

function VisualSpecEditor({
  disabled = false,
  onChange,
  visualSpec
}: {
  disabled?: boolean;
  onChange: (visualSpec: DeckOutlineDraft["unifiedVisualSpec"]) => void;
  visualSpec: DeckOutlineDraft["unifiedVisualSpec"];
}) {
  const t = useTranslations("workbench");

  return (
    <div className="grid gap-5">
      <VisualSpecSection title={t("outline.fields.basicInfo")}>
        <div className="grid gap-3 lg:grid-cols-2">
          <EditableField
            disabled={disabled}
            label={t("outline.fields.themeName")}
            onChange={(value) => onChange({ ...visualSpec, themeName: value })}
            value={visualSpec.themeName}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.visualStyle")}
            multiline
            onChange={(value) => onChange({ ...visualSpec, visualStyle: value })}
            value={visualSpec.visualStyle}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.designIntent")}
            multiline
            onChange={(value) => onChange({ ...visualSpec, designIntent: value })}
            value={visualSpec.designIntent}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.usageConvenience")}
            multiline
            onChange={(value) =>
              onChange({ ...visualSpec, usageConvenience: value })
            }
            value={visualSpec.usageConvenience}
          />
        </div>
      </VisualSpecSection>

      <PptTypeVisualToneEditor
        disabled={disabled}
        onChange={onChange}
        visualSpec={visualSpec}
      />

      <VisualSpecSection title={t("outline.fields.colorSystem")}>
        <ColorSystemPreview visualSpec={visualSpec} />
        <ColorPaletteEditor
          disabled={disabled}
          onChange={(value) =>
            onChange(sanitizeVisualSpecColorRoles({ ...visualSpec, colorPalette: value }))
          }
          value={visualSpec.colorPalette}
        />
        <div className="text-xs font-medium text-muted">
          {t("outline.fields.colorRoleTuning")}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              "background",
              "surface",
              "titleText",
              "bodyText",
              "accent",
              "highlight",
              "chart",
              "decorative",
              "borderDivider",
              "contrastRequirement"
            ] as const
          ).map((field) => (
            <div className="grid gap-2" key={field}>
              <EditableField
                disabled={disabled}
                label={t(`outline.fields.${field}`)}
                multiline={field === "contrastRequirement"}
                onChange={(value) =>
                  onChange(
                    updateVisualSpecColorRole(visualSpec, field, value)
                  )
                }
                value={visualSpec.colorRoles[field]}
              />
              <ColorRoleText
                palette={visualSpec.colorPalette}
                value={visualSpec.colorRoles[field]}
              />
            </div>
          ))}
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.layoutTypography")}>
        <div className="grid gap-3 md:grid-cols-2">
          <EditableField
            disabled={disabled}
            label={t("outline.fields.typography")}
            onChange={(value) => onChange({ ...visualSpec, typography: value })}
            value={visualSpec.typography}
          />
          <EditableField
            disabled={disabled}
            label={t("outline.fields.layoutInstruction")}
            multiline
            onChange={(value) =>
              onChange({
                ...visualSpec,
                pageSpec: {
                  ...visualSpec.pageSpec,
                  layoutInstruction: value
                }
              })
            }
            value={visualSpec.pageSpec.layoutInstruction}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <EditableField
            disabled
            label={t("outline.fields.aspectRatio")}
            onChange={() => undefined}
            value={visualSpec.pageSpec.aspectRatio}
          />
          <NumberField
            disabled
            label={t("outline.fields.width")}
            onChange={() => undefined}
            step={0.001}
            value={visualSpec.pageSpec.width}
          />
          <NumberField
            disabled
            label={t("outline.fields.height")}
            onChange={() => undefined}
            step={0.1}
            value={visualSpec.pageSpec.height}
          />
          <EditableField
            disabled
            label={t("outline.fields.unit")}
            onChange={() => undefined}
            value={visualSpec.pageSpec.unit}
          />
          <NumberField
            disabled
            label={t("outline.fields.safeMargin")}
            onChange={() => undefined}
            step={0.1}
            value={visualSpec.pageSpec.safeMargin}
          />
          <NumberField
            disabled
            label={t("outline.fields.gridColumns")}
            onChange={() => undefined}
            value={visualSpec.pageSpec.gridColumns}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <NumberField
            disabled={disabled}
            label={t("outline.fields.defaultFontSize")}
            max={40}
            min={8}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                typographyRules: {
                  ...visualSpec.typographyRules,
                  defaultFontSize: value
                }
              })
            }
            value={visualSpec.typographyRules.defaultFontSize}
          />
          <NumberField
            disabled={disabled}
            label={t("outline.fields.minFontSize")}
            max={deckPageCountMax}
            min={8}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                typographyRules: {
                  ...visualSpec.typographyRules,
                  minFontSize: value
                }
              })
            }
            value={visualSpec.typographyRules.minFontSize}
          />
          <NumberField
            disabled={disabled}
            label={t("outline.fields.maxLines")}
            max={9}
            min={1}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                typographyRules: {
                  ...visualSpec.typographyRules,
                  maxLines: value
                }
              })
            }
            value={visualSpec.typographyRules.maxLines}
          />
          <NumberField
            disabled={disabled}
            label={t("outline.fields.lineHeight")}
            max={1.8}
            min={1}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                typographyRules: {
                  ...visualSpec.typographyRules,
                  lineHeight: value
                }
              })
            }
            step={0.05}
            value={visualSpec.typographyRules.lineHeight}
          />
        </div>
        <ListEditor
          disabled={disabled}
          label={t("outline.fields.fontFallback")}
          onChange={(value) =>
            onChange({
              ...visualSpec,
              typographyRules: {
                ...visualSpec.typographyRules,
                fontFallback: value
              }
            })
          }
          value={visualSpec.typographyRules.fontFallback}
        />
        <div className="grid gap-3">
          {(["coverTitle", "coverSubtitle", "pageTitle", "sectionTitle", "body", "annotation", "chartLabel", "iconLabel"] as const).map((field) => (
            <div
              className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[1fr_1fr_1fr_2fr]"
              key={field}
            >
              <NumberField
                disabled={disabled}
                label={`${t(`outline.fields.${field}`)} · ${t("outline.fields.fontSize")}`}
                max={60}
                min={6}
                onChange={(value) =>
                  updateTypographyScale(field, { fontSize: value })
                }
                value={visualSpec.typographyRules.scale[field].fontSize}
              />
              <SelectField
                disabled={disabled}
                label={t("outline.fields.fontWeight")}
                onChange={(value) =>
                  updateTypographyScale(field, { fontWeight: value })
                }
                options={(["regular", "medium", "semibold", "bold"] as const).map((value) => ({
                  label: t(`outline.values.fontWeight.${value}`),
                  value
                }))}
                value={visualSpec.typographyRules.scale[field].fontWeight}
              />
              <NumberField
                disabled={disabled}
                label={t("outline.fields.lineHeight")}
                max={1.8}
                min={1}
                onChange={(value) =>
                  updateTypographyScale(field, { lineHeight: value })
                }
                step={0.05}
                value={visualSpec.typographyRules.scale[field].lineHeight}
              />
              <EditableField
                disabled={disabled}
                label={t("outline.fields.usage")}
                onChange={(value) =>
                  updateTypographyScale(field, { usage: value })
                }
                value={visualSpec.typographyRules.scale[field].usage}
              />
            </div>
          ))}
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.imageRules")}>
        <RuleTagGroupEditor
          addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
          disabled={disabled}
          items={[
            createRuleTagItem("image-style", `${t("outline.fields.imageStyle")}: ${visualSpec.imageStyle}`)
          ]}
          label={t("outline.fields.imageRules")}
          onAdd={(value) => onChange({ ...visualSpec, imageStyle: value })}
          onRemove={() => onChange({ ...visualSpec, imageStyle: "" })}
        />
        <div className="grid gap-2 md:grid-cols-2">
          <SelectField
            disabled={disabled}
            label={t("outline.fields.imageType")}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                imageRules: {
                  ...visualSpec.imageRules,
                  imageType: value
                }
              })
            }
            options={(["photo", "illustration", "icon", "diagram", "texture", "background", "cutout"] as const).map((value) => ({
              label: value,
              value
            }))}
            value={visualSpec.imageRules.imageType}
          />
          <SelectField
            disabled={disabled}
            label={t("outline.fields.aspectRatio")}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                imageRules: {
                  ...visualSpec.imageRules,
                  aspectRatio: value
                }
              })
            }
            options={(["16:9", "4:3", "1:1", "3:4", "9:16"] as const).map((value) => ({
              label: value,
              value
            }))}
            value={visualSpec.imageRules.aspectRatio}
          />
          <CheckboxField
            disabled={disabled}
            label={t("outline.fields.backgroundAvoidsHighContrastTextArea")}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                imageRules: {
                  ...visualSpec.imageRules,
                  backgroundAvoidsHighContrastTextArea: value
                }
              })
            }
            value={visualSpec.imageRules.backgroundAvoidsHighContrastTextArea}
          />
          <CheckboxField
            disabled={disabled}
            label={t("outline.fields.subjectAvoidsTitleArea")}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                imageRules: {
                  ...visualSpec.imageRules,
                  subjectAvoidsTitleArea: value
                }
              })
            }
            value={visualSpec.imageRules.subjectAvoidsTitleArea}
          />
        </div>
        <EditableField
          disabled={disabled}
          label={t("outline.fields.imagePromptStyle")}
          multiline
          onChange={(value) =>
            onChange({
              ...visualSpec,
              imageRules: {
                ...visualSpec.imageRules,
                imagePromptStyle: value
              }
            })
          }
          value={visualSpec.imageRules.imagePromptStyle}
        />
        <ListEditor
          disabled={disabled}
          label={t("outline.fields.forbiddenItems")}
          onChange={(value) =>
            onChange({
              ...visualSpec,
              imageRules: {
                ...visualSpec.imageRules,
                forbiddenItems: value
              }
            })
          }
          value={visualSpec.imageRules.forbiddenItems}
        />
        <RuleTagGroupEditor
          addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
          disabled={disabled}
          items={visualSpec.imageRules.usageNotes.map((item, index) =>
            createRuleTagItem(`usage-note-${index}`, item)
          )}
          label={t("outline.fields.usageNotes")}
          onAdd={(value) =>
            onChange({
              ...visualSpec,
              imageRules: {
                ...visualSpec.imageRules,
                usageNotes: dedupeVisualRuleTexts([
                  ...visualSpec.imageRules.usageNotes,
                  value
                ])
              }
            })
          }
          onRemove={(key) =>
            onChange({
              ...visualSpec,
              imageRules: {
                ...visualSpec.imageRules,
                usageNotes: visualSpec.imageRules.usageNotes.filter(
                  (_, index) => `usage-note-${index}` !== key
                )
              }
            })
          }
        />
        <ObjectRuleTagEditor
          addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
          disabled={disabled}
          fields={imageIllustrationRuleFields}
          label={t("outline.fields.imageIllustrationRules")}
          labelForField={(field) => t(`outline.fields.${field}`)}
          onChange={(value) =>
            onChange({
              ...visualSpec,
              imageIllustrationRules: value
            })
          }
          value={visualSpec.imageIllustrationRules}
        />
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.rulesList")}>
        <div className="grid gap-3">
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.consistencyRules")}
            onChange={(value) =>
              onChange({ ...visualSpec, consistencyRules: value })
            }
            value={visualSpec.consistencyRules}
          />
        </div>
      </VisualSpecSection>

      <AdvancedVisualSpecEditor
        disabled={disabled}
        onChange={onChange}
        visualSpec={visualSpec}
      />
    </div>
  );

  function updateTypographyScale(
    field: keyof UnifiedVisualSpec["typographyRules"]["scale"],
    patch: Partial<UnifiedVisualSpec["typographyRules"]["scale"]["body"]>
  ) {
    onChange({
      ...visualSpec,
      typographyRules: {
        ...visualSpec.typographyRules,
        scale: {
          ...visualSpec.typographyRules.scale,
          [field]: {
            ...visualSpec.typographyRules.scale[field],
            ...patch
          }
        }
      }
    });
  }
}

function AdvancedVisualSpecEditor({
  disabled = false,
  onChange,
  visualSpec
}: {
  disabled?: boolean;
  onChange: (visualSpec: DeckOutlineDraft["unifiedVisualSpec"]) => void;
  visualSpec: DeckOutlineDraft["unifiedVisualSpec"];
}) {
  const t = useTranslations("workbench");

  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        {t("outline.fields.advancedVisualSpec")}
      </summary>
      <div className="mt-4 grid gap-4">
        <VisualSpecSection title={t("outline.fields.advancedRules")}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-3">
              <SelectField
                disabled={disabled}
                label={t("outline.fields.defaultLevel")}
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    informationDensityRules: {
                      ...visualSpec.informationDensityRules,
                      defaultLevel: value
                    }
                  })
                }
                options={(["low", "medium", "high"] as const).map((value) => ({
                  label: t(`outline.values.density.${value}`),
                  value
                }))}
                value={visualSpec.informationDensityRules.defaultLevel}
              />
              <ObjectRuleTagEditor
                addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
                disabled={disabled}
                fields={["businessReport", "trainingCourse", "brandMarketing", "researchReport"] as const}
                label={t("outline.fields.informationDensityRules")}
                labelForField={(field) => t(`outline.fields.${field}`)}
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    informationDensityRules: {
                      ...visualSpec.informationDensityRules,
                      ...value
                    }
                  })
                }
                value={visualSpec.informationDensityRules}
              />
            </div>
            <ObjectRuleTagEditor
              addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
              disabled={disabled}
              fields={["pageMargin", "sectionGap", "elementGap", "whitespace"] as const}
              label={t("outline.fields.layoutRules")}
              labelForField={(field) => t(`outline.fields.${field}`)}
              onChange={(value) =>
                onChange({
                  ...visualSpec,
                  layoutRules: value
                })
              }
              value={visualSpec.layoutRules}
            />
            <ObjectRuleTagEditor
              addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
              disabled={disabled}
              fields={["chartTypes", "axisAndGrid", "labelRules", "colorUsage", "sourceNotes"] as const}
              label={t("outline.fields.chartVisualRules")}
              labelForField={(field) => t(`outline.fields.${field}`)}
              onChange={(value) =>
                onChange({
                  ...visualSpec,
                  chartVisualRules: value
                })
              }
              value={visualSpec.chartVisualRules}
            />
            <div className="grid gap-3">
              <SelectField
                disabled={disabled}
                label={t("outline.fields.iconStyle")}
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    iconStyleRules: {
                      ...visualSpec.iconStyleRules,
                      style: value
                    }
                  })
                }
                options={(["line", "filled", "duotone", "monochrome"] as const).map((value) => ({
                  label: t(`outline.values.iconStyle.${value}`),
                  value
                }))}
                value={visualSpec.iconStyleRules.style}
              />
              <ObjectRuleTagEditor
                addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
                disabled={disabled}
                fields={["stroke", "usage", "consistency"] as const}
                label={t("outline.fields.iconStyleRules")}
                labelForField={(field) => t(`outline.fields.${field}`)}
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    iconStyleRules: {
                      ...visualSpec.iconStyleRules,
                      ...value
                    }
                  })
                }
                value={visualSpec.iconStyleRules}
              />
            </div>
            <ObjectRuleTagEditor
              addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
              disabled={disabled}
              fields={["highlight", "keyNumbers", "keywords", "conclusion"] as const}
              label={t("outline.fields.emphasisRules")}
              labelForField={(field) => t(`outline.fields.${field}`)}
              onChange={(value) =>
                onChange({
                  ...visualSpec,
                  emphasisRules: value
                })
              }
              value={visualSpec.emphasisRules}
            />
            <ObjectRuleTagEditor
              addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
              disabled={disabled}
              fields={["card", "tag", "metric", "table", "chart", "icon"] as const}
              label={t("outline.fields.componentRules")}
              labelForField={(field) => t(`outline.fields.${field}`)}
              onChange={(value) =>
                onChange({
                  ...visualSpec,
                  componentRules: value
                })
              }
              value={visualSpec.componentRules}
            />
            <TransparencyRulesEditor
              disabled={disabled}
              onChange={(value) =>
                onChange({
                  ...visualSpec,
                  transparencyRules: value
                })
              }
              value={visualSpec.transparencyRules}
            />
          </div>
          <RuleTagGroupEditor
            addPlaceholder={t("outline.ruleTagEditor.addPlaceholder")}
            disabled={disabled}
            items={buildMergedForbiddenRules(visualSpec).map((item, index) =>
              createRuleTagItem(`forbidden-${index}`, item)
            )}
            label={t("outline.fields.forbiddenVisualRules")}
            onAdd={(value) =>
              onChange({
                ...visualSpec,
                ...buildForbiddenRulePatch([
                  ...buildMergedForbiddenRules(visualSpec),
                  value
                ])
              })
            }
            onRemove={(key) => {
              const mergedRules = buildMergedForbiddenRules(visualSpec).filter(
                (_, index) => `forbidden-${index}` !== key
              );

              onChange({
                ...visualSpec,
                ...buildForbiddenRulePatch(mergedRules)
              });
            }}
          />
        </VisualSpecSection>
      </div>
    </details>
  );

}

function SlideCanvasPreview({
  compact = false,
  motionEnabled,
  slide,
  unifiedVisualSpec
}: {
  compact?: boolean;
  motionEnabled: boolean;
  slide: GeneratedSlideResult;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  const visualColors = resolveSlideVisualColors(unifiedVisualSpec);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border border-border",
        compact ? "min-h-24" : "min-h-[320px]"
      )}
      data-slide-visual-background={visualColors.background}
      style={{ backgroundColor: visualColors.background }}
    >
      {slide.elements.map((element) => {
        const layer = slide.generatedImageLayers.find(
          (item) => item.requestId === element.imageRequestId
        );
        const motion = slide.motionPlan.elements.find(
          (item) => item.elementId === element.id
        );
        const motionStyle = motionEnabled && motion ? getMotionStyle(motion) : {};

        return (
          <div
            key={element.id}
            className={cn(
              "absolute overflow-hidden",
              renderableElementClassName(element),
              compact && element.type !== "text" && "text-[7px] leading-3",
              motionEnabled && motion && `ppt-motion ppt-motion-${motion.preset}`
            )}
            style={{
              left: `${toCanvasPercent(element.bounds.x, "x")}%`,
              top: `${toCanvasPercent(element.bounds.y, "y")}%`,
              width: `${toCanvasPercent(element.bounds.width, "x")}%`,
              height: `${toCanvasPercent(element.bounds.height, "y")}%`,
              zIndex: element.zIndex,
              ...renderableElementStyle(element, visualColors),
              ...motionStyle
            }}
            title={element.role}
          >
            {renderRenderableElementContent(element, layer, visualColors)}
          </div>
        );
      })}
    </div>
  );
}

function EditableSlideCanvas({
  disabled = false,
  motionEnabled,
  onChange,
  onSelectElement,
  selectedElementId,
  slide,
  unifiedVisualSpec
}: {
  disabled?: boolean;
  motionEnabled: boolean;
  onChange: (slide: GeneratedSlideResult) => void;
  onSelectElement: (id: string) => void;
  selectedElementId: string | null;
  slide: GeneratedSlideResult;
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  const visualColors = resolveSlideVisualColors(unifiedVisualSpec);
  const [dragState, setDragState] = useState<{
    elementId: string;
    mode: "move" | "resize";
    startBounds: SlideElement["bounds"];
    startX: number;
    startY: number;
  } | null>(null);

  return (
    <div
      className="relative mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-lg border border-border shadow-lg"
      data-slide-visual-background={visualColors.background}
      onPointerMove={(event) => {
        if (!dragState) {
          return;
        }

        const canvas = event.currentTarget.getBoundingClientRect();
        const dx = ((event.clientX - dragState.startX) / canvas.width) * 13.333;
        const dy = ((event.clientY - dragState.startY) / canvas.height) * 7.5;

        updateElementBounds(dragState.elementId, (bounds) => {
          if (dragState.mode === "resize") {
            return clampBounds({
              ...bounds,
              width: dragState.startBounds.width + dx,
              height: dragState.startBounds.height + dy
            });
          }

          return clampBounds({
            ...bounds,
            x: dragState.startBounds.x + dx,
            y: dragState.startBounds.y + dy
          });
        });
      }}
      onPointerUp={() => setDragState(null)}
      style={{ backgroundColor: visualColors.background }}
    >
      {slide.elements.map((element) => {
        const layer = slide.generatedImageLayers.find(
          (item) => item.requestId === element.imageRequestId
        );
        const motion = slide.motionPlan.elements.find(
          (item) => item.elementId === element.id
        );
        const motionStyle = motionEnabled && motion ? getMotionStyle(motion) : {};
        const selected = selectedElementId === element.id;

        return (
          <button
            aria-pressed={selected}
            className={cn(
              "absolute overflow-hidden transition",
              renderableElementClassName(element),
              selected &&
                "border-accent shadow-lg outline outline-2 outline-offset-2 outline-accent ring-4 ring-accent-soft",
              motionEnabled && motion && `ppt-motion ppt-motion-${motion.preset}`
            )}
            data-selected={selected ? "true" : undefined}
            data-testid={`slide-canvas-element-${element.id}`}
            key={element.id}
            onPointerDown={(event) => {
              if (disabled) {
                return;
              }

              event.currentTarget.setPointerCapture(event.pointerId);
              onSelectElement(element.id);
              setDragState({
                elementId: element.id,
                mode: event.altKey ? "resize" : "move",
                startBounds: element.bounds,
                startX: event.clientX,
                startY: event.clientY
              });
            }}
            style={{
              left: `${toCanvasPercent(element.bounds.x, "x")}%`,
              top: `${toCanvasPercent(element.bounds.y, "y")}%`,
              width: `${toCanvasPercent(element.bounds.width, "x")}%`,
              height: `${toCanvasPercent(element.bounds.height, "y")}%`,
              zIndex: element.zIndex,
              ...renderableElementStyle(element, visualColors),
              ...motionStyle
            }}
            title={`${element.role} · Alt 拖拽缩放`}
            type="button"
          >
            {renderRenderableElementContent(element, layer, visualColors)}
            {selected ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-accent bg-accent/10"
                data-testid={`slide-canvas-element-highlight-${element.id}`}
              />
            ) : null}
            {selected ? (
              <span className="absolute bottom-1 right-1 z-10 rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                Alt 缩放
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  function updateElementBounds(
    elementId: string,
    update: (bounds: SlideElement["bounds"]) => SlideElement["bounds"]
  ) {
    onChange({
      ...slide,
      elements: slide.elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              bounds: update(element.bounds)
            }
          : element
      )
    });
  }
}

function renderRenderableElementContent(
  element: SlideElement,
  layer: GeneratedSlideResult["generatedImageLayers"][number] | undefined,
  visualColors: SlideVisualColors
) {
  if (element.type === "generatedImage") {
    if (layer) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={element.role} className="size-full object-cover" src={layer.url} />
      );
    }

    return null;
  }

  if (element.type === "text") {
    return element.content;
  }

  if (element.type === "chartPlaceholder") {
    return (
      <span className="flex size-full items-end justify-center gap-[6%] px-[8%] pb-[9%]">
        {[44, 68, 52, 82].map((height, index) => (
          <span
            aria-hidden="true"
            className="block flex-1 rounded-t-sm"
            key={height}
            style={{
              backgroundColor: getChartSeriesColor(visualColors, index),
              height: `${height}%`
            }}
          />
        ))}
      </span>
    );
  }

  return null;
}

function getChartSeriesColor(visualColors: SlideVisualColors, index: number) {
  const series =
    visualColors.chartSeries.length > 0
      ? visualColors.chartSeries
      : [visualColors.chart, visualColors.highlight];

  return series[index % series.length] ?? visualColors.chart;
}

function renderableElementClassName(element: SlideElement) {
  if (element.type === "text") {
    return "flex items-center whitespace-pre-line px-1";
  }

  if (element.type === "chartPlaceholder") {
    return "rounded-md border border-accent/20 bg-accent-soft/45";
  }

  if (element.type === "icon") {
    return "rounded-md bg-signal/15";
  }

  return "rounded-md";
}

function renderableElementStyle(
  element: SlideElement,
  visualColors: SlideVisualColors
): CSSProperties {
  if (element.type === "text") {
    return {
      ...elementTextStyle(element, visualColors),
      justifyContent: toFlexJustify(element.textStyle?.align ?? "left"),
      textAlign: element.textStyle?.align ?? "left"
    };
  }

  if (element.type === "shape") {
    const isLine = isLineLikeCanvasShape(element);

    return {
      backgroundColor: isLine ? visualColors.accent : visualColors.surface,
      opacity: isLine ? 0.8 : 0.62
    };
  }

  if (element.type === "chartPlaceholder") {
    return {
      backgroundColor: canvasColorAlpha(visualColors.surface, 0.45),
      borderColor: canvasColorAlpha(visualColors.chart, 0.2)
    };
  }

  if (element.type === "icon") {
    return {
      backgroundColor: canvasColorAlpha(visualColors.decorative, 0.15),
      color: visualColors.decorative
    };
  }

  return {};
}

function isLineLikeCanvasShape(element: SlideElement) {
  return (
    element.bounds.height <= 0.18 ||
    element.bounds.width <= 0.18 ||
    /line|underline|emphasis|强调线|分隔线|线/i.test(
      `${element.id} ${element.role} ${element.styleNotes}`
    )
  );
}

function elementTextStyle(
  element: SlideElement,
  visualColors: SlideVisualColors
): CSSProperties {
  const textStyle = element.textStyle;

  if (!textStyle) {
    return {
      color: defaultCanvasTextColor(element, visualColors),
      fontSize: element.semanticType === "title" ? "28px" : "14px",
      fontWeight: element.semanticType === "title" ? 700 : 400,
      lineHeight: 1.25,
      whiteSpace: "pre-line"
    };
  }

  return {
    color: textStyle.color ?? defaultCanvasTextColor(element, visualColors),
    fontSize: `${textStyle.fontSize}px`,
    fontWeight: toCssFontWeight(textStyle.fontWeight),
    lineHeight: textStyle.lineHeight,
    textAlign: textStyle.align,
    whiteSpace: "pre-line"
  };
}

function defaultCanvasTextColor(
  element: SlideElement,
  visualColors: SlideVisualColors
) {
  if (element.semanticType === "title") {
    return visualColors.titleText;
  }

  if (element.semanticType === "footer") {
    return visualColors.mutedText;
  }

  if (element.semanticType === "badge") {
    return visualColors.accent;
  }

  return visualColors.bodyText;
}

function canvasColorAlpha(color: string, alpha: number) {
  const match = color.match(/^#([0-9A-F]{6})$/i);

  if (!match) {
    return color;
  }

  const value = match[1];
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function toCssFontWeight(
  weight: NonNullable<SlideElement["textStyle"]>["fontWeight"]
) {
  if (weight === "bold") {
    return 700;
  }

  if (weight === "semibold") {
    return 600;
  }

  if (weight === "medium") {
    return 500;
  }

  return 400;
}

function toFlexJustify(align: "left" | "center" | "right") {
  if (align === "center") {
    return "center";
  }

  if (align === "right") {
    return "flex-end";
  }

  return "flex-start";
}

function SlideEditingPanel({
  disabled = false,
  onSelectElement,
  onRegenerate,
  onSlideChange,
  selectedElementId,
  selectedSlide
}: {
  disabled?: boolean;
  onSelectElement: (elementId: string) => void;
  onRegenerate: () => void;
  onSlideChange: (slide: GeneratedSlideResult) => void;
  selectedElementId: string | null;
  selectedSlide: GeneratedSlideResult;
}) {
  return (
    <SlideDisplayContentPanel
      disabled={disabled}
      onContentChange={updateContent}
      onRegenerate={onRegenerate}
      onSelectElement={onSelectElement}
      selectedElementId={selectedElementId}
      slide={selectedSlide}
    />
  );

  function updateContent(patch: Partial<GeneratedSlideResult["content"]>) {
    const content = {
      ...selectedSlide.content,
      ...patch
    };
    const shouldSyncTitle = Object.prototype.hasOwnProperty.call(patch, "title");
    const shouldSyncSubtitle = Object.prototype.hasOwnProperty.call(
      patch,
      "subtitle"
    );
    const shouldSyncBodyPoints = Object.prototype.hasOwnProperty.call(
      patch,
      "bodyPoints"
    );
    const bodyTextElements = selectedSlide.elements.filter(
      (element) =>
        element.type === "text" &&
        (element.semanticType === "body" || element.semanticType === "card")
    );

    onSlideChange({
      ...selectedSlide,
      content,
      elements: selectedSlide.elements.map((element) => {
        if (shouldSyncTitle && element.semanticType === "title") {
          return {
            ...element,
            content: content.title
          };
        }

        if (shouldSyncSubtitle && element.semanticType === "subtitle") {
          return {
            ...element,
            content: content.subtitle ?? ""
          };
        }

        if (
          shouldSyncBodyPoints &&
          element.type === "text" &&
          (element.semanticType === "body" || element.semanticType === "card")
        ) {
          const bodyElementIndex = bodyTextElements.findIndex(
            (item) => item.id === element.id
          );
          const nextContent =
            bodyTextElements.length === 1
              ? content.bodyPoints.join("\n")
              : content.bodyPoints[bodyElementIndex];

          return {
            ...element,
            content: nextContent ?? element.content
          };
        }

        return element;
      })
    });
  }

}

function SlideSelectedElementEditor({
  deck,
  disabled = false,
  onDeleteElement,
  onElementChange,
  onSlideChange,
  selectedElement,
  selectedSlide
}: {
  deck: GeneratedDeckResult;
  disabled?: boolean;
  onDeleteElement: (elementId: string) => void;
  onElementChange: (elementId: string, patch: Partial<SlideElement>) => void;
  onSlideChange: (slide: GeneratedSlideResult) => void;
  selectedElement?: SlideElement;
  selectedSlide: GeneratedSlideResult;
}) {
  const t = useTranslations("workbench");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isFileElement = selectedElement
    ? isSlideFileElement(selectedElement)
    : false;

  return (
    <section
      className={cn(
        "grid min-w-0 content-start gap-3 rounded-lg border bg-background p-3 transition",
        selectedElement
          ? "border-accent bg-accent-soft/45 shadow-sm ring-2 ring-accent/25"
          : "border-border"
      )}
      data-selected={selectedElement ? "true" : undefined}
      data-testid="slide-selected-element-editor"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
        {t("selectedElement.title")}
      </div>
      {selectedElement ? (
        isFileElement ? (
          <div className="grid gap-3">
            <div className="rounded-lg border border-border bg-surface px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <ElementIcon type={selectedElement.type} />
                <span className="truncate">{selectedElement.role}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">
                {t(`elementTypes.${selectedElement.type}`)}
              </p>
            </div>
            <input
              accept="image/*"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void replaceElementFile(selectedElement, file);
                }

                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                type="button"
                variant="secondary"
              >
                <Upload className="size-4" aria-hidden="true" />
                {t("actions.uploadNewFile")}
              </Button>
              <Button
                disabled={disabled}
                onClick={() => onDeleteElement(selectedElement.id)}
                type="button"
                variant="destructive"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t("actions.delete")}
              </Button>
            </div>
            <BoundsEditor
              disabled={disabled}
              onChange={(bounds) =>
                onElementChange(selectedElement.id, { bounds })
              }
              value={selectedElement.bounds}
            />
          </div>
        ) : (
          <>
            <EditableField
              label={t("selectedElement.content")}
              multiline
              onChange={(value) =>
                onElementChange(selectedElement.id, { content: value })
              }
              value={selectedElement.content ?? ""}
            />
            <BoundsEditor
              disabled={disabled}
              onChange={(bounds) =>
                onElementChange(selectedElement.id, { bounds })
              }
              value={selectedElement.bounds}
            />
          </>
        )
      ) : (
        <p className="text-sm text-muted">{t("selectedElement.empty")}</p>
      )}
    </section>
  );

  async function replaceElementFile(element: SlideElement, file: File) {
    const formData = new FormData();

    formData.set("file", file);

    const response = await fetch(
      `/api/decks/${deck.id}/slides/${selectedSlide.slideId}/elements/${element.id}/file`,
      {
        body: formData,
        method: "POST"
      }
    );
    const payload = (await response.json()) as {
      layer?: GeneratedDeckResult["slides"][number]["generatedImageLayers"][number];
    };

    if (!response.ok || !payload.layer) {
      return;
    }

    const nextElement = {
      ...element,
      imageRequestId: payload.layer.requestId,
      type: "generatedImage" as const
    };

    onSlideChange({
      ...selectedSlide,
      elements: selectedSlide.elements.map((item) =>
        item.id === element.id ? nextElement : item
      ),
      generatedImageLayers: [
        ...selectedSlide.generatedImageLayers.filter(
          (layer) => layer.requestId !== payload.layer?.requestId
        ),
        payload.layer
      ]
    });
  }
}

function formatOutlineSectionIndex(index: number) {
  return `${index}.`;
}

function toCanvasPercent(value: number, axis: "x" | "y") {
  const max = axis === "x" ? 13.333 : 7.5;

  return (value / max) * 100;
}

function clampBounds(bounds: SlideElement["bounds"]) {
  const width = clamp(bounds.width, 0.05, 13.333);
  const height = clamp(bounds.height, 0.05, 7.5);
  const x = clamp(bounds.x, 0, 13.333 - width);
  const y = clamp(bounds.y, 0, 7.5 - height);

  return {
    x: roundCanvasValue(x),
    y: roundCanvasValue(y),
    width: roundCanvasValue(width),
    height: roundCanvasValue(height)
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function roundCanvasValue(value: number) {
  return Math.round(value * 100) / 100;
}

function SlideDisplayContentPanel({
  disabled = false,
  onContentChange,
  onSelectElement,
  onRegenerate,
  selectedElementId,
  slide
}: {
  disabled?: boolean;
  onContentChange: (patch: Partial<GeneratedSlideResult["content"]>) => void;
  onSelectElement: (elementId: string) => void;
  onRegenerate: () => void;
  selectedElementId: string | null;
  slide: GeneratedSlideResult;
}) {
  const t = useTranslations("workbench");
  const [isEditing, setIsEditing] = useState(false);
  const selectedDisplayItemRef = useRef<HTMLButtonElement | null>(null);
  const separator = t("preview.displayContentSeparator");
  const selectedElement = slide.elements.find(
    (element) => element.id === selectedElementId
  );
  const contentBlockBindings = resolveSlideContentBlockBindings(slide);
  const selectedContentBlockIndex =
    selectedElementId && selectedElement
      ? contentBlockBindings.contentBlockIndexByElementId.get(selectedElementId) ?? null
      : null;
  type DisplayContentItem = {
    disabled: boolean;
    elementId?: string;
    elementType?: SlideElement["type"];
    key: string;
    kind: "contentBlock" | "layer";
    label: string;
    layer?: number;
    priority?: number;
    selected: boolean;
    testId: string;
    text: string;
  };
  const contentBlockItems: DisplayContentItem[] = slide.content.contentBlocks.map(
    (block, index) => {
      const elementId = contentBlockBindings.elementIdByContentBlockIndex.get(index);
      const element = slide.elements.find((item) => item.id === elementId);

      return {
        disabled: !elementId,
        elementId,
        elementType: element?.type,
        key: `block-${index}`,
        kind: "contentBlock",
        label: contentBlockTypeLabel(block),
        layer: element?.zIndex,
        priority: block.priority,
        selected: selectedContentBlockIndex === index,
        testId: `slide-display-content-item-${index}`,
        text: contentBlockText(block)
      };
    }
  );
  const boundElementIds = new Set(
    contentBlockBindings.contentBlockIndexByElementId.keys()
  );
  const layerItems: DisplayContentItem[] = slide.elements
    .filter((element) => !boundElementIds.has(element.id))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((element) => ({
      disabled: false,
      elementId: element.id,
      elementType: element.type,
      key: `layer-${element.id}`,
      kind: "layer",
      label: t("preview.layerItem"),
      layer: element.zIndex,
      selected: selectedElementId === element.id,
      testId: `slide-display-layer-item-${element.id}`,
      text: element.content?.trim() || element.role || t("preview.emptyLayerContent")
    }));
  const displayItems = [...contentBlockItems, ...layerItems];

  useEffect(() => {
    selectedDisplayItemRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [selectedContentBlockIndex, selectedElementId]);

  return (
    <section
      className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 rounded-lg border border-border bg-background p-3"
      data-testid="slide-display-content-panel"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h4 className="min-w-0 text-sm font-semibold text-foreground">
          {t("preview.displayContent")}
        </h4>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            disabled={disabled}
            onClick={onRegenerate}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.regenerateCurrentSlide")}
          </Button>
          <Button
            disabled={disabled}
            onClick={() => setIsEditing((value) => !value)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {isEditing ? t("actions.done") : t("actions.editBodyPoints")}
          </Button>
        </div>
      </div>
      {isEditing ? (
        <div
          className="grid min-h-0 min-w-0 gap-3 overflow-y-auto rounded-md border border-border bg-surface p-3"
          data-testid="slide-display-content-editor"
        >
          <ListEditor
            disabled={disabled}
            label={t("preview.displayContentTypes.body")}
            onChange={(value) =>
              onContentChange({
                bodyPoints: value
              })
            }
            value={slide.content.bodyPoints}
          />
        </div>
      ) : (
        <div
          className="grid min-h-0 min-w-0 content-start gap-2 overflow-y-auto rounded-md border border-border bg-surface p-3"
          data-testid="slide-display-content-list"
        >
          {displayItems.map((item) => (
            <button
              aria-pressed={item.selected}
              className={cn(
                "min-w-0 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-accent disabled:cursor-default disabled:hover:border-border",
                item.selected &&
                  "border-accent bg-accent-soft ring-1 ring-accent/30"
              )}
              data-selected={item.selected ? "true" : undefined}
              data-testid={item.testId}
              disabled={item.disabled}
              key={item.key}
              onClick={() => {
                if (item.elementId) {
                  onSelectElement(item.elementId);
                }
              }}
              ref={item.selected ? selectedDisplayItemRef : undefined}
              type="button"
            >
              <div className="grid min-w-0 gap-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  {item.elementType ? (
                    <span
                      aria-label={t(`elementTypes.${item.elementType}`)}
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-accent-soft"
                      title={t(`elementTypes.${item.elementType}`)}
                    >
                      <ElementIcon type={item.elementType} />
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-muted">
                      {t("preview.notPlaced")}
                    </span>
                  )}
                  <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-muted">
                    {item.kind === "contentBlock"
                      ? t("preview.contentBlockItem")
                      : t(`elementTypes.${item.elementType}`)}
                  </span>
                  {item.layer !== undefined ? (
                    <span className="shrink-0 text-xs leading-5 text-muted">
                      {t("elements.layer", { zIndex: item.layer })}
                    </span>
                  ) : null}
                  {item.priority !== undefined ? (
                    <span className="ml-auto shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-strong">
                      P{item.priority}
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 items-start gap-2">
                  <span className="shrink-0 text-[13px] font-semibold leading-5 text-foreground">
                    {item.label}
                    {separator}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-muted">
                    {item.text}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SlideMetaPanel({
  selectedElementId,
  slide
}: {
  selectedElementId: string | null;
  slide: GeneratedSlideResult;
}) {
  const t = useTranslations("workbench");
  const selectedImageLayerRef = useRef<HTMLDivElement | null>(null);
  const selectedElement = slide.elements.find(
    (element) => element.id === selectedElementId
  );
  const selectedImageRequestId = selectedElement?.imageRequestId ?? null;
  const imageLayerItems = [
    ...slide.imageLayerRequests.map((request) => ({
      id: request.id,
      requestId: request.id,
      title:
        slide.generatedImageLayers.find((layer) => layer.requestId === request.id)
          ?.provider ?? request.purpose,
      visualNotes: request.visualNotes
    })),
    ...slide.generatedImageLayers
      .filter(
        (layer) =>
          !slide.imageLayerRequests.some((request) => request.id === layer.requestId)
      )
      .map((layer) => ({
        id: layer.id,
        requestId: layer.requestId,
        title: layer.provider,
        visualNotes: layer.visualNotes
      }))
  ];

  useEffect(() => {
    selectedImageLayerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [selectedElementId, selectedImageRequestId]);

  return (
    <section className="rounded-lg border border-border bg-background p-2.5">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ImageIcon className="size-4 text-accent" aria-hidden="true" />
          {t("imageLayers.title")}
        </div>
        {imageLayerItems.length > 0 ? (
          <div className="grid max-h-48 gap-1.5 overflow-y-auto pr-1">
            {imageLayerItems.map((item) => {
              const selected = selectedImageRequestId === item.requestId;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-md border border-transparent bg-surface px-2 py-1.5 text-xs leading-5 text-muted transition",
                    selected &&
                      "border-accent bg-accent-soft ring-1 ring-accent/30"
                  )}
                  data-selected={selected ? "true" : undefined}
                  data-testid={`slide-image-layer-meta-${item.requestId}`}
                  ref={selected ? selectedImageLayerRef : undefined}
                >
                  <div className="truncate font-medium text-foreground">
                    {item.title}
                  </div>
                  <div className="line-clamp-2">{item.visualNotes}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("imageLayers.empty")}</p>
        )}
      </div>
    </section>
  );
}

function CompactScorePanel({
  icon,
  label,
  score,
  summary,
  testId
}: DeckPreviewScoreItem) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Tooltip onOpenChange={setTooltipOpen} open={tooltipOpen}>
      <TooltipTrigger asChild>
        <section
          className="rounded-lg border border-border bg-background px-3 py-2 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent"
          data-testid={testId}
          onBlur={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          tabIndex={0}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-accent">{icon}</span>
                <span className="truncate">{label}</span>
              </div>
            </div>
            <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-strong">
              {score}
            </span>
          </div>
        </section>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-5" side="bottom">
        {summary}
      </TooltipContent>
    </Tooltip>
  );
}

function ElementIcon({ type }: { type: SlideElement["type"] }) {
  const className = "size-3.5 text-accent";

  if (type === "text") {
    return <Type className={className} aria-hidden="true" />;
  }

  if (type === "generatedImage") {
    return <ImageIcon className={className} aria-hidden="true" />;
  }

  return <Shapes className={className} aria-hidden="true" />;
}

function isSlideFileElement(element: SlideElement) {
  return element.type === "generatedImage" || element.type === "icon";
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractHexColors(value: string) {
  return Array.from(
    new Set(value.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g) ?? [])
  );
}

function getMotionStyle(motion: {
  delayMs: number;
  durationMs: number;
}): CSSProperties {
  return {
    "--ppt-motion-delay": `${motion.delayMs}ms`,
    "--ppt-motion-duration": `${motion.durationMs}ms`
  } as CSSProperties;
}
