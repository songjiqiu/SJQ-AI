import { NextResponse } from "next/server";

import { listPptSlotTemplates } from "@/lib/admin/ppt-to-slot/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function GET() {
  try {
    await requireAdminUser();

    return NextResponse.json({
      templates: await listPptSlotTemplates()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
