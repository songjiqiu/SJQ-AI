import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    session: {
      deleteMany: vi.fn()
    },
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  };

  return {
    prisma: {
      $transaction: vi.fn((callback) => callback(tx)),
      user: {
        findMany: vi.fn()
      }
    },
    tx
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

import {
  LastAdminRequiredError,
  SelfAdminChangeBlockedError,
  listAdminUsers,
  updateAdminUser
} from "@/lib/admin/users";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _count: {
      aiModels: 3,
      providers: 2,
      sessions: 1
    },
    createdAt: new Date("2026-05-22T00:00:00.000Z"),
    email: "user@example.com",
    id: "user-1",
    isActive: true,
    passwordHash: "secret",
    role: "USER",
    updatedAt: new Date("2026-05-22T00:00:00.000Z"),
    ...overrides
  };
}

describe("admin user service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists safe user DTOs with related counts", async () => {
    db.prisma.user.findMany.mockResolvedValue([makeUser()]);

    const users = await listAdminUsers();

    expect(users).toEqual([
      {
        counts: {
          models: 3,
          providers: 2,
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
    expect(users[0]).not.toHaveProperty("passwordHash");
    expect(db.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          _count: {
            select: {
              aiModels: true,
              providers: true,
              sessions: true
            }
          }
        }
      })
    );
  });

  it("disables a user and immediately clears their sessions", async () => {
    db.tx.user.findUnique.mockResolvedValue(makeUser());
    db.tx.user.update.mockResolvedValue(
      makeUser({
        _count: {
          aiModels: 3,
          providers: 2,
          sessions: 1
        },
        isActive: false
      })
    );

    const user = await updateAdminUser("admin-1", "user-1", {
      isActive: false
    });

    expect(db.tx.session.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1"
      }
    });
    expect(user.isActive).toBe(false);
    expect(user.counts.sessions).toBe(0);
  });

  it("blocks administrators from removing their own access", async () => {
    db.tx.user.findUnique.mockResolvedValue(
      makeUser({
        id: "admin-1",
        role: "ADMIN"
      })
    );

    await expect(
      updateAdminUser("admin-1", "admin-1", {
        role: "USER"
      })
    ).rejects.toBeInstanceOf(SelfAdminChangeBlockedError);
  });

  it("keeps at least one active administrator", async () => {
    db.tx.user.findUnique.mockResolvedValue(
      makeUser({
        id: "admin-2",
        role: "ADMIN"
      })
    );
    db.tx.user.count.mockResolvedValue(0);

    await expect(
      updateAdminUser("admin-1", "admin-2", {
        isActive: false
      })
    ).rejects.toBeInstanceOf(LastAdminRequiredError);
  });
});
