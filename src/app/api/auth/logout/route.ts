import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { deleteSessionToken, sessionCookieName } from "@/lib/auth/session";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(sessionCookieName)?.value;

    if (token) {
      await deleteSessionToken(token);
    }

    cookieStore.set(sessionCookieName, "", {
      maxAge: 0,
      path: "/"
    });

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return handleApiError(error);
  }
}
