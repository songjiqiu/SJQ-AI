import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    aiModelConfig: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    aiProvider: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

vi.mock("@/lib/auth/crypto", () => ({
  decryptSecret: vi.fn((value: string) => `decrypted:${value}`),
  encryptSecret: vi.fn((value: string) => `encrypted:${value}`)
}));

import {
  buildProviderModelsUrl,
  getUserDefaultImageEnv,
  listProviders,
  listImageModels,
  listProviderAvailableModels,
  setDefaultModelByKind
} from "@/lib/ai-config/service";

describe("AI configuration service", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds the OpenAI-compatible models URL from a provider base URL", () => {
    expect(
      buildProviderModelsUrl("https://ark.cn-beijing.volces.com/api/v3")
    ).toBe("https://ark.cn-beijing.volces.com/api/v3/models");
    expect(buildProviderModelsUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1/models"
    );
  });

  it("fetches and normalizes provider model options", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          {
            created: 1779408000,
            id: "deepseek-chat",
            owned_by: "deepseek"
          },
          {
            display_name: "DeepSeek Reasoner",
            id: "deepseek-reasoner"
          }
        ]
      })
    );

    db.prisma.aiProvider.findFirst.mockResolvedValue({
      baseUrl: "https://api.deepseek.com/v1",
      encryptedApiKey: null,
      id: "provider-1",
      name: "DeepSeek",
      slug: "deepseek"
    });
    vi.stubGlobal("fetch", fetchMock);

    const models = await listProviderAvailableModels("user-1", "provider-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/v1/models",
      expect.objectContaining({
        headers: {
          Accept: "application/json"
        }
      })
    );
    expect(models).toEqual([
      {
        createdAt: "2026-05-22T00:00:00.000Z",
        displayName: "deepseek-chat",
        id: "deepseek-chat",
        ownedBy: "deepseek"
      },
      {
        displayName: "DeepSeek Reasoner",
        id: "deepseek-reasoner"
      }
    ]);
  });

  it("filters mixed provider model lists by common model family prefixes", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: "deepseek-r1-250528",
            owned_by: "deepseek"
          },
          {
            id: "doubao-1-5-pro-32k-250115",
            owned_by: "doubao"
          },
          {
            display_name: "doubao-1-5-lite-32k",
            id: "doubao-1-5-lite-32k-250115"
          }
        ]
      })
    );

    db.prisma.aiProvider.findFirst.mockResolvedValue({
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      encryptedApiKey: null,
      id: "provider-1",
      name: "豆包",
      slug: "doubao"
    });
    vi.stubGlobal("fetch", fetchMock);

    const models = await listProviderAvailableModels("user-1", "provider-1");

    expect(models).toEqual([
      {
        displayName: "doubao-1-5-lite-32k",
        id: "doubao-1-5-lite-32k-250115"
      },
      {
        displayName: "doubao-1-5-pro-32k-250115",
        id: "doubao-1-5-pro-32k-250115",
        ownedBy: "doubao"
      }
    ]);
  });

  it("lists providers with zero model counts when unified model storage is missing", async () => {
    const createdAt = new Date("2026-05-30T00:00:00.000Z");
    const missingStorageError = Object.assign(
      new Error("The table `AiModelConfig` does not exist"),
      {
        code: "P2021"
      }
    );

    db.prisma.aiProvider.findMany
      .mockRejectedValueOnce(missingStorageError)
      .mockResolvedValueOnce([
        {
          baseUrl: "http://localhost:11434/v1",
          createdAt,
          encryptedApiKey: null,
          id: "provider-1",
          isEnabled: true,
          name: "ollama",
          slug: "ollama",
          updatedAt: createdAt,
          userId: "user-1"
        }
      ]);

    await expect(listProviders("user-1")).resolves.toEqual([
      expect.objectContaining({
        id: "provider-1",
        modelCount: 0,
        name: "ollama"
      })
    ]);
  });

  it("lists image models through the unified model table by kind", async () => {
    const createdAt = new Date("2026-05-30T00:00:00.000Z");

    db.prisma.aiModelConfig.findMany.mockResolvedValue([
      {
        createdAt,
        displayName: "gpt-image-2",
        id: "image-model-1",
        isDefault: true,
        isEnabled: true,
        kind: "IMAGE",
        modelId: "gpt-image-2",
        provider: {
          baseUrl: "https://api.openai.com/v1",
          encryptedApiKey: "secret",
          name: "OpenAI",
          slug: "openai"
        },
        providerId: "provider-1",
        temperature: 0.7,
        updatedAt: createdAt
      }
    ]);

    const models = await listImageModels("user-1");

    expect(db.prisma.aiModelConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          kind: "IMAGE",
          userId: "user-1"
        }
      })
    );
    expect(models[0]).toMatchObject({
      displayName: "gpt-image-2",
      kind: "IMAGE",
      providerSlug: "openai"
    });
  });

  it("treats missing unified model storage as empty optional model config", async () => {
    const missingStorageError = Object.assign(
      new Error("The table `AiModelConfig` does not exist"),
      {
        code: "P2021"
      }
    );

    db.prisma.aiModelConfig.findMany.mockRejectedValue(missingStorageError);
    db.prisma.aiModelConfig.findFirst.mockRejectedValue(missingStorageError);

    await expect(listImageModels("user-1")).resolves.toEqual([]);
    await expect(getUserDefaultImageEnv("user-1")).resolves.toBeNull();
  });

  it("reads default image environment from the image model provider", async () => {
    db.prisma.aiModelConfig.findFirst.mockResolvedValue({
      modelId: "gpt-image-2",
      provider: {
        baseUrl: "https://api.openai.com/v1",
        encryptedApiKey: "provider-secret"
      }
    });

    await expect(getUserDefaultImageEnv("user-1")).resolves.toEqual({
      AI_IMAGE_MODEL: "gpt-image-2",
      IMAGE_API_KEY: "decrypted:provider-secret",
      IMAGE_BASE_URL: "https://api.openai.com/v1"
    });
    expect(db.prisma.aiModelConfig.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "IMAGE",
          provider: {
            isEnabled: true
          },
          userId: "user-1"
        })
      })
    );
  });

  it("sets the default model only within the requested model kind", async () => {
    const createdAt = new Date("2026-05-30T00:00:00.000Z");
    const tx = {
      aiModelConfig: {
        findFirst: vi.fn(async () => ({
          id: "image-model-1"
        })),
        update: vi.fn(async () => ({
          createdAt,
          displayName: "gpt-image-2",
          id: "image-model-1",
          isDefault: true,
          isEnabled: true,
          kind: "IMAGE",
          modelId: "gpt-image-2",
          provider: {
            baseUrl: "https://api.openai.com/v1",
            encryptedApiKey: "secret",
            name: "OpenAI",
            slug: "openai"
          },
          providerId: "provider-1",
          temperature: 0.7,
          updatedAt: createdAt
        })),
        updateMany: vi.fn()
      }
    };

    db.prisma.$transaction = vi.fn(async (callback) => callback(tx));

    await setDefaultModelByKind("user-1", "IMAGE", "image-model-1");

    expect(tx.aiModelConfig.updateMany).toHaveBeenCalledWith({
      data: {
        isDefault: false
      },
      where: {
        kind: "IMAGE",
        userId: "user-1"
      }
    });
  });
});
