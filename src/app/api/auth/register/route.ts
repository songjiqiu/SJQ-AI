import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleApiError } from "@/lib/api/responses";
import { resolveUserRoleForEmail } from "@/lib/auth/access";
import { hashPassword, normalizeEmail } from "@/lib/auth/crypto";
import {
  createUserSession,
  getSessionCookieOptions,
  sessionCookieName
} from "@/lib/auth/session";
import { seedDefaultAiProviders } from "@/lib/auth/seed";
import { prisma } from "@/lib/db/prisma";

const authInputSchema = z.object({
  email: z.string().trim().email().max(191),
  password: z.string().min(8).max(128)
});

export async function POST(request: Request) {
  try {
    const input = authInputSchema.parse(await request.json());
    const email = normalizeEmail(input.email);
    const existing = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (existing) {
      return apiError("EMAIL_EXISTS", 409);
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash: hashPassword(input.password),
          role: resolveUserRoleForEmail(email)
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

      await seedDefaultAiProviders(created.id, tx);

      return created;
    });
    const token = await createUserSession(user.id);
    const cookieStore = await cookies();

    cookieStore.set(sessionCookieName, token, getSessionCookieOptions());

    return NextResponse.json({
      user
    });
  } catch (error) {
    return handleApiError(error);
  }
}
