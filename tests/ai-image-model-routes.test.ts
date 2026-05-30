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
  createImageModel: vi.fn(),
  deleteImageModel: vi.fn(),
  listImageModels: vi.fn(),
  setDefaultImageModel: vi.fn(),
  updateImageModel: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireCurrentUser: auth.requireCurrentUser
}));

vi.mock("@/lib/ai-config/service", () => aiConfig);

import {
  GET as GET_IMAGE_MODELS,
  POST as POST_IMAGE_MODEL
} from "@/app/api/ai/image-models/route";
import {
  DELETE as DELETE_IMAGE_MODEL,
  PATCH as PATCH_IMAGE_MODEL
} from "@/app/api/ai/image-models/[id]/route";
import { POST as POST_DEFAULT_IMAGE_MODEL } from "@/app/api/ai/image-models/[id]/default/route";

const imageModel = {
  createdAt: "2026-05-30T00:00:00.000Z",
  displayName: "gpt-image-2",
  id: "image-model-1",
  isDefault: true,
  isEnabled: true,
  kind: "IMAGE",
  modelId: "gpt-image-2",
  providerId: "provider-1",
  providerName: "OpenAI",
  providerSlug: "openai",
  temperature: 0.7,
  updatedAt: "2026-05-30T00:00:00.000Z"
};

describe("image model routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists and creates current-user image models", async () => {
    aiConfig.listImageModels.mockResolvedValue([imageModel]);
    aiConfig.createImageModel.mockResolvedValue(imageModel);

    const listResponse = await GET_IMAGE_MODELS();
    const createResponse = await POST_IMAGE_MODEL(
      new Request("http://localhost/api/ai/image-models", {
        body: JSON.stringify({
          displayName: "gpt-image-2",
          isDefault: true,
          modelId: "gpt-image-2",
          providerId: "provider-1",
          temperature: 0.7
        }),
        method: "POST"
      })
    );
    const listPayload = await listResponse.json();
    const createPayload = await createResponse.json();

    expect(listPayload.imageModels).toHaveLength(1);
    expect(createResponse.status).toBe(201);
    expect(createPayload.imageModel.id).toBe("image-model-1");
    expect(aiConfig.createImageModel).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        modelId: "gpt-image-2",
        providerId: "provider-1"
      })
    );
  });

  it("updates, deletes, and sets default image models", async () => {
    aiConfig.updateImageModel.mockResolvedValue(imageModel);
    aiConfig.setDefaultImageModel.mockResolvedValue(imageModel);
    aiConfig.deleteImageModel.mockResolvedValue(undefined);

    const updateResponse = await PATCH_IMAGE_MODEL(
      new Request("http://localhost/api/ai/image-models/image-model-1", {
        body: JSON.stringify({
          displayName: "gpt-image-2",
          isDefault: true,
          modelId: "gpt-image-2",
          providerId: "provider-1",
          temperature: 0.7
        }),
        method: "PATCH"
      }),
      {
        params: Promise.resolve({
          id: "image-model-1"
        })
      }
    );
    const defaultResponse = await POST_DEFAULT_IMAGE_MODEL(
      new Request("http://localhost/api/ai/image-models/image-model-1/default", {
        method: "POST"
      }),
      {
        params: Promise.resolve({
          id: "image-model-1"
        })
      }
    );
    const deleteResponse = await DELETE_IMAGE_MODEL(
      new Request("http://localhost/api/ai/image-models/image-model-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "image-model-1"
        })
      }
    );

    expect(updateResponse.status).toBe(200);
    expect(defaultResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(aiConfig.updateImageModel).toHaveBeenCalledWith(
      "user-1",
      "image-model-1",
      expect.any(Object)
    );
    expect(aiConfig.setDefaultImageModel).toHaveBeenCalledWith(
      "user-1",
      "image-model-1"
    );
    expect(aiConfig.deleteImageModel).toHaveBeenCalledWith(
      "user-1",
      "image-model-1"
    );
  });
});
