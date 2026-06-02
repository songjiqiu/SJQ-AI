import { NextResponse } from "next/server";

import { templateElementAssetUpdateSchema } from "@/lib/admin/template-assets/schemas";
import {
  deleteTemplateElementAsset,
  getTemplateElementAsset,
  updateTemplateElementAsset
} from "@/lib/admin/template-assets/service";
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
      asset: await getTemplateElementAsset(id)
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
    const input = templateElementAssetUpdateSchema.parse(await request.json());

    return NextResponse.json({
      asset: await updateTemplateElementAsset(id, input)
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
    await requireAdminUser();
    const { id } = await context.params;

    await deleteTemplateElementAsset(id);

    return new NextResponse(null, {
      status: 204
    });
  } catch (error) {
    return handleApiError(error);
  }
}
