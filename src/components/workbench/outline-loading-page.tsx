"use client";

import { AlertCircle, ArrowLeft, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { DeckOutlineDraft } from "@/lib/deck-outline/schema";

import { outlinePayloadStorageKey } from "./creation-workbench";
import { WorkbenchStepNav } from "./workbench-shared";

export function OutlineLoadingPage() {
  const t = useTranslations("workbench");
  const router = useRouter();
  const startedRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        const payload = (await response.json()) as DeckOutlineDraft & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? t("toast.failed"));
        }

        window.sessionStorage.removeItem(outlinePayloadStorageKey);
        toast.success(t("toast.outlineGenerated"));
        router.replace(`/workbench/outline/${payload.id}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("toast.failed");

        setErrorMessage(message);
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
  errorMessage,
  icon,
  onAction,
  progressLabel,
  title
}: {
  actionLabel: string;
  description: string;
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
