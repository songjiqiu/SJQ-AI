import type { PrismaClient, UserRole } from "@prisma/client";

import { normalizeEmail } from "@/lib/auth/crypto";
import { prisma } from "@/lib/db/prisma";

type UserRoleClient = Pick<PrismaClient, "user">;

type RoleUser = {
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  id: string;
  isActive: boolean;
  role: UserRole;
};

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class AccountDisabledError extends Error {
  constructor(message = "Account disabled") {
    super(message);
    this.name = "AccountDisabledError";
  }
}

export function getConfiguredAdminEmails(
  value = process.env.APP_ADMIN_EMAILS
) {
  return new Set(
    (value ?? "")
      .split(/[,\s;]+/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  );
}

export function isConfiguredAdminEmail(
  email: string,
  value = process.env.APP_ADMIN_EMAILS
) {
  return getConfiguredAdminEmails(value).has(normalizeEmail(email));
}

export function resolveUserRoleForEmail(
  email: string,
  currentRole: UserRole = "USER",
  value = process.env.APP_ADMIN_EMAILS
): UserRole {
  return isConfiguredAdminEmail(email, value) ? "ADMIN" : currentRole;
}

export async function syncConfiguredAdminRole(
  user: RoleUser,
  client: UserRoleClient = prisma
): Promise<RoleUser> {
  const role = resolveUserRoleForEmail(user.email, user.role);

  if (role === user.role) {
    return user;
  }

  await client.user.update({
    where: {
      id: user.id
    },
    data: {
      role
    },
    select: {
      id: true
    }
  });

  return {
    ...user,
    role
  };
}
