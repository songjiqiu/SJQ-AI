import { NextResponse } from "next/server";

import { templateElementAssetAiSearchSchema } from "@/lib/admin/template-assets/schemas";
import { searchTemplateElementAssetsForAi } from "@/lib/admin/template-assets/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    await requireAdminUser();

    const input = templateElementAssetAiSearchSchema.parse(await request.json());

    return NextResponse.json({
      assets: await searchTemplateElementAssetsForAi(input)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
