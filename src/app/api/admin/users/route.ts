import { NextResponse } from "next/server";

import { listAdminUsers } from "@/lib/admin/users";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function GET() {
  try {
    await requireAdminUser();

    return NextResponse.json({
      users: await listAdminUsers()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
