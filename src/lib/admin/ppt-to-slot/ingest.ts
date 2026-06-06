import JSZip from "jszip";

import { pptToSlotMaxFileSize } from "@/lib/admin/ppt-to-slot/schemas";

export type PptToSlotUploadedFile = {
  bytes: Uint8Array;
  name: string;
  size: number;
  type?: string;
};

export class PptToSlotValidationError extends Error {
  details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "PptToSlotValidationError";
    this.details = details;
  }
}

export async function ingestPptxFile(file: PptToSlotUploadedFile) {
  const extension = getExtension(file.name);

  if (extension !== ".pptx") {
    throw new PptToSlotValidationError("Only .pptx files are supported", {
      file: file.name
    });
  }

  if (file.size <= 0 || file.bytes.byteLength <= 0) {
    throw new PptToSlotValidationError("The PPTX file is empty", {
      file: file.name
    });
  }

  if (file.size > pptToSlotMaxFileSize || file.bytes.byteLength > pptToSlotMaxFileSize) {
    throw new PptToSlotValidationError("The PPTX file exceeds the size limit", {
      limitBytes: pptToSlotMaxFileSize
    });
  }

  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(file.bytes);
  } catch (error) {
    throw new PptToSlotValidationError("The PPTX file is damaged or encrypted", {
      message: error instanceof Error ? error.message : String(error)
    });
  }

  const slideFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name)
  );

  if (slideFiles.length === 0) {
    throw new PptToSlotValidationError("The PPTX file does not contain slides");
  }

  return {
    sourceFile: file.name,
    zip
  };
}

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");

  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}
