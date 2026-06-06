import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(async () => ({
    email: "tester@example.com",
    id: "user-1"
  }))
}));

const parser = vi.hoisted(() => ({
  parseDeckInputFiles: vi.fn(async () => ({
    parsedFiles: [
      {
        characterCount: 10,
        extension: ".md",
        id: "src_f001",
        keyPoints: ["试点数据"],
        mimeType: "text/markdown",
        name: "brief.md",
        parser: "markdown",
        size: 10,
        sourceIds: ["src_f001_c001"],
        summary: "试点数据",
        text: "试点数据",
        warnings: []
      }
    ],
    sources: [
      {
        chunkIndex: 1,
        fileId: "src_f001",
        fileName: "brief.md",
        kind: "text",
        label: "brief.md",
        sourceId: "src_f001_c001",
        text: "试点数据"
      }
    ],
    warnings: []
  }))
}));

const aiConfig = vi.hoisted(() => ({
  getUserDefaultAiEnv: vi.fn(async () => ({
    AI_TEXT_MODEL: "gpt-4.1-mini",
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "https://example.com/v1"
  }))
}));

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
  requireCurrentUser: auth.requireCurrentUser
}));

vi.mock("@/lib/ai-config/service", () => ({
  getUserDefaultAiEnv: aiConfig.getUserDefaultAiEnv
}));

vi.mock("@/lib/deck-input/parser", () => parser);

import { POST } from "@/app/api/decks/outline/files/route";

describe("POST /api/decks/outline/files", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("parses multipart files for the current user without creating a draft", async () => {
    const file = {
      arrayBuffer: async () => new TextEncoder().encode("试点数据").buffer,
      name: "brief.md",
      size: 10,
      type: "text/markdown"
    };

    const response = await POST(
      {
        formData: async () => ({
          getAll: (key: string) => (key === "files" ? [file] : [])
        })
      } as unknown as Request
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.parsedFiles[0]).toMatchObject({
      id: "src_f001",
      sourceIds: ["src_f001_c001"]
    });
    expect(payload.sources[0].sourceId).toBe("src_f001_c001");
    expect(auth.requireCurrentUser).toHaveBeenCalled();
    expect(aiConfig.getUserDefaultAiEnv).toHaveBeenCalledWith("user-1");
    expect(parser.parseDeckInputFiles).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          name: "brief.md",
          size: expect.any(Number),
          type: "text/markdown"
        })
      ],
      expect.objectContaining({
        ocrCacheDir: expect.stringContaining("storage"),
        visionEnv: expect.objectContaining({
          AI_TEXT_MODEL: "gpt-4.1-mini"
        })
      })
    );
  });
});
