import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import {
  createProvider,
  listProviders
} from "@/lib/ai-config/service";
import { providerInputSchema } from "@/lib/ai-config/schemas";
import { requireCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await requireCurrentUser();

    return NextResponse.json({
      providers: await listProviders(user.id)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const input = providerInputSchema.parse(await request.json());

    return NextResponse.json(
      {
        provider: await createProvider(user.id, input)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
