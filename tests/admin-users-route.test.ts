import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => {
  class UnauthorizedError extends Error {}

  return {
    UnauthorizedError,
    requireAdminUser: vi.fn()
  };
});

const adminUsers = vi.hoisted(() => {
  class LastAdminRequiredError extends Error {}
  class SelfAdminChangeBlockedError extends Error {}

  return {
    LastAdminRequiredError,
    SelfAdminChangeBlockedError,
    listAdminUsers: vi.fn(),
    updateAdminUser: vi.fn()
  };
});

vi.mock("@/lib/auth/session", () => ({
  UnauthorizedError: auth.UnauthorizedError,
  requireAdminUser: auth.requireAdminUser
}));

vi.mock("@/lib/admin/users", () => adminUsers);

import { PATCH } from "@/app/api/admin/users/[id]/route";
import { GET } from "@/app/api/admin/users/route";
import { ForbiddenError } from "@/lib/auth/access";

const adminUser = {
  email: "admin@example.com",
  id: "admin-1",
  isActive: true,
  role: "ADMIN"
};

describe("admin user routes", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    auth.requireAdminUser.mockRejectedValue(new auth.UnauthorizedError());

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("UNAUTHORIZED");
  });

  it("rejects non-admin users", async () => {
    auth.requireAdminUser.mockRejectedValue(new ForbiddenError());

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("FORBIDDEN");
  });

  it("lists users for administrators", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    adminUsers.listAdminUsers.mockResolvedValue([
      {
        counts: {
          models: 0,
          providers: 0,
          sessions: 1
        },
        createdAt: "2026-05-22T00:00:00.000Z",
        email: "user@example.com",
        id: "user-1",
        isActive: true,
        role: "USER",
        updatedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.users).toHaveLength(1);
  });

  it("updates users through the administrator identity", async () => {
    auth.requireAdminUser.mockResolvedValue(adminUser);
    adminUsers.updateAdminUser.mockResolvedValue({
      counts: {
        models: 0,
        providers: 0,
        sessions: 0
      },
      createdAt: "2026-05-22T00:00:00.000Z",
      email: "user@example.com",
      id: "user-1",
      isActive: false,
      role: "USER",
      updatedAt: "2026-05-22T00:00:00.000Z"
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        body: JSON.stringify({
          isActive: false
        }),
        method: "PATCH"
      }),
      {
        params: Promise.resolve({
          id: "user-1"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(adminUsers.updateAdminUser).toHaveBeenCalledWith("admin-1", "user-1", {
      isActive: false
    });
    expect(payload.user.isActive).toBe(false);
  });
});
