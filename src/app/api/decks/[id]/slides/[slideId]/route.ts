import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import { updateDeckSlideForUser } from "@/lib/decks/service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; slideId: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id, slideId } = await context.params;
    const deck = await updateDeckSlideForUser({
      projectId: id,
      rawInput: await request.json(),
      slideId,
      userId: user.id
    });

    return NextResponse.json(deck);
  } catch (error) {
    return handleApiError(error);
  }
}
