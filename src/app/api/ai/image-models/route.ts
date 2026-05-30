import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { imageModelInputSchema } from "@/lib/ai-config/schemas";
import { createImageModel, listImageModels } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    return NextResponse.json({
      imageModels: await listImageModels(user.id)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const input = imageModelInputSchema.parse(await request.json());

    return NextResponse.json(
      {
        imageModel: await createImageModel(user.id, input)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
