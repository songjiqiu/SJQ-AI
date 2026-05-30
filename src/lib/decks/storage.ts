import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const storageRoot = path.join(process.cwd(), "storage");
export const deckStorageRoot = path.join(storageRoot, "decks");

export type StoredDeckFile = {
  filename: string;
  relativePath: string;
  sizeBytes: number;
};

export async function writeDeckFile({
  bytes,
  filename,
  projectId
}: {
  bytes: Buffer | Uint8Array;
  filename: string;
  projectId: string;
}): Promise<StoredDeckFile> {
  const safeProjectId = safePathPart(projectId);
  const safeFilename = safePathPart(filename);
  const directory = path.join(deckStorageRoot, safeProjectId);
  const filePath = path.join(directory, safeFilename);

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, bytes);

  return {
    filename: safeFilename,
    relativePath: toStorageRelativePath(path.join("decks", safeProjectId, safeFilename)),
    sizeBytes: bytes.byteLength
  };
}

export async function readStorageFile(relativePath: string) {
  const filePath = resolveStoragePath(relativePath);

  if (!filePath) {
    return null;
  }

  try {
    const [bytes, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);

    return {
      bytes,
      lastModified: fileStat.mtime,
      sizeBytes: fileStat.size
    };
  } catch {
    return null;
  }
}

function resolveStoragePath(relativePath: string) {
  const resolved = path.resolve(storageRoot, relativePath);
  const root = path.resolve(storageRoot);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return resolved;
}

function toStorageRelativePath(value: string) {
  return value.replace(/\\/g, "/");
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 255);
}
