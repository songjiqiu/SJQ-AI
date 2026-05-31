import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  deleteDeckProjectForUser,
  getDeckProjectForUser
} from "@/lib/decks/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const project = await getDeckProjectForUser(user.id, id);

    return NextResponse.json(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    await deleteDeckProjectForUser(user.id, id);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return handleApiError(error);
  }
}
