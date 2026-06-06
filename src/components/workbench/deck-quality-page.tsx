"use client";

import { ArrowLeft, LayoutTemplate } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { GeneratedDeckResult } from "@/lib/ai-deck/schema";

const designQualityDimensionKeys = [
  "informationHierarchy",
  "visualConsistency",
  "contentDensity",
  "renderability",
  "expressionCompleteness"
] as const;

export function DeckQualityPage({ deck }: { deck: GeneratedDeckResult }) {
  const t = useTranslations("workbench");
  const router = useRouter();

  return (
    <main className="min-h-[calc(100dvh-4rem-1px)] bg-surface-muted/45">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5">
        <header className="grid gap-3 rounded-lg border border-border bg-background p-4 shadow-sm md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <Button
            className="justify-self-start"
            onClick={() => router.push(`/workbench/preview/${deck.id}`)}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("designQuality.backToPreview")}
          </Button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-accent">
              <LayoutTemplate className="size-4" aria-hidden="true" />
              {t("designQuality.pageTitle")}
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold text-foreground">
              {deck.deckTitle}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t("preview.generatedMeta", {
                count: deck.slides.length,
                mode: t(`preview.modes.${deck.mode}`)
              })}
            </p>
          </div>
        </header>

        <section className="grid gap-4">
          {deck.slides.map((slide) => (
            <article
              className="grid gap-4 rounded-lg border border-border bg-background p-4 shadow-sm"
              data-testid={`deck-quality-slide-${slide.slideId}`}
              key={slide.slideId}
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-muted">
                    {t("preview.slideLabel", { index: slide.index })}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">
                    {slide.content.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {slide.pageIntent.coreMessage}
                  </p>
                </div>
                <div className="grid min-w-40 gap-1 rounded-lg border border-border bg-surface px-4 py-3 text-center">
                  <span className="text-xs font-medium text-muted">
                    {t("designQuality.totalScore")}
                  </span>
                  <span className="text-3xl font-semibold text-accent">
                    {slide.designQualityScore.totalScore}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {slide.layoutSelection.selectedLayoutType}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-5">
                {designQualityDimensionKeys.map((key) => {
                  const dimension = slide.designQualityScore.dimensions[key];

                  return (
                    <div
                      className="grid gap-1 rounded-md bg-surface px-3 py-2 text-sm leading-6"
                      key={key}
                    >
                      <div className="flex items-center justify-between gap-2 font-medium text-foreground">
                        <span>{t(`designQuality.dimensions.${key}`)}</span>
                        <span>{dimension.score}</span>
                      </div>
                      <p className="text-xs leading-5 text-muted">
                        {dimension.summary}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <QualityTextList
                  emptyText={t("designQuality.noIssues")}
                  title={t("designQuality.issues")}
                  values={slide.designQualityScore.issues}
                />
                <QualityTextList
                  emptyText={t("designQuality.noSuggestions")}
                  title={t("designQuality.suggestions")}
                  values={slide.designQualityScore.suggestions}
                />
              </div>

              <div className="grid gap-3 text-sm leading-6 lg:grid-cols-2">
                <div className="rounded-md bg-surface px-3 py-2">
                  <div className="font-medium text-foreground">
                    {t("designQuality.repairStatus")}
                  </div>
                  <div className="text-muted">
                    {t(`designQuality.repair.${slide.designQualityScore.repairStatus}`)}
                  </div>
                </div>
                <div className="rounded-md bg-surface px-3 py-2">
                  <div className="font-medium text-foreground">
                    {t("designQuality.layoutCandidates")}
                  </div>
                  <div className="text-muted">
                    {slide.layoutSelection.candidates
                      .map(
                        (candidate) =>
                          `${candidate.layoutType} ${candidate.score}`
                      )
                      .join(" / ")}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function QualityTextList({
  emptyText,
  title,
  values
}: {
  emptyText: string;
  title: string;
  values: string[];
}) {
  return (
    <div className="rounded-md bg-surface px-3 py-2">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {values.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-sm leading-6 text-muted">
          {values.map((value, index) => (
            <li key={`${index}-${value}`}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted">{emptyText}</p>
      )}
    </div>
  );
}
