import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import {
  getUserDefaultAiEnv,
  getUserDefaultImageEnv
} from "@/lib/ai-config/service";
import { createImageQualityReviewer } from "@/lib/ai-deck/image-assets";
import { createImageLayerGenerator } from "@/lib/ai-deck/image-generator";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  createDeckGenerationTaskForUser,
  generateDeckFromOutlineDraftSchema,
  startDeckGenerationTaskForUser
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
    const task = await createDeckGenerationTaskForUser(
      user.id,
      payload.outlineDraftId
    );

    if (!task.reused) {
      startDeckGenerationTaskForUser(user.id, task.id, {
        analyzerOptions: userAiEnv
          ? {
              env: userAiEnv
            }
          : undefined,
        imageGenerator: createImageLayerGenerator(userImageEnv ?? undefined),
        imageQualityReviewer: createImageQualityReviewer(userAiEnv)
      });
    }

    return NextResponse.json(
      {
        details: task.details,
        error: task.error,
        id: task.id,
        previewUrl: task.previewUrl,
        progress: task.progress,
        status: task.status
      },
      { status: 202 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
