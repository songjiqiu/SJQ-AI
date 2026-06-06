"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Copy,
  Database,
  Download,
  Edit3,
  FileText,
  Filter,
  Flag,
  Gauge,
  Home,
  Import,
  Info,
  Lightbulb,
  LoaderCircle,
  LucideIcon,
  MapPin,
  Menu,
  Minus,
  MoreHorizontal,
  Package,
  Printer,
  Plus,
  Power,
  PowerOff,
  RefreshCcw,
  Search,
  Share2,
  Shield,
  Table2,
  Target,
  TrendingUp,
  Upload,
  User,
  Users,
  Wallet,
  X,
  Zap,
  ZoomIn,
  Save,
  Trash2
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  createElement,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { toast } from "sonner";

import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  AdminTemplateWorkspaceNav,
  TemplateWorkspaceHeadingIcon
} from "@/components/admin/admin-template-workspace-nav";
import { Link } from "@/i18n/navigation";
import {
  buildTemplateAssetCategoryPreset,
  findTemplateAssetCategoryPath,
  getDefaultTemplateAssetCategorySelection,
  getLocalizedAssetText,
  getTemplateAssetCategories,
  type TemplateAssetCategorySelection
} from "@/lib/admin/template-assets/categories";
import { isPptTemplateCategoryId } from "@/lib/admin/templates/categories";
import type { TemplateElementAssetDto } from "@/lib/admin/template-assets/types";
import { cn } from "@/lib/utils";

type AdminTemplateElementAssetsManagementProps = {
  initialAssets: TemplateElementAssetDto[];
  kind: TemplateElementAssetKind;
};

type TemplateElementAssetKind = TemplateElementAssetDto["kind"];

type ErrorMessages = {
  accountDisabled: string;
  duplicate: string;
  forbidden: string;
  generic: string;
  notFound: string;
  unauthorized: string;
  validation: string;
};

type AssetFormState = {
  allowAutoLayout: boolean;
  allowMove: boolean;
  allowRecolor: boolean;
  allowResize: boolean;
  allowStretch: boolean;
  allowTextShrink: boolean;
  backgroundModesText: string;
  colorTagsText: string;
  description: string;
  isEnabled: boolean;
  keywordsText: string;
  name: string;
  pageTypesText: string;
  previewJson: string;
  primaryCategory: string;
  resourceJson: string;
  reviewStatus: string;
  semanticTagsText: string;
  secondaryCategory: string;
  setKey: string;
  setKind: string;
  setName: string;
  source: string;
  sortOrder: string;
  styleJson: string;
  styleTagsText: string;
  synonymsText: string;
  tagsText: string;
  usageScenariosText: string;
  variantKey: string;
};

type EditingAsset =
  | {
      asset: TemplateElementAssetDto;
      mode: "edit";
    }
  | {
      asset: null;
      mode: "create";
    };

const permissionFields = [
  "allowRecolor",
  "allowResize",
  "allowMove",
  "allowStretch",
  "allowAutoLayout",
  "allowTextShrink"
] as const;

const workspaceKindMap: Record<
  TemplateElementAssetKind,
  "containers" | "icons" | "shapes" | "lines" | "navigation" | "textStyles"
> = {
  CONTAINER: "containers",
  ICON: "icons",
  LINE: "lines",
  NAVIGATION: "navigation",
  SHAPE: "shapes",
  TEXT_STYLE: "textStyles"
};

const assetApiPathByKind: Record<TemplateElementAssetKind, string> = {
  CONTAINER: "/api/admin/template-containers",
  ICON: "/api/admin/template-icons",
  LINE: "/api/admin/template-lines",
  NAVIGATION: "/api/admin/template-navigation",
  SHAPE: "/api/admin/template-shapes",
  TEXT_STYLE: "/api/admin/template-text-styles"
};

export function AdminTemplateElementAssetsManagement({
  initialAssets,
  kind
}: AdminTemplateElementAssetsManagementProps) {
  const locale = useLocale();
  const t = useTranslations("adminTemplateAssets");
  const templateT = useTranslations("adminTemplates");
  const workspaceT = useTranslations("adminTemplateWorkspace");
  const workspaceKind = workspaceKindMap[kind];
  const categories = useMemo(() => getTemplateAssetCategories(kind), [kind]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [query, setQuery] = useState("");
  const [primaryFilter, setPrimaryFilter] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("");
  const [secondaryFilter, setSecondaryFilter] = useState("");
  const [setKindFilter, setSetKindFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<EditingAsset | null>(null);
  const [deletingAsset, setDeletingAsset] =
    useState<TemplateElementAssetDto | null>(null);
  const [form, setForm] = useState<AssetFormState>(() =>
    buildAssetFormState(null, kind, t, locale)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const errorMessages = useMemo(
    () => ({
      accountDisabled: t("errors.accountDisabled"),
      duplicate: t("errors.duplicate"),
      forbidden: t("errors.forbidden"),
      generic: t("errors.generic"),
      notFound: t("errors.notFound"),
      unauthorized: t("errors.unauthorized"),
      validation: t("errors.validation")
    }),
    [t]
  );
  const filterSecondaries = useMemo(
    () =>
      categories.find((category) => category.key === primaryFilter)
        ?.secondaries ?? [],
    [categories, primaryFilter]
  );
  const filterVariants = useMemo(
    () =>
      filterSecondaries.find((category) => category.key === secondaryFilter)
        ?.variants ?? [],
    [filterSecondaries, secondaryFilter]
  );
  const filteredAssets = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return assets.filter((asset) =>
      assetMatchesCategory(asset, {
        primaryCategory: primaryFilter || null,
        secondaryCategory: secondaryFilter || null,
        variantKey: variantFilter || null
      }) &&
        (!reviewStatusFilter || asset.reviewStatus === reviewStatusFilter) &&
        (!setKindFilter || asset.setKind === setKindFilter) &&
        (!keyword ||
          getAssetSearchValues({
            asset,
            backgroundModeLabels: {
              dark: t("backgroundModes.dark"),
              light: t("backgroundModes.light"),
              transparent: t("backgroundModes.transparent")
            },
            categoryPathLabel: getAssetCategoryPathLabel(
              asset,
              kind,
              locale,
              t("uncategorized")
            ),
            templateCategoryLabel: (pageType) =>
              isPptTemplateCategoryId(pageType)
                ? templateT(`categories.${pageType}`)
                : null
          }).some((value) => value.toLowerCase().includes(keyword)))
    );
  }, [
    assets,
    kind,
    locale,
    primaryFilter,
    query,
    reviewStatusFilter,
    secondaryFilter,
    setKindFilter,
    t,
    templateT,
    variantFilter
  ]);

  const refreshAssets = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(assetApiPathByKind[kind]);

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      setAssets(payload.assets ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  }, [errorMessages, kind, t]);

  function openCreatePanel() {
    setForm(buildAssetFormState(null, kind, t, locale));
    setFormError(null);
    setEditingAsset({
      asset: null,
      mode: "create"
    });
  }

  function openEditPanel(asset: TemplateElementAssetDto) {
    setForm(buildAssetFormState(asset, kind, t, locale));
    setFormError(null);
    setEditingAsset({
      asset,
      mode: "edit"
    });
  }

  async function saveAsset() {
    if (!editingAsset) {
      return;
    }

    const payload = parseAssetForm(form, kind);

    if (!payload) {
      setFormError(t("errors.invalidJson"));
      return;
    }

    setFormError(null);
    setSavingAssetId(editingAsset.asset?.id ?? "new");

    try {
      const response = await fetch(
        editingAsset.mode === "edit" && editingAsset.asset
          ? `${assetApiPathByKind[kind]}/${editingAsset.asset.id}`
          : assetApiPathByKind[kind],
        {
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json"
          },
          method: editingAsset.mode === "edit" ? "PATCH" : "POST"
        }
      );

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const responsePayload = await response.json();
      const savedAsset = responsePayload.asset as TemplateElementAssetDto;

      setAssets((current) =>
        editingAsset.mode === "edit"
          ? current.map((asset) =>
              asset.id === savedAsset.id ? savedAsset : asset
            )
          : [...current, savedAsset].sort(compareAssets)
      );
      setEditingAsset(null);
      toast.success(
        editingAsset.mode === "edit" ? t("toast.saved") : t("toast.created")
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setSavingAssetId(null);
    }
  }

  async function updateAssetEnabled(asset: TemplateElementAssetDto) {
    setSavingAssetId(asset.id);

    try {
      const response = await fetch(`${assetApiPathByKind[kind]}/${asset.id}`, {
        body: JSON.stringify({
          isEnabled: !asset.isEnabled
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      const payload = await response.json();
      const updatedAsset = payload.asset as TemplateElementAssetDto;

      setAssets((current) =>
        current.map((item) => (item.id === updatedAsset.id ? updatedAsset : item))
      );
      toast.success(t("toast.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setSavingAssetId(null);
    }
  }

  async function importAssetsFromFile(file: File) {
    setIsImporting(true);

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const rawAssets = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed) && Array.isArray(parsed.assets)
          ? parsed.assets
          : null;

      if (!rawAssets || rawAssets.length === 0) {
        throw new Error(t("errors.invalidImportJson"));
      }

      const importedAssets: TemplateElementAssetDto[] = [];

      for (const rawAsset of rawAssets) {
        if (!isRecord(rawAsset)) {
          throw new Error(t("errors.invalidImportJson"));
        }

        const response = await fetch(assetApiPathByKind[kind], {
          body: JSON.stringify({
            ...rawAsset,
            kind: typeof rawAsset.kind === "string" ? rawAsset.kind : kind
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST"
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, errorMessages));
        }

        const payload = await response.json();
        importedAssets.push(payload.asset as TemplateElementAssetDto);
      }

      setAssets((current) =>
        [...current, ...importedAssets].sort(compareAssets)
      );
      toast.success(
        t("toast.imported", {
          count: importedAssets.length
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsImporting(false);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function deleteAsset() {
    if (!deletingAsset) {
      return;
    }

    setSavingAssetId(deletingAsset.id);

    try {
      const response = await fetch(`${assetApiPathByKind[kind]}/${deletingAsset.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      setAssets((current) =>
        current.filter((asset) => asset.id !== deletingAsset.id)
      );
      setDeletingAsset(null);
      toast.success(t("toast.deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setSavingAssetId(null);
    }
  }

  function updatePrimaryFilter(value: string) {
    setPrimaryFilter(value);
    setSecondaryFilter("");
    setVariantFilter("");
  }

  function updateSecondaryFilter(value: string) {
    setSecondaryFilter(value);
    setVariantFilter("");
  }

  function updateFormPrimaryCategory(value: string) {
    const primary = categories.find((category) => category.key === value);
    const secondary = primary?.secondaries[0];
    const variant = secondary?.variants[0];

    applyCategorySelectionToForm({
      primaryCategory: value || null,
      secondaryCategory: secondary?.key ?? null,
      variantKey: variant?.key ?? null
    });
  }

  function updateFormSecondaryCategory(value: string) {
    const primary = categories.find(
      (category) => category.key === form.primaryCategory
    );
    const secondary = primary?.secondaries.find(
      (category) => category.key === value
    );
    const variant = secondary?.variants[0];

    applyCategorySelectionToForm({
      primaryCategory: form.primaryCategory || null,
      secondaryCategory: value || null,
      variantKey: variant?.key ?? null
    });
  }

  function updateFormVariant(value: string) {
    applyCategorySelectionToForm({
      primaryCategory: form.primaryCategory || null,
      secondaryCategory: form.secondaryCategory || null,
      variantKey: value || null
    });
  }

  function applyCategorySelectionToForm(
    selection: TemplateAssetCategorySelection
  ) {
    const preset = buildTemplateAssetCategoryPreset(kind, selection, locale);

    setForm((current) => {
      const nextSelection = {
        primaryCategory: selection.primaryCategory ?? "",
        secondaryCategory: selection.secondaryCategory ?? "",
        variantKey: selection.variantKey ?? ""
      };

      if (!preset) {
        return {
          ...current,
          ...nextSelection
        };
      }

      return {
        ...current,
        ...nextSelection,
        description: preset.description,
        name: preset.name,
        previewJson: stringifyJson(preset.preview),
        resourceJson: stringifyJson(preset.resource),
        semanticTagsText: preset.semanticTags.join("\n"),
        styleJson: stringifyJson(preset.style),
        styleTagsText: preset.tags.slice(1).join("\n"),
        tagsText: preset.tags.join("\n"),
        usageScenariosText: preset.usageScenarios.join("\n")
      };
    });
  }

  const formSecondaries = useMemo(
    () =>
      categories.find((category) => category.key === form.primaryCategory)
        ?.secondaries ?? [],
    [categories, form.primaryCategory]
  );
  const formVariants = useMemo(
    () =>
      formSecondaries.find((category) => category.key === form.secondaryCategory)
        ?.variants ?? [],
    [form.secondaryCategory, formSecondaries]
  );
  const formPreviewAsset = useMemo(
    () =>
      buildPreviewAssetFromForm(
        form,
        kind,
        form.name || t(`${workspaceKind}.defaultName`)
      ),
    [form, kind, t, workspaceKind]
  );

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
              {workspaceT("actions.back")}
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
                <TemplateWorkspaceHeadingIcon type={workspaceKind} />
              </span>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {t(`${workspaceKind}.title`)}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                  {t(`${workspaceKind}.subtitle`)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={isLoading}
              onClick={() => void refreshAssets()}
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
              disabled={isImporting}
              onClick={() => importInputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              {isImporting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              {isImporting ? t("actions.importing") : t("actions.import")}
            </Button>
            <input
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void importAssetsFromFile(file);
                }
              }}
              ref={importInputRef}
              type="file"
            />
          </div>
        </div>
        <AdminTemplateWorkspaceNav active={workspaceKind} />
      </header>

      <section aria-label={t("listAria")} className="grid gap-4">
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:p-4">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
            <label className="relative block min-w-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                className={compactSearchInputClassName}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                value={query}
              />
            </label>
            <p className="text-sm text-muted lg:whitespace-nowrap lg:text-right">
              {t("count", {
                count: filteredAssets.length
              })}
            </p>
            <Button
              className="w-full whitespace-nowrap lg:w-auto"
              onClick={() => {
                setQuery("");
                setPrimaryFilter("");
                setReviewStatusFilter("");
                setSecondaryFilter("");
                setSetKindFilter("");
                setVariantFilter("");
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t("actions.clearFilters")}
            </Button>
            <Button
              className="w-full whitespace-nowrap lg:w-auto"
              onClick={openCreatePanel}
              size="sm"
              type="button"
            >
              <Plus className="size-4" aria-hidden="true" />
              {t("actions.new")}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <FilterField label={t("filters.primaryCategory")}>
              <select
                className={compactSelectClassName}
                onChange={(event) => updatePrimaryFilter(event.target.value)}
                value={primaryFilter}
              >
                <option value="">{t("filters.allPrimary")}</option>
                {categories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {getLocalizedAssetText(category.label, locale)}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label={t("filters.secondaryCategory")}>
              <select
                className={compactSelectClassName}
                disabled={!primaryFilter}
                onChange={(event) => updateSecondaryFilter(event.target.value)}
                value={secondaryFilter}
              >
                <option value="">{t("filters.allSecondary")}</option>
                {filterSecondaries.map((category) => (
                  <option key={category.key} value={category.key}>
                    {getLocalizedAssetText(category.label, locale)}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label={t("filters.variant")}>
              <select
                className={compactSelectClassName}
                disabled={!secondaryFilter}
                onChange={(event) => setVariantFilter(event.target.value)}
                value={variantFilter}
              >
                <option value="">{t("filters.allVariants")}</option>
                {filterVariants.map((variant) => (
                  <option key={variant.key} value={variant.key}>
                    {getLocalizedAssetText(variant.label, locale)}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label={t("filters.setKind")}>
              <select
                className={compactSelectClassName}
                onChange={(event) => setSetKindFilter(event.target.value)}
                value={setKindFilter}
              >
                <option value="">{t("filters.allSetKinds")}</option>
                <option value="COMMON">{t("setKinds.COMMON")}</option>
                <option value="TEMPLATE">{t("setKinds.TEMPLATE")}</option>
              </select>
            </FilterField>
            <FilterField label={t("filters.reviewStatus")}>
              <select
                className={compactSelectClassName}
                onChange={(event) => setReviewStatusFilter(event.target.value)}
                value={reviewStatusFilter}
              >
                <option value="">{t("filters.allReviewStatuses")}</option>
                <option value="APPROVED">{t("reviewStatus.APPROVED")}</option>
                <option value="PENDING_REVIEW">
                  {t("reviewStatus.PENDING_REVIEW")}
                </option>
                <option value="DRAFT">{t("reviewStatus.DRAFT")}</option>
                <option value="REJECTED">{t("reviewStatus.REJECTED")}</option>
              </select>
            </FilterField>
          </div>
        </div>

        {isLoading && assets.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface text-sm text-muted">
            <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
            {t("loading")}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-lg border border-border bg-surface p-6 text-center">
            <div>
              <p className="text-sm text-muted">{t("empty")}</p>
              <Button className="mt-4" onClick={openCreatePanel} type="button">
                <Plus className="size-4" aria-hidden="true" />
                {t("actions.new")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAssets.map((asset) => {
              const isSaving = savingAssetId === asset.id;
              const categoryPathLabel = getAssetCategoryPathLabel(
                asset,
                kind,
                locale,
                t("uncategorized")
              );
              const cardTags = getAssetCardTags(asset, categoryPathLabel);

              return (
                <article
                  className="grid min-w-0 gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
                  key={asset.id}
                >
                  <AssetPreview asset={asset} />
                  <div className="min-w-0 content-start">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 text-base font-semibold text-foreground">
                        {asset.name}
                      </h2>
                      <Badge tone={asset.isEnabled ? "success" : "muted"}>
                        {asset.isEnabled
                          ? t("status.enabled")
                          : t("status.disabled")}
                      </Badge>
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="line-clamp-1 min-w-0 text-xs font-medium text-accent-strong">
                        {categoryPathLabel}
                      </p>
                      <Badge tone={asset.reviewStatus === "APPROVED" ? "success" : "warning"}>
                        {t(`reviewStatus.${asset.reviewStatus}`)}
                      </Badge>
                      {asset.source === "AI_GENERATED" ? (
                        <Badge tone="warning">{t("source.AI_GENERATED")}</Badge>
                      ) : null}
                    </div>
                    {asset.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                        {asset.description}
                      </p>
                    ) : null}
                    {cardTags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cardTags.map((tag) => (
                          <Badge key={tag} tone="muted">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      onClick={() => openEditPanel(asset)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Edit3 className="size-4" aria-hidden="true" />
                      {t("actions.edit")}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        aria-label={
                          asset.isEnabled
                            ? t("actions.disable")
                            : t("actions.enable")
                        }
                        className="size-9 px-0"
                        disabled={isSaving}
                        onClick={() => void updateAssetEnabled(asset)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {isSaving ? (
                          <LoaderCircle
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : asset.isEnabled ? (
                          <PowerOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Power className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        aria-label={t("actions.delete")}
                        className="size-9 px-0"
                        disabled={isSaving}
                        onClick={() => setDeletingAsset(asset)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog
        actionLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        description={t("confirm.delete", {
          name: deletingAsset?.name ?? ""
        })}
        loading={savingAssetId === deletingAsset?.id}
        onAction={() => void deleteAsset()}
        onOpenChange={(open) => {
          if (!open && savingAssetId !== deletingAsset?.id) {
            setDeletingAsset(null);
          }
        }}
        open={deletingAsset !== null}
        title={t("confirm.deleteTitle")}
      />

      {editingAsset ? (
        <div className="fixed inset-0 z-[60] flex min-h-dvh items-center justify-center overflow-y-auto bg-background/70 p-4 backdrop-blur-sm">
          <section
            aria-labelledby="admin-template-asset-form-title"
            aria-modal="true"
            className="grid max-h-[calc(100dvh-2rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
            role="dialog"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h2
                  className="text-lg font-semibold text-foreground"
                  id="admin-template-asset-form-title"
                >
                  {editingAsset.mode === "edit"
                    ? t("form.editTitle")
                    : t("form.createTitle")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t("form.description")}
                </p>
              </div>
              <Button
                aria-label={t("actions.cancel")}
                disabled={savingAssetId !== null}
                onClick={() => setEditingAsset(null)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </header>

            <div className="grid min-h-0 gap-5 overflow-y-auto px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid content-start gap-4">
                <FormSection
                  defaultOpen
                  summary={t("form.sections.basicSummary")}
                  title={t("form.sections.basicTitle")}
                >
                  <div className="grid gap-3 md:grid-cols-3">
                  <Field label={t("fields.setKind")}>
                    <select
                      className={selectClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          setKind: event.target.value,
                          setKey:
                            event.target.value === "COMMON"
                              ? "common"
                              : current.setKey,
                          setName:
                            event.target.value === "COMMON"
                              ? t("defaultSetName")
                              : current.setName
                        }))
                      }
                      value={form.setKind}
                    >
                      <option value="COMMON">{t("setKinds.COMMON")}</option>
                      <option value="TEMPLATE">{t("setKinds.TEMPLATE")}</option>
                    </select>
                  </Field>
                  <Field label={t("fields.setKey")}>
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          setKey: event.target.value
                        }))
                      }
                      value={form.setKey}
                    />
                  </Field>
                  <Field label={t("fields.setName")}>
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          setName: event.target.value
                        }))
                      }
                      value={form.setName}
                    />
                  </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                  <Field label={t("fields.primaryCategory")}>
                    <select
                      className={selectClassName}
                      onChange={(event) =>
                        updateFormPrimaryCategory(event.target.value)
                      }
                      value={form.primaryCategory}
                    >
                      <option value="">{t("filters.uncategorized")}</option>
                      {categories.map((category) => (
                        <option key={category.key} value={category.key}>
                          {getLocalizedAssetText(category.label, locale)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("fields.secondaryCategory")}>
                    <select
                      className={selectClassName}
                      disabled={!form.primaryCategory}
                      onChange={(event) =>
                        updateFormSecondaryCategory(event.target.value)
                      }
                      value={form.secondaryCategory}
                    >
                      <option value="">{t("filters.uncategorized")}</option>
                      {formSecondaries.map((category) => (
                        <option key={category.key} value={category.key}>
                          {getLocalizedAssetText(category.label, locale)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("fields.variant")}>
                    <select
                      className={selectClassName}
                      disabled={!form.secondaryCategory}
                      onChange={(event) => updateFormVariant(event.target.value)}
                      value={form.variantKey}
                    >
                      <option value="">{t("filters.uncategorized")}</option>
                      {formVariants.map((variant) => (
                        <option key={variant.key} value={variant.key}>
                          {getLocalizedAssetText(variant.label, locale)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("fields.name")}>
                    <input
                      className={inputClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                      value={form.name}
                    />
                  </Field>
                  <Field label={t("fields.sortOrder")}>
                    <input
                      className={inputClassName}
                      inputMode="numeric"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          sortOrder: event.target.value
                        }))
                      }
                      value={form.sortOrder}
                    />
                  </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                  <Field label={t("fields.reviewStatus")}>
                    <select
                      className={selectClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reviewStatus: event.target.value
                        }))
                      }
                      value={form.reviewStatus}
                    >
                      <option value="APPROVED">{t("reviewStatus.APPROVED")}</option>
                      <option value="PENDING_REVIEW">
                        {t("reviewStatus.PENDING_REVIEW")}
                      </option>
                      <option value="DRAFT">{t("reviewStatus.DRAFT")}</option>
                      <option value="REJECTED">{t("reviewStatus.REJECTED")}</option>
                    </select>
                  </Field>
                  <Field label={t("fields.source")}>
                    <select
                      className={selectClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          reviewStatus:
                            event.target.value === "AI_GENERATED"
                              ? "PENDING_REVIEW"
                              : current.reviewStatus,
                          source: event.target.value
                        }))
                      }
                      value={form.source}
                    >
                      <option value="MANUAL">{t("source.MANUAL")}</option>
                      <option value="AI_GENERATED">{t("source.AI_GENERATED")}</option>
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 pt-7 text-sm text-foreground">
                    <input
                      checked={form.isEnabled}
                      className="size-4 accent-accent"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          isEnabled: event.target.checked
                        }))
                      }
                      type="checkbox"
                    />
                    {t("fields.isEnabled")}
                  </label>
                  </div>
                  <Field label={t("fields.description")}>
                  <textarea
                    className={textareaClassName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                    rows={3}
                    value={form.description}
                  />
                  </Field>
                </FormSection>

                <FormSection
                  defaultOpen
                  summary={t("form.sections.discoverySummary")}
                  title={t("form.sections.discoveryTitle")}
                >
                  <div className="grid gap-3 md:grid-cols-3">
                  <Field label={t("fields.keywords")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          keywordsText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.keywordsText}
                    />
                  </Field>
                  <Field label={t("fields.synonyms")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          synonymsText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.synonymsText}
                    />
                  </Field>
                  <Field label={t("fields.tags")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          tagsText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.tagsText}
                    />
                  </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                  <Field label={t("fields.semanticTags")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          semanticTagsText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.semanticTagsText}
                    />
                  </Field>
                  <Field label={t("fields.pageTypes")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pageTypesText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.pageTypesText}
                    />
                  </Field>
                  <Field label={t("fields.usageScenarios")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          usageScenariosText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.usageScenariosText}
                    />
                  </Field>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                  <Field label={t("fields.styleTags")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          styleTagsText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.styleTagsText}
                    />
                  </Field>
                  <Field label={t("fields.colorTags")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          colorTagsText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.colorTagsText}
                    />
                  </Field>
                  <Field label={t("fields.backgroundModes")}>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          backgroundModesText: event.target.value
                        }))
                      }
                      rows={4}
                      value={form.backgroundModesText}
                    />
                  </Field>
                  </div>
                </FormSection>

                <FormSection
                  summary={t("form.sections.jsonSummary")}
                  title={t("form.sections.jsonTitle")}
                >
                  <div className="grid gap-3 xl:grid-cols-3">
                  <Field label={t("fields.style")}>
                    <textarea
                      className={cn(textareaClassName, "min-h-72 font-mono text-xs")}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          styleJson: event.target.value
                        }))
                      }
                      rows={16}
                      value={form.styleJson}
                    />
                  </Field>
                  <Field label={t("fields.resource")}>
                    <textarea
                      className={cn(textareaClassName, "min-h-72 font-mono text-xs")}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          resourceJson: event.target.value
                        }))
                      }
                      rows={16}
                      value={form.resourceJson}
                    />
                  </Field>
                  <Field label={t("fields.preview")}>
                    <textarea
                      className={cn(textareaClassName, "min-h-72 font-mono text-xs")}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          previewJson: event.target.value
                        }))
                      }
                      rows={16}
                      value={form.previewJson}
                    />
                  </Field>
                  </div>
                </FormSection>

                <FormSection
                  summary={t("form.sections.permissionsSummary")}
                  title={t("form.sections.permissionsTitle")}
                >
                  <fieldset className="grid gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:grid-cols-2 lg:grid-cols-3">
                    <legend className="px-1 text-sm font-medium text-foreground">
                      {t("fields.aiModifyPermissions")}
                    </legend>
                    {permissionFields.map((field) => (
                      <label
                        className="flex items-center gap-2 text-sm text-foreground"
                        key={field}
                      >
                        <input
                          checked={form[field]}
                          className="size-4 accent-accent"
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              [field]: event.target.checked
                            }))
                          }
                          type="checkbox"
                        />
                        {t(`permissions.${field}`)}
                      </label>
                    ))}
                  </fieldset>
                </FormSection>

                {formError ? (
                  <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                    {formError}
                  </p>
                ) : null}
              </div>
              <FormPreviewPanel
                asset={formPreviewAsset}
                categoryPath={getAssetCategoryPathLabel(
                  formPreviewAsset,
                  kind,
                  locale,
                  t("uncategorized")
                )}
                isEnabled={form.isEnabled}
                reviewStatusLabel={t(
                  `reviewStatus.${form.reviewStatus as TemplateElementAssetDto["reviewStatus"]}`
                )}
                setLabel={t("setMeta", {
                  name: form.setName || t("defaultSetName"),
                  type: t(`setKinds.${form.setKind as TemplateElementAssetDto["setKind"]}`)
                })}
                sourceLabel={t(
                  `source.${form.source as TemplateElementAssetDto["source"]}`
                )}
                reviewLabel={t("form.previewMeta.review")}
                setMetaLabel={t("form.previewMeta.set")}
                sourceMetaLabel={t("form.previewMeta.source")}
                statusLabel={
                  form.isEnabled ? t("status.enabled") : t("status.disabled")
                }
                title={t("form.previewTitle")}
              />
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                disabled={savingAssetId !== null}
                onClick={() => setEditingAsset(null)}
                type="button"
                variant="secondary"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                disabled={savingAssetId !== null}
                onClick={() => void saveAsset()}
                type="button"
              >
                {savingAssetId ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {savingAssetId ? t("actions.saving") : t("actions.save")}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function AssetPreview({ asset }: { asset: TemplateElementAssetDto }) {
  const style = asset.style;
  const resource = asset.resource;
  const preview = asset.preview;
  const strokeColor = readString(style.strokeColor) ?? "#2563eb";
  const fillColor = readString(style.fillColor) ?? "#dbeafe";
  const strokeWidth = readNumber(style.strokeWidth) ?? 2;
  const cornerRadius = readNumber(style.cornerRadius) ?? 10;

  return (
    <div className="grid aspect-[16/9] place-items-center overflow-hidden rounded-lg border border-border bg-background p-6">
      {asset.kind === "ICON" ? (
        <IconAssetPreview
          asset={asset}
          cornerRadius={cornerRadius}
          preview={preview}
          resource={resource}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          style={style}
        />
      ) : null}

      {asset.kind === "SHAPE" ? (
        <ShapeAssetPreview
          cornerRadius={cornerRadius}
          fillColor={fillColor}
          shape={resolveShapePreviewType(asset, preview, resource, style)}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : null}

      {asset.kind === "LINE" ? (
        <LineAssetPreview
          asset={asset}
          preview={preview}
          resource={resource}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          style={style}
        />
      ) : null}

      {asset.kind === "TEXT_STYLE" ? (
        <TextStyleAssetPreview
          asset={asset}
          preview={preview}
          resource={resource}
          style={style}
        />
      ) : null}

      {asset.kind === "CONTAINER" ? (
        <ContainerAssetPreview
          asset={asset}
          cornerRadius={cornerRadius}
          fillColor={fillColor}
          preview={preview}
          resource={resource}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          style={style}
        />
      ) : null}

      {asset.kind === "NAVIGATION" ? (
        <NavigationAssetPreview
          asset={asset}
          preview={preview}
          resource={resource}
          style={style}
        />
      ) : null}
    </div>
  );
}

type ShapePreviewType =
  | "arc"
  | "card"
  | "circle"
  | "diamond"
  | "ellipse"
  | "hexagon"
  | "parallelogram"
  | "pill"
  | "rect"
  | "roundedRect"
  | "sector"
  | "square"
  | "trapezoid"
  | "triangle";

function IconAssetPreview({
  asset,
  cornerRadius,
  preview,
  resource,
  strokeColor,
  strokeWidth,
  style
}: {
  asset: TemplateElementAssetDto;
  cornerRadius: number;
  preview: Record<string, unknown>;
  resource: Record<string, unknown>;
  strokeColor: string;
  strokeWidth: number;
  style: Record<string, unknown>;
}) {
  const iconKey =
    readString(preview.iconName) ??
    readString(resource.semanticKey) ??
    asset.variantKey ??
    "";
  const Icon = getSemanticIcon(iconKey, asset.primaryCategory, asset.secondaryCategory);
  const size = Math.min(54, Math.max(26, readNumber(style.size) ?? 36));

  return (
    <div
      className="grid size-24 place-items-center rounded-2xl border bg-surface"
      data-preview-kind="icon"
      data-preview-key={iconKey}
      style={{
        borderColor: strokeColor,
        borderRadius: cornerRadius,
        borderWidth: Math.max(1, strokeWidth),
        color: strokeColor
      }}
    >
      {createElement(Icon, {
        "aria-hidden": true,
        strokeWidth: Math.max(1.5, Math.min(3, strokeWidth)),
        style: {
          height: size,
          width: size
        }
      })}
    </div>
  );
}

function ShapeAssetPreview({
  cornerRadius,
  fillColor,
  shape,
  strokeColor,
  strokeWidth
}: {
  cornerRadius: number;
  fillColor: string;
  shape: ShapePreviewType;
  strokeColor: string;
  strokeWidth: number;
}) {
  const width = Math.max(1, strokeWidth);
  const roundedRadius = Math.min(18, Math.max(0, cornerRadius));
  const commonShapeProps = {
    fill: fillColor,
    stroke: strokeColor,
    strokeLinejoin: "round",
    strokeWidth: width,
    vectorEffect: "non-scaling-stroke"
  } as const;

  return (
    <svg
      className="h-28 w-48 overflow-visible"
      data-preview-shape={shape}
      role="img"
      viewBox="0 0 192 112"
    >
      {shape === "rect" ? (
        <rect height="64" width="88" x="52" y="24" {...commonShapeProps} />
      ) : null}
      {shape === "roundedRect" ? (
        <rect
          height="64"
          rx={roundedRadius}
          width="88"
          x="52"
          y="24"
          {...commonShapeProps}
        />
      ) : null}
      {shape === "square" ? (
        <rect height="72" width="72" x="60" y="20" {...commonShapeProps} />
      ) : null}
      {shape === "parallelogram" ? (
        <polygon points="68 24 148 24 124 88 44 88" {...commonShapeProps} />
      ) : null}
      {shape === "circle" ? (
        <circle cx="96" cy="56" r="36" {...commonShapeProps} />
      ) : null}
      {shape === "ellipse" ? (
        <ellipse cx="96" cy="56" rx="56" ry="32" {...commonShapeProps} />
      ) : null}
      {shape === "sector" ? (
        <path d="M96 56 L96 18 A38 38 0 0 1 134 56 Z" {...commonShapeProps} />
      ) : null}
      {shape === "arc" ? (
        <path
          d="M54 74 A54 54 0 0 1 150 74"
          fill="none"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeWidth={Math.max(4, width * 3)}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {shape === "triangle" ? (
        <polygon points="96 18 140 88 52 88" {...commonShapeProps} />
      ) : null}
      {shape === "diamond" ? (
        <polygon points="96 18 140 56 96 94 52 56" {...commonShapeProps} />
      ) : null}
      {shape === "trapezoid" ? (
        <polygon points="64 24 128 24 148 88 44 88" {...commonShapeProps} />
      ) : null}
      {shape === "hexagon" ? (
        <polygon points="64 24 128 24 152 56 128 88 64 88 40 56" {...commonShapeProps} />
      ) : null}
      {shape === "pill" ? (
        <rect height="42" rx="21" width="112" x="40" y="35" {...commonShapeProps} />
      ) : null}
      {shape === "card" ? (
        <rect
          height="68"
          rx={Math.max(8, roundedRadius)}
          width="116"
          x="38"
          y="22"
          {...commonShapeProps}
        />
      ) : null}
    </svg>
  );
}

function LineAssetPreview({
  asset,
  preview,
  resource,
  strokeColor,
  strokeWidth,
  style
}: {
  asset: TemplateElementAssetDto;
  preview: Record<string, unknown>;
  resource: Record<string, unknown>;
  strokeColor: string;
  strokeWidth: number;
  style: Record<string, unknown>;
}) {
  const lineType = resolveLinePreviewType(asset, preview, resource, style);
  const direction = resolveLineDirection(asset, preview, resource, style, lineType);
  const dash = resolveLineDash(asset, preview, resource, style);
  const startArrow = resolveLineArrowType(asset, preview, resource, style, "start");
  const endArrow = resolveLineArrowType(asset, preview, resource, style, "end");
  const arrowMarkerId = `line-arrow-${useId().replace(/:/g, "")}`;
  const paths = buildLinePreviewPaths(lineType, direction);
  const dashArray =
    lineType === "divider" && dash === "solid"
      ? "10 8"
      : toSvgDashArray(dash);
  const width = Math.max(1, strokeWidth);

  return (
    <svg
      className="h-28 w-48 overflow-visible text-accent-strong"
      data-preview-line={lineType}
      data-preview-direction={direction}
      data-preview-dash={dash}
      data-preview-end-arrow={endArrow}
      data-preview-start-arrow={startArrow}
      role="img"
      viewBox="0 0 192 112"
    >
      <defs>
        <marker
          id={arrowMarkerId}
          markerHeight="7"
          markerWidth="7"
          orient="auto-start-reverse"
          refX="9"
          refY="5"
          viewBox="0 0 10 10"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
        </marker>
      </defs>
      {paths.map((path, index) => {
        const receivesMarkers = index === paths.length - 1;

        return (
          <path
            d={path}
            data-preview-path={index === paths.length - 1 ? "main" : "secondary"}
            fill="none"
            key={path}
            markerEnd={
              receivesMarkers && endArrow !== "none"
                ? `url(#${arrowMarkerId})`
                : undefined
            }
            markerStart={
              receivesMarkers && startArrow !== "none"
                ? `url(#${arrowMarkerId})`
                : undefined
            }
            stroke={strokeColor}
            strokeDasharray={dashArray}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={width}
          />
        );
      })}
    </svg>
  );
}

function TextStyleAssetPreview({
  asset,
  preview,
  resource,
  style
}: {
  asset: TemplateElementAssetDto;
  preview: Record<string, unknown>;
  resource: Record<string, unknown>;
  style: Record<string, unknown>;
}) {
  const textRole = resolveTextStylePreviewRole(asset, preview, resource);
  const fontSize = readNumber(style.fontSize) ?? 22;
  const fontWeight = readNumber(style.fontWeight) ?? 600;
  const lineHeight = readNumber(style.lineHeight) ?? 1.25;
  const color = readString(style.color) ?? "#111827";
  const sampleText =
    readString(preview.sampleText) ?? getTextStyleSample(textRole, asset.name);
  const previewSize = Math.min(42, Math.max(11, fontSize));
  const textAlign = textRole.includes("footer") || textRole.includes("source")
    ? "right"
    : textRole.includes("bullet")
      ? "left"
      : "center";

  return (
    <div
      className={cn(
        "grid w-full gap-2",
        textAlign === "center" && "place-items-center text-center",
        textAlign === "left" && "place-items-start text-left",
        textAlign === "right" && "place-items-end text-right",
        textRole.includes("quote") && "rounded-lg border-l-4 border-accent bg-surface px-4 py-3",
        textRole.includes("tag") && "inline-flex justify-center"
      )}
      data-preview-text-role={textRole || "text"}
    >
      <p
        className={cn(
          "max-w-full truncate",
          textRole.includes("tag") && "rounded-full border border-accent/30 px-3 py-1",
          textRole.includes("number") && "font-mono",
          textRole.includes("bullet") && "before:mr-2 before:content-['•']",
          textRole.includes("subtitle") && "opacity-80",
          (textRole.includes("footer") || textRole.includes("source")) && "w-full border-t border-border pt-2"
        )}
        style={{
          color,
          fontSize: previewSize,
          fontWeight,
          lineHeight
        }}
      >
        {sampleText}
      </p>
      <p className="text-xs text-muted">
        {fontSize}px / {fontWeight}
      </p>
    </div>
  );
}

function ContainerAssetPreview({
  asset,
  cornerRadius,
  fillColor,
  preview,
  resource,
  strokeColor,
  strokeWidth,
  style
}: {
  asset: TemplateElementAssetDto;
  cornerRadius: number;
  fillColor: string;
  preview: Record<string, unknown>;
  resource: Record<string, unknown>;
  strokeColor: string;
  strokeWidth: number;
  style: Record<string, unknown>;
}) {
  const role = resolveContainerPreviewRole(asset, preview, resource);
  const contentTypes = readStringArray(style.allowedContentTypes);
  const autoLayout = readBoolean(style.autoLayout) || role.includes("column");
  const width = Math.min(190, Math.max(118, readNumber(style.recommendedWidth) ?? 170));
  const height = Math.min(118, Math.max(72, (readNumber(style.recommendedHeight) ?? 120) * 0.58));
  const isEmphasis = role.includes("highlight") || role.includes("warning") || role.includes("insight");

  return (
    <div
      className={cn(
        "grid content-center gap-2 border px-4 py-3 shadow-sm text-current",
        autoLayout && "grid-flow-col auto-cols-fr items-center",
        role.includes("quote") && "border-l-4 italic",
        role.includes("metric") && "place-items-center text-center",
        role.includes("list") && "content-start",
        role.includes("placeholder") && "place-items-center border-dashed",
        role.includes("conclusion") && "place-items-center text-center",
        isEmphasis && "border-l-4"
      )}
      data-preview-container={role}
      style={{
        backgroundColor: fillColor,
        borderColor: strokeColor,
        borderRadius: cornerRadius,
        borderWidth: Math.max(1, strokeWidth),
        height,
        width
      }}
    >
      {renderContainerContent(role, contentTypes)}
    </div>
  );
}

function NavigationAssetPreview({
  asset,
  preview,
  resource,
  style
}: {
  asset: TemplateElementAssetDto;
  preview: Record<string, unknown>;
  resource: Record<string, unknown>;
  style: Record<string, unknown>;
}) {
  const role = resolveNavigationPreviewRole(asset, preview, resource);
  const mode = resolveNavigationPreviewMode(asset, preview, resource, style, role);
  const activeColor = readString(style.activeColor) ?? "#2563eb";
  const inactiveColor = readString(style.inactiveColor) ?? "#94a3b8";

  return (
    <div
      className="grid w-48 gap-3"
      data-preview-mode={mode}
      data-preview-navigation={role}
    >
      {mode === "grid" ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <span
              className="h-7 rounded border"
              key={item}
              style={{
                backgroundColor: item === 1 ? `${activeColor}18` : "#f8fafc",
                borderColor: item === 1 ? activeColor : "#cbd5e1"
              }}
            />
          ))}
        </div>
      ) : null}
      {mode === "list" ? (
        <div className={cn("grid gap-2", role.includes("sidebar") && "grid-cols-[0.35rem_1fr]")}>
          {role.includes("sidebar") ? (
            <span className="row-span-3 rounded-full" style={{ backgroundColor: activeColor }} />
          ) : null}
          {[1, 2, 3].map((item) => (
            <span
              className="h-2.5 rounded"
              key={item}
              style={{
                backgroundColor: item === 1 ? activeColor : inactiveColor,
                opacity: item === 1 ? 1 : 0.35,
                width: `${92 - item * 14}%`
              }}
            />
          ))}
        </div>
      ) : null}
      {mode === "progress" ? (
        <div className="grid gap-3">
          {role.includes("dot") ? (
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4].map((item) => (
                <span
                  className="size-2.5 rounded-full"
                  key={item}
                  style={{
                    backgroundColor: item <= 2 ? activeColor : inactiveColor,
                    opacity: item <= 2 ? 1 : 0.35
                  }}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs font-medium text-muted">
                <span>01</span>
                <span>02</span>
                <span>03</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: `${inactiveColor}55` }}>
                <div className="h-full w-1/2 rounded-full" style={{ backgroundColor: activeColor }} />
              </div>
            </>
          )}
        </div>
      ) : null}
      {mode === "step" ? (
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((item) => (
            <span
              className="grid size-8 place-items-center rounded-full border text-xs font-semibold"
              key={item}
              style={{
                backgroundColor:
                  role.includes("completed") && item < 3
                    ? `${activeColor}22`
                    : "transparent",
                borderColor: item === 2 ? activeColor : inactiveColor,
                color: item === 2 || (role.includes("completed") && item < 3) ? activeColor : inactiveColor
              }}
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {mode === "label" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          <span className="h-2 w-12 rounded-full" style={{ backgroundColor: activeColor }} />
          <span className="text-xs font-semibold" style={{ color: activeColor }}>
            {role.includes("page") || role.includes("footer") ? "08 / 24" : "SECTION"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function resolveShapePreviewType(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>,
  style: Record<string, unknown>
): ShapePreviewType {
  const explicitShape = normalizeShapePreviewType(
    readString(preview.shape) ??
      readString(resource.shapeType) ??
      readString(style.shapeType) ??
      ""
  );
  const inferredShape = normalizeShapePreviewType(
    asset.variantKey ?? ""
  );

  if (
    inferredShape &&
    shouldInferSpecificShapeFromVariant(asset, inferredShape)
  ) {
    return inferredShape;
  }

  if (explicitShape && explicitShape !== "roundedRect") {
    return explicitShape;
  }

  return explicitShape ?? inferredShape ?? "roundedRect";
}

function shouldInferSpecificShapeFromVariant(
  asset: TemplateElementAssetDto,
  shape: ShapePreviewType
) {
  return (
    shape !== "roundedRect" &&
    shape !== "card" &&
    asset.primaryCategory === "basic-geometry"
  );
}

function normalizeShapePreviewType(value: string): ShapePreviewType | null {
  const shape = value.trim().toLowerCase();

  if (!shape) {
    return null;
  }

  if (
    shape.includes("rounded-rect") ||
    shape.includes("rounded_rect") ||
    shape.includes("roundedrect")
  ) {
    return "roundedRect";
  }

  if (shape.includes("parallelogram")) {
    return "parallelogram";
  }

  if (shape.includes("trapezoid")) {
    return "trapezoid";
  }

  if (shape.includes("hexagon")) {
    return "hexagon";
  }

  if (shape.includes("square")) {
    return "square";
  }

  if (shape.includes("sector") || shape.includes("pie")) {
    return "sector";
  }

  if (shape.includes("arc")) {
    return "arc";
  }

  if (shape.includes("circle") || shape.includes("dot")) {
    return "circle";
  }

  if (shape.includes("ellipse") || shape.includes("oval")) {
    return "ellipse";
  }

  if (shape.includes("pill")) {
    return "pill";
  }

  if (shape.includes("triangle")) {
    return "triangle";
  }

  if (shape.includes("diamond")) {
    return "diamond";
  }

  if (shape.includes("card") || shape.includes("block")) {
    return "card";
  }

  if (shape.includes("rect")) {
    return "rect";
  }

  return "roundedRect";
}

function resolveTextStylePreviewRole(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>
) {
  return normalizeTextStylePreviewRole(
    readString(resource.textRole) ??
      readString(preview.textRole) ??
      asset.variantKey ??
      ""
  );
}

function normalizeTextStylePreviewRole(value: string) {
  const role = value.trim().toLowerCase();

  if (!role) {
    return "text";
  }

  if (role.includes("cover-subtitle")) {
    return "cover-subtitle";
  }

  if (role.includes("cover-title")) {
    return "cover-title";
  }

  if (role.includes("chapter-title")) {
    return "chapter-title";
  }

  if (role.includes("page-title")) {
    return "page-title";
  }

  if (role.includes("section-heading")) {
    return "section-heading";
  }

  if (role.includes("label-heading")) {
    return "label-heading";
  }

  if (role.includes("bullet")) {
    return "bullet-point";
  }

  if (role.includes("annotation")) {
    return "annotation";
  }

  if (role.includes("quote")) {
    return "quote";
  }

  if (role.includes("tag")) {
    return "tag";
  }

  if (role.includes("number")) {
    return "number-emphasis";
  }

  if (role.includes("source")) {
    return "source-note";
  }

  if (role.includes("footer")) {
    return "footer";
  }

  if (role.includes("header")) {
    return "header";
  }

  if (role.includes("paragraph") || role.includes("body")) {
    return "paragraph";
  }

  return role;
}

function resolveContainerPreviewRole(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>
) {
  const explicitRole = normalizeContainerPreviewRole(
    readString(resource.containerRole) ??
      readString(preview.containerRole) ??
      ""
  );
  const inferredRole = normalizeContainerPreviewRole(asset.variantKey ?? "");

  if (inferredRole !== "container") {
    return inferredRole;
  }

  if (explicitRole !== "container") {
    return explicitRole;
  }

  return normalizeContainerPreviewRole(readString(preview.shape) ?? "container");
}

function normalizeContainerPreviewRole(value: string) {
  const role = value.trim().toLowerCase();

  if (!role) {
    return "container";
  }

  if (role.includes("body-text-area") || role.includes("body-container")) {
    return "body-text-area";
  }

  if (role.includes("quote")) {
    return "quote-box";
  }

  if (role.includes("conclusion") || role.includes("summary")) {
    return "conclusion-box";
  }

  if (role.includes("image-text")) {
    return "image-text-card";
  }

  if (role.includes("image") || role.includes("picture")) {
    return "image-area";
  }

  if (role.includes("chart")) {
    return "chart-area";
  }

  if (role.includes("placeholder")) {
    return "placeholder";
  }

  if (role.includes("metric")) {
    return "metric-card";
  }

  if (role.includes("comparison-column")) {
    return "comparison-columns";
  }

  if (role.includes("three-column")) {
    return "three-column";
  }

  if (role.includes("two-column") || role === "columns") {
    return "two-column";
  }

  if (role.includes("numbered-list")) {
    return "numbered-list";
  }

  if (role.includes("check-list")) {
    return "check-list";
  }

  if (role.includes("bullet-list") || role.includes("list")) {
    return "bullet-list";
  }

  if (role.includes("warning")) {
    return "warning-box";
  }

  if (role.includes("insight")) {
    return "insight-box";
  }

  if (role.includes("highlight")) {
    return "highlight-box";
  }

  return role === "container" ? "container" : role;
}

function resolveNavigationPreviewRole(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>
) {
  const explicitRole = normalizeNavigationPreviewRole(
    readString(resource.navigationRole) ??
      readString(preview.navigationRole) ??
      ""
  );
  const inferredRole = normalizeNavigationPreviewRole(asset.variantKey ?? "");

  if (inferredRole !== "navigation") {
    return inferredRole;
  }

  if (explicitRole !== "navigation") {
    return explicitRole;
  }

  return normalizeNavigationPreviewRole(readString(preview.shape) ?? "navigation");
}

function normalizeNavigationPreviewRole(value: string) {
  const role = value.trim().toLowerCase();

  if (!role) {
    return "navigation";
  }

  if (role.includes("toc-sidebar")) {
    return "toc-sidebar";
  }

  if (role.includes("toc-grid") || role.includes("grid-navigation")) {
    return "toc-grid";
  }

  if (role.includes("toc-list") || role.includes("toc-navigation")) {
    return "toc-list";
  }

  if (role.includes("page-total")) {
    return "page-total";
  }

  if (role.includes("page-number")) {
    return "page-number";
  }

  if (role.includes("footer-index")) {
    return "footer-index";
  }

  if (role.includes("dot-progress")) {
    return "dot-progress";
  }

  if (role.includes("chapter-progress")) {
    return "chapter-progress";
  }

  if (role.includes("linear-progress") || role === "progress") {
    return "linear-progress";
  }

  if (role.includes("completed-step")) {
    return "completed-step";
  }

  if (role.includes("current-step")) {
    return "current-step";
  }

  if (role.includes("step-number") || role.includes("step-navigation")) {
    return "step-number";
  }

  if (role.includes("chapter-title")) {
    return "chapter-title";
  }

  if (role.includes("section-divider")) {
    return "section-divider";
  }

  if (role.includes("current-section")) {
    return "current-section";
  }

  return role === "navigation" ? "navigation" : role;
}

function resolveNavigationPreviewMode(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>,
  style: Record<string, unknown>,
  role: string
) {
  const explicitMode = readString(style.displayMode) ?? readString(preview.displayMode);

  if (explicitMode) {
    return explicitMode;
  }

  const value = [
    role,
    asset.variantKey,
    asset.secondaryCategory,
    readString(resource.navigationRole),
    readString(preview.shape)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (value.includes("grid")) {
    return "grid";
  }

  if (value.includes("toc") || value.includes("sidebar")) {
    return "list";
  }

  if (value.includes("progress")) {
    return "progress";
  }

  if (value.includes("step")) {
    return "step";
  }

  return "label";
}

type LinePreviewType =
  | "arc"
  | "arrow"
  | "curve"
  | "diagonal"
  | "divider"
  | "double"
  | "elbow"
  | "polyline"
  | "straight"
  | "vertical"
  | "wave";

type LineDirection =
  | "arc"
  | "curve"
  | "diagonal"
  | "down"
  | "horizontal"
  | "left"
  | "polyline"
  | "right"
  | "up"
  | "vertical"
  | "wave";

function resolveLinePreviewType(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>,
  style: Record<string, unknown>
): LinePreviewType {
  const value = [
    readString(preview.lineType),
    readString(resource.connectorType),
    readString(style.connectorType),
    asset.variantKey
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (value.includes("no-arrow")) {
    return "straight";
  }

  if (value.includes("vertical")) {
    return "vertical";
  }

  if (value.includes("diagonal")) {
    return "diagonal";
  }

  if (value.includes("polyline")) {
    return "polyline";
  }

  if (value.includes("elbow")) {
    return "elbow";
  }

  if (value.includes("curve")) {
    return "curve";
  }

  if (value.includes("arc")) {
    return "arc";
  }

  if (value.includes("wave")) {
    return "wave";
  }

  if (value.includes("double")) {
    return "double";
  }

  if (value.includes("divider")) {
    return "divider";
  }

  if (
    value.includes("arrow") ||
    readString(resource.endArrowType) === "triangle" ||
    readString(style.endArrowType) === "triangle"
  ) {
    return "arrow";
  }

  return "straight";
}

function resolveLineDirection(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>,
  style: Record<string, unknown>,
  lineType: LinePreviewType
): LineDirection {
  const value = [
    readString(preview.direction),
    readString(resource.direction),
    readString(style.direction),
    asset.variantKey,
    readString(preview.lineType),
    readString(resource.connectorType),
    readString(style.connectorType)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (value.includes("left-arrow") || value.includes("return")) {
    return "left";
  }

  if (value.includes("up-arrow")) {
    return "up";
  }

  if (value.includes("down-arrow")) {
    return "down";
  }

  if (value.includes("right") || value.includes("one-way")) {
    return "right";
  }

  if (value.includes("vertical") || lineType === "vertical") {
    return "vertical";
  }

  if (value.includes("diagonal") || lineType === "diagonal") {
    return "diagonal";
  }

  if (value.includes("polyline") || lineType === "polyline" || lineType === "elbow") {
    return "polyline";
  }

  if (value.includes("curve") || lineType === "curve") {
    return "curve";
  }

  if (value.includes("arc") || lineType === "arc") {
    return "arc";
  }

  if (value.includes("wave") || lineType === "wave") {
    return "wave";
  }

  return "horizontal";
}

function resolveLineDash(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>,
  style: Record<string, unknown>
) {
  const value = [
    readString(preview.dash),
    readString(resource.dash),
    readString(style.dash),
    asset.variantKey
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (value.includes("dot")) {
    return "dot";
  }

  if (value.includes("dash") || value.includes("draft")) {
    return "dash";
  }

  return "solid";
}

function resolveLineArrowType(
  asset: TemplateElementAssetDto,
  preview: Record<string, unknown>,
  resource: Record<string, unknown>,
  style: Record<string, unknown>,
  edge: "end" | "start"
) {
  const variantKey = asset.variantKey?.toLowerCase() ?? "";

  if (variantKey.includes("no-arrow")) {
    return "none";
  }

  if (edge === "start" && variantKey.includes("two-way")) {
    return "triangle";
  }

  const field = edge === "start" ? "startArrowType" : "endArrowType";
  const explicit =
    readString(preview[field]) ??
    readString(resource[field]) ??
    readString(style[field]);

  if (explicit) {
    return explicit;
  }

  if (
    edge === "end" &&
    (variantKey.includes("arrow") ||
      variantKey.includes("flow") ||
      variantKey.includes("route") ||
      variantKey.includes("dependency"))
  ) {
    return "triangle";
  }

  if (
    edge === "start" &&
    (variantKey.includes("cycle") || variantKey.includes("loop"))
  ) {
    return "triangle";
  }

  return "none";
}

function buildLinePreviewPaths(lineType: LinePreviewType, direction: LineDirection) {
  if (lineType === "double") {
    return ["M28 48 H164", "M28 64 H164"];
  }

  if (lineType === "wave" || direction === "wave") {
    return ["M24 58 C46 28 62 88 84 58 S122 28 144 58 S166 88 184 58"];
  }

  if (lineType === "curve" || direction === "curve") {
    return ["M30 78 C70 20 122 20 162 78"];
  }

  if (lineType === "arc" || direction === "arc") {
    return ["M34 76 A62 46 0 0 1 158 76"];
  }

  if (lineType === "polyline" || lineType === "elbow" || direction === "polyline") {
    return ["M30 38 H96 V76 H162"];
  }

  if (direction === "up") {
    return ["M96 88 V24"];
  }

  if (direction === "down") {
    return ["M96 24 V88"];
  }

  if (lineType === "vertical" || direction === "vertical") {
    return ["M96 24 V88"];
  }

  if (lineType === "diagonal" || direction === "diagonal") {
    return ["M36 82 L156 30"];
  }

  if (direction === "left") {
    return ["M164 56 H28"];
  }

  return ["M28 56 H164"];
}

function toSvgDashArray(value: string) {
  if (value === "dash" || value === "dashed") {
    return "10 8";
  }

  if (value === "dot" || value === "dotted") {
    return "2 7";
  }

  return undefined;
}

function getSemanticIcon(
  iconKey: string,
  primaryCategory: string | null,
  secondaryCategory: string | null
): LucideIcon {
  const key = iconKey.toLowerCase();
  const directIcon = semanticIconMap[key];

  if (directIcon) {
    return directIcon;
  }

  const category = `${primaryCategory ?? ""} ${secondaryCategory ?? ""}`.toLowerCase();

  if (category.includes("navigation") || category.includes("direction")) {
    return ArrowRight;
  }

  if (category.includes("status") || category.includes("feedback")) {
    return Info;
  }

  if (category.includes("time") || category.includes("progress")) {
    return Clock;
  }

  if (category.includes("data") || category.includes("metric") || category.includes("chart")) {
    return BarChart3;
  }

  if (category.includes("business") || category.includes("finance")) {
    return Briefcase;
  }

  if (category.includes("people") || category.includes("organization")) {
    return Users;
  }

  if (category.includes("security") || category.includes("compliance")) {
    return Shield;
  }

  return Package;
}

const semanticIconMap: Record<string, LucideIcon> = {
  abnormal: AlertCircle,
  account: User,
  add: Plus,
  analysis: BarChart3,
  back: ArrowLeft,
  calendar: CalendarDays,
  chart: BarChart3,
  clock: Clock,
  close: X,
  completed: CircleCheck,
  contract: FileText,
  copy: Copy,
  cost: Wallet,
  data: Database,
  database: Database,
  date: CalendarDays,
  deadline: CalendarDays,
  delay: Clock,
  delete: Trash2,
  disabled: PowerOff,
  download: Download,
  edit: Edit3,
  enabled: Power,
  error: CircleX,
  export: Share2,
  failure: CircleX,
  filter: Filter,
  forward: ArrowRight,
  growth: TrendingUp,
  home: Home,
  import: Import,
  info: Info,
  insight: Lightbulb,
  location: MapPin,
  loading: RefreshCcw,
  menu: Menu,
  money: Wallet,
  more: MoreHorizontal,
  paused: Minus,
  paste: FileText,
  plan: Flag,
  print: Printer,
  processing: Zap,
  progress: Gauge,
  question: CircleHelp,
  refresh: RefreshCcw,
  reminder: Bell,
  report: FileText,
  risk: CircleAlert,
  safe: Shield,
  save: Save,
  search: Search,
  share: Share2,
  success: CircleCheck,
  table: Table2,
  target: Target,
  time: Clock,
  top: ArrowUp,
  trend: TrendingUp,
  unavailable: PowerOff,
  upload: Upload,
  warning: CircleAlert,
  zoom: ZoomIn
};

function getTextStyleSample(textRole: string, fallback: string) {
  if (textRole.includes("cover-subtitle")) {
    return "战略简报副标题";
  }

  if (textRole.includes("number")) {
    return "128%";
  }

  if (textRole.includes("bullet")) {
    return "关键要点";
  }

  if (textRole.includes("tag")) {
    return "标签";
  }

  if (textRole.includes("quote")) {
    return "关键引用";
  }

  if (textRole.includes("footer") || textRole.includes("source")) {
    return "来源说明";
  }

  if (textRole.includes("annotation")) {
    return "注释说明";
  }

  if (textRole.includes("title") || textRole.includes("heading")) {
    return "标题层级";
  }

  if (textRole.includes("paragraph")) {
    return "正文段落";
  }

  return fallback || "正文样式";
}

function renderContainerContent(role: string, contentTypes: string[]) {
  if (role.includes("placeholder")) {
    return (
      <span
        className="grid size-14 place-items-center rounded border border-dashed border-current/35 text-xs text-muted"
        data-preview-container-content="placeholder"
      >
        +
      </span>
    );
  }

  if (role.includes("metric") || contentTypes.includes("metric")) {
    return (
      <>
        <span className="text-lg font-bold text-accent-strong" data-preview-container-content="metric">24%</span>
        <span className="h-2 w-16 rounded bg-current/20" />
      </>
    );
  }

  if (role.includes("image-text")) {
    return (
      <>
        <span className="h-12 rounded bg-current/15" data-preview-container-content="image-text" />
        <span className="grid gap-1">
          <span className="h-2 w-16 rounded bg-current/25" />
          <span className="h-2 w-12 rounded bg-current/15" />
        </span>
      </>
    );
  }

  if (role.includes("image") || contentTypes.includes("image")) {
    return (
      <>
        <span className="h-10 rounded bg-current/15" data-preview-container-content="image" />
        <span className="h-2 w-24 rounded bg-current/20" />
      </>
    );
  }

  if (role.includes("chart") || contentTypes.includes("chart")) {
    return (
      <span className="flex h-12 items-end gap-1" data-preview-container-content="chart">
        {[18, 28, 38, 24].map((height) => (
          <span
            className="w-5 rounded-t bg-current/25"
            key={height}
            style={{ height }}
          />
        ))}
      </span>
    );
  }

  if (role.includes("column")) {
    return (
      <>
        <span className="h-16 rounded bg-current/10" data-preview-container-content="columns" />
        <span className="h-16 rounded bg-current/15" />
      </>
    );
  }

  if (role.includes("list") || role.includes("check")) {
    return (
      <>
        {[1, 2, 3].map((item) => (
          <span className="flex items-center gap-2" data-preview-container-content={item === 1 ? "list" : undefined} key={item}>
            <span className={cn("size-2 bg-current/35", role.includes("check") ? "rounded-sm" : "rounded-full")} />
            <span className="h-2 w-20 rounded bg-current/15" />
          </span>
        ))}
      </>
    );
  }

  if (role.includes("quote")) {
    return (
      <>
        <span className="h-2 w-28 rounded bg-current/20" data-preview-container-content="quote" />
        <span className="h-2 w-20 rounded bg-current/15" />
      </>
    );
  }

  if (role.includes("conclusion")) {
    return (
      <>
        <span className="h-3 w-24 rounded bg-current/25" data-preview-container-content="conclusion" />
        <span className="h-2 w-16 rounded bg-current/15" />
      </>
    );
  }

  if (role.includes("warning") || role.includes("highlight") || role.includes("insight")) {
    return (
      <>
        <span className="h-2 w-24 rounded bg-current/25" data-preview-container-content="emphasis" />
        <span className="h-2 w-28 rounded bg-current/15" />
      </>
    );
  }

  return (
    <>
      <span className="h-2 w-20 rounded bg-current/20" data-preview-container-content="body" />
      <span className="h-2 w-32 rounded bg-current/15" />
      <span className="h-2 w-24 rounded bg-current/10" />
    </>
  );
}

function FormSection({
  children,
  defaultOpen = false,
  summary,
  title
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  summary: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      className="group rounded-lg border border-border bg-surface-muted/70 open:bg-surface-muted"
      open={isOpen}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden"
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((current) => !current);
        }}
      >
        <span className="grid gap-1">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-xs leading-5 text-muted">{summary}</span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="grid gap-4 border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

function FormPreviewPanel({
  asset,
  categoryPath,
  isEnabled,
  reviewLabel,
  reviewStatusLabel,
  setMetaLabel,
  setLabel,
  sourceMetaLabel,
  sourceLabel,
  statusLabel,
  title
}: {
  asset: TemplateElementAssetDto;
  categoryPath: string;
  isEnabled: boolean;
  reviewLabel: string;
  reviewStatusLabel: string;
  setMetaLabel: string;
  setLabel: string;
  sourceMetaLabel: string;
  sourceLabel: string;
  statusLabel: string;
  title: string;
}) {
  return (
    <aside
      aria-label={title}
      className="grid content-start gap-3 lg:sticky lg:top-0"
    >
      <div className="grid gap-3 rounded-lg border border-border bg-surface-muted p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <Badge tone={isEnabled ? "success" : "muted"}>{statusLabel}</Badge>
        </div>
        <AssetPreview asset={asset} />
        <p className="text-xs leading-5 text-muted">{categoryPath}</p>
        <dl className="grid gap-2 border-t border-border pt-3 text-xs">
          <PreviewMetaRow label={setMetaLabel} value={setLabel} />
          <PreviewMetaRow label={reviewLabel} value={reviewStatusLabel} />
          <PreviewMetaRow label={sourceMetaLabel} value={sourceLabel} />
        </dl>
      </div>
    </aside>
  );
}

function PreviewMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}

function Badge({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "muted" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        tone === "muted" && "bg-surface-muted text-muted",
        tone === "success" && "bg-accent-soft text-accent-strong",
        tone === "warning" && "bg-warning/10 text-warning"
      )}
    >
      {children}
    </span>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function FilterField({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

function assetMatchesCategory(
  asset: TemplateElementAssetDto,
  selection: TemplateAssetCategorySelection
) {
  return (
    (!selection.primaryCategory ||
      asset.primaryCategory === selection.primaryCategory) &&
    (!selection.secondaryCategory ||
      asset.secondaryCategory === selection.secondaryCategory) &&
    (!selection.variantKey || asset.variantKey === selection.variantKey)
  );
}

function getAssetCategoryPathLabel(
  asset: TemplateElementAssetDto,
  kind: TemplateElementAssetKind,
  locale: string,
  fallback: string
) {
  const path = findTemplateAssetCategoryPath(kind, {
    primaryCategory: asset.primaryCategory,
    secondaryCategory: asset.secondaryCategory,
    variantKey: asset.variantKey
  });

  if (!path.primary || !path.secondary || !path.variant) {
    return fallback;
  }

  return [
    getLocalizedAssetText(path.primary.label, locale),
    getLocalizedAssetText(path.secondary.label, locale),
    getLocalizedAssetText(path.variant.label, locale)
  ].join(" / ");
}

function getAssetSearchValues({
  asset,
  backgroundModeLabels,
  categoryPathLabel,
  templateCategoryLabel
}: {
  asset: TemplateElementAssetDto;
  backgroundModeLabels: Record<string, string>;
  categoryPathLabel: string;
  templateCategoryLabel: (pageType: string) => string | null;
}) {
  return [
    asset.name,
    asset.description ?? "",
    categoryPathLabel,
    ...asset.tags,
    ...asset.semanticTags,
    ...asset.keywords,
    ...asset.synonyms,
    ...asset.pageTypes.flatMap((pageType) => [
      pageType,
      templateCategoryLabel(pageType) ?? ""
    ]),
    ...asset.usageScenarios,
    ...asset.styleTags,
    ...asset.colorTags,
    ...asset.backgroundModes.flatMap((backgroundMode) => [
      backgroundMode,
      backgroundModeLabels[backgroundMode] ?? ""
    ]),
    asset.setName,
    asset.setKey
  ];
}

function getAssetCardTags(
  asset: TemplateElementAssetDto,
  categoryPathLabel: string
) {
  const normalizedCategoryPath = categoryPathLabel.toLowerCase();
  const tags: string[] = [];

  for (const tag of [...asset.semanticTags, ...asset.tags]) {
    const normalizedTag = tag.trim().toLowerCase();

    if (
      !normalizedTag ||
      normalizedCategoryPath.includes(normalizedTag) ||
      tags.some((current) => current.toLowerCase() === normalizedTag)
    ) {
      continue;
    }

    tags.push(tag);

    if (tags.length === 3) {
      break;
    }
  }

  return tags;
}

function buildPreviewAssetFromForm(
  form: AssetFormState,
  kind: TemplateElementAssetKind,
  name: string
): TemplateElementAssetDto {
  const preview = readJsonObject(form.previewJson) ?? {};
  const resource = readJsonObject(form.resourceJson) ?? {};
  const style = readJsonObject(form.styleJson) ?? {};

  return {
    aiModifyPermissions: {
      allowAutoLayout: form.allowAutoLayout,
      allowMove: form.allowMove,
      allowRecolor: form.allowRecolor,
      allowResize: form.allowResize,
      allowStretch: form.allowStretch,
      allowTextShrink: form.allowTextShrink
    },
    backgroundModes: readLines(form.backgroundModesText),
    colorTags: readLines(form.colorTagsText),
    createdAt: "",
    description: form.description || null,
    detail: buildAssetDetailFromForm(kind, style, resource, preview),
    id: "preview",
    isEnabled: form.isEnabled,
    keywords: readLines(form.keywordsText),
    kind,
    name,
    pageTypes: readLines(form.pageTypesText),
    preview,
    primaryCategory: form.primaryCategory || null,
    resource,
    reviewStatus: form.reviewStatus as TemplateElementAssetDto["reviewStatus"],
    semanticTags: readLines(form.semanticTagsText),
    secondaryCategory: form.secondaryCategory || null,
    setKey: form.setKey,
    setKind: form.setKind as TemplateElementAssetDto["setKind"],
    setName: form.setName,
    sortOrder: Number(form.sortOrder) || 0,
    source: form.source as TemplateElementAssetDto["source"],
    style,
    styleTags: readLines(form.styleTagsText),
    synonyms: readLines(form.synonymsText),
    tags: readLines(form.tagsText),
    updatedAt: "",
    usageScenarios: readLines(form.usageScenariosText),
    variantKey: form.variantKey || null
  };
}

function buildAssetFormState(
  asset: TemplateElementAssetDto | null,
  kind: TemplateElementAssetKind,
  t: ReturnType<typeof useTranslations>,
  locale?: string
): AssetFormState {
  const defaults = buildDefaultAsset(kind, t, locale);
  const permissions =
    asset?.aiModifyPermissions ?? defaults.aiModifyPermissions;

  return {
    allowAutoLayout: permissions.allowAutoLayout,
    allowMove: permissions.allowMove,
    allowRecolor: permissions.allowRecolor,
    allowResize: permissions.allowResize,
    allowStretch: permissions.allowStretch,
    allowTextShrink: permissions.allowTextShrink,
    backgroundModesText: (
      asset?.backgroundModes ?? defaults.backgroundModes
    ).join("\n"),
    colorTagsText: (asset?.colorTags ?? defaults.colorTags).join("\n"),
    description: asset?.description ?? defaults.description,
    isEnabled: asset?.isEnabled ?? true,
    keywordsText: (asset?.keywords ?? defaults.keywords).join("\n"),
    name: asset?.name ?? defaults.name,
    pageTypesText: (asset?.pageTypes ?? defaults.pageTypes).join("\n"),
    previewJson: stringifyJson(asset?.preview ?? defaults.preview),
    primaryCategory:
      asset?.primaryCategory ?? defaults.primaryCategory ?? "",
    resourceJson: stringifyJson(asset?.resource ?? defaults.resource),
    reviewStatus: asset?.reviewStatus ?? defaults.reviewStatus,
    semanticTagsText: (asset?.semanticTags ?? defaults.semanticTags).join("\n"),
    secondaryCategory:
      asset?.secondaryCategory ?? defaults.secondaryCategory ?? "",
    setKey: asset?.setKey ?? defaults.setKey,
    setKind: asset?.setKind ?? defaults.setKind,
    setName: asset?.setName ?? defaults.setName,
    source: asset?.source ?? defaults.source,
    sortOrder: String(asset?.sortOrder ?? defaults.sortOrder),
    styleJson: stringifyJson(asset?.style ?? defaults.style),
    styleTagsText: (asset?.styleTags ?? defaults.styleTags).join("\n"),
    synonymsText: (asset?.synonyms ?? defaults.synonyms).join("\n"),
    tagsText: (asset?.tags ?? defaults.tags).join("\n"),
    usageScenariosText: (asset?.usageScenarios ?? defaults.usageScenarios).join(
      "\n"
    ),
    variantKey: asset?.variantKey ?? defaults.variantKey ?? ""
  };
}

function buildDefaultAsset(
  kind: TemplateElementAssetKind,
  t: ReturnType<typeof useTranslations>,
  locale?: string
) {
  const workspaceKind = workspaceKindMap[kind];
  const selection = getDefaultTemplateAssetCategorySelection(kind);
  const preset = buildTemplateAssetCategoryPreset(kind, selection, locale);

  if (preset) {
    return {
      ...preset,
      ...buildDefaultAssetMetadata(kind, t),
      keywords: preset.semanticTags,
      pageTypes: ["cover-title", "title-body-points", "process-steps"],
      resource: preset.resource,
      styleTags: preset.tags.slice(1),
      synonyms: preset.semanticTags.slice(0, 3),
      sortOrder: 0
    };
  }

  if (kind === "ICON") {
    return {
      ...buildDefaultAssetMetadata(kind, t),
      description: t("icons.defaultDescription"),
      keywords: ["idea", "concept", "feature"],
      name: t("icons.defaultName"),
      pageTypes: ["title-body-points", "process-steps", "key-metrics"],
      preview: {
        iconName: "idea",
        shape: "lineIcon"
      },
      primaryCategory: null,
      semanticTags: ["idea", "concept", "feature"],
      secondaryCategory: null,
      sortOrder: 0,
      style: {
        cornerRadius: 12,
        fillMode: "none",
        strokeColor: "#2563eb",
        strokeWidth: 2
      },
      styleTags: ["minimal", "line"],
      synonyms: ["idea", "concept"],
      tags: [t(`${workspaceKind}.shortName`)],
      usageScenarios: ["feature", "process", "metric"],
      variantKey: null
    };
  }

  if (kind === "SHAPE") {
    return {
      ...buildDefaultAssetMetadata(kind, t),
      description: t("shapes.defaultDescription"),
      keywords: ["container", "highlight", "background"],
      name: t("shapes.defaultName"),
      pageTypes: ["title-body-points", "two-column-compare"],
      preview: {
        shape: "roundedRect"
      },
      primaryCategory: null,
      semanticTags: ["container", "highlight", "background"],
      secondaryCategory: null,
      sortOrder: 0,
      style: {
        cornerRadius: 14,
        fillColor: "#dbeafe",
        strokeColor: "#2563eb",
        strokeWidth: 1
      },
      styleTags: ["minimal", "container"],
      synonyms: ["card", "box"],
      tags: [t(`${workspaceKind}.shortName`)],
      usageScenarios: ["card", "section", "emphasis"],
      variantKey: null
    };
  }

  if (kind === "TEXT_STYLE") {
    return {
      ...buildDefaultAssetMetadata(kind, t),
      description: t("textStyles.defaultDescription"),
      keywords: ["title", "body", "typography"],
      name: t("textStyles.defaultName"),
      pageTypes: ["cover-title", "title-body-points"],
      preview: {
        sampleText: t("textStyles.shortName"),
        shape: "textStyle"
      },
      primaryCategory: null,
      semanticTags: ["title", "body", "typography"],
      secondaryCategory: null,
      sortOrder: 0,
      style: {
        color: "#111827",
        fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.25,
        maxLines: 2
      },
      styleTags: ["minimal", "business"],
      synonyms: ["font", "text"],
      tags: [t(`${workspaceKind}.shortName`)],
      usageScenarios: ["title", "body", "quote"],
      variantKey: null
    };
  }

  if (kind === "CONTAINER") {
    return {
      ...buildDefaultAssetMetadata(kind, t),
      description: t("containers.defaultDescription"),
      keywords: ["card", "container", "content"],
      name: t("containers.defaultName"),
      pageTypes: ["title-body-points", "two-column-compare"],
      preview: {
        shape: "container"
      },
      primaryCategory: null,
      semanticTags: ["card", "container", "content"],
      secondaryCategory: null,
      sortOrder: 0,
      style: {
        allowedContentTypes: ["text"],
        fillColor: "#f8fafc",
        padding: 18,
        recommendedHeight: 160,
        recommendedWidth: 320,
        strokeColor: "#cbd5e1",
        strokeWidth: 1
      },
      styleTags: ["minimal", "card"],
      synonyms: ["box", "panel"],
      tags: [t(`${workspaceKind}.shortName`)],
      usageScenarios: ["card", "summary", "comparison"],
      variantKey: null
    };
  }

  if (kind === "NAVIGATION") {
    return {
      ...buildDefaultAssetMetadata(kind, t),
      description: t("navigation.defaultDescription"),
      keywords: ["toc", "page number", "progress"],
      name: t("navigation.defaultName"),
      pageTypes: ["chapter", "title-body-points"],
      preview: {
        shape: "navigation"
      },
      primaryCategory: null,
      semanticTags: ["navigation", "progress", "page"],
      secondaryCategory: null,
      sortOrder: 0,
      style: {
        activeColor: "#2563eb",
        fixedPosition: "bottom",
        inactiveColor: "#94a3b8",
        showOnCover: false,
        showOnEnding: false
      },
      styleTags: ["minimal", "progress"],
      synonyms: ["toc", "pager"],
      tags: [t(`${workspaceKind}.shortName`)],
      usageScenarios: ["directory", "chapter", "progress"],
      variantKey: null
    };
  }

  return {
    ...buildDefaultAssetMetadata(kind, t),
    description: t("lines.defaultDescription"),
    keywords: ["connector", "divider", "flow"],
    name: t("lines.defaultName"),
    pageTypes: ["process-steps", "time-axis"],
    preview: {
      lineType: "arrow"
    },
    primaryCategory: null,
    semanticTags: ["connector", "divider", "flow"],
    secondaryCategory: null,
    sortOrder: 0,
    style: {
      cap: "round",
      strokeColor: "#2563eb",
      strokeWidth: 2
    },
    styleTags: ["minimal", "connector"],
    synonyms: ["arrow", "line"],
    tags: [t(`${workspaceKind}.shortName`)],
    usageScenarios: ["process", "timeline", "relationship"],
    variantKey: null
  };
}

function buildDefaultAssetMetadata(
  kind: TemplateElementAssetKind,
  t: ReturnType<typeof useTranslations>
) {
  return {
    aiModifyPermissions: buildDefaultPermissions(kind),
    backgroundModes: ["light", "dark"],
    colorTags: ["blue", "neutral"],
    resource: {},
    reviewStatus: "APPROVED",
    setKey: "common",
    setKind: "COMMON",
    setName: t("defaultSetName"),
    source: "MANUAL"
  };
}

function buildDefaultPermissions(kind: TemplateElementAssetKind) {
  return {
    allowAutoLayout: kind === "CONTAINER" || kind === "NAVIGATION",
    allowMove: true,
    allowRecolor: true,
    allowResize: true,
    allowStretch: kind === "SHAPE" || kind === "CONTAINER",
    allowTextShrink: kind === "TEXT_STYLE"
  };
}

function parseAssetForm(form: AssetFormState, kind: TemplateElementAssetKind) {
  const resource = readJsonObject(form.resourceJson);
  const style = readJsonObject(form.styleJson);
  const preview = readJsonObject(form.previewJson);

  if (!resource || !style || !preview) {
    return null;
  }

  return {
    aiModifyPermissions: {
      allowAutoLayout: form.allowAutoLayout,
      allowMove: form.allowMove,
      allowRecolor: form.allowRecolor,
      allowResize: form.allowResize,
      allowStretch: form.allowStretch,
      allowTextShrink: form.allowTextShrink
    },
    backgroundModes: readLines(form.backgroundModesText),
    colorTags: readLines(form.colorTagsText),
    description: form.description.trim() || null,
    detail: buildAssetDetailFromForm(kind, style, resource, preview),
    isEnabled: form.isEnabled,
    kind,
    keywords: readLines(form.keywordsText),
    name: form.name.trim(),
    pageTypes: readLines(form.pageTypesText),
    preview,
    primaryCategory: form.primaryCategory || null,
    resource,
    reviewStatus: form.reviewStatus,
    semanticTags: readLines(form.semanticTagsText),
    secondaryCategory: form.secondaryCategory || null,
    setKey: form.setKey.trim() || "common",
    setKind: form.setKind,
    setName: form.setName.trim(),
    sortOrder: Number(form.sortOrder) || 0,
    source: form.source,
    style,
    styleTags: readLines(form.styleTagsText),
    synonyms: readLines(form.synonymsText),
    tags: readLines(form.tagsText),
    usageScenarios: readLines(form.usageScenariosText),
    variantKey: form.variantKey || null
  };
}

function buildAssetDetailFromForm(
  kind: TemplateElementAssetKind,
  style: Record<string, unknown>,
  resource: Record<string, unknown>,
  preview: Record<string, unknown>
) {
  if (kind === "ICON") {
    return {
      cornerRadius: readNumber(style.cornerRadius) ?? null,
      fillMode: readString(style.fillMode) ?? null,
      iconName:
        readString(preview.iconName) ??
        readString(resource.iconName) ??
        readString(resource.semanticKey) ??
        "semantic-icon",
      iconStyle: readString(style.iconStyle) ?? "line",
      strokeColor: readString(style.strokeColor) ?? null,
      strokeWidth: readNumber(style.strokeWidth) ?? null
    };
  }

  if (kind === "SHAPE") {
    return {
      cornerRadius: readNumber(style.cornerRadius) ?? null,
      fillColor: readString(style.fillColor) ?? null,
      opacity: readNumber(style.opacity) ?? null,
      shadow: readBoolean(style.shadow),
      shapeType:
        readString(resource.shapeType) ??
        readString(style.shapeType) ??
        readString(preview.shape) ??
        "roundedRect",
      strokeColor: readString(style.strokeColor) ?? null,
      strokeWidth: readNumber(style.strokeWidth) ?? null
    };
  }

  if (kind === "LINE") {
    return {
      cap: readString(style.cap) ?? "round",
      connectorType:
        readString(resource.connectorType) ??
        readString(style.connectorType) ??
        "straight",
      dash: readString(style.dash) ?? "solid",
      direction:
        readString(resource.direction) ??
        readString(style.direction) ??
        readString(preview.direction) ??
        "horizontal",
      endArrowType:
        readString(resource.endArrowType) ??
        readString(style.endArrowType) ??
        "none",
      startArrowType:
        readString(resource.startArrowType) ??
        readString(style.startArrowType) ??
        "none",
      strokeColor: readString(style.strokeColor) ?? null,
      strokeWidth: readNumber(style.strokeWidth) ?? null
    };
  }

  if (kind === "TEXT_STYLE") {
    return {
      color: readString(style.color) ?? null,
      fontFamily: readString(style.fontFamily) ?? null,
      fontSize: readNumber(style.fontSize) ?? null,
      fontWeight: readNumber(style.fontWeight) ?? null,
      letterSpacing: readNumber(style.letterSpacing) ?? null,
      lineHeight: readNumber(style.lineHeight) ?? null,
      maxLines: readNumber(style.maxLines) ?? null,
      textRole:
        readString(resource.textRole) ??
        readString(style.textRole) ??
        readString(preview.textRole) ??
        "body"
    };
  }

  if (kind === "CONTAINER") {
    return {
      allowedContentTypes: readStringArray(style.allowedContentTypes),
      autoLayout: readBoolean(style.autoLayout),
      containerRole:
        readString(resource.containerRole) ??
        readString(style.containerRole) ??
        readString(preview.containerRole) ??
        "container",
      fillColor: readString(style.fillColor) ?? null,
      gap: readNumber(style.gap) ?? null,
      padding: readNumber(style.padding) ?? null,
      recommendedHeight: readNumber(style.recommendedHeight) ?? null,
      recommendedWidth: readNumber(style.recommendedWidth) ?? null,
      strokeColor: readString(style.strokeColor) ?? null,
      strokeWidth: readNumber(style.strokeWidth) ?? null
    };
  }

  return {
    activeColor: readString(style.activeColor) ?? null,
    displayMode:
      readString(resource.displayMode) ??
      readString(style.displayMode) ??
      readString(preview.displayMode) ??
      "label",
    fixedPosition: readString(style.fixedPosition) ?? "bottom",
    inactiveColor: readString(style.inactiveColor) ?? null,
    navigationRole:
      readString(resource.navigationRole) ??
      readString(style.navigationRole) ??
      readString(preview.navigationRole) ??
      "page-number",
    showOnCover: readBoolean(style.showOnCover),
    showOnEnding: readBoolean(style.showOnEnding)
  };
}

function readJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function compareAssets(
  first: TemplateElementAssetDto,
  second: TemplateElementAssetDto
) {
  return first.kind.localeCompare(second.kind) || first.sortOrder - second.sortOrder;
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

    if (code === "DUPLICATE_RECORD") {
      return messages.duplicate;
    }

    if (code === "NOT_FOUND") {
      return messages.notFound;
    }

    return messages.generic;
  } catch {
    return messages.generic;
  }
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

const selectClassName =
  "h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted";

const compactSearchInputClassName =
  "h-9 w-full min-w-0 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

const compactSelectClassName =
  "h-9 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted";

const textareaClassName =
  "min-h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
