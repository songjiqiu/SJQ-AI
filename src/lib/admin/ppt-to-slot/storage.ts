import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const storageRoot = path.join(process.cwd(), "storage");
export const pptToSlotStorageRoot = path.join(storageRoot, "ppt-to-slot");

export async function writePptToSlotArtifact({
  bytes,
  filename,
  jobId
}: {
  bytes: Buffer | Uint8Array | string;
  filename: string;
  jobId: string;
}) {
  const safeJobId = safePathPart(jobId);
  const safeFilename = safePathPart(filename);
  const directory = path.join(pptToSlotStorageRoot, safeJobId);
  const filePath = path.join(directory, safeFilename);
  const payload = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, payload);

  return {
    filename: safeFilename,
    relativePath: toStorageRelativePath(path.join("ppt-to-slot", safeJobId, safeFilename)),
    sizeBytes: payload.byteLength
  };
}

export async function readPptToSlotArtifact(relativePath: string) {
  const filePath = resolvePptToSlotPath(relativePath);

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

function resolvePptToSlotPath(relativePath: string) {
  const resolved = path.resolve(storageRoot, relativePath);
  const root = path.resolve(pptToSlotStorageRoot);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return resolved;
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 255);
}

function toStorageRelativePath(value: string) {
  return value.replace(/\\/g, "/");
}
