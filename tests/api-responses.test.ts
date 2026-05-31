import { describe, expect, it } from "vitest";

import {
  handleApiError,
  sanitizeApiErrorDetails
} from "@/lib/api/responses";
import {
  AiJsonError,
  type AiJsonErrorDetails
} from "@/lib/ai-deck/openai-json";
import { ActiveGenerationExistsError } from "@/lib/decks/errors";

describe("API error responses", () => {
  it("maps missing Prisma storage to a migration-required error", async () => {
    const response = handleApiError({
      code: "P2021",
      message: "The table `AiModelConfig` does not exist"
    });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe("DATABASE_MIGRATION_REQUIRED");
  });

  it("returns AI JSON diagnostics in error details", async () => {
    const details: AiJsonErrorDetails = {
      attempts: [
        {
          error: "Expected string",
          mode: "json_schema",
          responseSnippet: "{\"deckTitle\":1}",
          stage: "validation",
          zodIssues: [
            {
              code: "invalid_type",
              message: "Invalid input",
              path: ["deckTitle"]
            }
          ]
        }
      ],
      message: "AI JSON output failed validation after retry.",
      model: "test-model",
      schemaName: "DeckStructureOutlineResult"
    };
    const response = handleApiError(
      new AiJsonError(details.message, details)
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBe("AI_JSON_GENERATION_FAILED");
    expect(payload.details).toEqual(details);
  });

  it("maps unknown errors to internal errors with the original message in details", async () => {
    const response = handleApiError(new Error("真实失败原因"));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      details: {
        message: "真实失败原因"
      },
      error: "INTERNAL_ERROR"
    });
  });

  it("maps active generation conflicts to 409", async () => {
    const response = handleApiError(new ActiveGenerationExistsError());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("ACTIVE_GENERATION_EXISTS");
  });

  it("redacts secrets from error details", async () => {
    const details = sanitizeApiErrorDetails({
      apiKey: "sk-secret",
      authorization: "Bearer token-secret",
      DATABASE_URL: "mysql://root:root@localhost:3306/ai-ppt",
      nested: {
        password: "plain-password",
        message:
          "authorization: Bearer raw-token password=raw-password api_key=raw-key mysql://root:root@localhost:3306/ai-ppt"
      }
    });

    expect(details).toEqual({
      apiKey: "[REDACTED]",
      authorization: "[REDACTED]",
      DATABASE_URL: "mysql://root:***@localhost:3306/ai-ppt",
      nested: {
        password: "[REDACTED]",
        message:
          "authorization: Bearer [REDACTED] password=[REDACTED] api_key=[REDACTED] mysql://root:***@localhost:3306/ai-ppt"
      }
    });
  });
});
