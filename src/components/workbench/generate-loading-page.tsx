"use client";

import { AlertCircle, Layers3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";

import { generatePayloadStorageKey } from "./creation-workbench";
import {
  createWorkbenchApiError,
  WorkbenchApiError
} from "./api-errors";
import { LoadingShell } from "./outline-loading-page";
import { WorkbenchStepNav } from "./workbench-shared";

type DeckGenerationTaskPayload = {
  error?: string;
  details?: unknown;
  id: string;
  previewReady?: boolean;
  previewUrl?: string;
  progress?: {
    current: number;
    message: string;
    stage: string;
    total: number;
  };
  status: "GENERATING" | "READY" | "FAILED";
};

export function GenerateLoadingPage() {
  const t = useTranslations("workbench");
  const router = useRouter();
  const startedRef = useRef(false);
  const [isContinuingInBackground, setIsContinuingInBackground] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<unknown>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

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
        const payload = (await response.json()) as DeckGenerationTaskPayload;

        if (!response.ok) {
          throw createWorkbenchApiError(payload, t);
        }

        await pollDeckGeneration(payload.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("toast.failed");

        setErrorMessage(message);
        setErrorDetails(
          error instanceof WorkbenchApiError ? error.debugDetails : null
        );
        toast.error(message);
      }
    }

    async function pollDeckGeneration(projectId: string) {
      let attempt = 0;

      while (true) {
        const response = await fetch(`/api/decks/${projectId}/status`);
        const payload = (await response.json()) as DeckGenerationTaskPayload;

        if (!response.ok) {
          throw createWorkbenchApiError(payload, t);
        }

        if (payload.progress?.message) {
          setProgressLabel(payload.progress.message);
        }

        if (payload.status === "FAILED") {
          const message =
            payload.error ??
            payload.progress?.message ??
            t("loading.generateFailed");

          throw new WorkbenchApiError({
            code: "GENERATION_FAILED",
            details: payload,
            message
          });
        }

        if (payload.status === "READY" || payload.previewReady) {
          window.sessionStorage.removeItem(generatePayloadStorageKey);
          toast.success(
            payload.status === "READY"
              ? t("toast.generated")
              : t("toast.previewReady")
          );
          router.replace(`/workbench/preview/${payload.id}`);
          return;
        }

        attempt += 1;

        if (attempt >= 180) {
          setIsContinuingInBackground(true);
        }

        await wait(attempt >= 180 ? 10000 : 1500);
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
        errorDetails={errorDetails}
        errorDetailsLabel={t("errors.failureDetails")}
        errorMessage={errorMessage}
        icon={errorMessage ? <AlertCircle /> : <Layers3 />}
        onAction={() => router.replace("/workbench")}
        progressLabel={
          progressLabel ??
          (isContinuingInBackground
            ? t("loading.generateBackgroundProgress")
            : t("loading.generateProgress"))
        }
        title={
          errorMessage
            ? t("loading.generateFailed")
            : isContinuingInBackground
              ? t("loading.generateBackgroundTitle")
              : t("loading.generateTitle")
        }
      />
    </>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
