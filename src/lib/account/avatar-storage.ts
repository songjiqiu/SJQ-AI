import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const avatarMaxStoredBytes = 1024 * 1024;
export const avatarPublicPathPrefix = "/uploads/avatars";

const avatarUploadRoot = path.join(
  process.cwd(),
  "storage",
  "uploads",
  "avatars"
);

const contentTypeExtensions = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const extensionContentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

export class AvatarUploadValidationError extends Error {
  constructor(public readonly details: Record<string, string[]>) {
    super("Avatar upload validation failed");
    this.name = "AvatarUploadValidationError";
  }
}

export async function saveAvatarFile(userId: string, file: File) {
  const contentType = inferContentType(file);

  if (!contentType) {
    throw new AvatarUploadValidationError({
      avatar: ["头像文件仅支持 PNG、JPEG 或 WebP。"]
    });
  }

  if (file.size <= 0) {
    throw new AvatarUploadValidationError({
      avatar: ["头像文件不能为空。"]
    });
  }

  if (file.size > avatarMaxStoredBytes) {
    throw new AvatarUploadValidationError({
      avatar: ["头像文件需要压缩至 1MB 以内。"]
    });
  }

  await mkdir(avatarUploadRoot, { recursive: true });

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeUserId}-${randomUUID()}${contentTypeExtensions.get(
    contentType
  )}`;
  const filePath = path.join(avatarUploadRoot, filename);

  await writeFile(filePath, new Uint8Array(await file.arrayBuffer()));

  return `${avatarPublicPathPrefix}/${filename}`;
}

export async function deleteStoredAvatar(avatarUrl: string | null | undefined) {
  const filename = getStoredAvatarFilename(avatarUrl);

  if (!filename) {
    return;
  }

  try {
    await unlink(path.join(avatarUploadRoot, filename));
  } catch {
    // 删除旧头像失败不影响当前资料保存。
  }
}

export async function readStoredAvatar(filename: string) {
  if (!isSafeStoredAvatarFilename(filename)) {
    return null;
  }

  const filePath = path.join(avatarUploadRoot, filename);
  const contentType =
    extensionContentTypes.get(path.extname(filename).toLowerCase()) ??
    "application/octet-stream";

  try {
    const [bytes, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

    return {
      bytes,
      contentType,
      lastModified: fileStat.mtime
    };
  } catch {
    return null;
  }
}

function inferContentType(file: File) {
  const directType = file.type.toLowerCase().split(";")[0];

  if (contentTypeExtensions.has(directType)) {
    return directType;
  }

  const extension = path.extname(file.name).toLowerCase();

  return extensionContentTypes.get(extension) ?? null;
}

function getStoredAvatarFilename(avatarUrl: string | null | undefined) {
  if (!avatarUrl?.startsWith(`${avatarPublicPathPrefix}/`)) {
    return null;
  }

  const filename = avatarUrl.slice(avatarPublicPathPrefix.length + 1);

  return isSafeStoredAvatarFilename(filename) ? filename : null;
}

function isSafeStoredAvatarFilename(filename: string) {
  return (
    filename.length > 0 &&
    filename === path.basename(filename) &&
    /^[a-zA-Z0-9_.-]+$/.test(filename) &&
    extensionContentTypes.has(path.extname(filename).toLowerCase())
  );
}
