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
  generateDeckFromOutlineDraftSchema: {
    parse: vi.fn((value) => value)
  },
  generateDeckFromOutlineDraftForUser: vi.fn(),
  generateDeckForUser: vi.fn(),
  getDeckAssetForUser: vi.fn(),
  getDeckProjectForUser: vi.fn(),
  getDeckPptxAssetForUser: vi.fn(),
  listDeckProjects: vi.fn()
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
vi.mock("@/lib/decks/service", () => deckService);
vi.mock("@/lib/decks/storage", () => storage);

import { GET as GET_DECKS } from "@/app/api/decks/route";
import { POST as POST_GENERATE } from "@/app/api/decks/generate/route";
import { GET as GET_DECK } from "@/app/api/decks/[id]/route";
import { GET as GET_PPTX } from "@/app/api/decks/[id]/pptx/route";
import { GET as GET_ASSET } from "@/app/api/decks/[id]/assets/[assetId]/route";

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

  it("generates and saves a deck for the current user", async () => {
    deckService.generateDeckFromOutlineDraftForUser.mockResolvedValue(generatedDeck);

    const response = await POST_GENERATE(
      new Request("http://localhost/api/decks/generate", {
        body: JSON.stringify({
          outlineDraftId: "draft-1"
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe("deck-1");
    expect(deckService.generateDeckFromOutlineDraftForUser).toHaveBeenCalledWith(
      "user-1",
      "draft-1",
      expect.any(Object)
    );
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
