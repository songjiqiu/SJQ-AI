import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    aiProvider: {
      createMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

import { seedDefaultAiProviders } from "@/lib/auth/seed";

describe("AI provider seed", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates default provider templates without seeding model configs", async () => {
    db.prisma.aiProvider.createMany.mockResolvedValue({ count: 2 });

    await expect(seedDefaultAiProviders("user-1")).resolves.toBeUndefined();
    expect(db.prisma.aiProvider.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true
      })
    );
  });
});
