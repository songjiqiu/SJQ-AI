import { AiModelKind, Prisma } from "@prisma/client";

import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import type { AiDeckEnv } from "@/lib/ai-deck/analyzer";
import { prisma } from "@/lib/db/prisma";
import { isMissingPrismaModelStorageError } from "@/lib/db/prisma-errors";

import type {
  EmbeddingModelInput,
  ImageModelInput,
  ModelInput,
  ProviderInput
} from "./schemas";
import type { AvailableProviderModelDto } from "./types";

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ProviderModelsFetchError extends Error {
  details: unknown;

  constructor(message = "Provider models fetch failed", details?: unknown) {
    super(message);
    this.name = "ProviderModelsFetchError";
    this.details = details;
  }
}

type ProviderWithCount = Prisma.AiProviderGetPayload<{
  include: {
    _count: {
      select: {
        models: true;
      };
    };
  };
}>;

type ProviderRecord = Prisma.AiProviderGetPayload<Record<string, never>>;

type ModelWithProvider = Prisma.AiModelConfigGetPayload<{
  include: {
    provider: {
      select: {
        baseUrl: true;
        encryptedApiKey: true;
        name: true;
        slug: true;
      };
    };
  };
}>;

const modelProviderInclude = {
  provider: {
    select: {
      baseUrl: true,
      encryptedApiKey: true,
      name: true,
      slug: true
    }
  }
} satisfies Prisma.AiModelConfigInclude;

export type AiImageEnv = {
  AI_IMAGE_MODEL?: string;
  IMAGE_API_KEY?: string;
  IMAGE_BASE_URL?: string;
};

export function serializeProvider(provider: ProviderWithCount | ProviderRecord) {
  return {
    baseUrl: provider.baseUrl,
    createdAt: provider.createdAt.toISOString(),
    hasApiKey: Boolean(provider.encryptedApiKey),
    id: provider.id,
    isEnabled: provider.isEnabled,
    modelCount: "_count" in provider ? provider._count.models : 0,
    name: provider.name,
    slug: provider.slug,
    updatedAt: provider.updatedAt.toISOString()
  };
}

export function serializeModel(model: ModelWithProvider) {
  return {
    createdAt: model.createdAt.toISOString(),
    displayName: model.displayName,
    id: model.id,
    isDefault: model.isDefault,
    isEnabled: model.isEnabled,
    kind: model.kind,
    modelId: model.modelId,
    providerId: model.providerId,
    providerName: model.provider.name,
    providerSlug: model.provider.slug,
    temperature: model.temperature,
    updatedAt: model.updatedAt.toISOString()
  };
}

export async function listProviders(userId: string) {
  try {
    const providers = await prisma.aiProvider.findMany({
      where: {
        userId
      },
      include: {
        _count: {
          select: {
            models: true
          }
        }
      },
      orderBy: [
        {
          createdAt: "asc"
        }
      ]
    });

    return providers.map(serializeProvider);
  } catch (error) {
    if (!isMissingPrismaModelStorageError(error, "AiModelConfig")) {
      throw error;
    }

    const providers = await prisma.aiProvider.findMany({
      where: {
        userId
      },
      orderBy: [
        {
          createdAt: "asc"
        }
      ]
    });

    return providers.map(serializeProvider);
  }
}

export async function listProviderAvailableModels(
  userId: string,
  providerId: string
): Promise<AvailableProviderModelDto[]> {
  const provider = await prisma.aiProvider.findFirst({
    where: {
      id: providerId,
      userId
    }
  });

  if (!provider) {
    throw new NotFoundError("Provider not found");
  }

  const modelsUrl = buildProviderModelsUrl(provider.baseUrl);
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (provider.encryptedApiKey) {
    headers.Authorization = `Bearer ${decryptSecret(provider.encryptedApiKey)}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  let response: Response;

  try {
    response = await fetch(modelsUrl, {
      headers,
      signal: controller.signal
    });
  } catch (error) {
    throw new ProviderModelsFetchError("Provider models request failed", {
      message: error instanceof Error ? error.message : String(error),
      url: modelsUrl
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new ProviderModelsFetchError("Provider rejected model list request", {
      body: await readProviderErrorBody(response),
      status: response.status,
      url: modelsUrl
    });
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new ProviderModelsFetchError("Provider returned invalid JSON", {
      message: error instanceof Error ? error.message : String(error),
      status: response.status,
      url: modelsUrl
    });
  }

  return filterProviderModelsForProvider(extractProviderModels(payload), provider);
}

export async function createProvider(userId: string, input: ProviderInput) {
  const provider = await prisma.aiProvider.create({
    data: {
      baseUrl: input.baseUrl,
      encryptedApiKey: input.apiKey?.trim()
        ? encryptSecret(input.apiKey.trim())
        : null,
      isEnabled: input.isEnabled,
      name: input.name,
      slug: input.slug,
      userId
    },
    include: {
      _count: {
        select: {
          models: true
        }
      }
    }
  });

  return serializeProvider(provider);
}

export async function updateProvider(
  userId: string,
  providerId: string,
  input: ProviderInput
) {
  const existing = await prisma.aiProvider.findFirst({
    where: {
      id: providerId,
      userId
    }
  });

  if (!existing) {
    throw new NotFoundError();
  }

  const provider = await prisma.aiProvider.update({
    where: {
      id: providerId
    },
    data: {
      baseUrl: input.baseUrl,
      encryptedApiKey: input.clearApiKey
        ? null
        : input.apiKey?.trim()
          ? encryptSecret(input.apiKey.trim())
          : undefined,
      isEnabled: input.isEnabled,
      name: input.name,
      slug: input.slug
    },
    include: {
      _count: {
        select: {
          models: true
        }
      }
    }
  });

  return serializeProvider(provider);
}

export async function deleteProvider(userId: string, providerId: string) {
  const result = await prisma.aiProvider.deleteMany({
    where: {
      id: providerId,
      userId
    }
  });

  if (result.count === 0) {
    throw new NotFoundError();
  }
}

export async function listModelsByKind(userId: string, kind: AiModelKind) {
  try {
    const models = await prisma.aiModelConfig.findMany({
      where: {
        kind,
        userId
      },
      include: modelProviderInclude,
      orderBy: [
        {
          isDefault: "desc"
        },
        {
          createdAt: "asc"
        }
      ]
    });

    return models.map(serializeModel);
  } catch (error) {
    if (isMissingPrismaModelStorageError(error, "AiModelConfig")) {
      return [];
    }

    throw error;
  }
}

export async function createModelByKind(
  userId: string,
  kind: AiModelKind,
  input: ModelInput
) {
  return prisma.$transaction(async (tx) => {
    const provider = await tx.aiProvider.findFirst({
      where: {
        id: input.providerId,
        userId
      }
    });

    if (!provider) {
      throw new NotFoundError("Provider not found");
    }

    if (input.isDefault) {
      await tx.aiModelConfig.updateMany({
        where: {
          kind,
          userId
        },
        data: {
          isDefault: false
        }
      });
    }

    const model = await tx.aiModelConfig.create({
      data: {
        displayName: input.displayName,
        isDefault: input.isDefault,
        isEnabled: input.isDefault ? true : input.isEnabled,
        kind,
        modelId: input.modelId,
        providerId: input.providerId,
        temperature: input.temperature,
        userId
      },
      include: modelProviderInclude
    });

    return serializeModel(model);
  });
}

export async function updateModelByKind(
  userId: string,
  kind: AiModelKind,
  modelId: string,
  input: ModelInput
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.aiModelConfig.findFirst({
      where: {
        id: modelId,
        kind,
        userId
      }
    });

    if (!existing) {
      throw new NotFoundError();
    }

    const provider = await tx.aiProvider.findFirst({
      where: {
        id: input.providerId,
        userId
      }
    });

    if (!provider) {
      throw new NotFoundError("Provider not found");
    }

    if (input.isDefault) {
      await tx.aiModelConfig.updateMany({
        where: {
          kind,
          userId,
          NOT: {
            id: modelId
          }
        },
        data: {
          isDefault: false
        }
      });
    }

    const model = await tx.aiModelConfig.update({
      where: {
        id: modelId
      },
      data: {
        displayName: input.displayName,
        isDefault: input.isDefault,
        isEnabled: input.isDefault ? true : input.isEnabled,
        modelId: input.modelId,
        providerId: input.providerId,
        temperature: input.temperature
      },
      include: modelProviderInclude
    });

    return serializeModel(model);
  });
}

export async function deleteModelByKind(
  userId: string,
  kind: AiModelKind,
  modelId: string
) {
  const result = await prisma.aiModelConfig.deleteMany({
    where: {
      id: modelId,
      kind,
      userId
    }
  });

  if (result.count === 0) {
    throw new NotFoundError();
  }
}

export async function setDefaultModelByKind(
  userId: string,
  kind: AiModelKind,
  modelId: string
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.aiModelConfig.findFirst({
      where: {
        id: modelId,
        kind,
        userId
      }
    });

    if (!existing) {
      throw new NotFoundError();
    }

    await tx.aiModelConfig.updateMany({
      where: {
        kind,
        userId
      },
      data: {
        isDefault: false
      }
    });

    const model = await tx.aiModelConfig.update({
      where: {
        id: modelId
      },
      data: {
        isDefault: true,
        isEnabled: true
      },
      include: modelProviderInclude
    });

    return serializeModel(model);
  });
}

export function listModels(userId: string) {
  return listModelsByKind(userId, AiModelKind.LLM);
}

export function createModel(userId: string, input: ModelInput) {
  return createModelByKind(userId, AiModelKind.LLM, input);
}

export function updateModel(userId: string, modelId: string, input: ModelInput) {
  return updateModelByKind(userId, AiModelKind.LLM, modelId, input);
}

export function deleteModel(userId: string, modelId: string) {
  return deleteModelByKind(userId, AiModelKind.LLM, modelId);
}

export function setDefaultModel(userId: string, modelId: string) {
  return setDefaultModelByKind(userId, AiModelKind.LLM, modelId);
}

export function listImageModels(userId: string) {
  return listModelsByKind(userId, AiModelKind.IMAGE);
}

export function createImageModel(userId: string, input: ImageModelInput) {
  return createModelByKind(userId, AiModelKind.IMAGE, input);
}

export function updateImageModel(
  userId: string,
  imageModelId: string,
  input: ImageModelInput
) {
  return updateModelByKind(userId, AiModelKind.IMAGE, imageModelId, input);
}

export function deleteImageModel(userId: string, imageModelId: string) {
  return deleteModelByKind(userId, AiModelKind.IMAGE, imageModelId);
}

export function setDefaultImageModel(userId: string, imageModelId: string) {
  return setDefaultModelByKind(userId, AiModelKind.IMAGE, imageModelId);
}

export function listEmbeddingModels(userId: string) {
  return listModelsByKind(userId, AiModelKind.EMBEDDING);
}

export function createEmbeddingModel(
  userId: string,
  input: EmbeddingModelInput
) {
  return createModelByKind(userId, AiModelKind.EMBEDDING, input);
}

export function updateEmbeddingModel(
  userId: string,
  embeddingModelId: string,
  input: EmbeddingModelInput
) {
  return updateModelByKind(
    userId,
    AiModelKind.EMBEDDING,
    embeddingModelId,
    input
  );
}

export function deleteEmbeddingModel(userId: string, embeddingModelId: string) {
  return deleteModelByKind(userId, AiModelKind.EMBEDDING, embeddingModelId);
}

export function setDefaultEmbeddingModel(
  userId: string,
  embeddingModelId: string
) {
  return setDefaultModelByKind(userId, AiModelKind.EMBEDDING, embeddingModelId);
}

export async function getUserDefaultAiEnv(
  userId: string
): Promise<AiDeckEnv | null> {
  let model: Prisma.AiModelConfigGetPayload<{
    include: {
      provider: true;
    };
  }> | null;

  try {
    model = await prisma.aiModelConfig.findFirst({
      where: {
        isDefault: true,
        isEnabled: true,
        kind: AiModelKind.LLM,
        provider: {
          isEnabled: true
        },
        userId
      },
      include: {
        provider: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  } catch (error) {
    if (isMissingPrismaModelStorageError(error, "AiModelConfig")) {
      return null;
    }

    throw error;
  }

  if (!model) {
    return null;
  }

  const apiKey = model.provider.encryptedApiKey
    ? decryptSecret(model.provider.encryptedApiKey)
    : "local-provider";

  return {
    AI_TEXT_MODEL: model.modelId,
    AI_TEXT_TEMPERATURE: String(model.temperature),
    OPENAI_API_KEY: apiKey,
    OPENAI_BASE_URL: model.provider.baseUrl
  };
}

export async function getUserDefaultImageEnv(
  userId: string
): Promise<AiImageEnv | null> {
  let model: Prisma.AiModelConfigGetPayload<{
    include: {
      provider: true;
    };
  }> | null;

  try {
    model = await prisma.aiModelConfig.findFirst({
      where: {
        isDefault: true,
        isEnabled: true,
        kind: AiModelKind.IMAGE,
        provider: {
          isEnabled: true
        },
        userId
      },
      include: {
        provider: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  } catch (error) {
    if (isMissingPrismaModelStorageError(error, "AiModelConfig")) {
      return null;
    }

    throw error;
  }

  if (!model) {
    return null;
  }

  return {
    AI_IMAGE_MODEL: model.modelId,
    IMAGE_API_KEY: model.provider.encryptedApiKey
      ? decryptSecret(model.provider.encryptedApiKey)
      : undefined,
    IMAGE_BASE_URL: model.provider.baseUrl
  };
}

export function buildProviderModelsUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  const normalizedPath = url.pathname.replace(/\/+$/, "");

  url.pathname = `${normalizedPath}/models`;
  url.search = "";
  url.hash = "";

  return url.toString();
}

function extractProviderModels(payload: unknown): AvailableProviderModelDto[] {
  const source = getProviderModelSource(payload);
  const modelsById = new Map<string, AvailableProviderModelDto>();

  for (const item of source) {
    if (!isRecord(item)) {
      continue;
    }

    const id =
      readString(item.id) ?? readString(item.model) ?? readString(item.name);

    if (!id) {
      continue;
    }

    const displayName =
      readString(item.display_name) ??
      readString(item.displayName) ??
      readString(item.name) ??
      id;
    const ownedBy =
      readString(item.owned_by) ??
      readString(item.ownedBy) ??
      readString(item.owner);
    const createdAt = readCreatedAt(item.created) ?? readCreatedAt(item.created_at);

    modelsById.set(id, {
      ...(createdAt ? { createdAt } : {}),
      displayName,
      id,
      ...(ownedBy ? { ownedBy } : {})
    });
  }

  return Array.from(modelsById.values()).sort((first, second) =>
    first.id.localeCompare(second.id)
  );
}

const providerModelFamilyFilters = [
  {
    modelPrefixes: ["doubao"],
    providerTokens: ["doubao", "豆包"]
  },
  {
    modelPrefixes: ["deepseek"],
    providerTokens: ["deepseek", "深度求索"]
  }
] as const;

function filterProviderModelsForProvider(
  models: AvailableProviderModelDto[],
  provider: Pick<ProviderWithCount, "name" | "slug">
) {
  const providerIdentity = `${provider.slug} ${provider.name}`.toLowerCase();
  const filter = providerModelFamilyFilters.find(({ providerTokens }) =>
    providerTokens.some((token) => providerIdentity.includes(token))
  );

  if (!filter) {
    return models;
  }

  return models.filter((model) =>
    filter.modelPrefixes.some((prefix) => modelBelongsToFamily(model, prefix))
  );
}

function modelBelongsToFamily(
  model: AvailableProviderModelDto,
  familyPrefix: string
) {
  return [model.id, model.displayName, model.ownedBy].some((value) =>
    value ? modelTextMatchesFamily(value, familyPrefix) : false
  );
}

function modelTextMatchesFamily(value: string, familyPrefix: string) {
  const normalized = value.toLowerCase();

  if (normalized.startsWith(familyPrefix)) {
    return true;
  }

  return normalized.split(/[^a-z0-9]+/).includes(familyPrefix);
}

function getProviderModelSource(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.models)) {
    return payload.models;
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readCreatedAt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  return readString(value);
}

async function readProviderErrorBody(response: Response) {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
