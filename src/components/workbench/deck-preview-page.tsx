"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { GeneratedDeckResult } from "@/lib/ai-deck/schema";

import { deleteWorkbenchResource } from "./api-errors";
import { DeckPreview, WorkbenchStepNav } from "./workbench-shared";

export function DeckPreviewPage({ deck }: { deck: GeneratedDeckResult }) {
  const t = useTranslations("workbench");
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteHistory = async () => {
    if (
      !window.confirm(
        t("history.confirmDelete", {
          title: deck.deckTitle
        })
      )
    ) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteWorkbenchResource(
        `/api/decks/${deck.id}`,
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
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <WorkbenchStepNav current={3} />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            onClick={() => router.push("/workbench")}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("actions.backToInput")}
          </Button>
          <Button
            disabled={isDeleting}
            onClick={() => void deleteHistory()}
            type="button"
            variant="secondary"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {isDeleting ? t("actions.deleting") : t("actions.delete")}
          </Button>
        </div>
        <DeckPreview deck={deck} />
      </div>
    </main>
  );
}
