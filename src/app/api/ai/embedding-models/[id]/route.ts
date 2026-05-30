import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { embeddingModelInputSchema } from "@/lib/ai-config/schemas";
import {
  deleteEmbeddingModel,
  updateEmbeddingModel
} from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const input = embeddingModelInputSchema.parse(await request.json());

    return NextResponse.json({
      embeddingModel: await updateEmbeddingModel(user.id, id, input)
    });
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

    await deleteEmbeddingModel(user.id, id);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return handleApiError(error);
  }
}
