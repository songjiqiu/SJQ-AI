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
  analyzeDeckOutlineIntentForUser: vi.fn(),
  createDeckOutlineDraftForUser: vi.fn(),
  deleteDeckOutlineDraftForUser: vi.fn(),
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
vi.mock("@/lib/decks/errors", () => ({
  ActiveGenerationExistsError: class ActiveGenerationExistsError extends Error {}
}));
vi.mock("@/lib/decks/service", () => ({
  DeckProjectNotFoundError: class DeckProjectNotFoundError extends Error {}
}));

import {
  GET as GET_OUTLINES,
  POST as POST_OUTLINE
} from "@/app/api/decks/outline/route";
import { POST as POST_ANALYZE_OUTLINE } from "@/app/api/decks/outline/analyze/route";
import {
  DELETE as DELETE_OUTLINE,
  GET as GET_OUTLINE,
  PATCH as PATCH_OUTLINE
} from "@/app/api/decks/outline/[id]/route";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";

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
          deckType: "fundraising-pitch",
          style: "strategic",
          palette: "star-map",
          locale: "zh-CN",
          confirmedIntent: {
            deckType: "fundraising-pitch",
            style: "strategic",
            audience: "投资人",
            goal: "获得试点合作意向",
            coreMessage: "用市场机会与试点成果证明合作价值。",
            recommendedPageCount: 3
          }
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
        deckType: "fundraising-pitch",
        confirmedIntent: expect.objectContaining({
          audience: "投资人",
          recommendedPageCount: 3
        })
      }),
      expect.any(Object)
    );
  });

  it("analyzes outline intent without creating a draft", async () => {
    outlineService.createDeckOutlineDraftForUser.mockClear();
    outlineService.analyzeDeckOutlineIntentForUser.mockResolvedValue({
      input: {
        idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
        sourceText: "",
        textFiles: [],
        deckType: "fundraising-pitch",
        style: "strategic",
        palette: "star-map",
        locale: "zh-CN"
      },
      fileSummaries: [],
      deckType: "fundraising-pitch",
      style: "strategic",
      audience: "投资人",
      goal: "获得试点合作意向",
      coreMessage: "用市场机会与试点成果证明合作价值。",
      recommendedPageCount: 5
    });

    const response = await POST_ANALYZE_OUTLINE(
      new Request("http://localhost/api/decks/outline/analyze", {
        body: JSON.stringify({
          idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
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
    expect(payload.recommendedPageCount).toBe(5);
    expect(outlineService.analyzeDeckOutlineIntentForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        deckType: "fundraising-pitch"
      }),
      expect.any(Object)
    );
    expect(outlineService.createDeckOutlineDraftForUser).not.toHaveBeenCalled();
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

  it("deletes current-user outline drafts", async () => {
    outlineService.deleteDeckOutlineDraftForUser.mockResolvedValue(undefined);

    const response = await DELETE_OUTLINE(
      new Request("http://localhost/api/decks/outline/draft-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "draft-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true
    });
    expect(outlineService.deleteDeckOutlineDraftForUser).toHaveBeenCalledWith(
      "user-1",
      "draft-1"
    );
  });

  it("returns 409 when deleting an outline draft with active generation", async () => {
    outlineService.deleteDeckOutlineDraftForUser.mockRejectedValue(
      new ActiveGenerationExistsError()
    );

    const response = await DELETE_OUTLINE(
      new Request("http://localhost/api/decks/outline/draft-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "draft-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("ACTIVE_GENERATION_EXISTS");
  });
});
