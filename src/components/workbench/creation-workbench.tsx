"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import JSZip from "jszip";
import {
  BadgeDollarSign,
  BookOpenText,
  BriefcaseBusiness,
  CalendarCheck,
  ChartColumnIncreasing,
  ChartNoAxesCombined,
  ChartPie,
  ClipboardList,
  Compass,
  FileChartColumn,
  FileText,
  GraduationCap,
  Handshake,
  History,
  Layers3,
  Lightbulb,
  Megaphone,
  MonitorPlay,
  PanelsTopLeft,
  PenTool,
  Presentation,
  Puzzle,
  RotateCcw,
  Rocket,
  ScrollText,
  Send,
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
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  deckStyleIds,
  deckTypeGroups,
  type DeckStyleId,
  type DeckTypeId
} from "@/lib/create-deck/options";
import {
  deckInputFileAccept,
  deckInputMaxFileCharacters,
  deckInputMaxFileCount,
  deckInputMaxFileSize
} from "@/lib/create-deck/file-options";
import {
  createDeckFormDefaults,
  createDeckFormSchema,
  type CreateDeckForm,
  type CreateDeckFormInput
} from "@/lib/create-deck/schema";
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

const styleIcons: Record<DeckStyleId, LucideIcon> = {
  data: ChartNoAxesCombined,
  minimal: ChartPie,
  "problem-solution": Puzzle,
  retrospective: ScrollText,
  story: PenTool,
  strategic: Layers3,
  teaching: BookOpenText,
  "visual-proposal": Sparkles
};

export function CreationWorkbench() {
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

  const selectedStyle =
    useWatch({ control, name: "style" }) ?? createDeckFormDefaults.style;
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
        sourceText: "",
        textFiles: await readTextFiles(textFiles),
        deckType: values.deckType,
        style: values.style,
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
    if (!window.confirm(t("drafts.confirmDelete", { title: item.deckTitle }))) {
      return;
    }

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
    }
  };

  const deleteHistoryItem = async (item: DeckHistoryItem) => {
    if (!window.confirm(t("history.confirmDelete", { title: item.deckTitle }))) {
      return;
    }

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
    }
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

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <WorkbenchStepNav current={1} />
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 lg:py-4">
        <section className="mx-auto w-full max-w-3xl text-center">
          <div className="mb-1 flex items-center justify-center gap-2 sm:mb-2">
            <WandSparkles
              className="size-6 text-accent sm:size-7"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-4xl">
              {t("hero.title")}
            </h1>
          </div>
        </section>

        <div className="grid w-full gap-3 lg:grid-cols-[minmax(0,1fr)_336px] lg:items-stretch">
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

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
                <span className="text-xs text-muted">
                  {t("fields.textFiles.limit")}
                </span>
                {textFiles.length > 0 ? (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {textFiles.map((file) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="flex max-w-56 items-center gap-2 rounded-md bg-background px-2 py-1 text-xs text-muted"
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
            </div>

            <div className="grid gap-4 border-t border-border bg-background/70 p-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium text-foreground">
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

              <div className="grid gap-2">
                <span className="text-sm font-medium text-foreground">
                  {t("fields.style.label")}
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {deckStyleIds.map((style) => {
                    const Icon = styleIcons[style];

                    return (
                      <label
                        className={cn(
                          "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2 text-left text-sm transition hover:border-accent",
                          selectedStyle === style &&
                            "border-accent bg-accent-soft text-accent-strong"
                        )}
                        key={style}
                      >
                        <input
                          {...register("style")}
                          className="sr-only"
                          type="radio"
                          value={style}
                        />
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 break-words font-medium leading-4">
                          {optionT(`styles.${style}`)}
                        </span>
                      </label>
                    );
                  })}
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
                        onClick={() => void deleteOutlineDraft(item)}
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
                        onClick={() => void deleteHistoryItem(item)}
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
              <div className="grid gap-2">
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
    </main>
  );
}

async function readTextFiles(files: File[]) {
  const accepted = files.slice(0, deckInputMaxFileCount);

  return Promise.all(
    accepted.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      content: (await readDeckInputFile(file)).slice(0, deckInputMaxFileCharacters)
    }))
  );
}

async function readDeckInputFile(file: File) {
  if (getFileExtension(file.name) === ".docx") {
    return extractDocxText(await file.arrayBuffer());
  }

  return file.text();
}

async function extractDocxText(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("text");

  if (!documentXml) {
    return "";
  }

  return documentXml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFileExtension(filename: string) {
  const index = filename.lastIndexOf(".");

  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}
