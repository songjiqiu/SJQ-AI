import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import { listDeckProjects } from "@/lib/decks/service";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const projects = await listDeckProjects(user.id);

    return NextResponse.json({
      projects
    });
  } catch (error) {
    return handleApiError(error);
  }
}

