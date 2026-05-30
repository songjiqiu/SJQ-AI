import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { modelInputSchema } from "@/lib/ai-config/schemas";
import { deleteModel, updateModel } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const input = modelInputSchema.parse(await request.json());

    return NextResponse.json({
      model: await updateModel(user.id, id, input)
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

    await deleteModel(user.id, id);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return handleApiError(error);
  }
}
