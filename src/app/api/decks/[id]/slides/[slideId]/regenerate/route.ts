import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import {
  getUserDefaultAiEnv,
  getUserDefaultImageEnv
} from "@/lib/ai-config/service";
import { createImageQualityReviewer } from "@/lib/ai-deck/image-assets";
import { createImageLayerGenerator } from "@/lib/ai-deck/image-generator";
import { requireCurrentUser } from "@/lib/auth/session";
import { regenerateDeckSlideForUser } from "@/lib/decks/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; slideId: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id, slideId } = await context.params;
    const [userAiEnv, userImageEnv] = await Promise.all([
      getUserDefaultAiEnv(user.id),
      getUserDefaultImageEnv(user.id)
    ]);
    const deck = await regenerateDeckSlideForUser({
      analyzerOptions: userAiEnv
        ? {
            env: userAiEnv
          }
        : undefined,
      imageGenerator: createImageLayerGenerator(userImageEnv ?? undefined),
      imageQualityReviewer: createImageQualityReviewer(userAiEnv),
      projectId: id,
      slideId,
      userId: user.id
    });

    return NextResponse.json(deck);
  } catch (error) {
    return handleApiError(error);
  }
}
