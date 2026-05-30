"use client";

import { ArrowLeft, Layers3, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { DeckOutlineDraft } from "@/lib/deck-outline/schema";

import { generatePayloadStorageKey } from "./creation-workbench";
import { OutlineDraftEditor, WorkbenchStepNav } from "./workbench-shared";

export function OutlineReviewPage({
  initialDraft
}: {
  initialDraft: DeckOutlineDraft;
}) {
  const t = useTranslations("workbench");
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const selectedSlide = draft.slides[selectedSlideIndex] ?? draft.slides[0];

  const saveDraft = async () => {
    setIsSaving(true);

    try {
      const saved = await persistDraft(draft, t("toast.outlineSaveFailed"));

      setDraft(saved);
      toast.success(t("toast.outlineSaved"));
      return saved;
    } finally {
      setIsSaving(false);
    }
  };

  const continueToGenerate = async () => {
    setIsContinuing(true);

    try {
      const saved = await persistDraft(draft, t("toast.outlineSaveFailed"));

      window.sessionStorage.setItem(
        generatePayloadStorageKey,
        JSON.stringify({
          outlineDraftId: saved.id
        })
      );
      toast.success(t("toast.outlineSaved"));
      router.push("/workbench/generate/loading");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.outlineSaveFailed");

      toast.error(message);
      setIsContinuing(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <WorkbenchStepNav current={2} />
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 pb-28">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => router.push("/workbench")}
              type="button"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("actions.backToInput")}
            </button>
            <h1 className="text-xl font-semibold text-foreground">
              {t("outline.reviewTitle")}
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted">
              {t("outline.reviewSubtitle")}
            </p>
          </div>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-strong">
            {t("outline.slideCount", { count: draft.slides.length })}
          </span>
        </section>

        <OutlineDraftEditor
          draft={draft}
          selectedSlide={selectedSlide}
          selectedSlideIndex={selectedSlideIndex}
          setDraft={setDraft}
          setSelectedSlideIndex={setSelectedSlideIndex}
          variant="cards"
        />
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/92 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted">
            {t("outline.footerMeta", {
              count: draft.slides.length,
              title: draft.deckTitle
            })}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                disabled={isSaving || isContinuing}
                onClick={() => void saveDraft()}
                type="button"
                variant="secondary"
              >
                <Save className="size-4" aria-hidden="true" />
                {isSaving ? t("actions.savingOutline") : t("actions.saveOutline")}
              </Button>
              <Button
                disabled={isSaving || isContinuing}
                onClick={() => void continueToGenerate()}
                type="button"
              >
                <Layers3 className="size-4" aria-hidden="true" />
                {isContinuing ? t("actions.generating") : t("actions.generate")}
              </Button>
          </div>
        </div>
      </footer>
    </main>
  );
}

async function persistDraft(draft: DeckOutlineDraft, fallbackMessage: string) {
  const response = await fetch(`/api/decks/outline/${draft.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deckTitle: draft.deckTitle,
      deckSummary: draft.deckSummary,
      unifiedVisualSpec: draft.unifiedVisualSpec,
      slides: draft.slides
    })
  });
  const payload = (await response.json()) as DeckOutlineDraft & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? fallbackMessage);
  }

  return payload;
}
