import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { modelInputSchema } from "@/lib/ai-config/schemas";
import { createModel, listModels } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    return NextResponse.json({
      models: await listModels(user.id)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const input = modelInputSchema.parse(await request.json());

    return NextResponse.json(
      {
        model: await createModel(user.id, input)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
