import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireCurrentUser: vi.fn(async () => ({
    email: "tester@example.com",
    id: "user-1"
  }))
}));

vi.mock("@/lib/ai-config/service", () => ({
  NotFoundError: class NotFoundError extends Error {},
  getUserDefaultAiEnv: vi.fn(async () => null)
}));

import { POST } from "@/app/api/decks/analyze/route";

describe("POST /api/decks/analyze", () => {
  it("returns mock analysis for an authenticated user when OPENAI_API_KEY is empty", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await POST(
      new Request("http://localhost/api/decks/analyze", {
        method: "POST",
        body: JSON.stringify({
          sourceText:
            "这是一段用于测试接口的长文本，包含市场机会、产品优势、合作路径和执行计划。",
          audience: "投资人",
          goal: "获得试点合作意向",
          pageCount: 6,
          deckType: "business-report",
          palette: "star-map",
          locale: "zh-CN"
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("mock");
    expect(payload.unifiedVisualSpec).toBeDefined();
    expect(payload.slides).toHaveLength(6);

    vi.unstubAllEnvs();
  });
});
