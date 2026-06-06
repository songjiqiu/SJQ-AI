import { NextResponse } from "next/server";
import path from "node:path";

import { handleApiError } from "@/lib/api/responses";
import { getUserDefaultAiEnv } from "@/lib/ai-config/service";
import { requireCurrentUser } from "@/lib/auth/session";
import { parseDeckInputFiles } from "@/lib/deck-input/parser";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const userAiEnv = await getUserDefaultAiEnv(user.id);

    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter(isUploadedFile);
    const parsed = await parseDeckInputFiles(
      await Promise.all(
        files.map(async (file) => ({
          bytes: new Uint8Array(await file.arrayBuffer()),
          name: file.name,
          size: file.size,
          type: file.type
        }))
      ),
      {
        ocrCacheDir: path.join(process.cwd(), "storage", "ocr"),
        visionEnv: userAiEnv
      }
    );

    return NextResponse.json(parsed);
  } catch (error) {
    return handleApiError(error);
  }
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "arrayBuffer" in value && "name" in value;
}
