import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireCurrentUser: vi.fn(async () => ({
    email: "tester@example.com",
    id: "user-1"
  }))
}));

const aiConfig = vi.hoisted(() => ({
  NotFoundError: class NotFoundError extends Error {},
  createEmbeddingModel: vi.fn(),
  deleteEmbeddingModel: vi.fn(),
  listEmbeddingModels: vi.fn(),
  setDefaultEmbeddingModel: vi.fn(),
  updateEmbeddingModel: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireCurrentUser: auth.requireCurrentUser
}));

vi.mock("@/lib/ai-config/service", () => aiConfig);

import {
  GET as GET_EMBEDDING_MODELS,
  POST as POST_EMBEDDING_MODEL
} from "@/app/api/ai/embedding-models/route";
import {
  DELETE as DELETE_EMBEDDING_MODEL,
  PATCH as PATCH_EMBEDDING_MODEL
} from "@/app/api/ai/embedding-models/[id]/route";
import { POST as POST_DEFAULT_EMBEDDING_MODEL } from "@/app/api/ai/embedding-models/[id]/default/route";

const embeddingModel = {
  createdAt: "2026-05-30T00:00:00.000Z",
  displayName: "text-embedding-3-small",
  id: "embedding-model-1",
  isDefault: true,
  isEnabled: true,
  kind: "EMBEDDING",
  modelId: "text-embedding-3-small",
  providerId: "provider-1",
  providerName: "OpenAI",
  providerSlug: "openai",
  temperature: 0.7,
  updatedAt: "2026-05-30T00:00:00.000Z"
};

describe("embedding model routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists and creates current-user embedding models", async () => {
    aiConfig.listEmbeddingModels.mockResolvedValue([embeddingModel]);
    aiConfig.createEmbeddingModel.mockResolvedValue(embeddingModel);

    const listResponse = await GET_EMBEDDING_MODELS();
    const createResponse = await POST_EMBEDDING_MODEL(
      new Request("http://localhost/api/ai/embedding-models", {
        body: JSON.stringify({
          displayName: "text-embedding-3-small",
          isDefault: true,
          modelId: "text-embedding-3-small",
          providerId: "provider-1",
          temperature: 0.7
        }),
        method: "POST"
      })
    );
    const listPayload = await listResponse.json();
    const createPayload = await createResponse.json();

    expect(listPayload.embeddingModels).toHaveLength(1);
    expect(createResponse.status).toBe(201);
    expect(createPayload.embeddingModel.id).toBe("embedding-model-1");
    expect(aiConfig.createEmbeddingModel).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        modelId: "text-embedding-3-small",
        providerId: "provider-1"
      })
    );
  });

  it("updates, deletes, and sets default embedding models", async () => {
    aiConfig.updateEmbeddingModel.mockResolvedValue(embeddingModel);
    aiConfig.setDefaultEmbeddingModel.mockResolvedValue(embeddingModel);
    aiConfig.deleteEmbeddingModel.mockResolvedValue(undefined);

    const updateResponse = await PATCH_EMBEDDING_MODEL(
      new Request("http://localhost/api/ai/embedding-models/embedding-model-1", {
        body: JSON.stringify({
          displayName: "text-embedding-3-small",
          isDefault: true,
          modelId: "text-embedding-3-small",
          providerId: "provider-1",
          temperature: 0.7
        }),
        method: "PATCH"
      }),
      {
        params: Promise.resolve({
          id: "embedding-model-1"
        })
      }
    );
    const defaultResponse = await POST_DEFAULT_EMBEDDING_MODEL(
      new Request(
        "http://localhost/api/ai/embedding-models/embedding-model-1/default",
        {
          method: "POST"
        }
      ),
      {
        params: Promise.resolve({
          id: "embedding-model-1"
        })
      }
    );
    const deleteResponse = await DELETE_EMBEDDING_MODEL(
      new Request("http://localhost/api/ai/embedding-models/embedding-model-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "embedding-model-1"
        })
      }
    );

    expect(updateResponse.status).toBe(200);
    expect(defaultResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(aiConfig.updateEmbeddingModel).toHaveBeenCalledWith(
      "user-1",
      "embedding-model-1",
      expect.any(Object)
    );
    expect(aiConfig.setDefaultEmbeddingModel).toHaveBeenCalledWith(
      "user-1",
      "embedding-model-1"
    );
    expect(aiConfig.deleteEmbeddingModel).toHaveBeenCalledWith(
      "user-1",
      "embedding-model-1"
    );
  });
});
