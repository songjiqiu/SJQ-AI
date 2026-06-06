import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { z } from "zod";

import {
  deckInputMaxFileCharacters,
  deckInputMaxFileCount,
  deckInputMaxFileSize
} from "@/lib/create-deck/file-options";

import {
  deckInputSourceSchema,
  parsedDeckInputFileSchema,
  type DeckInputSource,
  type ParsedDeckInputFile
} from "./schema";

type UploadedDeckInputFile = {
  bytes: Uint8Array;
  name: string;
  size: number;
  type?: string;
};

type DeckInputVisionEnv = {
  AI_TEXT_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
};

type DeckInputVisionClient = {
  chat: {
    completions: {
      create: (
        payload: Record<string, unknown>,
        options?: Record<string, unknown>
      ) => Promise<{
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      }>;
    };
  };
};

export type ParseDeckInputFilesOptions = {
  ocrCacheDir?: string;
  visionClient?: DeckInputVisionClient;
  visionEnv?: DeckInputVisionEnv | null;
};

type ExtractedSection = {
  kind?: DeckInputSource["kind"];
  label?: string;
  pageNumber?: number;
  sheetName?: string;
  slideNumber?: number;
  text: string;
};

export type ParseDeckInputFilesResult = {
  parsedFiles: ParsedDeckInputFile[];
  sources: DeckInputSource[];
  warnings: string[];
};

const textExtensions = new Set([".txt", ".md", ".markdown", ".csv", ".json"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"]);
const unsupportedLegacyOfficeExtensions = new Set([".doc", ".ppt", ".xls"]);
const chunkMaxLength = 1400;
const chunkOverlap = 160;
const ocrLanguage = "chi_sim+eng";
const visionImageMaxBytes = 4 * 1024 * 1024;

export async function parseDeckInputFiles(
  files: UploadedDeckInputFile[],
  options: ParseDeckInputFilesOptions = {}
): Promise<ParseDeckInputFilesResult> {
  const limitedFiles = files.slice(0, deckInputMaxFileCount);
  const parsedFiles: ParsedDeckInputFile[] = [];
  const sources: DeckInputSource[] = [];
  const warnings: string[] = [];

  if (files.length > deckInputMaxFileCount) {
    warnings.push(`最多解析 ${deckInputMaxFileCount} 个文件，已忽略超出部分。`);
  }

  for (const [fileIndex, file] of limitedFiles.entries()) {
    const fileId = buildFileId(fileIndex);
    const extension = getExtension(file.name);

    if (file.size > deckInputMaxFileSize) {
      const warning = `${file.name} 超过单文件大小限制，已跳过。`;

      warnings.push(warning);
      parsedFiles.push(
        buildParsedFile({
          extension,
          file,
          fileId,
          parser: "unsupported",
          warnings: [warning]
        })
      );
      continue;
    }

    try {
      const extracted = await extractFileSections(file, extension, options);
      const fileWarnings = extracted.warnings;
      const normalizedText = compactWhitespace(
        extracted.sections.map((section) => section.text).join("\n\n")
      ).slice(0, deckInputMaxFileCharacters);
      const fileSources = buildSourcesForFile({
        file,
        fileId,
        sections: extracted.sections,
        startChunkIndex: 1
      });
      const sourceIds = fileSources.map((source) => source.sourceId);
      const summary = summarizeText(normalizedText);

      sources.push(...fileSources);
      warnings.push(...fileWarnings.map((warning) => `${file.name}: ${warning}`));
      parsedFiles.push(
        parsedDeckInputFileSchema.parse({
          characterCount: normalizedText.length,
          extension,
          id: fileId,
          keyPoints: buildKeyPoints(normalizedText),
          mimeType: file.type ?? "",
          name: file.name,
          parser: extracted.parser,
          size: file.size,
          sourceIds,
          summary,
          text: normalizedText,
          warnings: fileWarnings
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const warning = `${file.name} 解析失败：${message}`;

      warnings.push(warning);
      parsedFiles.push(
        buildParsedFile({
          extension,
          file,
          fileId,
          parser: "unsupported",
          warnings: [warning]
        })
      );
    }
  }

  return {
    parsedFiles,
    sources: z.array(deckInputSourceSchema).parse(sources),
    warnings
  };
}

function buildParsedFile({
  extension,
  file,
  fileId,
  parser,
  text = "",
  warnings = []
}: {
  extension: string;
  file: UploadedDeckInputFile;
  fileId: string;
  parser: ParsedDeckInputFile["parser"];
  text?: string;
  warnings?: string[];
}) {
  return parsedDeckInputFileSchema.parse({
    characterCount: text.length,
    extension,
    id: fileId,
    keyPoints: buildKeyPoints(text),
    mimeType: file.type ?? "",
    name: file.name,
    parser,
    size: file.size,
    sourceIds: [],
    summary: summarizeText(text),
    text,
    warnings
  });
}

async function extractFileSections(
  file: UploadedDeckInputFile,
  extension: string,
  options: ParseDeckInputFilesOptions
): Promise<{
  parser: ParsedDeckInputFile["parser"];
  sections: ExtractedSection[];
  warnings: string[];
}> {
  if (unsupportedLegacyOfficeExtensions.has(extension)) {
    return {
      parser: "unsupported",
      sections: [],
      warnings: ["暂不支持旧版二进制 Office 文件，请另存为 .docx/.pptx/.xlsx 后上传。"]
    };
  }

  if (extension === ".docx") {
    return extractDocxSections(file);
  }

  if (extension === ".pptx") {
    return extractPptxSections(file);
  }

  if (extension === ".xlsx") {
    return extractXlsxSections(file);
  }

  if (extension === ".pdf") {
    return extractPdfSections(file, options);
  }

  if (imageExtensions.has(extension) || (file.type ?? "").startsWith("image/")) {
    return extractImageSections(file, options);
  }

  if (textExtensions.has(extension) || (file.type ?? "").startsWith("text/")) {
    const text = decodeText(file.bytes);

    return {
      parser:
        extension === ".md" || extension === ".markdown"
          ? "markdown"
          : extension === ".csv"
            ? "csv"
            : extension === ".json"
              ? "json"
              : "text",
      sections: [
        {
          kind: extension === ".csv" ? "table" : "text",
          label: file.name,
          text
        }
      ],
      warnings: []
    };
  }

  return {
    parser: "unsupported",
    sections: [],
    warnings: [`暂不支持 ${extension || "未知"} 文件类型。`]
  };
}

async function extractDocxSections(file: UploadedDeckInputFile) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(file.bytes)
  });
  const warnings = result.messages.map((message) => message.message);

  return {
    parser: "docx" as const,
    sections: [
      {
        kind: "text" as const,
        label: file.name,
        text: result.value
      }
    ],
    warnings
  };
}

async function extractPptxSections(file: UploadedDeckInputFile) {
  const zip = await JSZip.loadAsync(file.bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(sortOfficePartNames);
  const noteFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort(sortOfficePartNames);
  const sections: ExtractedSection[] = [];

  for (const [index, name] of slideFiles.entries()) {
    const xml = await zip.file(name)?.async("text");
    const notesXml = await zip.file(noteFiles[index] ?? "")?.async("text");
    const text = [
      xml ? extractOfficeXmlText(xml) : "",
      notesXml ? `备注：${extractOfficeXmlText(notesXml)}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    if (text.trim()) {
      sections.push({
        kind: "slide",
        label: `第 ${index + 1} 页`,
        slideNumber: index + 1,
        text
      });
    }
  }

  return {
    parser: "pptx" as const,
    sections,
    warnings: sections.length === 0 ? ["未能从 PPTX 中提取可用文本。"] : []
  };
}

async function extractXlsxSections(file: UploadedDeckInputFile) {
  const xlsx = await import("xlsx");
  const workbook = xlsx.read(file.bytes, {
    cellDates: true,
    type: "array"
  });
  const sections = workbook.SheetNames.flatMap((sheetName): ExtractedSection[] => {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(
      sheet,
      {
        blankrows: false,
        defval: "",
        header: 1
      }
    );
    const text = summarizeRows(rows);

    return text
      ? [
          {
            kind: "table",
            label: `Sheet：${sheetName}`,
            sheetName,
            text
          }
        ]
      : [];
  });

  return {
    parser: "xlsx" as const,
    sections,
    warnings: sections.length === 0 ? ["未能从 Excel 中提取可用文本。"] : []
  };
}

async function extractPdfSections(
  file: UploadedDeckInputFile,
  options: ParseDeckInputFilesOptions
) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(file.bytes),
    disableFontFace: true
  }).promise;
  const sections: ExtractedSection[] = [];
  const warnings: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .trim();

    if (text.length >= 20) {
      sections.push({
        kind: "page",
        label: `第 ${pageNumber} 页`,
        pageNumber,
        text
      });
      continue;
    }

    try {
      const ocrText = await ocrPdfPage(
        page as unknown as Parameters<typeof ocrPdfPage>[0],
        {
          cacheKey: `${file.name}:page:${pageNumber}`,
          options
        }
      );

      if (ocrText.trim()) {
        sections.push({
          kind: "page",
          label: `第 ${pageNumber} 页 OCR`,
          pageNumber,
          text: ocrText
        });
      } else {
        warnings.push(`第 ${pageNumber} 页没有可提取文本。`);
      }
    } catch (error) {
      warnings.push(`第 ${pageNumber} 页 OCR 失败：${formatError(error)}`);
    }
  }

  return {
    parser: "pdf" as const,
    sections,
    warnings
  };
}

async function extractImageSections(
  file: UploadedDeckInputFile,
  options: ParseDeckInputFilesOptions
) {
  const warnings: string[] = [];
  const text = await ocrImage(file.bytes, {
    cacheKey: `${file.name}:image`,
    options
  });
  let visualDescription = "";

  try {
    visualDescription = await describeImage(file, options);
  } catch (error) {
    warnings.push(`图片视觉说明生成失败：${formatError(error)}`);
  }

  const content = [
    visualDescription ? `视觉说明：${visualDescription}` : "",
    text.trim() ? `OCR文字：${text}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    parser: "image" as const,
    sections: [
      {
        kind: "image" as const,
        label: file.name,
        text: content
      }
    ].filter((section) => section.text.trim().length > 0),
    warnings: [
      ...warnings,
      ...(text.trim() || visualDescription.trim()
        ? []
        : ["图片 OCR 未提取到可用文字。"])
    ]
  };
}

async function ocrPdfPage(
  page: {
    getViewport: (options: { scale: number }) => {
      height: number;
      width: number;
    };
    render: (options: Record<string, unknown>) => { promise: Promise<unknown> };
  },
  {
    cacheKey,
    options
  }: {
    cacheKey: string;
    options: ParseDeckInputFilesOptions;
  }
) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({
    canvas,
    canvasContext: context,
    viewport
  }).promise;

  return ocrImage(canvas.toBuffer("image/png"), {
    cacheKey,
    options
  });
}

async function ocrImage(
  bytes: Uint8Array,
  {
    cacheKey,
    options
  }: {
    cacheKey: string;
    options: ParseDeckInputFilesOptions;
  }
) {
  const cachePath = options.ocrCacheDir
    ? path.join(options.ocrCacheDir, `${hashOcrInput(bytes, cacheKey)}.txt`)
    : "";

  if (cachePath) {
    const cached = await readCachedOcrText(cachePath);

    if (cached !== null) {
      return cached;
    }
  }

  const tesseract = await import("tesseract.js");
  const result = await tesseract.recognize(Buffer.from(bytes), ocrLanguage, {
    logger: undefined
  });

  if (cachePath) {
    await writeCachedOcrText(cachePath, result.data.text);
  }

  return result.data.text;
}

async function readCachedOcrText(cachePath: string) {
  try {
    return await readFile(cachePath, "utf8");
  } catch {
    return null;
  }
}

async function writeCachedOcrText(cachePath: string, text: string) {
  try {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, text, "utf8");
  } catch {
    // OCR cache is a runtime optimization; parsing should not fail if it cannot be written.
  }
}

function hashOcrInput(bytes: Uint8Array, cacheKey: string) {
  return createHash("sha256")
    .update(ocrLanguage)
    .update(cacheKey)
    .update(Buffer.from(bytes))
    .digest("hex");
}

async function describeImage(
  file: UploadedDeckInputFile,
  options: ParseDeckInputFilesOptions
) {
  if (file.bytes.byteLength > visionImageMaxBytes) {
    return "";
  }

  const client =
    options.visionClient ?? (await createVisionClient(options.visionEnv));

  if (!client) {
    return "";
  }

  const mimeType = inferImageMimeType(file);
  const response = await client.chat.completions.create(
    {
      messages: [
        {
          role: "system",
          content:
            "你是 PPT 资料图片理解助手。只输出一句简短中文视觉说明，不要 Markdown，不要解释。"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请用不超过 80 个中文字符描述图片中的主要对象、场景、数据或界面信息。"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${Buffer.from(file.bytes).toString("base64")}`
              }
            }
          ]
        }
      ],
      model: options.visionEnv?.AI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0.1
    },
    {
      timeout: 30_000
    }
  );

  return compactWhitespace(response.choices?.[0]?.message?.content ?? "")
    .replace(/^视觉说明[:：]\s*/, "")
    .slice(0, 120);
}

async function createVisionClient(env?: DeckInputVisionEnv | null) {
  if (!env?.OPENAI_API_KEY) {
    return null;
  }

  const { default: OpenAI } = await import("openai");

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || undefined
  }) as unknown as DeckInputVisionClient;
}

function inferImageMimeType(file: UploadedDeckInputFile) {
  if (file.type?.startsWith("image/")) {
    return file.type;
  }

  const extension = getExtension(file.name);

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".bmp") {
    return "image/bmp";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  return "image/png";
}

function buildSourcesForFile({
  file,
  fileId,
  sections
}: {
  file: UploadedDeckInputFile;
  fileId: string;
  sections: ExtractedSection[];
  startChunkIndex: number;
}) {
  let chunkIndex = 1;
  const sources: DeckInputSource[] = [];

  for (const section of sections) {
    for (const chunk of chunkText(section.text)) {
      const sourceId = `${fileId}_c${String(chunkIndex).padStart(3, "0")}`;

      sources.push(
        deckInputSourceSchema.parse({
          chunkIndex,
          fileId,
          fileName: file.name,
          kind: section.kind ?? "text",
          label: section.label ?? file.name,
          pageNumber: section.pageNumber,
          sheetName: section.sheetName,
          slideNumber: section.slideNumber,
          sourceId,
          text: chunk
        })
      );
      chunkIndex += 1;
    }
  }

  return sources;
}

function chunkText(value: string) {
  const normalized = compactWhitespace(value);

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length && chunks.length < 200) {
    const hardEnd = Math.min(normalized.length, cursor + chunkMaxLength);
    const slice = normalized.slice(cursor, hardEnd);
    const softBreak = Math.max(
      slice.lastIndexOf("\n\n"),
      slice.lastIndexOf("。"),
      slice.lastIndexOf("！"),
      slice.lastIndexOf("？"),
      slice.lastIndexOf(". ")
    );
    const end =
      hardEnd < normalized.length && softBreak > chunkMaxLength * 0.45
        ? cursor + softBreak + 1
        : hardEnd;
    const chunk = normalized.slice(cursor, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    cursor = Math.max(end - chunkOverlap, end);
  }

  return chunks;
}

function buildFileId(index: number) {
  return `src_f${String(index + 1).padStart(3, "0")}`;
}

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");

  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function decodeText(bytes: Uint8Array) {
  return new TextDecoder("utf-8", {
    fatal: false
  }).decode(bytes);
}

function compactWhitespace(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function summarizeText(text: string) {
  const normalized = compactWhitespace(text).replace(/\s+/g, " ");

  return normalized.length > 800 ? `${normalized.slice(0, 797)}...` : normalized;
}

function buildKeyPoints(text: string) {
  return compactWhitespace(text)
    .split(/\n+|(?<=[。！？.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8)
    .slice(0, 8)
    .map((item) => (item.length > 220 ? `${item.slice(0, 217)}...` : item));
}

function summarizeRows(rows: Array<Array<string | number | boolean | Date | null>>) {
  const limitedRows = rows.slice(0, 80);
  const lines = limitedRows
    .map((row, rowIndex) => {
      const values = row
        .slice(0, 16)
        .map(formatCellValue)
        .filter(Boolean);

      return values.length > 0 ? `R${rowIndex + 1}: ${values.join(" | ")}` : "";
    })
    .filter(Boolean);

  return lines.join("\n");
}

function formatCellValue(value: string | number | boolean | Date | null) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value ?? "").trim();
}

function extractOfficeXmlText(xml: string) {
  return xml
    .replace(/<a:br\/>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sortOfficePartNames(first: string, second: string) {
  return getOfficePartNumber(first) - getOfficePartNumber(second);
}

function getOfficePartNumber(value: string) {
  return Number(/\d+/.exec(value)?.[0] ?? 0);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
