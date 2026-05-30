"use client";

import {
  Bot,
  CheckCircle2,
  Database,
  Image as ImageIcon,
  Info,
  KeyRound,
  Languages,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Palette,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
  User,
  X
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { LocaleSelect } from "@/components/locale/locale-switcher";
import {
  paletteSwatches,
  usePalettePreset
} from "@/components/theme/palette-provider";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type {
  AiModelConfigDto,
  AiProviderDto,
  AvailableProviderModelDto,
  EmbeddingModelDto,
  ImageModelDto,
  LlmModelDto
} from "@/lib/ai-config/types";
import type { CurrentUser } from "@/lib/auth/session";
import { paletteIds } from "@/lib/create-deck/options";
import { cn } from "@/lib/utils";

type SettingsTab =
  | "general"
  | "account"
  | "appearance"
  | "providers"
  | "models"
  | "imageModels"
  | "embeddings"
  | "about";

type ProviderFormState = {
  apiKey: string;
  baseUrl: string;
  clearApiKey: boolean;
  id?: string;
  isEnabled: boolean;
  name: string;
  slug: string;
};

type ModelFormState = {
  displayName: string;
  id?: string;
  isDefault: boolean;
  isEnabled: boolean;
  kind: ModelFormKind;
  modelId: string;
  providerId: string;
  temperature: string;
};

type ModelFormKind = "models" | "imageModels" | "embeddings";

type ExperienceSettingsDialogProps = {
  onUserChange?: (user: CurrentUser | null) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type SessionPayload = {
  authenticated: boolean;
  user: CurrentUser | null;
};

type SettingsErrorMessages = {
  databaseMigrationRequired: string;
  duplicate: string;
  loadFailed: string;
  notFound: string;
  providerModelsFetchFailed?: string;
  saveFailed: string;
  unauthorized: string;
  validation: string;
};

const tabIcons: Record<SettingsTab, typeof Languages> = {
  account: User,
  appearance: Palette,
  about: Info,
  embeddings: Database,
  general: Languages,
  imageModels: ImageIcon,
  models: Bot,
  providers: KeyRound
};

const tabIds: SettingsTab[] = [
  "general",
  "account",
  "appearance",
  "providers",
  "models",
  "imageModels",
  "embeddings",
  "about"
];

const aiConfigTabs = new Set<SettingsTab>([
  "embeddings",
  "imageModels",
  "models",
  "providers"
]);

export function ExperienceSettingsDialog({
  onUserChange,
  onOpenChange,
  open
}: ExperienceSettingsDialogProps) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [providers, setProviders] = useState<AiProviderDto[]>([]);
  const [models, setModels] = useState<LlmModelDto[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelDto[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModelDto[]>(
    []
  );
  const [isAiConfigLoading, setIsAiConfigLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasRequestedAiConfigRef = useRef(false);
  const hasLoadedAiConfigRef = useRef(false);
  const wasOpenRef = useRef(open);
  const [providerForm, setProviderForm] = useState<ProviderFormState | null>(
    null
  );
  const [modelForm, setModelForm] = useState<ModelFormState | null>(null);
  const [providerModelOptions, setProviderModelOptions] = useState<
    AvailableProviderModelDto[]
  >([]);
  const [providerModelOptionsProviderId, setProviderModelOptionsProviderId] =
    useState<string | null>(null);
  const [isFetchingProviderModels, setIsFetchingProviderModels] =
    useState(false);
  const errorMessages = useMemo<SettingsErrorMessages>(() => ({
    databaseMigrationRequired: t("errors.databaseMigrationRequired"),
    duplicate: t("errors.duplicate"),
    loadFailed: t("toast.loadFailed"),
    notFound: t("errors.notFound"),
    saveFailed: t("toast.saveFailed"),
    unauthorized: t("errors.unauthorized"),
    validation: t("errors.validation")
  }), [t]);

  const updateCurrentUser = useCallback(
    (user: CurrentUser | null) => {
      setCurrentUser(user);
      onUserChange?.(user);
    },
    [onUserChange]
  );

  const loadSession = useCallback(async () => {
    setIsSessionLoading(true);

    try {
      const sessionResponse = await fetch("/api/auth/session");

      if (!sessionResponse.ok) {
        throw new Error(t("toast.loadFailed"));
      }

      const sessionPayload = (await sessionResponse.json()) as SessionPayload;

      updateCurrentUser(sessionPayload.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.loadFailed");
      toast.error(message);
    } finally {
      setIsSessionLoading(false);
    }
  }, [t, updateCurrentUser]);

  const loadAiConfig = useCallback(async () => {
    hasRequestedAiConfigRef.current = true;
    setIsAiConfigLoading(true);

    try {
      const [
        loadedProviders,
        loadedModels,
        loadedImageModels,
        loadedEmbeddingModels
      ] =
        await Promise.all([
          loadSettingsCollection<AiProviderDto>(
            "/api/ai/providers",
            "providers",
            errorMessages
          ),
          loadSettingsCollection<LlmModelDto>(
            "/api/ai/models",
            "models",
            errorMessages
          ),
          loadSettingsCollection<ImageModelDto>(
            "/api/ai/image-models",
            "imageModels",
            errorMessages
          ),
          loadSettingsCollection<EmbeddingModelDto>(
            "/api/ai/embedding-models",
            "embeddingModels",
            errorMessages
          )
        ]);

      if (loadedProviders.ok) {
        setProviders(loadedProviders.items);
      }

      if (loadedModels.ok) {
        setModels(loadedModels.items);
      }

      if (loadedImageModels.ok) {
        setImageModels(loadedImageModels.items);
      }

      if (loadedEmbeddingModels.ok) {
        setEmbeddingModels(loadedEmbeddingModels.items);
      }

      hasLoadedAiConfigRef.current = true;

      const failedCollection = [
        loadedProviders,
        loadedModels,
        loadedImageModels,
        loadedEmbeddingModels
      ].find((result) => !result.ok);

      if (failedCollection && failedCollection.message) {
        toast.error(failedCollection.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.loadFailed");
      toast.error(message);
    } finally {
      setIsAiConfigLoading(false);
    }
  }, [errorMessages, t]);

  useEffect(() => {
    if (open) {
      const timeoutId = window.setTimeout(() => {
        void loadSession();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [loadSession, open]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      hasRequestedAiConfigRef.current = false;
      hasLoadedAiConfigRef.current = false;
    }

    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      !aiConfigTabs.has(activeTab) ||
      hasRequestedAiConfigRef.current ||
      hasLoadedAiConfigRef.current ||
      isAiConfigLoading
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadAiConfig();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeTab,
    isAiConfigLoading,
    loadAiConfig,
    open
  ]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const defaultModelId = useMemo(
    () => models.find((model) => model.isDefault)?.id ?? null,
    [models]
  );
  const defaultImageModelId = useMemo(
    () => imageModels.find((model) => model.isDefault)?.id ?? null,
    [imageModels]
  );
  const defaultEmbeddingModelId = useMemo(
    () => embeddingModels.find((model) => model.isDefault)?.id ?? null,
    [embeddingModels]
  );

  if (!open || typeof document === "undefined") {
    return null;
  }

  function openNewProvider() {
    setProviderForm({
      apiKey: "",
      baseUrl: "",
      clearApiKey: false,
      isEnabled: true,
      name: "",
      slug: ""
    });
  }

  function openEditProvider(provider: AiProviderDto) {
    setProviderForm({
      apiKey: "",
      baseUrl: provider.baseUrl,
      clearApiKey: false,
      id: provider.id,
      isEnabled: provider.isEnabled,
      name: provider.name,
      slug: provider.slug
    });
  }

  function openNewModel(kind: ModelFormKind = "models") {
    setProviderModelOptions([]);
    setProviderModelOptionsProviderId(null);
    setModelForm({
      displayName: "",
      isDefault: getModelsByKind(kind).length === 0,
      isEnabled: true,
      kind,
      modelId: "",
      providerId: providers[0]?.id ?? "",
      temperature: "0.7"
    });
  }

  function openEditModel(model: AiModelConfigDto, kind: ModelFormKind = "models") {
    setProviderModelOptions([]);
    setProviderModelOptionsProviderId(null);
    setModelForm({
      displayName: model.displayName,
      id: model.id,
      isDefault: model.isDefault,
      isEnabled: model.isEnabled,
      kind,
      modelId: model.modelId,
      providerId: model.providerId,
      temperature: String(model.temperature)
    });
  }

  function getModelsByKind(kind: ModelFormKind) {
    if (kind === "imageModels") {
      return imageModels;
    }

    if (kind === "embeddings") {
      return embeddingModels;
    }

    return models;
  }

  async function submitProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!providerForm) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        providerForm.id
          ? `/api/ai/providers/${providerForm.id}`
          : "/api/ai/providers",
        {
          body: JSON.stringify({
            apiKey: providerForm.apiKey || undefined,
            baseUrl: providerForm.baseUrl,
            clearApiKey: providerForm.clearApiKey,
            isEnabled: providerForm.isEnabled,
            name: providerForm.name,
            slug: providerForm.slug
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: providerForm.id ? "PATCH" : "POST"
        }
      );

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      toast.success(t("toast.saved"));
      setProviderForm(null);
      await loadAiConfig();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.saveFailed");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!modelForm) {
      return;
    }

    setIsSaving(true);

    try {
      const endpoint = getModelEndpoint(modelForm.kind);
      const response = await fetch(
        modelForm.id ? `${endpoint}/${modelForm.id}` : endpoint,
        {
          body: JSON.stringify({
            displayName: modelForm.displayName,
            isDefault: modelForm.isDefault,
            isEnabled: modelForm.isEnabled,
            modelId: modelForm.modelId,
            providerId: modelForm.providerId,
            temperature: modelForm.temperature
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: modelForm.id ? "PATCH" : "POST"
        }
      );

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      toast.success(t("toast.saved"));
      setModelForm(null);
      await loadAiConfig();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.saveFailed");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function fetchProviderModels() {
    if (!modelForm?.providerId) {
      toast.error(t("models.toast.providerRequired"));
      return;
    }

    setIsFetchingProviderModels(true);

    try {
      const response = await fetch(
        `/api/ai/providers/${modelForm.providerId}/models`
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(response, {
            ...errorMessages,
            providerModelsFetchFailed: t("models.toast.fetchFailed")
          })
        );
      }

      const payload = (await response.json()) as {
        models?: AvailableProviderModelDto[];
      };
      const fetchedModels = payload.models ?? [];

      setProviderModelOptions(fetchedModels);
      setProviderModelOptionsProviderId(modelForm.providerId);

      if (fetchedModels.length > 0) {
        toast.success(t("models.toast.fetched", { count: fetchedModels.length }));
      } else {
        toast.info(t("models.toast.emptyFetched"));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("models.toast.fetchFailed");
      toast.error(message);
    } finally {
      setIsFetchingProviderModels(false);
    }
  }

  function applyProviderModelOption(modelId: string) {
    if (!modelForm || !modelId) {
      return;
    }

    const option = providerModelOptions.find((model) => model.id === modelId);

    if (!option) {
      return;
    }

    setModelForm({
      ...modelForm,
      displayName: modelForm.displayName.trim()
        ? modelForm.displayName
        : option.displayName,
      modelId: option.id
    });
  }

  function updateModelProvider(providerId: string) {
    if (!modelForm) {
      return;
    }

    setProviderModelOptions([]);
    setProviderModelOptionsProviderId(null);
    setModelForm({
      ...modelForm,
      modelId: "",
      providerId
    });
  }

  async function deleteEntity(
    type: "provider" | ModelFormKind,
    id: string
  ) {
    const confirmed = window.confirm(
      type === "provider"
        ? t("providers.confirmDelete")
        : type === "imageModels"
          ? t("imageModels.confirmDelete")
          : type === "embeddings"
            ? t("embeddings.confirmDelete")
            : t("models.confirmDelete")
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        type === "provider"
          ? `/api/ai/providers/${id}`
          : `${getModelEndpoint(type)}/${id}`,
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      toast.success(t("toast.deleted"));
      await loadAiConfig();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("toast.deleteFailed");
      toast.error(message);
    }
  }

  async function makeDefault(kind: ModelFormKind, modelId: string) {
    try {
      const response = await fetch(`${getModelEndpoint(kind)}/${modelId}/default`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, errorMessages));
      }

      toast.success(t(`${kind}.toast.defaultSaved`));
      await loadAiConfig();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.saveFailed");
      toast.error(message);
    }
  }

  function getModelEndpoint(kind: ModelFormKind) {
    if (kind === "imageModels") {
      return "/api/ai/image-models";
    }

    if (kind === "embeddings") {
      return "/api/ai/embedding-models";
    }

    return "/api/ai/models";
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    toast.success(t("general.logoutDone"));
    onOpenChange(false);
    router.push("/login");
    router.refresh();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto bg-background/70 p-4 backdrop-blur-sm sm:p-6">
      <section
        aria-labelledby="experience-settings-title"
        aria-modal="true"
        className="relative my-auto grid h-[min(82dvh,720px)] max-h-[calc(100dvh-2rem)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl md:grid-cols-[220px_1fr]"
        role="dialog"
      >
        <header className="col-span-full flex h-16 items-center justify-between border-b border-border px-5">
          <h2
            className="text-lg font-semibold text-foreground"
            id="experience-settings-title"
          >
            {t("title")}
          </h2>
          <Button
            aria-label={t("actions.close")}
            onClick={() => onOpenChange(false)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>

        <nav
          aria-label={t("tabs.aria")}
          className="min-h-0 overflow-x-auto border-b border-border bg-background p-3 md:block md:overflow-y-auto md:border-b-0 md:border-r"
        >
          {tabIds.map((tab) => {
            const Icon = tabIcons[tab];

            return (
              <button
                className={cn(
                  "flex h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-muted outline-none transition hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent md:w-full",
                  activeTab === tab &&
                    "bg-surface-muted text-foreground shadow-sm"
                )}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                <Icon className="size-4 text-accent" aria-hidden="true" />
                {t(`tabs.${tab}`)}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 overflow-y-auto p-5">
          {activeTab === "providers" ? (
            <ProvidersPane
              isLoading={isAiConfigLoading}
              onDelete={(id) => void deleteEntity("provider", id)}
              onEdit={openEditProvider}
              onNew={openNewProvider}
              providers={providers}
            />
          ) : activeTab === "models" ? (
            <ModelConfigsPane
              defaultModelId={defaultModelId}
              kind="models"
              isLoading={isAiConfigLoading}
              models={models}
              onDelete={(id) => void deleteEntity("models", id)}
              onEdit={(model) => openEditModel(model, "models")}
              onMakeDefault={(id) => void makeDefault("models", id)}
              onNew={() => openNewModel("models")}
              providers={providers}
            />
          ) : activeTab === "imageModels" ? (
            <ModelConfigsPane
              defaultModelId={defaultImageModelId}
              kind="imageModels"
              isLoading={isAiConfigLoading}
              models={imageModels}
              onDelete={(id) => void deleteEntity("imageModels", id)}
              onEdit={(model) => openEditModel(model, "imageModels")}
              onMakeDefault={(id) => void makeDefault("imageModels", id)}
              onNew={() => openNewModel("imageModels")}
              providers={providers}
            />
          ) : activeTab === "embeddings" ? (
            <ModelConfigsPane
              defaultModelId={defaultEmbeddingModelId}
              kind="embeddings"
              isLoading={isAiConfigLoading}
              models={embeddingModels}
              onDelete={(id) => void deleteEntity("embeddings", id)}
              onEdit={(model) => openEditModel(model, "embeddings")}
              onMakeDefault={(id) => void makeDefault("embeddings", id)}
              onNew={() => openNewModel("embeddings")}
              providers={providers}
            />
          ) : activeTab === "general" ? (
            <GeneralPane onLogout={() => void logout()} />
          ) : activeTab === "appearance" ? (
            <AppearancePane />
          ) : activeTab === "account" ? (
            <AccountPane
              key={currentUser?.id ?? "account-loading"}
              isLoading={isSessionLoading}
              onUserChange={updateCurrentUser}
              user={currentUser}
            />
          ) : (
            <PlaceholderPane tab={activeTab} />
          )}
        </div>

        {providerForm ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/55 p-3 backdrop-blur-sm">
            <form
              className="w-full max-w-xl rounded-lg border border-border bg-surface shadow-xl"
              onSubmit={submitProvider}
            >
              <FormHeader
                onClose={() => setProviderForm(null)}
                title={
                  providerForm.id
                    ? t("providers.form.editTitle")
                    : t("providers.form.createTitle")
                }
              />
              <div className="grid gap-3 p-4">
                <TextField
                  label={t("providers.form.name")}
                  onChange={(value) =>
                    setProviderForm({ ...providerForm, name: value })
                  }
                  required
                  value={providerForm.name}
                />
                <TextField
                  label={t("providers.form.slug")}
                  onChange={(value) =>
                    setProviderForm({ ...providerForm, slug: value })
                  }
                  required
                  value={providerForm.slug}
                />
                <TextField
                  label={t("providers.form.baseUrl")}
                  onChange={(value) =>
                    setProviderForm({ ...providerForm, baseUrl: value })
                  }
                  required
                  value={providerForm.baseUrl}
                />
                <TextField
                  label={t("providers.form.apiKey")}
                  onChange={(value) =>
                    setProviderForm({ ...providerForm, apiKey: value })
                  }
                  placeholder={t("providers.form.apiKeyPlaceholder")}
                  type="password"
                  value={providerForm.apiKey}
                />
                {providerForm.id ? (
                  <CheckboxField
                    checked={providerForm.clearApiKey}
                    label={t("providers.form.clearApiKey")}
                    onChange={(checked) =>
                      setProviderForm({ ...providerForm, clearApiKey: checked })
                    }
                  />
                ) : null}
                <CheckboxField
                  checked={providerForm.isEnabled}
                  label={t("common.enabled")}
                  onChange={(checked) =>
                    setProviderForm({ ...providerForm, isEnabled: checked })
                  }
                />
              </div>
              <FormFooter isSaving={isSaving} />
            </form>
          </div>
        ) : null}

        {modelForm ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/55 p-3 backdrop-blur-sm">
            <form
              className="w-full max-w-xl rounded-lg border border-border bg-surface shadow-xl"
              onSubmit={submitModel}
            >
              <FormHeader
                onClose={() => setModelForm(null)}
                title={
                  modelForm.id
                    ? t(`${modelForm.kind}.form.editTitle`)
                    : t(`${modelForm.kind}.form.createTitle`)
                }
              />
              <div className="grid gap-3 p-4">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("models.form.provider")}
                  </span>
                  <select
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    onChange={(event) => updateModelProvider(event.target.value)}
                    required
                    value={modelForm.providerId}
                  >
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label={t("models.form.displayName")}
                  onChange={(value) =>
                    setModelForm({ ...modelForm, displayName: value })
                  }
                  required
                  value={modelForm.displayName}
                />
                <div className="grid gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t("models.form.modelId")}
                  </span>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      aria-label={t("models.form.modelId")}
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
                      onChange={(event) =>
                        setModelForm({ ...modelForm, modelId: event.target.value })
                      }
                      placeholder={t("models.form.modelIdPlaceholder")}
                      required
                      value={modelForm.modelId}
                    />
                    <Button
                      disabled={
                        isFetchingProviderModels || !modelForm.providerId
                      }
                      onClick={() => void fetchProviderModels()}
                      type="button"
                      variant="secondary"
                    >
                      {isFetchingProviderModels ? (
                        <LoaderCircle
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <RefreshCcw className="size-4" aria-hidden="true" />
                      )}
                      {t("models.actions.fetch")}
                    </Button>
                  </div>
                  {providerModelOptionsProviderId === modelForm.providerId &&
                  providerModelOptions.length > 0 ? (
                    <div className="grid gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {t("models.form.fetchedModels")}
                      </span>
                      <select
                        aria-label={t("models.form.fetchedModels")}
                        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                        onChange={(event) =>
                          applyProviderModelOption(event.target.value)
                        }
                        value={
                          providerModelOptions.some(
                            (option) => option.id === modelForm.modelId
                          )
                            ? modelForm.modelId
                            : ""
                        }
                      >
                        <option value="">
                          {t("models.form.fetchedModelsPlaceholder")}
                        </option>
                        {providerModelOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.displayName === option.id
                              ? option.id
                              : `${option.displayName} (${option.id})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                <TextField
                  label={t("models.form.temperature")}
                  onChange={(value) =>
                    setModelForm({ ...modelForm, temperature: value })
                  }
                  required
                  type="number"
                  value={modelForm.temperature}
                />
                <CheckboxField
                  checked={modelForm.isEnabled}
                  label={t("common.enabled")}
                  onChange={(checked) =>
                    setModelForm({ ...modelForm, isEnabled: checked })
                  }
                />
                <CheckboxField
                  checked={modelForm.isDefault}
                  label={t(`${modelForm.kind}.form.isDefault`)}
                  onChange={(checked) =>
                    setModelForm({ ...modelForm, isDefault: checked })
                  }
                />
              </div>
              <FormFooter isSaving={isSaving} />
            </form>
          </div>
        ) : null}
      </section>
    </div>,
    document.body
  );
}

function ProvidersPane({
  isLoading,
  onDelete,
  onEdit,
  onNew,
  providers
}: {
  isLoading: boolean;
  onDelete: (id: string) => void;
  onEdit: (provider: AiProviderDto) => void;
  onNew: () => void;
  providers: AiProviderDto[];
}) {
  const t = useTranslations("settings");

  return (
    <section>
      <PaneHeader
        actionLabel={t("providers.actions.new")}
        eyebrow={t("providers.eyebrow")}
        onAction={onNew}
        summary={t("providers.summary")}
        title={t("providers.title")}
      />
      <EntityList
        emptyLabel={t("providers.empty")}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
      >
        {providers.map((provider) => (
          <article
            className="grid gap-2 border-b border-border py-4 last:border-b-0"
            key={provider.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">
                    {provider.name}
                  </h4>
                  <Badge>{provider.isEnabled ? t("common.enabled") : t("common.disabled")}</Badge>
                  <Badge>
                    {provider.hasApiKey
                      ? t("providers.badges.keyReady")
                      : t("providers.badges.keyEmpty")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{provider.slug}</p>
                <p className="mt-1 break-all text-sm text-foreground">
                  {provider.baseUrl}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("providers.modelCount", { count: provider.modelCount })}
                </p>
              </div>
              <EntityActions
                onDelete={() => onDelete(provider.id)}
                onEdit={() => onEdit(provider)}
              />
            </div>
          </article>
        ))}
      </EntityList>
    </section>
  );
}

function ModelConfigsPane({
  defaultModelId,
  isLoading,
  kind,
  models,
  onDelete,
  onEdit,
  onMakeDefault,
  onNew,
  providers
}: {
  defaultModelId: string | null;
  isLoading: boolean;
  kind: ModelFormKind;
  models: AiModelConfigDto[];
  onDelete: (id: string) => void;
  onEdit: (model: AiModelConfigDto) => void;
  onMakeDefault: (id: string) => void;
  onNew: () => void;
  providers: AiProviderDto[];
}) {
  const t = useTranslations("settings");

  return (
    <section>
      <PaneHeader
        actionDisabled={providers.length === 0}
        actionLabel={t(`${kind}.actions.new`)}
        eyebrow={t(`${kind}.eyebrow`)}
        onAction={onNew}
        summary={t(`${kind}.summary`)}
        title={t(`${kind}.title`)}
      />
      <EntityList
        emptyLabel={t(`${kind}.empty`)}
        isLoading={isLoading}
        loadingLabel={t("common.loading")}
      >
        {models.map((model) => (
          <ModelManagementItem
            actions={
              <>
                <DefaultModelButton
                  disabled={defaultModelId === model.id}
                  isDefault={model.isDefault}
                  label={t(`${kind}.actions.makeDefault`)}
                  onClick={() => onMakeDefault(model.id)}
                />
                <EntityActions
                  onDelete={() => onDelete(model.id)}
                  onEdit={() => onEdit(model)}
                />
              </>
            }
            badges={
              <>
                {model.isDefault ? <Badge>{t(`${kind}.badges.default`)}</Badge> : null}
                <Badge>
                  {model.isEnabled ? t("common.enabled") : t("common.disabled")}
                </Badge>
              </>
            }
            detail={t("models.temperature", { value: model.temperature })}
            key={model.id}
            meta={`${model.providerSlug} / ${model.modelId}`}
            title={model.displayName}
          />
        ))}
      </EntityList>
    </section>
  );
}

function GeneralPane({ onLogout }: { onLogout: () => void }) {
  const t = useTranslations("settings");

  return (
    <section>
      <header className="mb-4 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase text-accent-strong">
          {t("general.eyebrow")}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">
          {t("general.title")}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          {t("general.summary")}
        </p>
      </header>

      <div className="grid gap-4">
        <section className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                <Languages className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-foreground">
                  {t("general.language.title")}
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {t("general.language.body")}
                </p>
              </div>
            </div>
            <LocaleSelect
              className="w-full sm:w-[9rem]"
              keepSettingsDialogOpen
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                <LogOut className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-foreground">
                  {t("general.logout.title")}
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {t("general.logout.body")}
                </p>
              </div>
            </div>
            <Button
              className="w-full sm:w-[9rem]"
              onClick={onLogout}
              type="button"
              variant="secondary"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t("general.logout.action")}
            </Button>
          </div>
        </section>
      </div>
    </section>
  );
}

function AccountPane({
  isLoading,
  onUserChange,
  user
}: {
  isLoading: boolean;
  onUserChange: (user: CurrentUser) => void;
  user: CurrentUser | null;
}) {
  const t = useTranslations("settings");
  const [displayName, setDisplayName] = useState(
    user ? getAccountDisplayName(user) : ""
  );
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarFileLabel, setAvatarFileLabel] = useState("");
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(
    null
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const [isAvatarPreparing, setIsAvatarPreparing] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (localAvatarPreview && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(localAvatarPreview);
      }
    };
  }, [localAvatarPreview]);

  async function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsAvatarPreparing(true);

    try {
      const preparedFile = await prepareAvatarFile(file);
      const nextPreview =
        typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(preparedFile)
          : null;

      setAvatarFile(preparedFile);
      setAvatarFileLabel(
        `${preparedFile.name} (${formatAvatarFileSize(preparedFile.size)})`
      );
      setLocalAvatarPreview((current) => {
        if (current && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(current);
        }

        return nextPreview;
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const message =
        code === "AVATAR_TYPE_UNSUPPORTED"
          ? t("account.errors.avatarType")
          : code === "AVATAR_TOO_LARGE_AFTER_COMPRESSION"
            ? t("account.errors.avatarTooLarge")
            : t("account.errors.avatarCompress");

      toast.error(message);
    } finally {
      setIsAvatarPreparing(false);
    }
  }

  async function saveProfile() {
    if (!user) {
      return;
    }

    setIsProfileSaving(true);

    try {
      const body = avatarFile
        ? createAccountProfileFormData(displayName, avatarFile)
        : JSON.stringify({
            displayName
          });
      const response = await fetch("/api/account/profile", {
        body,
        headers: avatarFile
          ? undefined
          : {
              "Content-Type": "application/json"
            },
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await readAccountApiError(response, t));
      }

      const payload = (await response.json()) as { user: CurrentUser };
      onUserChange(payload.user);
      setAvatarUrl(payload.user.avatarUrl ?? "");
      setDisplayName(getAccountDisplayName(payload.user));
      setAvatarFile(null);
      setAvatarFileLabel("");
      setLocalAvatarPreview((current) => {
        if (current && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      toast.success(t("account.toast.profileSaved"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("account.errors.generic");
      toast.error(message);
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPasswordSaving(true);

    try {
      const response = await fetch("/api/account/password", {
        body: JSON.stringify({
          currentPassword,
          newPassword
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await readAccountApiError(response, t));
      }

      setCurrentPassword("");
      setNewPassword("");
      setIsPasswordEditing(false);
      toast.success(t("account.toast.passwordSaved"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("account.errors.generic");
      toast.error(message);
    } finally {
      setIsPasswordSaving(false);
    }
  }

  return (
    <section>
      <header className="mb-4 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase text-accent-strong">
          {t("account.eyebrow")}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">
          {t("account.title")}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          {t("account.summary")}
        </p>
      </header>

      {isLoading ? (
        <div className="flex min-h-44 items-center justify-center text-sm text-muted">
          <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
          {t("common.loading")}
        </div>
      ) : !user ? (
        <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted">
          {t("errors.unauthorized")}
        </div>
      ) : (
        <div className="grid gap-4">
          <section className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <AvatarPreview
                avatarUrl={localAvatarPreview ?? avatarUrl}
                fallback={getAvatarFallback(displayName, user.email)}
              />
              <div className="grid min-w-0 flex-1 gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {t("account.fields.email")}
                    </span>
                    <span className="relative">
                      <Mail
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                        aria-hidden="true"
                      />
                      <input
                        className="h-11 w-full rounded-lg border border-border bg-surface-muted px-9 text-sm text-muted outline-none"
                        readOnly
                        value={user.email}
                      />
                    </span>
                  </label>
                  <TextField
                    label={t("account.fields.displayName")}
                    onChange={setDisplayName}
                    required
                    value={displayName}
                  />
                </div>

                <input
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={t("account.fields.avatarFile")}
                  className="sr-only"
                  onChange={(event) => void selectAvatar(event)}
                  ref={avatarInputRef}
                  type="file"
                />

                {avatarFileLabel ? (
                  <p className="truncate text-xs text-muted">
                    {t("account.fields.avatarSelected", {
                      file: avatarFileLabel
                    })}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={isAvatarPreparing || isProfileSaving}
                    onClick={() => avatarInputRef.current?.click()}
                    type="button"
                    variant="secondary"
                  >
                    {isAvatarPreparing ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Upload className="size-4" aria-hidden="true" />
                    )}
                    {t("account.actions.uploadAvatar")}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={isProfileSaving || isAvatarPreparing}
                    onClick={() => void saveProfile()}
                    type="button"
                  >
                    {isProfileSaving ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    {t("account.actions.saveProfile")}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
                  <Lock className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-foreground">
                    {t("account.password.title")}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {t("account.password.body")}
                  </p>
                </div>
              </div>
              <Button
                className="w-full sm:w-auto"
                onClick={() => setIsPasswordEditing((current) => !current)}
                type="button"
                variant="secondary"
              >
                <Lock className="size-4" aria-hidden="true" />
                {t("account.actions.changePassword")}
              </Button>
            </div>

            {isPasswordEditing ? (
              <form
                className="mt-4 grid gap-3 border-t border-border pt-4"
                onSubmit={savePassword}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label={t("account.fields.currentPassword")}
                    onChange={setCurrentPassword}
                    required
                    type="password"
                    value={currentPassword}
                  />
                  <TextField
                    label={t("account.fields.newPassword")}
                    onChange={setNewPassword}
                    required
                    type="password"
                    value={newPassword}
                  />
                </div>
                <div className="flex justify-end">
                  <Button disabled={isPasswordSaving} type="submit">
                    {isPasswordSaving ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    {t("account.actions.savePassword")}
                  </Button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      )}
    </section>
  );
}

function AppearancePane() {
  const t = useTranslations("settings");
  const optionT = useTranslations("options");
  const { palette, setPalette } = usePalettePreset();

  return (
    <section>
      <header className="mb-4 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase text-accent-strong">
          {t("appearance.eyebrow")}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">
          {t("appearance.title")}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          {t("appearance.summary")}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
              <Monitor className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-foreground">
                {t("appearance.mode.title")}
              </h4>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("appearance.mode.body")}
              </p>
            </div>
          </div>
          <ThemeModeControl className="shrink-0" />
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
              <Palette className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h4 className="text-base font-semibold text-foreground">
                {t("appearance.palette.title")}
              </h4>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("appearance.palette.body")}
              </p>
            </div>
          </div>
          <div
            aria-label={t("appearance.palette.aria")}
            className="grid w-full gap-2 sm:w-72 sm:grid-cols-2"
            role="group"
          >
            {paletteIds.map((paletteId) => (
              <button
                className={cn(
                  "flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
                  palette === paletteId &&
                    "border-accent bg-accent-soft text-accent-strong"
                )}
                key={paletteId}
                onClick={() => setPalette(paletteId)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-3 rounded-full", paletteSwatches[paletteId])}
                />
                {optionT(`palettes.${paletteId}`)}
              </button>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function PlaceholderPane({ tab }: { tab: SettingsTab }) {
  const t = useTranslations("settings");

  return (
    <section className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-border bg-background p-6 text-center">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {t(`placeholders.${tab}.title`)}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
          {t(`placeholders.${tab}.body`)}
        </p>
      </div>
    </section>
  );
}

function PaneHeader({
  actionDisabled,
  actionLabel,
  eyebrow,
  onAction,
  summary,
  title
}: {
  actionDisabled?: boolean;
  actionLabel: string;
  eyebrow: string;
  onAction: () => void;
  summary: string;
  title: string;
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase text-accent-strong">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">{summary}</p>
      </div>
      <Button
        className="min-w-[10rem] shrink-0 whitespace-nowrap"
        disabled={actionDisabled}
        onClick={onAction}
        type="button"
      >
        <Plus className="size-4" aria-hidden="true" />
        {actionLabel}
      </Button>
    </header>
  );
}

function EntityList({
  children,
  emptyLabel,
  isLoading,
  loadingLabel
}: {
  children?: React.ReactNode;
  emptyLabel: string;
  isLoading: boolean;
  loadingLabel: string;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-44 items-center justify-center text-sm text-muted">
        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />
        {loadingLabel}
      </div>
    );
  }

  if (!children || (Array.isArray(children) && children.length === 0)) {
    return (
      <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  return <div>{children}</div>;
}

function ModelManagementItem({
  actions,
  badges,
  detail,
  meta,
  title
}: {
  actions: React.ReactNode;
  badges: React.ReactNode;
  detail?: React.ReactNode;
  meta: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <article className="grid gap-2 border-b border-border py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-foreground">{title}</h4>
            {badges}
          </div>
          <p className="mt-1 break-all text-sm text-muted">{meta}</p>
          {detail ? (
            <p className="mt-1 break-all text-sm text-foreground">{detail}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </div>
    </article>
  );
}

function DefaultModelButton({
  disabled,
  isDefault,
  label,
  onClick
}: {
  disabled: boolean;
  isDefault: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      size="icon"
      title={label}
      type="button"
      variant={isDefault ? "secondary" : "ghost"}
    >
      <CheckCircle2 className="size-4" aria-hidden="true" />
    </Button>
  );
}

function EntityActions({
  onDelete,
  onEdit
}: {
  onDelete: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("settings");

  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label={t("actions.edit")}
        onClick={onEdit}
        size="icon"
        title={t("actions.edit")}
        type="button"
        variant="ghost"
      >
        <Pencil className="size-4" aria-hidden="true" />
      </Button>
      <Button
        aria-label={t("actions.delete")}
        onClick={onDelete}
        size="icon"
        title={t("actions.delete")}
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function FormHeader({
  onClose,
  title
}: {
  onClose: () => void;
  title: string;
}) {
  const t = useTranslations("settings");

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <Button
        aria-label={t("actions.close")}
        onClick={onClose}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </header>
  );
}

function FormFooter({ isSaving }: { isSaving: boolean }) {
  const t = useTranslations("settings");

  return (
    <footer className="border-t border-border p-4">
      <Button className="w-full" disabled={isSaving} type="submit">
        {isSaving ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {t("actions.save")}
      </Button>
    </footer>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        step={type === "number" ? "0.1" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function CheckboxField({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      <input
        checked={checked}
        className="size-4 accent-accent"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

const avatarMaxUploadBytes = 1024 * 1024;
const avatarAllowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

function createAccountProfileFormData(displayName: string, avatarFile: File) {
  const formData = new FormData();

  formData.set("displayName", displayName);
  formData.set("avatar", avatarFile);

  return formData;
}

async function prepareAvatarFile(file: File) {
  if (!isSupportedAvatarType(file)) {
    throw new Error("AVATAR_TYPE_UNSUPPORTED");
  }

  if (file.size <= avatarMaxUploadBytes) {
    return file;
  }

  const image = await loadAvatarImage(file);

  try {
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("AVATAR_COMPRESS_FAILED");
    }

    let scale = Math.min(1, 768 / Math.max(sourceWidth, sourceHeight));
    let quality = 0.86;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      canvas.width = Math.max(128, Math.round(sourceWidth * scale));
      canvas.height = Math.max(128, Math.round(sourceHeight * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, "image/jpeg", quality);

      if (blob.size <= avatarMaxUploadBytes) {
        return new File([blob], replaceFileExtension(file.name, "jpg"), {
          type: "image/jpeg"
        });
      }

      if (quality > 0.58) {
        quality -= 0.08;
      } else {
        scale *= 0.82;
      }
    }

    throw new Error("AVATAR_TOO_LARGE_AFTER_COMPRESSION");
  } finally {
    if ("close" in image) {
      image.close();
    }
  }
}

async function loadAvatarImage(file: File) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  if (typeof URL.createObjectURL !== "function") {
    throw new Error("AVATAR_COMPRESS_FAILED");
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("AVATAR_COMPRESS_FAILED"));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("AVATAR_COMPRESS_FAILED"));
          return;
        }

        resolve(blob);
      },
      type,
      quality
    );
  });
}

function isSupportedAvatarType(file: File) {
  const directType = file.type.toLowerCase();

  if (avatarAllowedImageTypes.has(directType)) {
    return true;
  }

  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function replaceFileExtension(filename: string, extension: string) {
  const baseName = filename.replace(/\.[^.]+$/, "") || "avatar";

  return `${baseName}.${extension}`;
}

function formatAvatarFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">
      {children}
    </span>
  );
}

function AvatarPreview({
  avatarUrl,
  fallback
}: {
  avatarUrl: string;
  fallback: string;
}) {
  return (
    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-accent-soft text-xl font-semibold text-accent-strong">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          src={avatarUrl}
        />
      ) : (
        fallback
      )}
    </div>
  );
}

function getAccountDisplayName(user: CurrentUser) {
  return user.displayName?.trim() || user.email.split("@")[0] || user.email;
}

function getAvatarFallback(displayName: string, email: string) {
  return (displayName.trim() || email).slice(0, 1).toUpperCase();
}

async function readAccountApiError(
  response: Response,
  t: ReturnType<typeof useTranslations>
) {
  try {
    const payload = await response.json();
    const code = typeof payload.error === "string" ? payload.error : "";

    if (code === "INVALID_CREDENTIALS") {
      return t("account.errors.invalidPassword");
    }

    if (code === "VALIDATION_FAILED") {
      return t("account.errors.validation");
    }

    if (code === "UNAUTHORIZED") {
      return t("errors.unauthorized");
    }

    return t("account.errors.generic");
  } catch {
    return t("account.errors.generic");
  }
}

async function readApiError(
  response: Response,
  messages: SettingsErrorMessages
) {
  try {
    const payload = await response.json();
    const code = typeof payload.error === "string" ? payload.error : "";

    if (code === "DUPLICATE_RECORD") {
      return messages.duplicate;
    }

    if (code === "VALIDATION_FAILED") {
      return messages.validation;
    }

    if (code === "UNAUTHORIZED") {
      return messages.unauthorized;
    }

    if (code === "NOT_FOUND") {
      return messages.notFound;
    }

    if (code === "PROVIDER_MODELS_FETCH_FAILED") {
      return messages.providerModelsFetchFailed ?? messages.saveFailed;
    }

    if (code === "DATABASE_MIGRATION_REQUIRED") {
      return messages.databaseMigrationRequired;
    }

    return messages.saveFailed;
  } catch {
    return messages.saveFailed;
  }
}

async function loadSettingsCollection<T>(
  url: string,
  payloadKey: string,
  messages: SettingsErrorMessages
): Promise<
  | {
      items: T[];
      ok: true;
    }
  | {
      message: string;
      ok: false;
    }
> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        message: await readApiError(response, {
          ...messages,
          saveFailed: messages.loadFailed
        }),
        ok: false
      };
    }

    const payload = await response.json();
    const items = isRecord(payload) ? payload[payloadKey] : undefined;

    return {
      items: Array.isArray(items) ? (items as T[]) : [],
      ok: true
    };
  } catch {
    return {
      message: messages.loadFailed,
      ok: false
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
