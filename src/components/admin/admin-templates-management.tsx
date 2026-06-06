"use client";

import {
  ArrowLeft,
  CopyPlus,
  Download,
  Edit3,
  FileJson,
  GalleryVerticalEnd,
  LayoutTemplate,
  LoaderCircle,
  Plus,
  Power,
  PowerOff,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AdminTemplateWorkspaceNav } from "@/components/admin/admin-template-workspace-nav";
import { TemplateCanvas } from "@/components/admin/template-canvas";
import { Link, useRouter } from "@/i18n/navigation";
import {
  normalizePptTemplateCategoryId,
  pptTemplateCategoryIds,
  type PptTemplateCategoryId
} from "@/lib/admin/templates/categories";
import { buildDefaultTemplateSlide } from "@/lib/admin/templates/defaults";
import type { PptTemplateDto } from "@/lib/admin/templates/types";
import { cn } from "@/lib/utils";

type AdminTemplatesManagementProps = {
  initialTemplates: PptTemplateDto[];
};

type ErrorMessages = {
  accountDisabled: string;
  forbidden: string;
  generic: string;
  notFound: string;
  unauthorized: string;
  validation: string;
};

type CreateTemplatePayload = {
  category: PptTemplateCategoryId;
  customCategoryKey?: string | null;
  customCategoryName?: string | null;
  description?: string | null;
  isEnabled?: boolean;
  name: string;
  slide?: PptTemplateDto["slide"];
  sortOrder?: number;
  tags?: string[];
};

const templateImportFormatVersion = "ppt-template-import-v1";

export function AdminTemplatesManagement({
  initialTemplates
}: AdminTemplatesManagementProps) {
  const t = useTranslations("adminTemplates");
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedCategory, setSelectedCategory] =
    useState<PptTemplateCategoryId>("chapter");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingUniversalTemplates, setIsImportingUniversalTemplates] =
    useState(false);
  const [isUniversalImportConfirmOpen, setIsUniversalImportConfirmOpen] =
    useState(false);
  const [creatingCategory, setCreatingCategory] =
    useState<PptTemplateCategoryId | null>(null);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] =
    useState<PptTemplateDto | null>(null);
  const errorMessages = useMemo(
    () => ({
      accountDisabled: t("errors.accountDisabled"),
      forbidden: t("errors.forbidden"),
      generic: t("errors.generic"),
      notFound: t("errors.notFound"),
      unauthorized: t("errors.unauthorized"),
      validation: t("errors.validation")
    }),
    [t]
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        pptTemplateCategoryIds.map((category) => [
          category,
          templates.filter((template) => template.category === category).length
        ])
      ) as Record<PptTemplateCategoryId, number>,
    [templates]
  );
  const filteredTemplates = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return templates.filter((template) => {
      if (template.category !== selectedCategory) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        template.name,
        template.description ?? "",
        ...template.tags
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [query, selectedCategory, templates]);
  const hasCompatibilityWarnings = templates.some(
    (template) => template.compatibilityWarning
  );

  const refreshTemplates = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/templates");

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      setTemplates(payload.templates ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  }, [errorMessages, t]);

  function buildDefaultCreatePayload(
    category: PptTemplateCategoryId
  ): CreateTemplatePayload {
    return {
      category,
      description: t("defaults.description", {
        category: t(`categories.${category}`)
      }),
      name: t("defaults.name", {
        category: t(`categories.${category}`),
        count: counts[category] + 1
      }),
      sortOrder: counts[category] + 1,
      tags: [t(`categories.${category}`)]
    };
  }

  async function createTemplateFromPayload(
    input: CreateTemplatePayload,
    successMessage: string
  ) {
    setCreatingCategory(input.category);

    try {
      const response = await fetch("/api/admin/templates", {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      const template = payload.template as PptTemplateDto;

      setTemplates((current) => [...current, template]);
      setSelectedCategory(input.category);
      setIsCreatePanelOpen(false);
      toast.success(successMessage);
      router.push(`/admin/templates/${template.id}`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
      return false;
    } finally {
      setCreatingCategory(null);
    }
  }

  async function createTemplate(category: PptTemplateCategoryId) {
    return createTemplateFromPayload(
      buildDefaultCreatePayload(category),
      t("toast.created")
    );
  }

  function downloadJsonTemplateFormat(category: PptTemplateCategoryId) {
    const example = {
      formatVersion: templateImportFormatVersion,
      ...buildDefaultCreatePayload(category),
      isEnabled: true,
      slide: buildDefaultTemplateSlide(category)
    };
    const blob = new Blob([JSON.stringify(example, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `ppt-template-format-${category}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function buildImportedTemplatePayload(
    value: unknown,
    fileName: string
  ): CreateTemplatePayload | null {
    if (isRecord(value) && "slide" in value) {
      const category = readCategory(value.category, selectedCategory);
      const fallbackName =
        readFileBaseName(fileName) ??
        t("defaults.name", {
          category: t(`categories.${category}`),
          count: counts[category] + 1
        });

      return {
        category,
        customCategoryKey: readNullableString(value.customCategoryKey),
        customCategoryName: readNullableString(value.customCategoryName),
        description:
          readNullableString(value.description) ??
          t("defaults.description", {
            category: t(`categories.${category}`)
          }),
        isEnabled:
          typeof value.isEnabled === "boolean" ? value.isEnabled : true,
        name: readString(value.name) ?? fallbackName,
        slide: value.slide as PptTemplateDto["slide"],
        sortOrder: readSortOrder(value.sortOrder) ?? counts[category] + 1,
        tags: readStringArray(value.tags) ?? [t(`categories.${category}`)]
      };
    }

    if (looksLikeSlideCompositionPlan(value)) {
      const category = selectedCategory;

      return {
        ...buildDefaultCreatePayload(category),
        name:
          readFileBaseName(fileName) ??
          t("defaults.name", {
            category: t(`categories.${category}`),
            count: counts[category] + 1
          }),
        slide: value
      };
    }

    return null;
  }

  async function importJsonTemplate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error(t("errors.invalidJson"));
      return;
    }

    setIsImporting(true);

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const payload = buildImportedTemplatePayload(parsed, file.name);

      if (!payload) {
        toast.error(t("errors.invalidJson"));
        return;
      }

      await createTemplateFromPayload(payload, t("toast.imported"));
    } catch {
      toast.error(t("errors.invalidJson"));
    } finally {
      setIsImporting(false);
    }
  }

  async function importUniversalTemplates() {
    setIsImportingUniversalTemplates(true);

    try {
      const response = await fetch("/api/admin/templates/universal-v1/import", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = (await response.json()) as {
        createdCount?: number;
        deletedCount?: number;
        templates?: PptTemplateDto[];
      };

      setTemplates(payload.templates ?? []);
      setIsUniversalImportConfirmOpen(false);
      toast.success(
        t("toast.universalImported", {
          created: payload.createdCount ?? 0,
          deleted: payload.deletedCount ?? 0
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsImportingUniversalTemplates(false);
    }
  }

  async function updateTemplate(
    template: PptTemplateDto,
    input: Partial<Pick<PptTemplateDto, "isEnabled">>
  ) {
    setSavingTemplateId(template.id);

    try {
      const response = await fetch(`/api/admin/templates/${template.id}`, {
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      const updatedTemplate = payload.template as PptTemplateDto;

      setTemplates((current) =>
        current.map((item) =>
          item.id === updatedTemplate.id ? updatedTemplate : item
        )
      );
      toast.success(t("toast.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setSavingTemplateId(null);
    }
  }

  async function deleteTemplate() {
    if (!deletingTemplate) {
      return;
    }

    setSavingTemplateId(deletingTemplate.id);

    try {
      const response = await fetch(`/api/admin/templates/${deletingTemplate.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      setTemplates((current) =>
        current.filter((template) => template.id !== deletingTemplate.id)
      );
      toast.success(t("toast.deleted"));
      setDeletingTemplate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setSavingTemplateId(null);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl px-4 py-8">
      <header className="mb-6 grid gap-5 border-b border-border pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              href="/admin"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("actions.back")}
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
                <LayoutTemplate className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {t("title")}
                </h1>
                <p className="mt-1 text-sm leading-6 text-muted lg:whitespace-nowrap">
                  {t("subtitle")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={isLoading}
              onClick={() => void refreshTemplates()}
              type="button"
              variant="secondary"
            >
              {isLoading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw className="size-4" aria-hidden="true" />
              )}
              {t("actions.refresh")}
            </Button>
            <Button
              disabled={isImportingUniversalTemplates}
              onClick={() => setIsUniversalImportConfirmOpen(true)}
              type="button"
              variant="secondary"
            >
              {isImportingUniversalTemplates ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <GalleryVerticalEnd className="size-4" aria-hidden="true" />
              )}
              {t("actions.importUniversalTemplates")}
            </Button>
            <Button
              onClick={() => downloadJsonTemplateFormat(selectedCategory)}
              type="button"
              variant="secondary"
            >
              <Download className="size-4" aria-hidden="true" />
              {t("actions.downloadJsonFormat")}
            </Button>
          </div>
        </div>
        <AdminTemplateWorkspaceNav active="templates" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          aria-label={t("categoriesAria")}
          className="grid content-start gap-2 rounded-lg border border-border bg-surface p-3"
        >
          {pptTemplateCategoryIds.map((category) => (
            <button
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-muted",
                selectedCategory === category &&
                  "bg-accent-soft text-accent-strong"
              )}
              key={category}
              onClick={() => setSelectedCategory(category)}
              type="button"
            >
              <span className="truncate font-medium">
                {t(`categories.${category}`)}
              </span>
              <span className="rounded-md bg-background px-2 py-1 text-xs text-muted">
                {counts[category]}
              </span>
            </button>
          ))}
        </aside>

        <section aria-label={t("listAria")} className="min-w-0">
          {hasCompatibilityWarnings ? (
            <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm leading-6 text-foreground">
              {t("compatibilityWarning")}
            </p>
          ) : null}

          <div className="mb-4 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <label className="relative block min-w-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                value={query}
              />
            </label>
            <Button
              disabled={creatingCategory === selectedCategory}
              onClick={() => setIsCreatePanelOpen(true)}
              type="button"
              variant="secondary"
            >
              <CopyPlus className="size-4" aria-hidden="true" />
              {t("actions.createInCategory", {
                category: t(`categories.${selectedCategory}`)
              })}
            </Button>
          </div>

          {isLoading && templates.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface text-sm text-muted">
              <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {t("loading")}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="grid min-h-64 place-items-center rounded-lg border border-border bg-surface p-6 text-center">
              <div>
                <p className="text-sm text-muted">{t("empty")}</p>
                <Button
                  className="mt-4"
                  onClick={() => setIsCreatePanelOpen(true)}
                  type="button"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t("actions.newTemplate")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredTemplates.map((template) => {
                const isSaving = savingTemplateId === template.id;

                return (
                  <article
                    className="grid min-w-0 gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm"
                    key={template.id}
                  >
                    <TemplateCanvas
                      disabled
                      slide={template.slide}
                      variant="thumbnail"
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <h2 className="line-clamp-2 text-base font-semibold text-foreground">
                          {template.name}
                        </h2>
                        <Badge tone={template.isEnabled ? "success" : "muted"}>
                          {template.isEnabled
                            ? t("status.enabled")
                            : t("status.disabled")}
                        </Badge>
                      </div>
                      {template.description ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                          {template.description}
                        </p>
                      ) : null}
                      {template.compatibilityWarning ? (
                        <p className="mt-2 rounded-md bg-warning/10 px-2 py-1.5 text-xs leading-5 text-warning">
                          {t("compatibilityCardWarning")}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {template.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} tone="muted">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        onClick={() => router.push(`/admin/templates/${template.id}`)}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        <Edit3 className="size-4" aria-hidden="true" />
                        {t("actions.edit")}
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          disabled={isSaving}
                          onClick={() =>
                            void updateTemplate(template, {
                              isEnabled: !template.isEnabled
                            })
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {isSaving ? (
                            <LoaderCircle
                              className="size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : template.isEnabled ? (
                            <PowerOff className="size-4" aria-hidden="true" />
                          ) : (
                            <Power className="size-4" aria-hidden="true" />
                          )}
                          {template.isEnabled
                            ? t("actions.disable")
                            : t("actions.enable")}
                        </Button>
                        <Button
                          disabled={isSaving}
                          onClick={() => setDeletingTemplate(template)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          {t("actions.delete")}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AlertDialog
        actionLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        description={t("confirm.delete", {
          name: deletingTemplate?.name ?? ""
        })}
        loading={savingTemplateId === deletingTemplate?.id}
        onAction={() => void deleteTemplate()}
        onOpenChange={(open) => {
          if (!open && savingTemplateId !== deletingTemplate?.id) {
            setDeletingTemplate(null);
          }
        }}
        open={deletingTemplate !== null}
        title={t("confirm.deleteTitle")}
      />

      <AlertDialog
        actionLabel={t("actions.importUniversalTemplates")}
        actionLoadingLabel={t("actions.importingUniversalTemplates")}
        cancelLabel={t("actions.cancel")}
        description={t("confirm.importUniversalTemplates")}
        loading={isImportingUniversalTemplates}
        onAction={() => void importUniversalTemplates()}
        onOpenChange={(open) => {
          if (!open && !isImportingUniversalTemplates) {
            setIsUniversalImportConfirmOpen(false);
          }
        }}
        open={isUniversalImportConfirmOpen}
        title={t("confirm.importUniversalTemplatesTitle")}
      />

      {isCreatePanelOpen ? (
        <div className="fixed inset-0 z-[60] flex min-h-dvh items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <section
            aria-labelledby="admin-template-create-title"
            aria-modal="true"
            className="grid w-full max-w-lg gap-5 rounded-lg border border-border bg-surface p-6 shadow-2xl"
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  id="admin-template-create-title"
                >
                  {t("createPanel.title")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t("createPanel.description", {
                    category: t(`categories.${selectedCategory}`)
                  })}
                </p>
              </div>
              <Button
                aria-label={t("actions.cancel")}
                disabled={creatingCategory !== null || isImporting}
                onClick={() => setIsCreatePanelOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </header>

            <div className="grid gap-3">
              <Button
                className="h-auto justify-start px-4 py-3 text-left"
                disabled={creatingCategory !== null || isImporting}
                onClick={() => void createTemplate(selectedCategory)}
                type="button"
                variant="secondary"
              >
                {creatingCategory === selectedCategory && !isImporting ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <FileJson className="size-4" aria-hidden="true" />
                )}
                <span className="grid gap-1">
                  <span>{t("actions.createFromDefault")}</span>
                  <span className="text-xs font-normal text-muted">
                    {t("createPanel.defaultHint")}
                  </span>
                </span>
              </Button>

              <label
                className={cn(
                  "flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-surface-muted",
                  (creatingCategory !== null || isImporting) &&
                    "cursor-not-allowed opacity-60"
                )}
              >
                {isImporting ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload className="size-4 text-accent" aria-hidden="true" />
                )}
                <span className="grid gap-1">
                  <span>{t("actions.importJson")}</span>
                  <span className="text-xs font-normal text-muted">
                    {t("createPanel.fileHint")}
                  </span>
                </span>
                <input
                  accept="application/json,.json"
                  aria-label={t("createPanel.fileLabel")}
                  className="sr-only"
                  disabled={creatingCategory !== null || isImporting}
                  onChange={(event) => void importJsonTemplate(event)}
                  type="file"
                />
              </label>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Badge({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "muted" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        tone === "muted" && "bg-surface-muted text-muted",
        tone === "success" && "bg-accent-soft text-accent-strong"
      )}
    >
      {children}
    </span>
  );
}

function readCategory(
  value: unknown,
  fallback: PptTemplateCategoryId
): PptTemplateCategoryId {
  return typeof value === "string"
    ? normalizePptTemplateCategoryId(value) ?? fallback
    : fallback;
}

function readFileBaseName(fileName: string) {
  const normalized = fileName.replace(/\.json$/i, "").trim();

  return normalized || null;
}

function readNullableString(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}

function readSortOrder(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.trunc(value));
}

function looksLikeSlideCompositionPlan(
  value: unknown
): value is PptTemplateDto["slide"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.slideId === "string" &&
    isRecord(value.content) &&
    isRecord(value.contentHierarchy) &&
    isRecord(value.designPlan) &&
    isRecord(value.layoutDiagnostics) &&
    isRecord(value.canvas) &&
    Array.isArray(value.elements) &&
    Array.isArray(value.imageLayerRequests)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readApiError(response: Response, messages: ErrorMessages) {
  try {
    const payload = await response.json();
    const code = typeof payload.error === "string" ? payload.error : "";

    if (code === "UNAUTHORIZED") {
      return messages.unauthorized;
    }

    if (code === "FORBIDDEN") {
      return messages.forbidden;
    }

    if (code === "ACCOUNT_DISABLED") {
      return messages.accountDisabled;
    }

    if (code === "VALIDATION_FAILED") {
      return messages.validation;
    }

    if (code === "NOT_FOUND") {
      return messages.notFound;
    }

    return messages.generic;
  } catch {
    return messages.generic;
  }
}
