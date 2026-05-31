import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const storageRoot = path.join(process.cwd(), "storage");
export const deckStorageRoot = path.join(storageRoot, "decks");
export const reusableAssetStorageRoot = path.join(storageRoot, "assets");

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

export async function writeReusableAssetFile({
  bytes,
  filename,
  userId
}: {
  bytes: Buffer | Uint8Array;
  filename: string;
  userId: string;
}): Promise<StoredDeckFile> {
  const safeUserId = safePathPart(userId);
  const safeFilename = safePathPart(filename);
  const directory = path.join(reusableAssetStorageRoot, safeUserId);
  const filePath = path.join(directory, safeFilename);

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, bytes);

  return {
    filename: safeFilename,
    relativePath: toStorageRelativePath(path.join("assets", safeUserId, safeFilename)),
    sizeBytes: bytes.byteLength
  };
}

export async function copyStorageFileToDeck({
  filename,
  projectId,
  sourceRelativePath
}: {
  filename: string;
  projectId: string;
  sourceRelativePath: string;
}): Promise<StoredDeckFile | null> {
  const sourcePath = resolveStoragePath(sourceRelativePath);

  if (!sourcePath) {
    return null;
  }

  const safeProjectId = safePathPart(projectId);
  const safeFilename = safePathPart(filename);
  const directory = path.join(deckStorageRoot, safeProjectId);
  const targetPath = path.join(directory, safeFilename);

  try {
    await mkdir(directory, { recursive: true });
    await copyFile(sourcePath, targetPath);
    const fileStat = await stat(targetPath);

    return {
      filename: safeFilename,
      relativePath: toStorageRelativePath(path.join("decks", safeProjectId, safeFilename)),
      sizeBytes: fileStat.size
    };
  } catch {
    return null;
  }
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

export async function deleteStorageFile(relativePath: string) {
  const filePath = resolveStoragePath(relativePath);

  if (!filePath) {
    return;
  }

  await rm(filePath, {
    force: true
  });
}

export async function deleteDeckStorageDirectory(projectId: string) {
  const safeProjectId = safePathPart(projectId);
  const directory = path.resolve(deckStorageRoot, safeProjectId);
  const root = path.resolve(deckStorageRoot);

  if (directory !== root && directory.startsWith(`${root}${path.sep}`)) {
    await rm(directory, {
      force: true,
      recursive: true
    });
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
