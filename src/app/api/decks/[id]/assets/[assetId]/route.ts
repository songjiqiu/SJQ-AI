import { handleApiError } from "@/lib/api/responses";
import { requireCurrentUser } from "@/lib/auth/session";
import { getDeckAssetForUser } from "@/lib/decks/service";
import { readStorageFile } from "@/lib/decks/storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { assetId, id } = await context.params;
    const asset = await getDeckAssetForUser({
      assetId,
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
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Length": String(file.sizeBytes),
        "Content-Type": asset.mimeType,
        "Last-Modified": file.lastModified.toUTCString()
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
