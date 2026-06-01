import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import { uploadDeckSlideElementFileForUser } from "@/lib/decks/service";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ elementId: string; id: string; slideId: string }>;
  }
) {
  try {
    const user = await requireCurrentUser();
    const { elementId, id, slideId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedFile(file)) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED"
        },
        {
          status: 400
        }
      );
    }

    const layer = await uploadDeckSlideElementFileForUser({
      bytes: Buffer.from(await file.arrayBuffer()),
      elementId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      projectId: id,
      slideId,
      userId: user.id
    });

    return NextResponse.json({
      layer
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "name" in value &&
    typeof value.name === "string" &&
    "type" in value &&
    typeof value.type === "string"
  );
}
