import { NextResponse } from "next/server";

import {
  readPptSlotTemplateArtifact
} from "@/lib/admin/ppt-to-slot/service";
import { handleApiError } from "@/lib/api/responses";
import { requireAdminUser } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; kind: string }> }
) {
  try {
    await requireAdminUser();
    const { id, kind } = await context.params;
    const artifact = await readPptSlotTemplateArtifact({
      kind,
      templateId: id
    });

    return new NextResponse(new Uint8Array(artifact.bytes), {
      headers: {
        "Content-Disposition": `inline; filename="${artifact.filename}"`,
        "Content-Length": String(artifact.sizeBytes),
        "Content-Type": artifact.contentType,
        "Last-Modified": artifact.lastModified.toUTCString()
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
