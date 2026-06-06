"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarCheck,
  ChartColumnIncreasing,
  ClipboardList,
  Compass,
  FileChartColumn,
  FileText,
  GraduationCap,
  Handshake,
  History,
  Lightbulb,
  Megaphone,
  MonitorPlay,
  PanelsTopLeft,
  Presentation,
  RotateCcw,
  Rocket,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Trash2,
  UploadCloud,
  UserPen,
  Users,
  type LucideIcon,
  WandSparkles
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { usePalettePreset } from "@/components/theme/palette-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { deckTypeGroups, type DeckTypeId } from "@/lib/create-deck/options";
import {
  deckInputFileAccept,
  deckInputMaxFileCount,
  deckInputMaxFileSize
} from "@/lib/create-deck/file-options";
import {
  createDeckFormDefaults,
  createDeckFormSchema,
  type CreateDeckForm,
  type CreateDeckFormInput
} from "@/lib/create-deck/schema";
import { deckPageCountMax, deckPageCountMin } from "@/lib/deck-input/schema";
import type {
  DeckInputSource,
  ParsedDeckInputFile
} from "@/lib/deck-input/schema";
import type { DeckOutlineDraftListItem } from "@/lib/deck-outline/schema";
import { cn } from "@/lib/utils";

import { deleteWorkbenchResource } from "./api-errors";
import {
  Field,
  formatFileSize,
  WorkbenchStepNav,
  type DeckHistoryItem
} from "./workbench-shared";

export const outlinePayloadStorageKey = "pptcm_outline_payload";
export const intentPayloadStorageKey = "pptcm_intent_payload";
export const intentAnalysisStorageKey = "pptcm_intent_analysis";
export const generatePayloadStorageKey = "pptcm_generate_payload";
const creationFormId = "pptcm-creation-form";

type PendingDelete =
  | { item: DeckOutlineDraftListItem; kind: "draft" }
  | { item: DeckHistoryItem; kind: "history" }
  | null;

const deckTypeIcons: Record<DeckTypeId, LucideIcon> = {
  "brand-marketing": Megaphone,
  "business-report": BriefcaseBusiness,
  "community-sharing": Users,
  "data-analysis": ChartColumnIncreasing,
  "event-promotion": MonitorPlay,
  "fundraising-pitch": BadgeDollarSign,
  "growth-experiment": Rocket,
  "industry-insight": Compass,
  "knowledge-sharing": Lightbulb,
  "operation-plan": Store,
  "personal-review": UserPen,
  portfolio: PanelsTopLeft,
  "product-launch": Sparkles,
  "project-plan": CalendarCheck,
  proposal: Handshake,
  "research-report": FileChartColumn,
  "retrospective-summary": ScrollText,
  "sales-proposal": Target,
  "teaching-deck": Presentation,
  "training-course": GraduationCap
};

type CreationWorkbenchProps = {
  showAdminBackLink?: boolean;
};

export function CreationWorkbench({
  showAdminBackLink = false
}: CreationWorkbenchProps = {}) {
  const t = useTranslations("workbench");
  const optionT = useTranslations("options");
  const locale = useLocale();
  const router = useRouter();
  const { palette: selectedPalette } = usePalettePreset();
  const [outlineDrafts, setOutlineDrafts] = useState<
    DeckOutlineDraftListItem[]
  >([]);
  const [history, setHistory] = useState<DeckHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isDraftsLoading, setIsDraftsLoading] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textFiles, setTextFiles] = useState<File[]>([]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<CreateDeckFormInput, unknown, CreateDeckForm>({
    resolver: zodResolver(createDeckFormSchema),
    defaultValues: createDeckFormDefaults,
    mode: "onBlur"
  });

  const selectedDeckType =
    useWatch({ control, name: "deckType" }) ??
    createDeckFormDefaults.deckType;

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);

    try {
      const response = await fetch("/api/decks");

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        projects: DeckHistoryItem[];
      };

      setHistory(Array.isArray(payload.projects) ? payload.projects : []);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const loadOutlineDrafts = useCallback(async () => {
    setIsDraftsLoading(true);

    try {
      const response = await fetch("/api/decks/outline");

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        drafts: DeckOutlineDraftListItem[];
      };

      setOutlineDrafts(Array.isArray(payload.drafts) ? payload.drafts : []);
    } finally {
      setIsDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory();
      void loadOutlineDrafts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadHistory, loadOutlineDrafts]);

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);

    try {
      const payload = {
        idea: values.idea,
        ...(await parseInputFiles(textFiles)),
        sourceText: "",
        ...(values.pageCount ? { pageCount: values.pageCount } : {}),
        deckType: values.deckType,
        palette: selectedPalette,
        locale
      };

      window.sessionStorage.setItem(
        intentPayloadStorageKey,
        JSON.stringify(payload)
      );
      router.push("/workbench/outline/analyze/loading");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.failed");

      toast.error(message);
      setIsSubmitting(false);
    }
  });

  const resetForm = () => {
    reset(createDeckFormDefaults);
    setTextFiles([]);
  };

  const deleteOutlineDraft = async (item: DeckOutlineDraftListItem) => {
    setDeletingDraftId(item.id);

    try {
      await deleteWorkbenchResource(
        `/api/decks/outline/${item.id}`,
        t,
        t("toast.deleteDraftFailed")
      );
      setOutlineDrafts((items) =>
        items.filter((draft) => draft.id !== item.id)
      );
      toast.success(t("toast.draftDeleted"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.deleteDraftFailed");

      toast.error(message);
    } finally {
      setDeletingDraftId(null);
      setPendingDelete(null);
    }
  };

  const deleteHistoryItem = async (item: DeckHistoryItem) => {
    setDeletingHistoryId(item.id);

    try {
      await deleteWorkbenchResource(
        `/api/decks/${item.id}`,
        t,
        t("toast.deleteHistoryFailed")
      );
      setHistory((items) => items.filter((historyItem) => historyItem.id !== item.id));
      toast.success(t("toast.historyDeleted"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.deleteHistoryFailed");

      toast.error(message);
    } finally {
      setDeletingHistoryId(null);
      setPendingDelete(null);
    }
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) {
      return;
    }

    if (pendingDelete.kind === "draft") {
      void deleteOutlineDraft(pendingDelete.item);
      return;
    }

    void deleteHistoryItem(pendingDelete.item);
  };

  const handleTextFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const acceptedFiles = files.filter(
      (file) => file.size <= deckInputMaxFileSize
    );

    if (acceptedFiles.length < files.length) {
      toast.error(t("fields.textFiles.tooLarge"));
    }

    setTextFiles(acceptedFiles.slice(0, deckInputMaxFileCount));
    event.target.value = "";
  };

  const isPendingDeleteLoading =
    pendingDelete?.kind === "draft"
      ? deletingDraftId === pendingDelete.item.id
      : pendingDelete?.kind === "history"
        ? deletingHistoryId === pendingDelete.item.id
        : false;
  const pendingDeleteDescription =
    pendingDelete?.kind === "draft"
      ? t("drafts.confirmDelete", { title: pendingDelete.item.deckTitle })
      : pendingDelete?.kind === "history"
        ? t("history.confirmDelete", { title: pendingDelete.item.deckTitle })
        : "";

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <WorkbenchStepNav current={1} />
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:py-7">
        {showAdminBackLink ? (
          <div className="flex justify-end">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted outline-none transition hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              href="/admin"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {t("actions.backToAdmin")}
            </Link>
          </div>
        ) : null}
        <section className="mx-auto w-full max-w-3xl text-center">
          <div className="mb-2 flex items-center justify-center gap-3 sm:mb-3">
            <WandSparkles
              className="size-7 text-accent sm:size-8"
              aria-hidden="true"
            />
            <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-5xl">
              {t("hero.title")}
            </h1>
          </div>
        </section>

        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_336px] lg:items-stretch">
          <form
            aria-label={t("form.aria")}
            className="overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
            id={creationFormId}
            onSubmit={onSubmit}
          >
            <div className="grid gap-4 p-4 sm:p-5">
              <Field
                error={errors.idea ? t("validation.idea") : undefined}
                label={t("fields.idea.label")}
              >
                <textarea
                  {...register("idea")}
                  className="min-h-44 w-full resize-y border-0 bg-transparent px-0 py-0 text-lg leading-8 text-foreground outline-none placeholder:text-muted focus:ring-0"
                  placeholder={t("fields.idea.placeholder")}
                />
              </Field>

              <div className="grid gap-4 border-t border-border pt-5 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
                <div className="flex min-w-0 flex-wrap items-end gap-4">
                  <div className="grid gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-accent/50 bg-background px-3 text-sm font-medium text-accent-strong transition hover:border-accent">
                        <UploadCloud className="size-4" aria-hidden="true" />
                        {t("fields.textFiles.action")}
                        <input
                          accept={deckInputFileAccept}
                          className="sr-only"
                          multiple
                          onChange={handleTextFilesChange}
                          type="file"
                        />
                      </label>
                      <span className="text-xs leading-5 text-muted">
                        {t("fields.textFiles.limit")}
                      </span>
                    </div>
                    <span className="text-xs leading-5 text-muted">
                      {t("fields.textFiles.formats")}
                    </span>
                  </div>
                  {textFiles.length > 0 ? (
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                      {textFiles.map((file) => (
                        <div
                          key={`${file.name}-${file.size}`}
                          className="flex max-w-56 items-center gap-2 rounded-md bg-background px-2.5 py-1.5 text-sm text-muted"
                        >
                          <FileText className="size-3.5" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {file.name}
                          </span>
                          <span>{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <label className="grid gap-1.5">
                  <input
                    {...register("pageCount", {
                      setValueAs: (value) =>
                        value === "" ? undefined : Number(value)
                    })}
                    className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    max={deckPageCountMax}
                    min={deckPageCountMin}
                    placeholder={t("fields.pageCount.placeholder")}
                    type="number"
                  />
                  <span className="text-xs leading-5 text-muted">
                    {t("fields.pageCount.label")}
                  </span>
                  {errors.pageCount ? (
                    <span className="text-xs text-warning">
                      {t("validation.pageCount")}
                    </span>
                  ) : null}
                </label>
              </div>
            </div>

            <div className="grid gap-4 border-t border-border bg-background/70 p-4">
              <div className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {t("fields.deckType.label")}
                </span>
                <div className="grid gap-2">
                  {deckTypeGroups.map((group) => (
                    <fieldset
                      className="grid gap-1.5 rounded-lg border border-border bg-surface px-2.5 pb-2.5 pt-1.5"
                      key={group.id}
                    >
                      <legend className="px-1 text-xs font-medium text-muted">
                        {optionT(`typeGroups.${group.id}`)}
                      </legend>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {group.types.map((deckType) => {
                          const Icon = deckTypeIcons[deckType];

                          return (
                            <label
                              className={cn(
                                "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left text-sm transition hover:border-accent",
                                selectedDeckType === deckType &&
                                  "border-accent bg-accent-soft text-accent-strong"
                              )}
                              key={deckType}
                            >
                              <input
                                {...register("deckType")}
                                className="sr-only"
                                type="radio"
                                value={deckType}
                              />
                              <Icon className="size-4 shrink-0" aria-hidden="true" />
                              <span className="min-w-0 break-words font-medium leading-4">
                                {optionT(`deckTypes.${deckType}`)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>

            </div>
          </form>

          <aside className="flex flex-col gap-4 lg:self-stretch">
            <section
              aria-label={t("drafts.aria")}
              className="rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardList className="size-4 text-accent" aria-hidden="true" />
                  {t("drafts.title")}
                </div>
                <span className="text-xs text-muted">
                  {isDraftsLoading ? t("drafts.loading") : outlineDrafts.length}
                </span>
              </div>
              <div className="grid max-h-72 gap-2 overflow-auto pr-1 lg:max-h-[32vh]">
                {outlineDrafts.length > 0 ? (
                  outlineDrafts.map((item) => (
                    <div
                      key={item.id}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-background p-3 transition hover:border-accent"
                    >
                      <button
                        className="grid min-w-0 gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={() => router.push(`/workbench/outline/${item.id}`)}
                        type="button"
                      >
                        <span className="line-clamp-1 text-sm font-medium text-foreground">
                          {item.deckTitle}
                        </span>
                        <span className="text-xs text-muted">
                          {t("drafts.meta", {
                            count: item.slideCount,
                            mode: t(`preview.modes.${item.mode}`)
                          })}
                        </span>
                      </button>
                      <button
                        aria-label={t("drafts.deleteAria", {
                          title: item.deckTitle
                        })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted outline-none transition hover:bg-surface-muted hover:text-warning focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={deletingDraftId === item.id}
                        onClick={() => setPendingDelete({ item, kind: "draft" })}
                        title={t("actions.delete")}
                        type="button"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-background p-3 text-sm leading-6 text-muted">
                    {t("drafts.empty")}
                  </p>
                )}
              </div>
            </section>

            <section
              aria-label={t("history.aria")}
              className="rounded-lg border border-border bg-surface p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="size-4 text-accent" aria-hidden="true" />
                  {t("history.title")}
                </div>
                <span className="text-xs text-muted">
                  {isHistoryLoading ? t("history.loading") : history.length}
                </span>
              </div>
              <div className="grid max-h-80 gap-2 overflow-auto pr-1 lg:max-h-[34vh]">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-background p-3 transition hover:border-accent"
                    >
                      <button
                        className="grid min-w-0 gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={() => router.push(`/workbench/preview/${item.id}`)}
                        type="button"
                      >
                        <span className="line-clamp-1 text-sm font-medium text-foreground">
                          {item.deckTitle}
                        </span>
                        <span className="text-xs text-muted">
                          {t("history.meta", {
                            consistency: item.consistencyScore,
                            count: item.slideCount,
                            review: item.reviewScore
                          })}
                        </span>
                      </button>
                      <button
                        aria-label={t("history.deleteAria", {
                          title: item.deckTitle
                        })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted outline-none transition hover:bg-surface-muted hover:text-warning focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={deletingHistoryId === item.id}
                        onClick={() => setPendingDelete({ item, kind: "history" })}
                        title={t("actions.delete")}
                        type="button"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-background p-3 text-sm leading-6 text-muted">
                    {t("history.empty")}
                  </p>
                )}
              </div>
            </section>

            <div className="rounded-lg border border-border bg-surface p-4 shadow-sm lg:mt-auto">
              <div className="grid gap-3">
                <Button onClick={resetForm} type="button" variant="secondary">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {t("actions.reset")}
                </Button>
                <Button
                  disabled={isSubmitting}
                  form={creationFormId}
                  type="submit"
                >
                  {isSubmitting ? (
                    <WandSparkles
                      className="size-4 animate-pulse"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {isSubmitting
                    ? t("actions.generatingOutline")
                    : t("actions.generateOutline")}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
      <AlertDialog
        actionLabel={t("actions.delete")}
        actionLoadingLabel={t("actions.deleting")}
        cancelLabel={t("actions.cancel")}
        description={pendingDeleteDescription}
        loading={isPendingDeleteLoading}
        onAction={confirmPendingDelete}
        onOpenChange={(open) => {
          if (!open && !isPendingDeleteLoading) {
            setPendingDelete(null);
          }
        }}
        open={pendingDelete !== null}
        title={t("confirm.deleteTitle")}
      />
    </main>
  );
}

async function parseInputFiles(files: File[]) {
  if (files.length === 0) {
    return {
      parsedFiles: [] as ParsedDeckInputFile[],
      sources: [] as DeckInputSource[],
      textFiles: []
    };
  }

  const formData = new FormData();

  for (const file of files.slice(0, deckInputMaxFileCount)) {
    formData.append("files", file);
  }

  const response = await fetch("/api/decks/outline/files", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("文件解析失败，请检查文件格式后重试。");
  }

  const payload = (await response.json()) as {
    parsedFiles?: ParsedDeckInputFile[];
    sources?: DeckInputSource[];
    warnings?: string[];
  };

  if (payload.warnings?.length) {
    toast.warning(payload.warnings.slice(0, 2).join("\n"));
  }

  return {
    parsedFiles: payload.parsedFiles ?? [],
    sources: payload.sources ?? [],
    textFiles: []
  };
}
