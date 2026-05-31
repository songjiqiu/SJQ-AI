"use client";

import { ArrowLeft, ClipboardCheck, FileText, Layers3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { DeckIntentAnalysisResult } from "@/lib/ai-deck/schema";

import {
  intentAnalysisStorageKey,
  intentPayloadStorageKey,
  outlinePayloadStorageKey
} from "./creation-workbench";
import { Field, WorkbenchStepNav } from "./workbench-shared";

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

    if (
      trimmedAudience.length < 2 ||
      trimmedGoal.length < 2 ||
      trimmedCoreMessage.length < 2 ||
      pageCount < 3 ||
      pageCount > 18
    ) {
      toast.error(t("toast.intentInvalid"));
      return;
    }

    window.sessionStorage.setItem(
      outlinePayloadStorageKey,
      JSON.stringify({
        ...analysis.input,
        confirmedIntent: {
          deckType: analysis.deckType,
          style: analysis.style,
          audience: trimmedAudience,
          goal: trimmedGoal,
          coreMessage: trimmedCoreMessage,
          recommendedPageCount: pageCount
        }
      })
    );
    window.sessionStorage.removeItem(intentAnalysisStorageKey);
    window.sessionStorage.removeItem(intentPayloadStorageKey);
    router.push("/workbench/outline/loading");
  };

  if (!analysis) {
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

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm md:grid-cols-[1fr_1fr] md:p-5">
          <ReadonlyMeta
            label={t("fields.deckType.label")}
            value={optionT(`deckTypes.${analysis.deckType}`)}
          />
          <ReadonlyMeta
            label={t("fields.style.label")}
            value={optionT(`styles.${analysis.style}`)}
          />
        </section>

        <section className="grid gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="size-4 text-accent" aria-hidden="true" />
            {t("intent.analysisTitle")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("intent.fields.audience")}>
              <input
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                onChange={(event) => setAudience(event.target.value)}
                value={audience}
              />
            </Field>
            <Field label={t("intent.fields.goal")}>
              <input
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                onChange={(event) => setGoal(event.target.value)}
                value={goal}
              />
            </Field>
          </div>
          <Field label={t("intent.fields.coreMessage")}>
            <textarea
              aria-label={t("intent.fields.coreMessage")}
              className="min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              onChange={(event) => setCoreMessage(event.target.value)}
              value={coreMessage}
            />
          </Field>
          <Field label={t("intent.fields.recommendedPageCount")}>
            <input
              aria-label={t("intent.fields.recommendedPageCount")}
              className="h-11 w-40 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              max={18}
              min={3}
              onChange={(event) =>
                setRecommendedPageCount(Number(event.target.value))
              }
              type="number"
              value={recommendedPageCount}
            />
          </Field>
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
