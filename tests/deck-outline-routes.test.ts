import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(async () => ({
    email: "tester@example.com",
    id: "user-1"
  }))
}));

const aiConfig = vi.hoisted(() => ({
  getUserDefaultAiEnv: vi.fn(async () => null)
}));

const outlineService = vi.hoisted(() => ({
  createDeckOutlineDraftForUser: vi.fn(),
  getDeckOutlineDraftForUser: vi.fn(),
  listDeckOutlineDrafts: vi.fn(),
  updateDeckOutlineDraftForUser: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireCurrentUser: auth.requireCurrentUser
}));

vi.mock("@/lib/ai-config/service", () => ({
  NotFoundError: class NotFoundError extends Error {},
  getUserDefaultAiEnv: aiConfig.getUserDefaultAiEnv
}));

vi.mock("@/lib/deck-outline/service", () => outlineService);
vi.mock("@/lib/decks/service", () => ({
  DeckProjectNotFoundError: class DeckProjectNotFoundError extends Error {}
}));

import {
  GET as GET_OUTLINES,
  POST as POST_OUTLINE
} from "@/app/api/decks/outline/route";
import {
  GET as GET_OUTLINE,
  PATCH as PATCH_OUTLINE
} from "@/app/api/decks/outline/[id]/route";

const draft = {
  id: "draft-1",
  deckTitle: "测试大纲",
  deckSummary: "这是一份用于测试的大纲摘要。",
  mode: "mock",
  slides: [],
  createdAt: "2026-05-30T00:00:00.000Z",
  updatedAt: "2026-05-30T00:00:00.000Z"
};

describe("deck outline routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates an outline draft for the current user", async () => {
    outlineService.createDeckOutlineDraftForUser.mockResolvedValue(draft);

    const response = await POST_OUTLINE(
      new Request("http://localhost/api/decks/outline", {
        body: JSON.stringify({
          idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
          audience: "投资人",
          goal: "获得试点合作意向",
          pageCount: 3,
          deckType: "fundraising-pitch",
          style: "strategic",
          palette: "star-map",
          locale: "zh-CN"
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe("draft-1");
    expect(outlineService.createDeckOutlineDraftForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        audience: "投资人",
        deckType: "fundraising-pitch"
      }),
      expect.any(Object)
    );
  });

  it("lists, reads, and updates current-user outline drafts", async () => {
    outlineService.listDeckOutlineDrafts.mockResolvedValue([draft]);
    outlineService.getDeckOutlineDraftForUser.mockResolvedValue(draft);
    outlineService.updateDeckOutlineDraftForUser.mockResolvedValue({
      ...draft,
      deckTitle: "更新后大纲"
    });

    const listResponse = await GET_OUTLINES();
    const detailResponse = await GET_OUTLINE(
      new Request("http://localhost/api/decks/outline/draft-1"),
      {
        params: Promise.resolve({
          id: "draft-1"
        })
      }
    );
    const updateResponse = await PATCH_OUTLINE(
      new Request("http://localhost/api/decks/outline/draft-1", {
        body: JSON.stringify({
          deckTitle: "更新后大纲"
        }),
        method: "PATCH"
      }),
      {
        params: Promise.resolve({
          id: "draft-1"
        })
      }
    );
    const listPayload = await listResponse.json();
    const detailPayload = await detailResponse.json();
    const updatePayload = await updateResponse.json();

    expect(listPayload.drafts).toHaveLength(1);
    expect(detailPayload.id).toBe("draft-1");
    expect(updatePayload.deckTitle).toBe("更新后大纲");
    expect(outlineService.getDeckOutlineDraftForUser).toHaveBeenCalledWith(
      "user-1",
      "draft-1"
    );
    expect(outlineService.updateDeckOutlineDraftForUser).toHaveBeenCalledWith(
      "user-1",
      "draft-1",
      expect.objectContaining({
        deckTitle: "更新后大纲"
      })
    );
  });
});
