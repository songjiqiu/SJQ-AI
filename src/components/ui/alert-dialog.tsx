"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { Button } from "./button";

type AlertDialogProps = {
  actionDisabled?: boolean;
  actionLabel: string;
  actionLoadingLabel?: string;
  cancelLabel: string;
  className?: string;
  description: string;
  loading?: boolean;
  onAction: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function AlertDialog({
  actionDisabled = false,
  actionLabel,
  actionLoadingLabel,
  cancelLabel,
  className,
  description,
  loading = false,
  onAction,
  onOpenChange,
  open,
  title
}: AlertDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
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
      if (event.key === "Escape" && !loading) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [loading, onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex min-h-dvh items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          "grid w-full max-w-md gap-5 rounded-lg border border-border bg-surface p-6 text-left shadow-2xl outline-none",
          className
        )}
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold text-foreground" id={titleId}>
            {title}
          </h2>
          <p className="text-sm leading-6 text-muted" id={descriptionId}>
            {description}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={loading}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="secondary"
          >
            {cancelLabel}
          </Button>
          <Button
            disabled={loading || actionDisabled}
            onClick={onAction}
            type="button"
            variant="destructive"
          >
            {loading && actionLoadingLabel ? actionLoadingLabel : actionLabel}
          </Button>
        </div>
      </section>
    </div>,
    document.body
  );
}
