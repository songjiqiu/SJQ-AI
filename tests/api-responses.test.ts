import { describe, expect, it } from "vitest";

import { handleApiError } from "@/lib/api/responses";

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
});
