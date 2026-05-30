import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import { getDeckPptxAssetForUser } from "@/lib/decks/service";
import { readStorageFile } from "@/lib/decks/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const asset = await getDeckPptxAssetForUser({
      projectId: id,
      userId: user.id
    });
    const file = await readStorageFile(asset.relativePath);

    if (!file) {
      return new Response(
        JSON.stringify({
          error: "NOT_FOUND"
        }),
        {
          headers: {
            "Content-Type": "application/json"
          },
          status: 404
        }
      );
    }

    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          asset.filename
        )}"`,
        "Content-Length": String(file.sizeBytes),
        "Content-Type": asset.mimeType,
        "Last-Modified": file.lastModified.toUTCString()
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

