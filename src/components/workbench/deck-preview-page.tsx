"use client";

import { ArrowLeft, FileJson, LayoutTemplate, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { GeneratedDeckResult } from "@/lib/ai-deck/schema";
import { cn } from "@/lib/utils";

import { deleteWorkbenchResource } from "./api-errors";
import {
  DeckPreview,
  DeckPreviewScoreStrip,
  VisualSpecPreview,
  WorkbenchStepNav
} from "./workbench-shared";

export function DeckPreviewPage({ deck }: { deck: GeneratedDeckResult }) {
  const t = useTranslations("workbench");
  const router = useRouter();
  const [currentDeck, setCurrentDeck] = useState(deck);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isVisualSpecOpen, setIsVisualSpecOpen] = useState(false);

  const deleteHistory = async () => {
    setIsDeleting(true);

    try {
      await deleteWorkbenchResource(
        `/api/decks/${currentDeck.id}`,
        t,
        t("toast.deleteHistoryFailed")
      );
      toast.success(t("toast.historyDeleted"));
      router.push("/workbench");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.deleteHistoryFailed");

      toast.error(message);
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <main className="flex h-[calc(100dvh-4rem-1px)] flex-col overflow-hidden">
      <WorkbenchStepNav current={3} />
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5">
        <div className="grid shrink-0 gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <Button
            className="justify-self-start"
            onClick={() => router.push("/workbench")}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("actions.backToInput")}
          </Button>
          <DeckPreviewScoreStrip
            className="w-full max-w-[21rem] justify-self-center"
            deck={currentDeck}
          />
          <div className="flex flex-wrap items-center gap-2 justify-self-start md:justify-self-end">
            <Button
              onClick={() => setIsVisualSpecOpen(true)}
              type="button"
              variant="secondary"
            >
              <FileJson className="size-4" aria-hidden="true" />
              {t("visualSpec.open")}
            </Button>
            <Button
              onClick={() =>
                router.push(`/workbench/preview/${currentDeck.id}/quality`)
              }
              type="button"
              variant="secondary"
            >
              <LayoutTemplate className="size-4" aria-hidden="true" />
              {t("designQuality.open")}
            </Button>
            <Button
              disabled={isDeleting || currentDeck.status === "GENERATING"}
              onClick={() => setIsDeleteDialogOpen(true)}
              type="button"
              variant="secondary"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {isDeleting ? t("actions.deleting") : t("actions.delete")}
            </Button>
          </div>
        </div>
        <DeckPreview deck={currentDeck} onDeckChange={setCurrentDeck} />
      </div>
      <VisualSpecDialog
        onOpenChange={setIsVisualSpecOpen}
        open={isVisualSpecOpen}
        title={t("visualSpec.title")}
        visualSpec={currentDeck.unifiedVisualSpec}
      />
      <AlertDialog
        actionLabel={t("actions.delete")}
        actionLoadingLabel={t("actions.deleting")}
        cancelLabel={t("actions.cancel")}
        description={t("history.confirmDelete", {
          title: currentDeck.deckTitle
        })}
        loading={isDeleting}
        onAction={() => void deleteHistory()}
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

function VisualSpecDialog({
  onOpenChange,
  open,
  title,
  visualSpec
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  visualSpec: GeneratedDeckResult["unifiedVisualSpec"];
}) {
  const t = useTranslations("workbench");
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimeout = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex min-h-dvh items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "grid max-h-[88dvh] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface text-left shadow-2xl outline-none"
        )}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <FileJson className="size-5 shrink-0 text-accent" aria-hidden="true" />
            <h2 className="truncate text-lg font-semibold text-foreground" id={titleId}>
              {title}
            </h2>
          </div>
          <Button
            aria-label={t("actions.close")}
            onClick={() => onOpenChange(false)}
            size="icon"
            type="button"
            variant="secondary"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">
          <VisualSpecPreview visualSpec={visualSpec} />
        </div>
      </section>
    </div>,
    document.body
  );
}
