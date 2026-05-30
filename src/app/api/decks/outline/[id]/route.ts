import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import {
  getDeckOutlineDraftForUser,
  updateDeckOutlineDraftForUser
} from "@/lib/deck-outline/service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const draft = await getDeckOutlineDraftForUser(user.id, id);

    return NextResponse.json(draft);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const payload = await request.json();
    const draft = await updateDeckOutlineDraftForUser(user.id, id, payload);

    return NextResponse.json(draft);
  } catch (error) {
    return handleApiError(error);
  }
}
