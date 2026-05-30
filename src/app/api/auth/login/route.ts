import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleApiError } from "@/lib/api/responses";
import { syncConfiguredAdminRole } from "@/lib/auth/access";
import { normalizeEmail, verifyPassword } from "@/lib/auth/crypto";
import {
  createUserSession,
  getSessionCookieOptions,
  sessionCookieName
} from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const authInputSchema = z.object({
  email: z.string().trim().email().max(191),
  password: z.string().min(8).max(128)
});

export async function POST(request: Request) {
  try {
    const input = authInputSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: {
        email: normalizeEmail(input.email)
      }
    });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      return apiError("INVALID_CREDENTIALS", 401);
    }

    if (!user.isActive) {
      return apiError("ACCOUNT_DISABLED", 403);
    }

    const sessionUser = await syncConfiguredAdminRole(user);
    const token = await createUserSession(sessionUser.id);
    const cookieStore = await cookies();

    cookieStore.set(sessionCookieName, token, getSessionCookieOptions());

    return NextResponse.json({
      user: {
        avatarUrl: sessionUser.avatarUrl ?? null,
        displayName: sessionUser.displayName ?? null,
        email: sessionUser.email,
        id: sessionUser.id,
        isActive: sessionUser.isActive,
        role: sessionUser.role
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
