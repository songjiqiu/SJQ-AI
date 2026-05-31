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
  Type
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type {
  GeneratedDeckResult,
  GeneratedSlideResult,
  SlideElement
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
      className="sticky top-0 z-20 border-b border-border bg-background/92 px-4 py-3 backdrop-blur"
    >
      <ol className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-sm font-medium text-muted sm:gap-4">
        {steps.map((step, index) => {
          const completed = step.id < current;
          const active = step.id === current;

          return (
            <li className="flex items-center gap-2" key={step.id}>
              {index > 0 ? (
                <span className="hidden h-px w-10 bg-border sm:block" />
              ) : null}
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border border-border bg-surface text-xs",
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
  const updateVisualSpec = (
    field: keyof DeckOutlineDraft["unifiedVisualSpec"],
    value: string | string[]
  ) => {
    updateDraft({
      unifiedVisualSpec: {
        ...draft.unifiedVisualSpec,
        [field]: value
      }
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
                onChange={(value) => updateSlideAt(index, "title", value)}
                value={slide.title}
              />
              <EditableField
                label={t("outline.fields.subtitle")}
                onChange={(value) => updateSlideAt(index, "subtitle", value)}
                value={slide.subtitle ?? ""}
              />
              <ListEditor
                label={t("outline.fields.bodyPoints")}
                onChange={(value) => updateSlideAt(index, "bodyPoints", value)}
                value={slide.bodyPoints}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <EditableField
                  label={t("outline.fields.speakerGoal")}
                  multiline
                  onChange={(value) => updateSlideAt(index, "speakerGoal", value)}
                  value={slide.speakerGoal}
                />
                <EditableField
                  label={t("outline.fields.visualIntent")}
                  multiline
                  onChange={(value) => updateSlideAt(index, "visualIntent", value)}
                  value={slide.visualIntent}
                />
              </div>
            </article>
          ))}

          <details className="rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              {t("visualSpec.title")}
            </summary>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <EditableField
                  label={t("outline.fields.themeName")}
                  onChange={(value) => updateVisualSpec("themeName", value)}
                  value={draft.unifiedVisualSpec.themeName}
                />
                <EditableField
                  label={t("outline.fields.typography")}
                  onChange={(value) => updateVisualSpec("typography", value)}
                  value={draft.unifiedVisualSpec.typography}
                />
                <EditableField
                  label={t("outline.fields.visualStyle")}
                  multiline
                  onChange={(value) => updateVisualSpec("visualStyle", value)}
                  value={draft.unifiedVisualSpec.visualStyle}
                />
                <EditableField
                  label={t("outline.fields.imageStyle")}
                  multiline
                  onChange={(value) => updateVisualSpec("imageStyle", value)}
                  value={draft.unifiedVisualSpec.imageStyle}
                />
              </div>
              <ListEditor
                label={t("outline.fields.colorPalette")}
                onChange={(value) => updateVisualSpec("colorPalette", value)}
                value={draft.unifiedVisualSpec.colorPalette}
              />
              <ListEditor
                label={t("outline.fields.layoutRules")}
                onChange={(value) => updateVisualSpec("layoutRules", value)}
                value={draft.unifiedVisualSpec.layoutRules}
              />
              <ListEditor
                label={t("outline.fields.consistencyRules")}
                onChange={(value) => updateVisualSpec("consistencyRules", value)}
                value={draft.unifiedVisualSpec.consistencyRules}
              />
              <ListEditor
                label={t("outline.fields.forbiddenRules")}
                onChange={(value) => updateVisualSpec("forbiddenRules", value)}
                value={draft.unifiedVisualSpec.forbiddenRules}
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
        <div className="grid gap-3 lg:grid-cols-2">
          <EditableField
            label={t("outline.fields.themeName")}
            onChange={(value) => updateVisualSpec("themeName", value)}
            value={draft.unifiedVisualSpec.themeName}
          />
          <EditableField
            label={t("outline.fields.typography")}
            onChange={(value) => updateVisualSpec("typography", value)}
            value={draft.unifiedVisualSpec.typography}
          />
          <EditableField
            label={t("outline.fields.visualStyle")}
            multiline
            onChange={(value) => updateVisualSpec("visualStyle", value)}
            value={draft.unifiedVisualSpec.visualStyle}
          />
          <EditableField
            label={t("outline.fields.imageStyle")}
            multiline
            onChange={(value) => updateVisualSpec("imageStyle", value)}
            value={draft.unifiedVisualSpec.imageStyle}
          />
        </div>
        <ListEditor
          label={t("outline.fields.colorPalette")}
          onChange={(value) => updateVisualSpec("colorPalette", value)}
          value={draft.unifiedVisualSpec.colorPalette}
        />
        <ListEditor
          label={t("outline.fields.layoutRules")}
          onChange={(value) => updateVisualSpec("layoutRules", value)}
          value={draft.unifiedVisualSpec.layoutRules}
        />
        <ListEditor
          label={t("outline.fields.consistencyRules")}
          onChange={(value) => updateVisualSpec("consistencyRules", value)}
          value={draft.unifiedVisualSpec.consistencyRules}
        />
        <ListEditor
          label={t("outline.fields.forbiddenRules")}
          onChange={(value) => updateVisualSpec("forbiddenRules", value)}
          value={draft.unifiedVisualSpec.forbiddenRules}
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
        </section>
      </div>
    </div>
  );

  function updateSlideAt(
    indexToUpdate: number,
    field: keyof DeckOutlineDraft["slides"][number],
    value: string | string[]
  ) {
    setDraft({
      ...draft,
      slides: draft.slides.map((slide, index) =>
        index === indexToUpdate
          ? {
              ...slide,
              [field]: value
            }
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
        </OutlinePreviewCard>
      ))}

      <details className="rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {t("visualSpec.title")}
        </summary>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <OutlinePreviewNote
              label={t("outline.fields.themeName")}
              value={draft.unifiedVisualSpec.themeName}
            />
            <OutlinePreviewNote
              label={t("outline.fields.typography")}
              value={draft.unifiedVisualSpec.typography}
            />
            <OutlinePreviewNote
              label={t("outline.fields.visualStyle")}
              value={draft.unifiedVisualSpec.visualStyle}
            />
            <OutlinePreviewNote
              label={t("outline.fields.imageStyle")}
              value={draft.unifiedVisualSpec.imageStyle}
            />
          </div>
          <OutlinePreviewList
            label={t("outline.fields.colorPalette")}
            value={draft.unifiedVisualSpec.colorPalette}
          />
          <OutlinePreviewList
            label={t("outline.fields.layoutRules")}
            value={draft.unifiedVisualSpec.layoutRules}
          />
          <OutlinePreviewList
            label={t("outline.fields.consistencyRules")}
            value={draft.unifiedVisualSpec.consistencyRules}
          />
          <OutlinePreviewList
            label={t("outline.fields.forbiddenRules")}
            value={draft.unifiedVisualSpec.forbiddenRules}
          />
        </div>
      </details>
    </section>
  );
}

export function DeckPreview({ deck }: { deck: GeneratedDeckResult }) {
  const t = useTranslations("workbench");
  const [editableDeck, setEditableDeck] = useState(deck);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isMotionPlaying, setIsMotionPlaying] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const selectedSlide =
    editableDeck.slides[selectedSlideIndex] ?? editableDeck.slides[0];
  const selectedElement = selectedSlide?.elements.find(
    (element) => element.id === selectedElementId
  );

  return (
    <section
      aria-label={t("preview.aria")}
      className="min-h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border bg-background px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => addBlankSlide()} type="button" variant="secondary">
            <Plus className="size-4" aria-hidden="true" />
            新增一页
          </Button>
          <Button onClick={() => void regenerateCurrentSlide()} type="button" variant="secondary">
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
            disabled={isSaving}
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
          ) : null}
        </div>
      </div>

      <div className="grid min-h-[720px] gap-0 xl:grid-cols-[190px_minmax(0,1fr)_360px]">
        <aside className="border-b border-border bg-background p-3 xl:border-b-0 xl:border-r">
          <div className="mb-2 text-sm font-semibold text-foreground">
            {t("preview.thumbnails")}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 xl:grid xl:max-h-[680px] xl:overflow-y-auto xl:overflow-x-hidden xl:pr-1">
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

        <div className="grid content-center gap-4 bg-surface-muted/55 p-4 md:p-5">
          {selectedSlide ? (
            <EditableSlideCanvas
              motionEnabled={isMotionPlaying}
              onChange={(slide) => updateSlide(slide)}
              onSelectElement={setSelectedElementId}
              selectedElementId={selectedElementId}
              slide={selectedSlide}
            />
          ) : null}

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <ScorePanel
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
              label={t("review.title")}
              score={editableDeck.contentReview.score}
              summary={editableDeck.contentReview.summary}
            />
            <ScorePanel
              icon={<Gauge className="size-4" aria-hidden="true" />}
              label={t("consistency.title")}
              score={editableDeck.consistencyReport.score}
              summary={editableDeck.consistencyReport.summary}
            />
          </div>
        </div>

        <aside className="grid content-start gap-4 border-t border-border bg-background p-4 xl:border-l xl:border-t-0">
          {selectedSlide ? (
            <SlideEditingPanel
              deck={editableDeck}
              onRegenerate={() => void regenerateCurrentSlide()}
              onSlideChange={(slide) => updateSlide(slide)}
              onVisualSpecChange={(visualSpec) =>
                setEditableDeck((value) => ({
                  ...value,
                  unifiedVisualSpec: visualSpec
                }))
              }
              selectedElement={selectedElement}
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
            elements: selectedSlide.elements
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
        visualIntent: "补充本页视觉意图"
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
          <span
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium leading-5 text-foreground"
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
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
  label,
  multiline = false,
  onChange,
  value
}: {
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
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </label>
  );
}

function ListEditor({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string[]) => void;
  value: string[];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <textarea
        className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
        onChange={(event) => onChange(parseLines(event.target.value))}
        value={value.join("\n")}
      />
    </label>
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
  motionEnabled,
  onChange,
  onSelectElement,
  selectedElementId,
  slide
}: {
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
            className={cn(
              "absolute flex items-center justify-center overflow-hidden rounded-md border px-2 text-center text-xs font-medium leading-5",
              element.type === "generatedImage" &&
                "border-accent/50 bg-accent-soft text-accent-strong",
              element.type === "text" &&
                "border-border bg-surface text-foreground shadow-sm",
              element.type === "shape" &&
                "border-transparent bg-accent/20 text-accent-strong",
              selected && "ring-2 ring-accent",
              motionEnabled && motion && `ppt-motion ppt-motion-${motion.preset}`
            )}
            key={element.id}
            onPointerDown={(event) => {
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
              <span className="absolute bottom-1 right-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
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
  onRegenerate,
  onSlideChange,
  onVisualSpecChange,
  selectedElement,
  selectedSlide
}: {
  deck: GeneratedDeckResult;
  onRegenerate: () => void;
  onSlideChange: (slide: GeneratedSlideResult) => void;
  onVisualSpecChange: (visualSpec: GeneratedDeckResult["unifiedVisualSpec"]) => void;
  selectedElement?: SlideElement;
  selectedSlide: GeneratedSlideResult;
}) {
  return (
    <>
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">本页内容</h2>
          <Button onClick={onRegenerate} size="sm" type="button" variant="secondary">
            <RefreshCw className="size-4" aria-hidden="true" />
            重新生成当前页
          </Button>
        </div>
        <EditableField
          label="标题"
          onChange={(value) =>
            updateContent({
              title: value
            })
          }
          value={selectedSlide.content.title}
        />
        <EditableField
          label="副标题"
          onChange={(value) =>
            updateContent({
              subtitle: value
            })
          }
          value={selectedSlide.content.subtitle ?? ""}
        />
        <ListEditor
          label="本页条目"
          onChange={(value) =>
            updateContent({
              bodyPoints: value
            })
          }
          value={selectedSlide.content.bodyPoints}
        />
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
          选中元素
        </div>
        {selectedElement ? (
          <>
            <EditableField
              label="内容"
              multiline
              onChange={(value) => updateElement(selectedElement.id, { content: value })}
              value={selectedElement.content ?? ""}
            />
            <div className="grid grid-cols-2 gap-2">
              {(["x", "y", "width", "height"] as const).map((field) => (
                <label className="grid gap-1" key={field}>
                  <span className="text-xs font-medium text-muted">{field}</span>
                  <input
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
                    onChange={(event) =>
                      updateElement(selectedElement.id, {
                        bounds: clampBounds({
                          ...selectedElement.bounds,
                          [field]: Number(event.target.value)
                        })
                      })
                    }
                    step="0.05"
                    type="number"
                    value={selectedElement.bounds[field]}
                  />
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">点击画布中的元素后可编辑内容与位置。</p>
        )}
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileJson className="size-4 text-accent" aria-hidden="true" />
          主题
        </div>
        <EditableField
          label="视觉风格"
          multiline
          onChange={(value) =>
            onVisualSpecChange({
              ...deck.unifiedVisualSpec,
              visualStyle: value
            })
          }
          value={deck.unifiedVisualSpec.visualStyle}
        />
        <div className="flex flex-wrap gap-2">
          {deck.unifiedVisualSpec.colorPalette.map((color) => (
            <span
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground"
              key={color}
            >
              <span
                aria-hidden="true"
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: color }}
              />
              {color}
            </span>
          ))}
        </div>
      </section>

      <SlideCopyPanel slide={selectedSlide} />
      <SlideMetaPanel slide={selectedSlide} />
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

function SlideMetaPanel({ slide }: { slide: GeneratedSlideResult }) {
  const t = useTranslations("workbench");

  return (
    <section className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileJson className="size-4 text-accent" aria-hidden="true" />
        {t("elements.title")}
      </div>
      <div className="grid gap-2">
        {slide.elements.map((element) => (
          <div
            key={element.id}
            className="grid gap-1 rounded-md bg-surface p-2 text-xs leading-5 text-muted"
          >
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ElementIcon type={element.type} />
              {element.role}
            </div>
            <div>
              {t("elements.bounds", {
                height: element.bounds.height,
                width: element.bounds.width,
                x: element.bounds.x,
                y: element.bounds.y,
                zIndex: element.zIndex
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ImageIcon className="size-4 text-accent" aria-hidden="true" />
          {t("imageLayers.title")}
        </div>
        {slide.generatedImageLayers.length > 0 ? (
          <div className="grid gap-2">
            {slide.generatedImageLayers.map((layer) => (
              <div
                key={layer.id}
                className="rounded-md bg-surface p-2 text-xs leading-5 text-muted"
              >
                <div className="font-medium text-foreground">
                  {layer.provider}
                </div>
                <div>{layer.visualNotes}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("imageLayers.empty")}</p>
        )}
      </div>
    </section>
  );
}

function ScorePanel({
  icon,
  label,
  score,
  summary
}: {
  icon: ReactNode;
  label: string;
  score: number;
  summary: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-accent">{icon}</span>
          {label}
        </div>
        <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-strong">
          {score}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{summary}</p>
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

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
