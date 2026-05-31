import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { getUserDefaultAiEnv } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";
import { analyzeDeckOutlineIntentForUser } from "@/lib/deck-outline/service";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const payload = await request.json();
    const userAiEnv = await getUserDefaultAiEnv(user.id);
    const analysis = await analyzeDeckOutlineIntentForUser(payload, {
      analyzerOptions: userAiEnv
        ? {
            env: userAiEnv
          }
        : undefined
    });

    return NextResponse.json(analysis);
  } catch (error) {
    return handleApiError(error);
  }
}
