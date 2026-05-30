import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireCurrentUser: vi.fn(async () => ({
    email: "tester@example.com",
    id: "user-1"
  }))
}));

const aiConfig = vi.hoisted(() => ({
  listProviderAvailableModels: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireCurrentUser: auth.requireCurrentUser
}));

vi.mock("@/lib/ai-config/service", () => ({
  NotFoundError: class NotFoundError extends Error {},
  listProviderAvailableModels: aiConfig.listProviderAvailableModels
}));

import { GET } from "@/app/api/ai/providers/[id]/models/route";

describe("GET /api/ai/providers/[id]/models", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists available models through the current user's provider", async () => {
    aiConfig.listProviderAvailableModels.mockResolvedValue([
      {
        displayName: "DeepSeek Chat",
        id: "deepseek-chat"
      }
    ]);

    const response = await GET(
      new Request("http://localhost/api/ai/providers/provider-1/models"),
      {
        params: Promise.resolve({
          id: "provider-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(aiConfig.listProviderAvailableModels).toHaveBeenCalledWith(
      "user-1",
      "provider-1"
    );
    expect(payload.models).toEqual([
      {
        displayName: "DeepSeek Chat",
        id: "deepseek-chat"
      }
    ]);
  });
});
