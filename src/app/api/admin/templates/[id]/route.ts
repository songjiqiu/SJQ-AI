import { NextResponse } from "next/server";

import { pptTemplateUpdateSchema } from "@/lib/admin/templates/schemas";
import {
  deletePptTemplate,
  getPptTemplate,
  updatePptTemplate
} from "@/lib/admin/templates/service";
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
      template: await getPptTemplate(id)
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
    const input = pptTemplateUpdateSchema.parse(await request.json());

    return NextResponse.json({
      template: await updatePptTemplate(id, input)
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

    await deletePptTemplate(id);

    return new NextResponse(null, {
      status: 204
    });
  } catch (error) {
    return handleApiError(error);
  }
}
