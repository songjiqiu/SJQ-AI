import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { listProviderAvailableModels } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    return NextResponse.json({
      models: await listProviderAvailableModels(user.id, id)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
