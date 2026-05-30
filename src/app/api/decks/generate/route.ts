import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import {
  getUserDefaultAiEnv,
  getUserDefaultImageEnv
} from "@/lib/ai-config/service";
import { createImageLayerGenerator } from "@/lib/ai-deck/image-generator";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  generateDeckFromOutlineDraftForUser,
  generateDeckFromOutlineDraftSchema
} from "@/lib/decks/service";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const payload = generateDeckFromOutlineDraftSchema.parse(
      await request.json()
    );
    const [userAiEnv, userImageEnv] = await Promise.all([
      getUserDefaultAiEnv(user.id),
      getUserDefaultImageEnv(user.id)
    ]);
    const result = await generateDeckFromOutlineDraftForUser(
      user.id,
      payload.outlineDraftId,
      {
        analyzerOptions: userAiEnv
          ? {
              env: userAiEnv
            }
          : undefined,
        imageGenerator: createImageLayerGenerator(userImageEnv ?? undefined)
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
