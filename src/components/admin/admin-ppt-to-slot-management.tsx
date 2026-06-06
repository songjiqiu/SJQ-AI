"use client";

import { CheckCircle2, Download, ExternalLink, FileJson, Loader2, UploadCloud, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type {
  PptSlotTemplateDto,
  PptSlotTemplateReviewStatus
} from "@/lib/admin/ppt-to-slot/types";

type Props = {
  initialTemplates: PptSlotTemplateDto[];
};

const reviewStatuses: PptSlotTemplateReviewStatus[] = [
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "DRAFT"
];

export function AdminPptToSlotManagement({ initialTemplates }: Props) {
  const t = useTranslations("adminPptToSlot");
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState(initialTemplates[0]?.id ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [selectedId, templates]
  );

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    setIsUploading(true);

    try {
      const response = await fetch("/api/admin/ppt-to-slot/jobs", {
        body: formData,
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.details?.message ?? payload?.error ?? t("errors.uploadFailed"));
      }

      setTemplates((current) => [...payload.templates, ...current]);
      setSelectedId(payload.templates[0]?.id ?? selectedId);
      toast.success(t("toast.uploaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.uploadFailed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function updateReviewStatus(status: PptSlotTemplateReviewStatus) {
    if (!selectedTemplate) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ppt-to-slot/templates/${selectedTemplate.id}`, {
        body: JSON.stringify({
          isEnabled: status === "APPROVED",
          reviewNotes: reviewNotes || null,
          reviewStatus: status
        }),
        method: "PATCH"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? t("errors.updateFailed"));
      }

      setTemplates((current) =>
        current.map((template) =>
          template.id === selectedTemplate.id ? payload.template : template
        )
      );
      toast.success(t("toast.updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.updateFailed"));
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <UploadCloud className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">
              {t("title")}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent"
          href="/admin"
        >
          {t("actions.back")}
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="grid gap-4">
          <form
            className="rounded-lg border border-border bg-surface p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const file = fileInputRef.current?.files?.[0];

              if (file) {
                void uploadFile(file);
              }
            }}
          >
            <label className="grid gap-2 text-sm font-medium text-foreground">
              {t("upload.label")}
              <input
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="block w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white"
                disabled={isUploading}
                ref={fileInputRef}
                type="file"
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-muted">
              {t("upload.help")}
            </p>
            <Button className="mt-4" disabled={isUploading} type="submit">
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud className="size-4" aria-hidden="true" />
              )}
              {t("upload.submit")}
            </Button>
          </form>

          <section
            aria-label={t("list.aria")}
            className="grid gap-3"
          >
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-5 text-sm text-muted">
                {t("list.empty")}
              </div>
            ) : (
              templates.map((template) => (
                <button
                  className="rounded-lg border border-border bg-surface p-4 text-left outline-none transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 data-[active=true]:border-accent"
                  data-active={template.id === selectedTemplate?.id}
                  key={template.id}
                  onClick={() => {
                    setSelectedId(template.id);
                    setReviewNotes(template.reviewNotes ?? "");
                  }}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="grid gap-1">
                      <span className="font-semibold text-foreground">
                        {template.name}
                      </span>
                      <span className="text-xs text-muted">
                        {template.sourceFile} · {t("list.slide", { index: template.sourceSlideIndex })}
                      </span>
                    </span>
                    <StatusBadge
                      label={t(`statuses.${template.reviewStatus}`)}
                      status={template.reviewStatus}
                    />
                  </span>
                  <span className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                    {template.pageTypes.map((pageType) => (
                      <span
                        className="rounded-md bg-surface-muted px-2 py-1"
                        key={pageType}
                      >
                        {pageType}
                      </span>
                    ))}
                  </span>
                </button>
              ))
            )}
          </section>
        </div>

        <section className="rounded-lg border border-border bg-surface p-5">
          {selectedTemplate ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {selectedTemplate.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {selectedTemplate.layoutPattern}
                  </p>
                </div>
                <StatusBadge
                  label={t(`statuses.${selectedTemplate.reviewStatus}`)}
                  status={selectedTemplate.reviewStatus}
                />
              </div>

              <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={t("detail.overlayAlt")}
                  className="aspect-video w-full object-contain"
                  src={`/api/admin/ppt-to-slot/templates/${selectedTemplate.id}/artifacts/overlay`}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ArtifactLink
                  href={`/api/admin/ppt-to-slot/templates/${selectedTemplate.id}/artifacts/template`}
                  icon={<FileJson className="size-4" aria-hidden="true" />}
                  label={t("artifacts.template")}
                />
                <ArtifactLink
                  href={`/api/admin/ppt-to-slot/templates/${selectedTemplate.id}/artifacts/rawLayers`}
                  icon={<FileJson className="size-4" aria-hidden="true" />}
                  label={t("artifacts.rawLayers")}
                />
                <ArtifactLink
                  href={`/api/admin/ppt-to-slot/templates/${selectedTemplate.id}/artifacts/layoutCandidates`}
                  icon={<FileJson className="size-4" aria-hidden="true" />}
                  label={t("artifacts.layoutCandidates")}
                />
                <ArtifactLink
                  href={`/api/admin/ppt-to-slot/templates/${selectedTemplate.id}/artifacts/reviewReport`}
                  icon={<Download className="size-4" aria-hidden="true" />}
                  label={t("artifacts.reviewReport")}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="ppt-slot-review-notes">
                  {t("review.notes")}
                </label>
                <textarea
                  className="min-h-24 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
                  id="ppt-slot-review-notes"
                  onChange={(event) => setReviewNotes(event.target.value)}
                  value={reviewNotes}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void updateReviewStatus("APPROVED")}>
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {t("review.approve")}
                </Button>
                <Button
                  onClick={() => void updateReviewStatus("CHANGES_REQUESTED")}
                  variant="secondary"
                >
                  {t("review.changesRequested")}
                </Button>
                <Button
                  onClick={() => void updateReviewStatus("REJECTED")}
                  variant="destructive"
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  {t("review.reject")}
                </Button>
              </div>

              <pre className="max-h-80 overflow-auto rounded-lg bg-surface-muted p-4 text-xs leading-5 text-foreground">
                {JSON.stringify(selectedTemplate.slots, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="grid min-h-96 place-items-center text-sm text-muted">
              {t("detail.empty")}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function StatusBadge({
  label,
  status
}: {
  label: string;
  status: PptSlotTemplateReviewStatus;
}) {
  return (
    <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">
      {reviewStatuses.includes(status) ? label : status}
    </span>
  );
}

function ArtifactLink({
  href,
  icon,
  label
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {icon}
      {label}
      <ExternalLink className="ml-auto size-4 text-muted" aria-hidden="true" />
    </a>
  );
}
