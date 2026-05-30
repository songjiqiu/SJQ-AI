import { NextResponse } from "next/server";

import { accountPasswordUpdateSchema } from "@/lib/account/schemas";
import { updateAccountPassword } from "@/lib/account/service";
import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const input = accountPasswordUpdateSchema.parse(await request.json());

    await updateAccountPassword(currentUser.id, input);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    return handleApiError(error);
  }
}
