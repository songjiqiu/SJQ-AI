import type {
  AccountPasswordUpdateInput,
  AccountProfileUpdateInput
} from "@/lib/account/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { prisma } from "@/lib/db/prisma";

export class InvalidCurrentPasswordError extends Error {
  constructor(message = "Invalid current password") {
    super(message);
    this.name = "InvalidCurrentPasswordError";
  }
}

export async function updateAccountProfile(
  userId: string,
  input: AccountProfileUpdateInput
) {
  return prisma.user.update({
    where: {
      id: userId
    },
    data: {
      displayName: input.displayName,
      ...(input.avatarUrl !== undefined
        ? {
            avatarUrl: input.avatarUrl || null
          }
        : {})
    },
    select: {
      avatarUrl: true,
      displayName: true,
      email: true,
      id: true,
      isActive: true,
      role: true
    }
  });
}

export async function updateAccountPassword(
  userId: string,
  input: AccountPasswordUpdateInput
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      passwordHash: true
    }
  });

  if (!user || !verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new InvalidCurrentPasswordError();
  }

  await prisma.user.update({
    where: {
      id: userId
    },
    data: {
      passwordHash: hashPassword(input.newPassword)
    },
    select: {
      id: true
    }
  });
}
