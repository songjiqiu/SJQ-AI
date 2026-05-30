import { NextResponse } from "next/server";

import { adminUserUpdateSchema } from "@/lib/admin/schemas";
import { updateAdminUser } from "@/lib/admin/users";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminUser();
    const { id } = await context.params;
    const input = adminUserUpdateSchema.parse(await request.json());

    return NextResponse.json({
      user: await updateAdminUser(admin.id, id, input)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
