import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

const session = vi.hoisted(() => {
  class UnauthorizedError extends Error {}

  return {
    UnauthorizedError,
    createUserSession: vi.fn(),
    getSessionCookieOptions: vi.fn(() => ({
      path: "/"
    })),
    sessionCookieName: "pptcm_session"
  };
});

const cookieStore = vi.hoisted(() => ({
  set: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

vi.mock("@/lib/auth/session", () => session);

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore)
}));

import { POST } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth/crypto";

describe("POST /api/auth/login", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects disabled accounts after password verification", async () => {
    db.prisma.user.findUnique.mockResolvedValue({
      email: "disabled@example.com",
      id: "user-1",
      isActive: false,
      passwordHash: hashPassword("correct-password"),
      role: "USER"
    });

    const response = await POST(
      new Request("http://localhost/api/auth/login", {
        body: JSON.stringify({
          email: "disabled@example.com",
          password: "correct-password"
        }),
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("ACCOUNT_DISABLED");
    expect(session.createUserSession).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
