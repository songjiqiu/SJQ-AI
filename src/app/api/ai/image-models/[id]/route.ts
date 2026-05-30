import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { imageModelInputSchema } from "@/lib/ai-config/schemas";
import { deleteImageModel, updateImageModel } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const input = imageModelInputSchema.parse(await request.json());

    return NextResponse.json({
      imageModel: await updateImageModel(user.id, id, input)
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

    await deleteImageModel(user.id, id);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return handleApiError(error);
  }
}
