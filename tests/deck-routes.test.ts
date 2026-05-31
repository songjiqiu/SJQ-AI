import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireCurrentUser: vi.fn(async () => ({
    email: "tester@example.com",
    id: "user-1"
  }))
}));

const deckService = vi.hoisted(() => ({
  DeckProjectNotFoundError: class DeckProjectNotFoundError extends Error {},
  createDeckGenerationTaskForUser: vi.fn(),
  deleteDeckProjectForUser: vi.fn(),
  generateDeckFromOutlineDraftSchema: {
    parse: vi.fn((value) => value)
  },
  generateDeckFromOutlineDraftForUser: vi.fn(),
  generateDeckForUser: vi.fn(),
  getDeckAssetForUser: vi.fn(),
  getDeckGenerationStatusForUser: vi.fn(),
  getDeckProjectForUser: vi.fn(),
  getDeckPptxAssetForUser: vi.fn(),
  listDeckProjects: vi.fn(),
  regenerateDeckSlideForUser: vi.fn(),
  startDeckGenerationTaskForUser: vi.fn(),
  updateDeckSlideForUser: vi.fn()
}));

const aiConfig = vi.hoisted(() => ({
  NotFoundError: class NotFoundError extends Error {},
  getUserDefaultAiEnv: vi.fn(async () => null),
  getUserDefaultImageEnv: vi.fn(async () => null)
}));

const storage = vi.hoisted(() => ({
  readStorageFile: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireCurrentUser: auth.requireCurrentUser
}));

vi.mock("@/lib/ai-config/service", () => aiConfig);
vi.mock("@/lib/decks/errors", () => ({
  ActiveGenerationExistsError: class ActiveGenerationExistsError extends Error {}
}));
vi.mock("@/lib/decks/service", () => deckService);
vi.mock("@/lib/decks/storage", () => storage);

import { GET as GET_DECKS } from "@/app/api/decks/route";
import { POST as POST_GENERATE } from "@/app/api/decks/generate/route";
import {
  DELETE as DELETE_DECK,
  GET as GET_DECK
} from "@/app/api/decks/[id]/route";
import { GET as GET_STATUS } from "@/app/api/decks/[id]/status/route";
import { GET as GET_PPTX } from "@/app/api/decks/[id]/pptx/route";
import { GET as GET_ASSET } from "@/app/api/decks/[id]/assets/[assetId]/route";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";

const generatedDeck = {
  id: "deck-1",
  deckTitle: "测试演示",
  slides: [],
  status: "READY"
};

describe("deck routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts an async deck generation task for the current user", async () => {
    deckService.createDeckGenerationTaskForUser.mockResolvedValue({
      id: "deck-1",
      progress: {
        current: 0,
        message: "queued",
        stage: "queued",
        total: 3
      },
      status: "GENERATING"
    });

    const response = await POST_GENERATE(
      new Request("http://localhost/api/decks/generate", {
        body: JSON.stringify({
          outlineDraftId: "draft-1"
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.id).toBe("deck-1");
    expect(deckService.createDeckGenerationTaskForUser).toHaveBeenCalledWith(
      "user-1",
      "draft-1"
    );
    expect(deckService.startDeckGenerationTaskForUser).toHaveBeenCalledWith(
      "user-1",
      "deck-1",
      expect.any(Object)
    );
  });

  it("does not start a duplicate runner when reusing an active generation task", async () => {
    deckService.createDeckGenerationTaskForUser.mockResolvedValue({
      id: "deck-1",
      progress: {
        current: 1,
        message: "images",
        stage: "images",
        total: 3
      },
      reused: true,
      status: "GENERATING"
    });

    const response = await POST_GENERATE(
      new Request("http://localhost/api/decks/generate", {
        body: JSON.stringify({
          outlineDraftId: "draft-1"
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).not.toHaveProperty("reused");
    expect(payload.id).toBe("deck-1");
    expect(deckService.startDeckGenerationTaskForUser).not.toHaveBeenCalled();
  });

  it("reads async deck generation status", async () => {
    deckService.getDeckGenerationStatusForUser.mockResolvedValue({
      details: {
        current: 3,
        error: null,
        projectId: "deck-1",
        stage: "ready",
        total: 3
      },
      error: null,
      id: "deck-1",
      previewUrl: "/workbench/preview/deck-1",
      progress: {
        current: 3,
        message: "ready",
        stage: "ready",
        total: 3
      },
      status: "READY"
    });

    const response = await GET_STATUS(
      new Request("http://localhost/api/decks/deck-1/status"),
      {
        params: Promise.resolve({
          id: "deck-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("READY");
    expect(payload.details).toEqual({
      current: 3,
      error: null,
      projectId: "deck-1",
      stage: "ready",
      total: 3
    });
    expect(deckService.getDeckGenerationStatusForUser).toHaveBeenCalledWith(
      "user-1",
      "deck-1"
    );
  });

  it("returns async deck generation failure details", async () => {
    deckService.getDeckGenerationStatusForUser.mockResolvedValue({
      details: {
        current: 0,
        error: "AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed",
        projectId: "deck-1",
        stage: "failed",
        total: 3
      },
      error: "AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed",
      id: "deck-1",
      progress: {
        current: 0,
        message: "AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed",
        stage: "failed",
        total: 3
      },
      status: "FAILED"
    });

    const response = await GET_STATUS(
      new Request("http://localhost/api/decks/deck-1/status"),
      {
        params: Promise.resolve({
          id: "deck-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.error).toContain("AI_JSON_GENERATION_FAILED");
    expect(payload.details).toMatchObject({
      error: "AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed",
      projectId: "deck-1",
      stage: "failed"
    });
  });

  it("lists and opens only current-user deck history", async () => {
    deckService.listDeckProjects.mockResolvedValue([
      {
        id: "deck-1",
        deckTitle: "测试演示",
        deckSummary: "摘要",
        mode: "mock",
        reviewScore: 96,
        consistencyScore: 95,
        slideCount: 3,
        status: "READY",
        createdAt: new Date().toISOString()
      }
    ]);
    deckService.getDeckProjectForUser.mockResolvedValue(generatedDeck);

    const listResponse = await GET_DECKS();
    const listPayload = await listResponse.json();
    const detailResponse = await GET_DECK(
      new Request("http://localhost/api/decks/deck-1"),
      {
        params: Promise.resolve({
          id: "deck-1"
        })
      }
    );
    const detailPayload = await detailResponse.json();

    expect(listPayload.projects).toHaveLength(1);
    expect(detailPayload.id).toBe("deck-1");
    expect(deckService.getDeckProjectForUser).toHaveBeenCalledWith(
      "user-1",
      "deck-1"
    );
  });

  it("deletes current-user deck history", async () => {
    deckService.deleteDeckProjectForUser.mockResolvedValue(undefined);

    const response = await DELETE_DECK(
      new Request("http://localhost/api/decks/deck-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "deck-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true
    });
    expect(deckService.deleteDeckProjectForUser).toHaveBeenCalledWith(
      "user-1",
      "deck-1"
    );
  });

  it("returns 409 when deleting deck history with active generation", async () => {
    deckService.deleteDeckProjectForUser.mockRejectedValue(
      new ActiveGenerationExistsError()
    );

    const response = await DELETE_DECK(
      new Request("http://localhost/api/decks/deck-1", {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          id: "deck-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("ACTIVE_GENERATION_EXISTS");
  });

  it("downloads a generated PPTX asset", async () => {
    deckService.getDeckPptxAssetForUser.mockResolvedValue({
      filename: "deck.pptx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      relativePath: "decks/deck-1/deck.pptx"
    });
    storage.readStorageFile.mockResolvedValue({
      bytes: Buffer.from("pptx"),
      lastModified: new Date("2026-05-22T00:00:00.000Z"),
      sizeBytes: 4
    });

    const response = await GET_PPTX(
      new Request("http://localhost/api/decks/deck-1/pptx"),
      {
        params: Promise.resolve({
          id: "deck-1"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("presentationml");
    expect(await response.text()).toBe("pptx");
  });

  it("reads a generated image layer asset", async () => {
    deckService.getDeckAssetForUser.mockResolvedValue({
      mimeType: "image/svg+xml",
      relativePath: "decks/deck-1/layer.svg"
    });
    storage.readStorageFile.mockResolvedValue({
      bytes: Buffer.from("<svg />"),
      lastModified: new Date("2026-05-22T00:00:00.000Z"),
      sizeBytes: 7
    });

    const response = await GET_ASSET(
      new Request("http://localhost/api/decks/deck-1/assets/asset-1"),
      {
        params: Promise.resolve({
          assetId: "asset-1",
          id: "deck-1"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await response.text()).toBe("<svg />");
  });
});
