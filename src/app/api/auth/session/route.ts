import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json({
      authenticated: Boolean(user),
      user
    });
  } catch (error) {
    return handleApiError(error);
  }
}
