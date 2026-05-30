"use client";

import { AlertCircle, Layers3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import type { GeneratedDeckResult } from "@/lib/ai-deck/schema";

import { generatePayloadStorageKey } from "./creation-workbench";
import { LoadingShell } from "./outline-loading-page";
import { WorkbenchStepNav } from "./workbench-shared";

export function GenerateLoadingPage() {
  const t = useTranslations("workbench");
  const router = useRouter();
  const startedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const payloadText = window.sessionStorage.getItem(generatePayloadStorageKey);

    async function generateDeck() {
      if (!payloadText) {
        setErrorMessage(t("loading.missingGeneratePayload"));
        return;
      }

      try {
        const response = await fetch("/api/decks/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: payloadText
        });
        const payload = (await response.json()) as GeneratedDeckResult & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? t("toast.failed"));
        }

        window.sessionStorage.removeItem(generatePayloadStorageKey);
        toast.success(t("toast.generated"));
        router.replace(`/workbench/preview/${payload.id}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("toast.failed");

        setErrorMessage(message);
        toast.error(message);
      }
    }

    void generateDeck();
  }, [router, t]);

  return (
    <>
      <WorkbenchStepNav current={2} />
      <LoadingShell
        actionLabel={t("loading.backToInput")}
        description={t("loading.generateDescription")}
        errorMessage={errorMessage}
        icon={errorMessage ? <AlertCircle /> : <Layers3 />}
        onAction={() => router.replace("/workbench")}
        progressLabel={t("loading.generateProgress")}
        title={
          errorMessage ? t("loading.generateFailed") : t("loading.generateTitle")
        }
      />
    </>
  );
}
