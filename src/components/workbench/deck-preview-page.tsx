"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { GeneratedDeckResult } from "@/lib/ai-deck/schema";

import { deleteWorkbenchResource } from "./api-errors";
import {
  DeckPreview,
  DeckPreviewScoreStrip,
  WorkbenchStepNav
} from "./workbench-shared";

export function DeckPreviewPage({ deck }: { deck: GeneratedDeckResult }) {
  const t = useTranslations("workbench");
  const router = useRouter();
  const [currentDeck, setCurrentDeck] = useState(deck);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
            className="w-full max-w-2xl justify-self-center"
            deck={currentDeck}
          />
          <Button
            className="justify-self-start md:justify-self-end"
            disabled={isDeleting || currentDeck.status === "GENERATING"}
            onClick={() => setIsDeleteDialogOpen(true)}
            type="button"
            variant="secondary"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {isDeleting ? t("actions.deleting") : t("actions.delete")}
          </Button>
        </div>
        <DeckPreview deck={currentDeck} onDeckChange={setCurrentDeck} />
      </div>
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
