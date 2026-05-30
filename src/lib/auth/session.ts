import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

import { createOpaqueToken, hashToken } from "@/lib/auth/crypto";
import {
  AccountDisabledError,
  ForbiddenError,
  syncConfiguredAdminRole
} from "@/lib/auth/access";
import { prisma } from "@/lib/db/prisma";

export const sessionCookieName = "pptcm_session";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export type CurrentUser = {
  avatarUrl: string | null;
  displayName: string | null;
  id: string;
  email: string;
  isActive: boolean;
  role: UserRole;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export async function createUserSession(userId: string) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  return token;
}

export async function deleteSessionToken(token: string) {
  await prisma.session.deleteMany({
    where: {
      tokenHash: hashToken(token)
    }
  });
}

async function readSessionToken() {
  const cookieStore = await cookies();

  return cookieStore.get(sessionCookieName)?.value ?? null;
}

async function readCurrentSessionUser() {
  const token = await readSessionToken();

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(token)
    },
    include: {
      user: {
        select: {
          avatarUrl: true,
          displayName: true,
          email: true,
          id: true,
          isActive: true,
          role: true
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({
      where: {
        id: session.id
      }
    });

    return null;
  }

  return {
    sessionId: session.id,
    user: session.user
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const current = await readCurrentSessionUser();

  if (!current) {
    return null;
  }

  if (!current.user.isActive) {
    await prisma.session.deleteMany({
      where: {
        id: current.sessionId
      }
    });

    return null;
  }

  return syncConfiguredAdminRole(current.user);
}

export async function requireCurrentUser() {
  const current = await readCurrentSessionUser();

  if (!current) {
    throw new UnauthorizedError();
  }

  if (!current.user.isActive) {
    await prisma.session.deleteMany({
      where: {
        id: current.sessionId
      }
    });

    throw new AccountDisabledError();
  }

  return syncConfiguredAdminRole(current.user);
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();

  if (user.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  return user;
}
