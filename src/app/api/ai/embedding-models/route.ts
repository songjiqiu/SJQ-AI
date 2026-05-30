import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { embeddingModelInputSchema } from "@/lib/ai-config/schemas";
import {
  createEmbeddingModel,
  listEmbeddingModels
} from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    return NextResponse.json({
      embeddingModels: await listEmbeddingModels(user.id)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const input = embeddingModelInputSchema.parse(await request.json());

    return NextResponse.json(
      {
        embeddingModel: await createEmbeddingModel(user.id, input)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
