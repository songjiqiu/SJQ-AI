import type { Prisma } from "@prisma/client";

import { NotFoundError } from "@/lib/ai-config/service";
import type { AdminUserDto } from "@/lib/admin/types";
import type { AdminUserUpdateInput } from "@/lib/admin/schemas";
import { prisma } from "@/lib/db/prisma";

type UserWithCounts = Prisma.UserGetPayload<{
  include: {
    _count: {
      select: {
        aiModels: true;
        providers: true;
        sessions: true;
      };
    };
  };
}>;

export class LastAdminRequiredError extends Error {
  constructor(message = "At least one active administrator is required") {
    super(message);
    this.name = "LastAdminRequiredError";
  }
}

export class SelfAdminChangeBlockedError extends Error {
  constructor(message = "Administrators cannot remove their own access") {
    super(message);
    this.name = "SelfAdminChangeBlockedError";
  }
}

function serializeAdminUser(user: UserWithCounts): AdminUserDto {
  return {
    counts: {
      models: user._count.aiModels,
      providers: user._count.providers,
      sessions: user._count.sessions
    },
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id,
    isActive: user.isActive,
    role: user.role,
    updatedAt: user.updatedAt.toISOString()
  };
}

export async function listAdminUsers() {
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          aiModels: true,
          providers: true,
          sessions: true
        }
      }
    },
    orderBy: [
      {
        role: "desc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return users.map(serializeAdminUser);
}

export async function updateAdminUser(
  actorId: string,
  targetId: string,
  input: AdminUserUpdateInput
) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: {
        id: targetId
      }
    });

    if (!target) {
      throw new NotFoundError();
    }

    const nextRole = input.role ?? target.role;
    const nextIsActive = input.isActive ?? target.isActive;

    if (
      actorId === targetId &&
      (nextRole !== "ADMIN" || nextIsActive === false)
    ) {
      throw new SelfAdminChangeBlockedError();
    }

    const removesActiveAdmin =
      target.role === "ADMIN" &&
      target.isActive &&
      (nextRole !== "ADMIN" || nextIsActive === false);

    if (removesActiveAdmin) {
      const remainingActiveAdmins = await tx.user.count({
        where: {
          id: {
            not: targetId
          },
          isActive: true,
          role: "ADMIN"
        }
      });

      if (remainingActiveAdmins === 0) {
        throw new LastAdminRequiredError();
      }
    }

    const user = await tx.user.update({
      where: {
        id: targetId
      },
      data: {
        isActive: input.isActive,
        role: input.role
      },
      include: {
        _count: {
          select: {
            aiModels: true,
            providers: true,
            sessions: true
          }
        }
      }
    });

    if (nextIsActive === false) {
      await tx.session.deleteMany({
        where: {
          userId: targetId
        }
      });
      user._count.sessions = 0;
    }

    return serializeAdminUser(user);
  });
}
