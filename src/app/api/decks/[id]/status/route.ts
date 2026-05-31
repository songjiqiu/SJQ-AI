import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import { getDeckGenerationStatusForUser } from "@/lib/decks/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const status = await getDeckGenerationStatusForUser(user.id, id);

    return NextResponse.json(status);
  } catch (error) {
    return handleApiError(error);
  }
}
