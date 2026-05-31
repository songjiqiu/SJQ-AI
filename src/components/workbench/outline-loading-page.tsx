"use client";

import { AlertCircle, ArrowLeft, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { DeckIntentAnalysisResult } from "@/lib/ai-deck/schema";
import type { DeckOutlineDraft } from "@/lib/deck-outline/schema";

import {
  intentAnalysisStorageKey,
  intentPayloadStorageKey,
  outlinePayloadStorageKey
} from "./creation-workbench";
import {
  WorkbenchApiError,
  createWorkbenchApiError
} from "./api-errors";
import { WorkbenchStepNav } from "./workbench-shared";

type WorkbenchApiErrorPayload = {
  details?: unknown;
  error?: string;
};

export function IntentAnalysisLoadingPage() {
  const t = useTranslations("workbench");
  const router = useRouter();
  const startedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<unknown>(null);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const payloadText = window.sessionStorage.getItem(intentPayloadStorageKey);

    async function analyzeIntent() {
      if (!payloadText) {
        setErrorMessage(t("loading.missingIntentPayload"));
        return;
      }

      try {
        const response = await fetch("/api/decks/outline/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: payloadText
        });
        const payload = (await response.json()) as DeckIntentAnalysisResult &
          WorkbenchApiErrorPayload;

        if (!response.ok) {
          throw createWorkbenchApiError(payload, t);
        }

        window.sessionStorage.setItem(
          intentAnalysisStorageKey,
          JSON.stringify(payload)
        );
        toast.success(t("toast.intentAnalyzed"));
        router.replace("/workbench/outline/analyze/confirm");
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

    void analyzeIntent();
  }, [router, t]);

  return (
    <>
      <WorkbenchStepNav current={1} />
      <LoadingShell
        actionLabel={t("loading.backToInput")}
        description={t("loading.intentDescription")}
        errorDetails={errorDetails}
        errorDetailsLabel={t("errors.failureDetails")}
        errorMessage={errorMessage}
        icon={errorMessage ? <AlertCircle /> : <WandSparkles />}
        onAction={() => router.replace("/workbench")}
        progressLabel={t("loading.intentProgress")}
        title={
          errorMessage ? t("loading.intentFailed") : t("loading.intentTitle")
        }
      />
    </>
  );
}

export function OutlineLoadingPage() {
  const t = useTranslations("workbench");
  const router = useRouter();
  const startedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<unknown>(null);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const payloadText = window.sessionStorage.getItem(outlinePayloadStorageKey);

    async function createOutline() {
      if (!payloadText) {
        setErrorMessage(t("loading.missingOutlinePayload"));
        return;
      }

      try {
        const response = await fetch("/api/decks/outline", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: payloadText
        });
        const payload = (await response.json()) as DeckOutlineDraft &
          WorkbenchApiErrorPayload;

        if (!response.ok) {
          throw createWorkbenchApiError(payload, t);
        }

        window.sessionStorage.removeItem(outlinePayloadStorageKey);
        toast.success(t("toast.outlineGenerated"));
        router.replace(`/workbench/outline/${payload.id}`);
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

    void createOutline();
  }, [router, t]);

  return (
    <>
      <WorkbenchStepNav current={1} />
      <LoadingShell
        actionLabel={t("loading.backToInput")}
        description={t("loading.outlineDescription")}
        errorDetails={errorDetails}
        errorDetailsLabel={t("errors.failureDetails")}
        errorMessage={errorMessage}
        icon={errorMessage ? <AlertCircle /> : <WandSparkles />}
        onAction={() => router.replace("/workbench")}
        progressLabel={t("loading.outlineProgress")}
        title={
          errorMessage ? t("loading.outlineFailed") : t("loading.outlineTitle")
        }
      />
    </>
  );
}

export function LoadingShell({
  actionLabel,
  description,
  errorDetails,
  errorDetailsLabel,
  errorMessage,
  icon,
  onAction,
  progressLabel,
  title
}: {
  actionLabel: string;
  description: string;
  errorDetails?: unknown;
  errorDetailsLabel?: string;
  errorMessage: string | null;
  icon: ReactNode;
  onAction: () => void;
  progressLabel?: string;
  title: string;
}) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <section className="w-full max-w-xl rounded-lg border border-border bg-surface p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-accent-soft text-accent-strong [&_svg]:size-6">
          <span className={errorMessage ? "" : "animate-pulse"}>{icon}</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          {errorMessage ?? description}
        </p>
        {errorMessage && errorDetails !== undefined && errorDetails !== null ? (
          <details className="mt-4 rounded-lg border border-border bg-background text-left">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
              {errorDetailsLabel}
            </summary>
            <pre className="max-h-80 overflow-auto border-t border-border p-3 text-xs leading-5 text-muted">
              {formatDebugDetails(errorDetails)}
            </pre>
          </details>
        ) : null}
        {!errorMessage && progressLabel ? (
          <div className="mx-auto mt-5 max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
            </div>
            <p className="mt-3 text-xs text-muted">{progressLabel}</p>
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-5 flex justify-center">
            <Button onClick={onAction} type="button" variant="secondary">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function formatDebugDetails(details: unknown) {
  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}
