import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { getUserDefaultAiEnv } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  createDeckOutlineDraftForUser,
  listDeckOutlineDrafts
} from "@/lib/deck-outline/service";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const drafts = await listDeckOutlineDrafts(user.id);

    return NextResponse.json({
      drafts
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const payload = await request.json();
    const userAiEnv = await getUserDefaultAiEnv(user.id);
    const draft = await createDeckOutlineDraftForUser(user.id, payload, {
      analyzerOptions: userAiEnv
        ? {
            env: userAiEnv
          }
        : undefined
    });

    return NextResponse.json(draft);
  } catch (error) {
    return handleApiError(error);
  }
}
