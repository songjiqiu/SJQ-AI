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
  LayoutTemplate,
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
  Upload
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type {
  GeneratedDeckResult,
  GeneratedSlideResult,
  SlideContent,
  SlideElement,
  UnifiedVisualSpec
} from "@/lib/ai-deck/schema";
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
    value: string | string[]
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
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      <CompactScorePanel
        icon={<ShieldCheck className="size-4" aria-hidden="true" />}
        label={t("review.title")}
        score={deck.contentReview.score}
        summary={deck.contentReview.summary}
      />
      <CompactScorePanel
        icon={<Gauge className="size-4" aria-hidden="true" />}
        label={t("consistency.title")}
        score={deck.consistencyReport.score}
        summary={deck.consistencyReport.summary}
      />
    </div>
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
            新增一页
          </Button>
          <Button
            disabled={isGenerating}
            onClick={() => void regenerateCurrentSlide()}
            type="button"
            variant="secondary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            换模板
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
            保存当前页
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
              />
            ) : null}
          </div>

          <div className="grid min-h-0 items-end">
            {selectedSlide ? (
              <SlideMetaPanel
                selectedElementId={selectedElementId}
                slide={selectedSlide}
              />
            ) : null}
          </div>
        </div>

        <aside className="grid min-h-0 min-w-0 content-start gap-4 overflow-y-auto overflow-x-hidden border-t border-border bg-background p-4 xl:border-l xl:border-t-0">
          {selectedSlide ? (
            <SlideEditingPanel
              deck={editableDeck}
              onDeleteElement={deleteElement}
              onRegenerate={() => void regenerateCurrentSlide()}
              onSlideChange={(slide) => updateSlide(slide)}
              onVisualSpecChange={(visualSpec) =>
                setEditableDeck((value) => ({
                  ...value,
                  unifiedVisualSpec: visualSpec
                }))
              }
              selectedElement={selectedElement}
              disabled={isGenerating}
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
        subtitle: "",
        bodyPoints: ["输入本页要点"],
        speakerGoal: "补充本页演讲目标",
        visualIntent: "补充本页视觉意图",
        coreStatement: "补充本页核心表达句",
        narrativeRole: "argument",
        contentLayers: {
          primary: ["补充本页核心表达句"],
          supporting: ["输入本页要点"],
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
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/80 p-3">
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <ColorizedText value={value} />
    </div>
  );
}

function OutlinePreviewList({
  label,
  value
}: {
  label: string;
  value: string[];
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">
        {value.map((item) => (
          <ColorToken key={item} value={item} />
        ))}
      </div>
    </div>
  );
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
          value={slide.contentLayers.primary}
        />
        <OutlinePreviewList
          label={t("outline.fields.contentLayersSupporting")}
          value={slide.contentLayers.supporting}
        />
        <OutlinePreviewList
          label={t("outline.fields.contentLayersSupplementary")}
          value={slide.contentLayers.supplementary}
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

function VisualSpecPreview({
  visualSpec
}: {
  visualSpec: DeckOutlineDraft["unifiedVisualSpec"];
}) {
  const t = useTranslations("workbench");

  return (
    <div className="mt-4 grid gap-4">
      <VisualSpecSection title={t("outline.fields.basicInfo")}>
        <div className="grid gap-3 md:grid-cols-2">
          <OutlinePreviewColorText
            label={t("outline.fields.themeName")}
            value={visualSpec.themeName}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.visualStyle")}
            value={visualSpec.visualStyle}
          />
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.colorSystem")}>
        <ColorPalettePreview colors={visualSpec.colorPalette} />
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
              "contrastRequirement"
            ] as const
          ).map((field) => (
            <OutlinePreviewColorText
              key={field}
              label={t(`outline.fields.${field}`)}
              value={visualSpec.colorRoles[field]}
            />
          ))}
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.layoutTypography")}>
        <div className="grid gap-3 md:grid-cols-2">
          <OutlinePreviewColorText
            label={t("outline.fields.typography")}
            value={visualSpec.typography}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.pageSpec")}
            value={visualSpec.pageSpec.layoutInstruction}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.typographyRules")}
            value={[
              `${t("outline.fields.defaultFontSize")}: ${visualSpec.typographyRules.defaultFontSize}`,
              `${t("outline.fields.minFontSize")}: ${visualSpec.typographyRules.minFontSize}`,
              `${t("outline.fields.maxLines")}: ${visualSpec.typographyRules.maxLines}`,
              `${t("outline.fields.lineHeight")}: ${visualSpec.typographyRules.lineHeight}`
            ].join(" / ")}
          />
          <OutlinePreviewList
            label={t("outline.fields.fontFallback")}
            value={visualSpec.typographyRules.fontFallback}
          />
          {(["coverTitle", "pageTitle", "body", "annotation", "chartLabel"] as const).map((field) => {
            const item = visualSpec.typographyRules.scale[field];

            return (
              <OutlinePreviewColorText
                key={field}
                label={t(`outline.fields.${field}`)}
                value={`${item.fontSize}px / ${item.fontWeight} / ${item.lineHeight} · ${item.usage}`}
              />
            );
          })}
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.imageRules")}>
        <div className="grid gap-3 md:grid-cols-2">
          <OutlinePreviewColorText
            label={t("outline.fields.imageStyle")}
            value={visualSpec.imageStyle}
          />
          <OutlinePreviewList
            label={t("outline.fields.usageNotes")}
            value={[
              `${t("outline.fields.backgroundAvoidsHighContrastTextArea")}: ${
                visualSpec.imageRules.backgroundAvoidsHighContrastTextArea
                  ? t("outline.values.yes")
                  : t("outline.values.no")
              }`,
              `${t("outline.fields.subjectAvoidsTitleArea")}: ${
                visualSpec.imageRules.subjectAvoidsTitleArea
                  ? t("outline.values.yes")
                  : t("outline.values.no")
              }`,
              ...visualSpec.imageRules.usageNotes
            ]}
          />
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.rulesList")}>
        <div className="grid gap-3 md:grid-cols-3">
          <OutlinePreviewList
            label={t("outline.fields.layoutRules")}
            value={visualSpec.layoutRules}
          />
          <OutlinePreviewList
            label={t("outline.fields.consistencyRules")}
            value={visualSpec.consistencyRules}
          />
          <OutlinePreviewList
            label={t("outline.fields.forbiddenRules")}
            value={visualSpec.forbiddenRules}
          />
        </div>
      </VisualSpecSection>

      <AdvancedVisualSpecPreview visualSpec={visualSpec} />
    </div>
  );
}

function AdvancedVisualSpecPreview({
  visualSpec
}: {
  visualSpec: UnifiedVisualSpec;
}) {
  const t = useTranslations("workbench");

  return (
    <>
      <VisualSpecSection title={t("outline.fields.pptTypeVisualTone")}>
        <div className="grid gap-3 md:grid-cols-2">
          <OutlinePreviewColorText
            label={t("outline.fields.deckType")}
            value={visualSpec.pptTypeVisualTone.deckTypeName}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.recommendedTone")}
            value={visualSpec.pptTypeVisualTone.recommendedTone}
          />
          <OutlinePreviewList
            label={t("outline.fields.visualKeywords")}
            value={visualSpec.pptTypeVisualTone.visualKeywords}
          />
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.advancedRules")}>
        <div className="grid gap-3 md:grid-cols-2">
          <OutlinePreviewColorText
            label={t("outline.fields.informationDensityRules")}
            value={[
              `${t("outline.fields.defaultLevel")}: ${visualSpec.informationDensityRules.defaultLevel}`,
              visualSpec.informationDensityRules.businessReport,
              visualSpec.informationDensityRules.trainingCourse,
              visualSpec.informationDensityRules.brandMarketing,
              visualSpec.informationDensityRules.researchReport
            ].join(" / ")}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.spacingRules")}
            value={Object.values(visualSpec.spacingRules).join(" / ")}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.chartVisualRules")}
            value={Object.values(visualSpec.chartVisualRules).join(" / ")}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.imageIllustrationRules")}
            value={Object.values(visualSpec.imageIllustrationRules).join(" / ")}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.iconStyleRules")}
            value={`${visualSpec.iconStyleRules.style} / ${visualSpec.iconStyleRules.stroke} / ${visualSpec.iconStyleRules.usage} / ${visualSpec.iconStyleRules.consistency}`}
          />
          <OutlinePreviewColorText
            label={t("outline.fields.emphasisRules")}
            value={Object.values(visualSpec.emphasisRules).join(" / ")}
          />
        </div>
        <OutlinePreviewList
          label={t("outline.fields.forbiddenVisualRules")}
          value={visualSpec.forbiddenVisualRules}
        />
      </VisualSpecSection>
    </>
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

function ColorPalettePreview({ colors }: { colors: string[] }) {
  const t = useTranslations("workbench");

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted">
        {t("outline.fields.colorPalette")}
      </div>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <ColorToken key={color} value={color} variant="palette" />
        ))}
      </div>
    </div>
  );
}

function ColorizedText({ value }: { value: string }) {
  const colors = extractHexColors(value);

  return (
    <div className="grid gap-2">
      {colors.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => (
            <ColorToken key={color} value={color} />
          ))}
        </div>
      ) : null}
      <p className="text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}

function ColorToken({
  value,
  variant = "inline"
}: {
  value: string;
  variant?: "inline" | "palette";
}) {
  const color = extractHexColors(value)[0];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium leading-5 text-foreground",
        variant === "palette" && "px-2.5 py-1.5"
      )}
      data-color-token={color ?? undefined}
    >
      {color ? (
        <span
          aria-hidden="true"
          className="size-3.5 rounded-full border border-border"
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
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.contentLayersPrimary")}
            onChange={(value) =>
              update({
                contentLayers: {
                  ...slide.contentLayers,
                  primary: value
                }
              })
            }
            value={slide.contentLayers.primary}
          />
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.contentLayersSupporting")}
            onChange={(value) =>
              update({
                contentLayers: {
                  ...slide.contentLayers,
                  supporting: value
                }
              })
            }
            value={slide.contentLayers.supporting}
          />
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.contentLayersSupplementary")}
            onChange={(value) =>
              update({
                contentLayers: {
                  ...slide.contentLayers,
                  supplementary: value
                }
              })
            }
            value={slide.contentLayers.supplementary}
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
        </div>
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.colorSystem")}>
        <ColorPalettePreview colors={visualSpec.colorPalette} />
        <ListEditor
          disabled={disabled}
          label={t("outline.fields.colorPalette")}
          onChange={(value) => onChange({ ...visualSpec, colorPalette: value })}
          value={visualSpec.colorPalette}
        />
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
              "contrastRequirement"
            ] as const
          ).map((field) => (
            <div className="grid gap-2" key={field}>
              <EditableField
                disabled={disabled}
                label={t(`outline.fields.${field}`)}
                multiline={field === "contrastRequirement"}
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    colorRoles: {
                      ...visualSpec.colorRoles,
                      [field]: value
                    }
                  })
                }
                value={visualSpec.colorRoles[field]}
              />
              <ColorizedText value={visualSpec.colorRoles[field]} />
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
            max={18}
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
          {(["coverTitle", "pageTitle", "body", "annotation", "chartLabel"] as const).map((field) => (
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
        <EditableField
          disabled={disabled}
          label={t("outline.fields.imageStyle")}
          multiline
          onChange={(value) => onChange({ ...visualSpec, imageStyle: value })}
          value={visualSpec.imageStyle}
        />
        <div className="grid gap-2 md:grid-cols-2">
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
        <ListEditor
          disabled={disabled}
          label={t("outline.fields.usageNotes")}
          onChange={(value) =>
            onChange({
              ...visualSpec,
              imageRules: {
                ...visualSpec.imageRules,
                usageNotes: value
              }
            })
          }
          value={visualSpec.imageRules.usageNotes}
        />
      </VisualSpecSection>

      <VisualSpecSection title={t("outline.fields.rulesList")}>
        <div className="grid gap-3 lg:grid-cols-3">
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.layoutRules")}
            onChange={(value) => onChange({ ...visualSpec, layoutRules: value })}
            value={visualSpec.layoutRules}
          />
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.consistencyRules")}
            onChange={(value) =>
              onChange({ ...visualSpec, consistencyRules: value })
            }
            value={visualSpec.consistencyRules}
          />
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.forbiddenRules")}
            onChange={(value) =>
              onChange({ ...visualSpec, forbiddenRules: value })
            }
            value={visualSpec.forbiddenRules}
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
      <VisualSpecSection title={t("outline.fields.pptTypeVisualTone")}>
        <div className="grid gap-3 md:grid-cols-2">
            <EditableField
              disabled
              label={t("outline.fields.deckType")}
              value={visualSpec.pptTypeVisualTone.deckTypeName}
              onChange={() => undefined}
            />
            <EditableField
              disabled={disabled}
              label={t("outline.fields.recommendedTone")}
              multiline
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

        <VisualSpecSection title={t("outline.fields.advancedRules")}>
          <div className="grid gap-3 md:grid-cols-2">
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
            {(["businessReport", "trainingCourse", "brandMarketing", "researchReport"] as const).map((field) => (
              <EditableField
                disabled={disabled}
                key={field}
                label={`${t("outline.fields.informationDensityRules")} · ${t(`outline.fields.${field}`)}`}
                multiline
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    informationDensityRules: {
                      ...visualSpec.informationDensityRules,
                      [field]: value
                    }
                  })
                }
                value={visualSpec.informationDensityRules[field]}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["pageMargin", "sectionGap", "elementGap", "whitespace"] as const).map((field) => (
              <EditableField
                disabled={disabled}
                key={field}
                label={t(`outline.fields.${field}`)}
                multiline
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    spacingRules: {
                      ...visualSpec.spacingRules,
                      [field]: value
                    }
                  })
                }
                value={visualSpec.spacingRules[field]}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["chartTypes", "axisAndGrid", "labelRules", "colorUsage", "sourceNotes"] as const).map((field) => (
              <EditableField
                disabled={disabled}
                key={field}
                label={t(`outline.fields.${field}`)}
                multiline
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    chartVisualRules: {
                      ...visualSpec.chartVisualRules,
                      [field]: value
                    }
                  })
                }
                value={visualSpec.chartVisualRules[field]}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["style", "composition", "background", "consistency"] as const).map((field) => (
              <EditableField
                disabled={disabled}
                key={`image-${field}`}
                label={`${t("outline.fields.imageIllustrationRules")} · ${t(`outline.fields.${field}`)}`}
                multiline={field !== "style"}
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    imageIllustrationRules: {
                      ...visualSpec.imageIllustrationRules,
                      [field]: value
                    }
                  })
                }
                value={visualSpec.imageIllustrationRules[field]}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
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
            {(["stroke", "usage", "consistency"] as const).map((field) => (
              <EditableField
                disabled={disabled}
                key={`icon-${field}`}
                label={`${t("outline.fields.iconStyleRules")} · ${t(`outline.fields.${field}`)}`}
                multiline
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    iconStyleRules: {
                      ...visualSpec.iconStyleRules,
                      [field]: value
                    }
                  })
                }
                value={visualSpec.iconStyleRules[field]}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["highlight", "keyNumbers", "keywords", "conclusion"] as const).map((field) => (
              <EditableField
                disabled={disabled}
                key={`emphasis-${field}`}
                label={`${t("outline.fields.emphasisRules")} · ${t(`outline.fields.${field}`)}`}
                multiline
                onChange={(value) =>
                  onChange({
                    ...visualSpec,
                    emphasisRules: {
                      ...visualSpec.emphasisRules,
                      [field]: value
                    }
                  })
                }
                value={visualSpec.emphasisRules[field]}
              />
            ))}
          </div>
          <ListEditor
            disabled={disabled}
            label={t("outline.fields.forbiddenVisualRules")}
            onChange={(value) =>
              onChange({
                ...visualSpec,
                forbiddenVisualRules: value
              })
            }
            value={visualSpec.forbiddenVisualRules}
          />
        </VisualSpecSection>
      </div>
    </details>
  );

}

function SlideCanvasPreview({
  compact = false,
  motionEnabled,
  slide
}: {
  compact?: boolean;
  motionEnabled: boolean;
  slide: GeneratedSlideResult;
}) {
  const t = useTranslations("workbench.elementTypes");

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-muted",
        compact ? "min-h-24" : "min-h-[320px]"
      )}
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
              "absolute flex items-center justify-center overflow-hidden rounded-md border px-2 text-center font-medium",
              compact ? "text-[7px] leading-3" : "text-xs leading-5",
              element.type === "generatedImage" &&
                "border-accent/50 bg-accent-soft text-accent-strong",
              element.type === "text" &&
                "border-border bg-surface text-foreground shadow-sm",
              element.type === "shape" &&
                "border-transparent bg-accent/20 text-accent-strong",
              element.type === "icon" &&
                "border-signal/40 bg-signal/15 text-signal",
              element.type === "chartPlaceholder" &&
                "border-warning/40 bg-warning/15 text-warning",
              motionEnabled && motion && `ppt-motion ppt-motion-${motion.preset}`
            )}
            style={{
              left: `${toCanvasPercent(element.bounds.x, "x")}%`,
              top: `${toCanvasPercent(element.bounds.y, "y")}%`,
              width: `${toCanvasPercent(element.bounds.width, "x")}%`,
              height: `${toCanvasPercent(element.bounds.height, "y")}%`,
              zIndex: element.zIndex,
              ...motionStyle
            }}
            title={element.role}
          >
            {element.type === "generatedImage" && layer ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={element.role}
                className="size-full object-cover"
                src={layer.url}
              />
            ) : element.type === "text" ? (
              element.content
            ) : (
              `${t(element.type)} · ${element.role}`
            )}
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
  slide
}: {
  disabled?: boolean;
  motionEnabled: boolean;
  onChange: (slide: GeneratedSlideResult) => void;
  onSelectElement: (id: string) => void;
  selectedElementId: string | null;
  slide: GeneratedSlideResult;
}) {
  const t = useTranslations("workbench.elementTypes");
  const [dragState, setDragState] = useState<{
    elementId: string;
    mode: "move" | "resize";
    startBounds: SlideElement["bounds"];
    startX: number;
    startY: number;
  } | null>(null);

  return (
    <div
      className="relative mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
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
              "absolute flex items-center justify-center overflow-hidden rounded-md border px-2 text-center text-xs font-medium leading-5 transition",
              element.type === "generatedImage" &&
                "border-accent/50 bg-accent-soft text-accent-strong",
              element.type === "text" &&
                "border-border bg-surface text-foreground shadow-sm",
              element.type === "shape" &&
                "border-transparent bg-accent/20 text-accent-strong",
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
              ...motionStyle
            }}
            title={`${element.role} · Alt 拖拽缩放`}
            type="button"
          >
            {element.type === "generatedImage" && layer ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={element.role}
                className="size-full object-cover"
                src={layer.url}
              />
            ) : element.type === "text" ? (
              element.content
            ) : (
              `${t(element.type)} · ${element.role}`
            )}
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

function SlideEditingPanel({
  deck,
  disabled = false,
  onDeleteElement,
  onRegenerate,
  onSlideChange,
  onVisualSpecChange,
  selectedElement,
  selectedSlide
}: {
  deck: GeneratedDeckResult;
  disabled?: boolean;
  onDeleteElement: (elementId: string) => void;
  onRegenerate: () => void;
  onSlideChange: (slide: GeneratedSlideResult) => void;
  onVisualSpecChange: (visualSpec: GeneratedDeckResult["unifiedVisualSpec"]) => void;
  selectedElement?: SlideElement;
  selectedSlide: GeneratedSlideResult;
}) {
  const t = useTranslations("workbench");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isFileElement = selectedElement
    ? isSlideFileElement(selectedElement)
    : false;

  return (
    <>
      <section className="grid min-w-0 gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">本页内容</h2>
          <Button
            disabled={disabled}
            onClick={onRegenerate}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            重新生成当前页
          </Button>
        </div>
        <EditableField
          label="标题"
          disabled={disabled}
          onChange={(value) =>
            updateContent({
              title: value
            })
          }
          value={selectedSlide.content.title}
        />
        <EditableField
          label="副标题"
          disabled={disabled}
          onChange={(value) =>
            updateContent({
              subtitle: value
            })
          }
          value={selectedSlide.content.subtitle ?? ""}
        />
        <ListEditor
          label="本页条目"
          disabled={disabled}
          onChange={(value) =>
            updateContent({
              bodyPoints: value
            })
          }
          value={selectedSlide.content.bodyPoints}
        />
      </section>

      <section
        className={cn(
          "grid min-w-0 gap-3 rounded-lg border bg-surface p-3 transition",
          selectedElement
            ? "border-accent bg-accent-soft/45 shadow-sm ring-2 ring-accent/25"
            : "border-border"
        )}
        data-selected={selectedElement ? "true" : undefined}
        data-testid="slide-selected-element-editor"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
          选中元素
        </div>
        {selectedElement ? (
          isFileElement ? (
            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-background px-3 py-2">
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
                  updateElement(selectedElement.id, { bounds })
                }
                value={selectedElement.bounds}
              />
            </div>
          ) : (
            <>
              <EditableField
                label="内容"
                multiline
                onChange={(value) =>
                  updateElement(selectedElement.id, { content: value })
                }
                value={selectedElement.content ?? ""}
              />
              <BoundsEditor
                disabled={disabled}
                onChange={(bounds) =>
                  updateElement(selectedElement.id, { bounds })
                }
                value={selectedElement.bounds}
              />
            </>
          )
        ) : (
          <p className="text-sm text-muted">点击画布中的元素后可编辑内容与位置。</p>
        )}
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileJson className="size-4 text-accent" aria-hidden="true" />
          {t("visualSpec.title")}
        </div>
        <EditableField
          label={t("outline.fields.visualStyle")}
          disabled={disabled}
          multiline
          onChange={(value) =>
            onVisualSpecChange({
              ...deck.unifiedVisualSpec,
              visualStyle: value
            })
          }
          value={deck.unifiedVisualSpec.visualStyle}
        />
        <ColorPalettePreview colors={deck.unifiedVisualSpec.colorPalette} />
      </section>

      <SlideCopyPanel slide={selectedSlide} />
    </>
  );

  function updateContent(patch: Partial<GeneratedSlideResult["content"]>) {
    const content = {
      ...selectedSlide.content,
      ...patch
    };

    onSlideChange({
      ...selectedSlide,
      content,
      elements: selectedSlide.elements.map((element) => {
        if (element.semanticType === "title") {
          return {
            ...element,
            content: content.title
          };
        }

        if (element.semanticType === "body") {
          return {
            ...element,
            content: content.bodyPoints.join("\n")
          };
        }

        return element;
      })
    });
  }

  function updateElement(
    elementId: string,
    patch: Partial<SlideElement>
  ) {
    onSlideChange({
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

function SlideCopyPanel({ slide }: { slide: GeneratedSlideResult }) {
  return (
    <section className="rounded-lg border border-border bg-background p-3">
      <h4 className="text-sm font-semibold text-foreground">
        {slide.content.title}
      </h4>
      {slide.content.subtitle ? (
        <p className="mt-1 text-sm text-muted">{slide.content.subtitle}</p>
      ) : null}
      <ul className="mt-2 space-y-1 text-sm leading-6 text-muted">
        {slide.content.bodyPoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
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
  const selectedElementRef = useRef<HTMLDivElement | null>(null);
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
    selectedElementRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
    selectedImageLayerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [selectedElementId, selectedImageRequestId]);

  return (
    <section className="rounded-lg border border-border bg-background p-2.5">
      <div className="grid gap-3">
        <SlideDesignQualityPanel slide={slide} />

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileJson className="size-4 text-accent" aria-hidden="true" />
            {t("elements.title")}
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto pr-1 lg:max-h-48">
              <div className="grid gap-1.5">
                {slide.elements.map((element) => {
                  const selected = selectedElementId === element.id;

                  return (
                    <div
                      key={element.id}
                      className={cn(
                        "grid gap-0.5 rounded-md border border-transparent bg-surface px-2 py-1.5 text-xs leading-5 text-muted transition",
                        selected &&
                          "border-accent bg-accent-soft ring-1 ring-accent/30"
                      )}
                      data-selected={selected ? "true" : undefined}
                      data-testid={`slide-element-meta-${element.id}`}
                      ref={selected ? selectedElementRef : undefined}
                    >
                      <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        <ElementIcon type={element.type} />
                        <span className="truncate">{element.role}</span>
                      </div>
                      <div className="truncate text-xs text-muted">
                        {t("elements.layer", { zIndex: element.zIndex })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 border-t border-border pt-2 lg:max-h-48 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-2 lg:pt-0">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ImageIcon className="size-4 text-accent" aria-hidden="true" />
                {t("imageLayers.title")}
              </div>
              {imageLayerItems.length > 0 ? (
                <div className="grid gap-1.5">
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
          </div>
        </div>
      </div>
    </section>
  );
}

function SlideDesignQualityPanel({ slide }: { slide: GeneratedSlideResult }) {
  const t = useTranslations("workbench");
  const dimensions = [
    ["informationHierarchy", slide.designQualityScore.dimensions.informationHierarchy],
    ["visualConsistency", slide.designQualityScore.dimensions.visualConsistency],
    ["contentDensity", slide.designQualityScore.dimensions.contentDensity],
    ["renderability", slide.designQualityScore.dimensions.renderability],
    ["expressionCompleteness", slide.designQualityScore.dimensions.expressionCompleteness]
  ] as const;

  return (
    <div className="grid gap-2 rounded-md border border-border bg-surface p-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <LayoutTemplate className="size-4 text-accent" aria-hidden="true" />
          <span className="truncate">{t("designQuality.title")}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted">
          <span>{slide.layoutSelection.selectedLayoutType}</span>
          <span className="rounded-md bg-accent-soft px-2 py-1 font-semibold text-accent-strong">
            {slide.designQualityScore.totalScore}
          </span>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-5">
        {dimensions.map(([key, dimension]) => (
          <div
            className="rounded-md bg-background px-2 py-1.5 text-xs leading-5 text-muted"
            key={key}
          >
            <div className="flex items-center justify-between gap-2 font-medium text-foreground">
              <span className="truncate">{t(`designQuality.dimensions.${key}`)}</span>
              <span>{dimension.score}</span>
            </div>
            <div className="mt-0.5 line-clamp-2">{dimension.summary}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-1.5 text-xs leading-5 text-muted sm:grid-cols-2">
        <div className="rounded-md bg-background px-2 py-1.5">
          <div className="font-medium text-foreground">
            {t("designQuality.repairStatus")}
          </div>
          <div>{t(`designQuality.repair.${slide.designQualityScore.repairStatus}`)}</div>
        </div>
        <div className="rounded-md bg-background px-2 py-1.5">
          <div className="font-medium text-foreground">
            {t("designQuality.layoutCandidates")}
          </div>
          <div className="truncate">
            {slide.layoutSelection.candidates
              .map((candidate) => candidate.layoutType)
              .join(" / ")}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactScorePanel({
  icon,
  label,
  score,
  summary
}: DeckPreviewScoreItem) {
  return (
    <section className="rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="text-accent">{icon}</span>
            <span className="truncate">{label}</span>
          </div>
          <p className="mt-1 truncate text-xs leading-5 text-muted">{summary}</p>
        </div>
        <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-strong">
          {score}
        </span>
      </div>
    </section>
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
