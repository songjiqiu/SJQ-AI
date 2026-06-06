import { NextResponse } from "next/server";

import {
  createPptToSlotJob,
  PptToSlotValidationError
} from "@/lib/admin/ppt-to-slot/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    const formData = await request.formData();
    const file = formData.get("file") ?? formData.getAll("files")[0];

    if (!isUploadedFile(file)) {
      throw new PptToSlotValidationError("A .pptx file is required");
    }

    const result = await createPptToSlotJob({
      file: {
        bytes: new Uint8Array(await file.arrayBuffer()),
        name: file.name,
        size: file.size,
        type: file.type
      },
      userId: admin.id
    });

    return NextResponse.json(result, {
      status: 201
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function isUploadedFile(value: FormDataEntryValue | null | undefined): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value
  );
}
