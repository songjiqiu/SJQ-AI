import { NextResponse } from "next/server";

import {
  getPptSlotTemplate,
  updatePptSlotTemplate
} from "@/lib/admin/ppt-to-slot/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser();
    const { id } = await context.params;

    return NextResponse.json({
      template: await getPptSlotTemplate(id)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser();
    const { id } = await context.params;

    return NextResponse.json({
      template: await updatePptSlotTemplate(id, await request.json())
    });
  } catch (error) {
    return handleApiError(error);
  }
}
