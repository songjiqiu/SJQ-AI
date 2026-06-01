"use client";

import { ArrowLeft, Layers3, PencilLine, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { DeckOutlineDraft } from "@/lib/deck-outline/schema";

import { generatePayloadStorageKey } from "./creation-workbench";
import {
  deleteWorkbenchResource,
  getWorkbenchApiErrorMessage
} from "./api-errors";
import {
  OutlineDraftEditor,
  OutlineDraftPreview,
  WorkbenchStepNav
} from "./workbench-shared";

export function OutlineReviewPage({
  initialDraft
}: {
  initialDraft: DeckOutlineDraft;
}) {
  const t = useTranslations("workbench");
  const router = useRouter();
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const visibleDraft = isEditing ? draft : savedDraft;
  const selectedSlide = draft.slides[selectedSlideIndex] ?? draft.slides[0];
  const getOutlineErrorMessage = (code?: string) =>
    code ? getWorkbenchApiErrorMessage(code, t) : t("toast.outlineSaveFailed");

  const beginEditing = () => {
    setDraft(savedDraft);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(savedDraft);
    setIsEditing(false);
  };

  const startGenerate = (outlineDraftId: string) => {
    window.sessionStorage.setItem(
      generatePayloadStorageKey,
      JSON.stringify({
        outlineDraftId
      })
    );
    router.push("/workbench/generate/loading");
  };

  const saveDraft = async () => {
    setIsSaving(true);

    try {
      const saved = await persistDraft(draft, getOutlineErrorMessage);

      setSavedDraft(saved);
      setDraft(saved);
      setIsEditing(false);
      toast.success(t("toast.outlineSaved"));
      return saved;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.outlineSaveFailed");

      toast.error(message);
      return undefined;
    } finally {
      setIsSaving(false);
    }
  };

  const continueToGenerate = async () => {
    setIsContinuing(true);

    if (!isEditing) {
      startGenerate(savedDraft.id);
      return;
    }

    try {
      const saved = await persistDraft(draft, getOutlineErrorMessage);

      setSavedDraft(saved);
      setDraft(saved);
      setIsEditing(false);
      toast.success(t("toast.outlineSaved"));
      startGenerate(saved.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.outlineSaveFailed");

      toast.error(message);
      setIsContinuing(false);
    }
  };

  const deleteDraft = async () => {
    setIsDeleting(true);

    try {
      await deleteWorkbenchResource(
        `/api/decks/outline/${savedDraft.id}`,
        t,
        t("toast.deleteDraftFailed")
      );
      toast.success(t("toast.draftDeleted"));
      router.push("/workbench");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.deleteDraftFailed");

      toast.error(message);
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <WorkbenchStepNav current={2} />
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 pb-28">
        <section className="grid gap-3">
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
        </section>

        {isEditing ? (
          <OutlineDraftEditor
            draft={draft}
            selectedSlide={selectedSlide}
            selectedSlideIndex={selectedSlideIndex}
            setDraft={setDraft}
            setSelectedSlideIndex={setSelectedSlideIndex}
            variant="cards"
          />
        ) : (
          <OutlineDraftPreview draft={savedDraft} />
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/92 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <div className="min-w-0 text-sm text-muted">
            {t("outline.footerMeta", {
              count: visibleDraft.slides.length,
              title: visibleDraft.deckTitle
            })}
          </div>
          <OutlineModeControls
            disabled={isEditing ? isSaving || isContinuing : isContinuing}
            isEditing={isEditing}
            onBeginEditing={beginEditing}
            onCancelEditing={cancelEditing}
            slideCount={visibleDraft.slides.length}
          />
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              disabled={isSaving || isContinuing || isDeleting}
              onClick={() => setIsDeleteDialogOpen(true)}
              type="button"
              variant="secondary"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {isDeleting ? t("actions.deleting") : t("actions.delete")}
            </Button>
            {isEditing ? (
              <Button
                disabled={isSaving || isContinuing || isDeleting}
                onClick={() => void saveDraft()}
                type="button"
                variant="secondary"
              >
                <Save className="size-4" aria-hidden="true" />
                {isSaving ? t("actions.savingOutline") : t("actions.saveOutline")}
              </Button>
            ) : null}
            <Button
              disabled={isSaving || isContinuing || isDeleting}
              onClick={() => void continueToGenerate()}
              type="button"
            >
              <Layers3 className="size-4" aria-hidden="true" />
              {isContinuing ? t("actions.generating") : t("actions.generate")}
            </Button>
          </div>
        </div>
      </footer>
      <AlertDialog
        actionLabel={t("actions.delete")}
        actionLoadingLabel={t("actions.deleting")}
        cancelLabel={t("actions.cancel")}
        description={t("drafts.confirmDelete", {
          title: savedDraft.deckTitle
        })}
        loading={isDeleting}
        onAction={() => void deleteDraft()}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setIsDeleteDialogOpen(false);
          }
        }}
        open={isDeleteDialogOpen}
        title={t("confirm.deleteTitle")}
      />
    </main>
  );
}

function OutlineModeControls({
  disabled,
  isEditing,
  onBeginEditing,
  onCancelEditing,
  slideCount
}: {
  disabled: boolean;
  isEditing: boolean;
  onBeginEditing: () => void;
  onCancelEditing: () => void;
  slideCount: number;
}) {
  const t = useTranslations("workbench");

  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-medium text-muted">
        {t(isEditing ? "outline.editMode" : "outline.previewMode")}
      </span>
      <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-strong">
        {t("outline.slideCount", { count: slideCount })}
      </span>
      {isEditing ? (
        <Button
          disabled={disabled}
          onClick={onCancelEditing}
          type="button"
          variant="secondary"
        >
          <X className="size-4" aria-hidden="true" />
          {t("actions.cancelEdit")}
        </Button>
      ) : (
        <Button
          disabled={disabled}
          onClick={onBeginEditing}
          type="button"
          variant="secondary"
        >
          <PencilLine className="size-4" aria-hidden="true" />
          {t("actions.editOutline")}
        </Button>
      )}
    </div>
  );
}

async function persistDraft(
  draft: DeckOutlineDraft,
  getErrorMessage: (code?: string) => string
) {
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
    throw new Error(getErrorMessage(payload.error));
  }

  return payload;
}
