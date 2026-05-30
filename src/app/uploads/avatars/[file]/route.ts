import { NextResponse } from "next/server";

import { readStoredAvatar } from "@/lib/account/avatar-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> }
) {
  const { file } = await context.params;
  const avatar = await readStoredAvatar(file);

  if (!avatar) {
    return NextResponse.json(
      {
        error: "NOT_FOUND"
      },
      {
        status: 404
      }
    );
  }

  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": avatar.contentType,
      "Last-Modified": avatar.lastModified.toUTCString()
    }
  });
}
