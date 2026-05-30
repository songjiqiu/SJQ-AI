"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { GeneratedDeckResult } from "@/lib/ai-deck/schema";

import { DeckPreview, WorkbenchStepNav } from "./workbench-shared";

export function DeckPreviewPage({ deck }: { deck: GeneratedDeckResult }) {
  const t = useTranslations("workbench");
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <WorkbenchStepNav current={3} />
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5">
        <div>
          <Button
            onClick={() => router.push("/workbench")}
            type="button"
            variant="secondary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("actions.backToInput")}
          </Button>
        </div>
        <DeckPreview deck={deck} />
      </div>
    </main>
  );
}
