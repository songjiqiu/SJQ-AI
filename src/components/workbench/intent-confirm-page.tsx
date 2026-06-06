"use client";

import { ArrowLeft, ClipboardCheck, Layers3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type {
  DeckIntentAnalysisResult,
  DeckStructureOutline
} from "@/lib/ai-deck/schema";
import { deckPageCountMax, deckPageCountMin } from "@/lib/deck-input/schema";

import {
  intentAnalysisStorageKey,
  intentPayloadStorageKey,
  outlinePayloadStorageKey
} from "./creation-workbench";
import { Field, WorkbenchStepNav } from "./workbench-shared";
import {
  buildConfirmedOutlinePayload,
  isConfirmedOutlinePayloadValid,
  syncStructureSlideCount
} from "./outline-intent-payload";

export function IntentConfirmPage() {
  const t = useTranslations("workbench");
  const optionT = useTranslations("options");
  const router = useRouter();
  const [analysis, setAnalysis] = useState<DeckIntentAnalysisResult | null>(
    null
  );
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [coreMessage, setCoreMessage] = useState("");
  const [recommendedPageCount, setRecommendedPageCount] = useState(6);
  const [structureOutline, setStructureOutline] =
    useState<DeckStructureOutline | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(intentAnalysisStorageKey);
    let timer: number | undefined;

    if (!stored) {
      router.replace("/workbench");
      return undefined;
    }

    try {
      const parsed = JSON.parse(stored) as DeckIntentAnalysisResult;

      timer = window.setTimeout(() => {
        setAnalysis(parsed);
        setAudience(parsed.audience);
        setGoal(parsed.goal);
        setCoreMessage(parsed.coreMessage);
        setRecommendedPageCount(parsed.recommendedPageCount);
        setStructureOutline(parsed.structureOutline);
      }, 0);
    } catch {
      router.replace("/workbench");
    }

    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [router]);

  const backToInput = () => {
    router.replace("/workbench");
  };

  const confirmIntent = () => {
    if (!analysis) {
      return;
    }

    const trimmedAudience = audience.trim();
    const trimmedGoal = goal.trim();
    const trimmedCoreMessage = coreMessage.trim();
    const pageCount = Math.trunc(Number(recommendedPageCount));
    const normalizedStructure = structureOutline
      ? syncStructureSlideCount(structureOutline, pageCount)
      : null;

    if (
      !isConfirmedOutlinePayloadValid({
        audience: trimmedAudience,
        goal: trimmedGoal,
        coreMessage: trimmedCoreMessage,
        pageCount,
        structureOutline: normalizedStructure
      })
    ) {
      toast.error(t("toast.intentInvalid"));
      return;
    }

    if (!normalizedStructure) {
      toast.error(t("toast.intentInvalid"));
      return;
    }

    window.sessionStorage.setItem(
      outlinePayloadStorageKey,
      JSON.stringify(
        buildConfirmedOutlinePayload({
          analysis,
          audience: trimmedAudience,
          goal: trimmedGoal,
          coreMessage: trimmedCoreMessage,
          pageCount,
          structureOutline: normalizedStructure
        })
      )
    );
    window.sessionStorage.removeItem(intentAnalysisStorageKey);
    window.sessionStorage.removeItem(intentPayloadStorageKey);
    router.push("/workbench/outline/loading");
  };

  if (!analysis || !structureOutline) {
    return (
      <>
        <WorkbenchStepNav current={1} />
        <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl place-items-center px-4 py-8">
          <p className="text-sm text-muted">{t("intent.loading")}</p>
        </main>
      </>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <WorkbenchStepNav current={1} />
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-5 pb-28">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              onClick={backToInput}
              type="button"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("actions.backToInput")}
            </button>
            <h1 className="text-xl font-semibold text-foreground">
              {t("intent.title")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              {t("intent.subtitle")}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-strong">
            <ClipboardCheck className="size-4" aria-hidden="true" />
            {t("intent.pageCountBadge", {
              count: recommendedPageCount
            })}
          </span>
        </section>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm md:grid-cols-2 md:p-5">
          <ReadonlyMeta
            label={t("fields.deckType.label")}
            value={optionT(`deckTypes.${analysis.deckType}`)}
          />
          <ReadonlyMeta
            label={t("intent.fields.narrativeStyle")}
            value={formatEnumValue(analysis.lightweightOutline.narrativeStyle)}
          />
        </section>

        <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
          <div className="text-sm font-semibold text-foreground">
            {t("intent.sourceTitle")}
          </div>
          <div className="rounded-lg border border-border bg-background p-3 text-sm leading-6 text-muted">
            {summarizeSourceIdea(analysis.input.idea)}
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
          <Field label={t("intent.fields.recommendedPageCount")}>
            <input
              aria-label={t("intent.fields.recommendedPageCount")}
              className="h-11 w-40 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              max={deckPageCountMax}
              min={deckPageCountMin}
              onChange={(event) =>
                updatePageCount(Number(event.target.value))
              }
              type="number"
              value={recommendedPageCount}
            />
          </Field>
        </section>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers3 className="size-4 text-accent" aria-hidden="true" />
            {t("intent.structureTitle")}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ReadonlyMeta
              label={t("intent.fields.globalTheme")}
              value={analysis.lightweightOutline.globalTheme.theme}
            />
            <ReadonlyMeta
              label={t("intent.fields.globalObjective")}
              value={analysis.lightweightOutline.globalTheme.objective}
            />
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-medium text-muted">
              {t("intent.chaptersTitle")}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {analysis.lightweightOutline.chapters.map((chapter) => (
                <div
                  className="rounded-lg border border-border bg-background p-3 text-sm"
                  key={chapter.chapterId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">
                      {chapter.title}
                    </span>
                    <span className="text-xs text-muted">
                      {chapter.pageRange.start}-{chapter.pageRange.end}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {chapter.purpose}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("outline.fields.deckTitle")}>
              <input
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                onChange={(event) =>
                  updateStructure({ deckTitle: event.target.value })
                }
                value={structureOutline.deckTitle}
              />
            </Field>
            <Field label={t("outline.fields.deckSummary")}>
              <textarea
                className="min-h-24 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                onChange={(event) =>
                  updateStructure({ deckSummary: event.target.value })
                }
                value={structureOutline.deckSummary}
              />
            </Field>
          </div>
          <div className="grid gap-3">
            {structureOutline.slides.map((slide, index) => (
              <article
                className="grid gap-3 rounded-lg border border-border bg-background p-3"
                key={slide.slideId}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">
                      {t("preview.slideLabel", { index: slide.index })}
                    </span>
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted">
                      {analysis.lightweightOutline.pages[index]?.pageType ??
                        slide.pageType ??
                        "content"}
                    </span>
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted">
                      {analysis.lightweightOutline.pages[index]?.layoutType ??
                        slide.layoutType ??
                        "title-body-points"}
                    </span>
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted">
                      {analysis.lightweightOutline.pages[index]?.narrativeRole ??
                        slide.narrativeRole ??
                        "argument"}
                    </span>
                  </div>
                  <span className="text-xs text-muted">{slide.slideId}</span>
                </div>
                <Field label={t("intent.fields.structureTitle")}>
                  <input
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    onChange={(event) =>
                      updateStructureSlide(index, {
                        title: event.target.value
                      })
                    }
                    value={slide.title}
                  />
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("intent.fields.purpose")}>
                    <textarea
                      className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                      onChange={(event) =>
                        updateStructureSlide(index, {
                          purpose: event.target.value
                        })
                      }
                      value={slide.purpose}
                    />
                  </Field>
                  <Field label={t("intent.fields.keyMessage")}>
                    <textarea
                      className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                      onChange={(event) =>
                        updateStructureSlide(index, {
                          keyMessage: event.target.value
                        })
                      }
                      value={slide.keyMessage}
                    />
                  </Field>
                </div>
                <ReadonlyMeta
                  label={t("intent.fields.sourceIds")}
                  value={
                    (analysis.lightweightOutline.pages[index]?.sourceIds ??
                      slide.sourceIds ??
                      []).join(", ") || t("intent.noSources")
                  }
                />
              </article>
            ))}
          </div>
        </section>

        {analysis.fileSummaries.length > 0 ? (
          <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
            <div className="text-sm font-semibold text-foreground">
              {t("intent.filesTitle")}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {analysis.fileSummaries.map((file) => (
                <div
                  className="rounded-lg border border-border bg-background p-3 text-sm text-muted"
                  key={`${file.name}-${file.size}`}
                >
                  <div className="font-medium text-foreground">{file.name}</div>
                  <div>
                    {t("intent.fileMeta", {
                      characters: file.characterCount,
                      size: file.size
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/92 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{t("intent.footerMeta")}</p>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button onClick={backToInput} type="button" variant="secondary">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("actions.backToInput")}
            </Button>
            <Button onClick={confirmIntent} type="button">
              <Layers3 className="size-4" aria-hidden="true" />
              {t("actions.confirmIntent")}
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );

  function updatePageCount(nextValue: number) {
    const nextPageCount = Math.trunc(Number(nextValue));

    setRecommendedPageCount(nextPageCount);

    if (
      Number.isFinite(nextPageCount) &&
      nextPageCount >= deckPageCountMin &&
      nextPageCount <= deckPageCountMax
    ) {
      setStructureOutline((current) =>
        current ? syncStructureSlideCount(current, nextPageCount) : current
      );
    }
  }

  function updateStructure(patch: Partial<DeckStructureOutline>) {
    setStructureOutline((current) =>
      current
        ? {
            ...current,
            ...patch
          }
        : current
    );
  }

  function updateStructureSlide(
    indexToUpdate: number,
    patch: Partial<DeckStructureOutline["slides"][number]>
  ) {
    setStructureOutline((current) =>
      current
        ? {
            ...current,
            slides: current.slides.map((slide, index) =>
              index === indexToUpdate
                ? {
                    ...slide,
                    ...patch
                  }
                : slide
            )
          }
        : current
    );
  }
}

function ReadonlyMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function summarizeSourceIdea(idea: string) {
  const normalized = idea.replace(/\s+/g, " ").trim();
  const maxLength = 280;

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

function formatEnumValue(value: string) {
  return value
    .split("-")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}
