import { NextResponse } from "next/server";

import { importUniversalPptTemplatesV1 } from "@/lib/admin/templates/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function POST() {
  try {
    await requireAdminUser();

    return NextResponse.json(await importUniversalPptTemplatesV1());
  } catch (error) {
    return handleApiError(error);
  }
}
