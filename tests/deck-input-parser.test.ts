import { rm } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

const mammoth = vi.hoisted(() => ({
  extractRawText: vi.fn(async () => ({
    messages: [],
    value: "DOCX 标题\nDOCX 段落内容。"
  }))
}));

const xlsx = vi.hoisted(() => ({
  read: vi.fn(() => ({
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: {}
    }
  })),
  utils: {
    sheet_to_json: vi.fn(() => [
      ["指标", "数值"],
      ["转化率", 0.2]
    ])
  }
}));

const tesseract = vi.hoisted(() => ({
  recognize: vi.fn(async () => ({
    data: {
      text: "OCR 识别文本。"
    }
  }))
}));

const canvas = vi.hoisted(() => ({
  createCanvas: vi.fn(() => ({
    getContext: vi.fn(() => ({})),
    toBuffer: vi.fn(() => Buffer.from("png"))
  }))
}));

const pdfjs = vi.hoisted(() => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      getPage: vi.fn(async (pageNumber: number) => ({
        getTextContent: vi.fn(async () => ({
          items:
            pageNumber === 1
              ? [{ str: "PDF 可复制文本内容，足够触发文本提取。" }]
              : []
        })),
        getViewport: vi.fn(() => ({
          height: 100,
          width: 100
        })),
        render: vi.fn(() => ({
          promise: Promise.resolve()
        }))
      })),
      numPages: 2
    })
  }))
}));

vi.mock("mammoth", () => mammoth);
vi.mock("xlsx", () => xlsx);
vi.mock("tesseract.js", () => tesseract);
vi.mock("@napi-rs/canvas", () => canvas);
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => pdfjs);

import { parseDeckInputFiles } from "@/lib/deck-input/parser";

function fileInput(name: string, text: string, type = "text/plain") {
  return {
    bytes: new TextEncoder().encode(text),
    name,
    size: text.length,
    type
  };
}

const ocrCacheDir = path.join(process.cwd(), ".vitest", "ocr-cache");

describe("parseDeckInputFiles", () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await rm(ocrCacheDir, {
      force: true,
      recursive: true
    });
  });

  it("parses text-like files into stable source chunks", async () => {
    const result = await parseDeckInputFiles([
      fileInput("brief.md", "# 标题\n试点数据：转化率提升 20%。", "text/markdown")
    ]);

    expect(result.parsedFiles[0]).toMatchObject({
      id: "src_f001",
      parser: "markdown",
      sourceIds: ["src_f001_c001"]
    });
    expect(result.sources[0]).toMatchObject({
      chunkIndex: 1,
      fileId: "src_f001",
      sourceId: "src_f001_c001"
    });
  });

  it("returns a clear warning for legacy binary Office formats", async () => {
    const result = await parseDeckInputFiles([
      {
        bytes: new Uint8Array([1, 2, 3]),
        name: "old.doc",
        size: 3,
        type: "application/msword"
      }
    ]);

    expect(result.parsedFiles[0]).toMatchObject({
      parser: "unsupported",
      sourceIds: []
    });
    expect(result.warnings.join(" ")).toContain("另存为 .docx/.pptx/.xlsx");
  });

  it("extracts DOCX and XLSX text through structured parsers", async () => {
    const result = await parseDeckInputFiles([
      {
        bytes: new Uint8Array([1]),
        name: "brief.docx",
        size: 1,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      {
        bytes: new Uint8Array([2]),
        name: "table.xlsx",
        size: 1,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    ]);

    expect(result.parsedFiles.map((file) => file.parser)).toEqual([
      "docx",
      "xlsx"
    ]);
    expect(result.sources.map((source) => source.sourceId)).toEqual([
      "src_f001_c001",
      "src_f002_c001"
    ]);
    expect(result.sources[1].text).toContain("R1: 指标 | 数值");
  });

  it("extracts PPTX slide and notes text from XML", async () => {
    const zip = new JSZip();

    zip.file(
      "ppt/slides/slide1.xml",
      "<a:p><a:t>第一页标题</a:t></a:p><a:p><a:t>正文</a:t></a:p>"
    );
    zip.file("ppt/notesSlides/notesSlide1.xml", "<a:p><a:t>讲者备注</a:t></a:p>");

    const bytes = new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
    const result = await parseDeckInputFiles([
      {
        bytes,
        name: "deck.pptx",
        size: bytes.byteLength,
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      }
    ]);

    expect(result.parsedFiles[0].parser).toBe("pptx");
    expect(result.sources[0]).toMatchObject({
      kind: "slide",
      slideNumber: 1,
      sourceId: "src_f001_c001"
    });
    expect(result.sources[0].text).toContain("讲者备注");
  });

  it("uses PDF text first and OCR fallback for low-text pages", async () => {
    const result = await parseDeckInputFiles([
      {
        bytes: new Uint8Array([1, 2, 3]),
        name: "report.pdf",
        size: 3,
        type: "application/pdf"
      }
    ]);

    expect(result.parsedFiles[0].parser).toBe("pdf");
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].text).toContain("PDF 可复制文本");
    expect(result.sources[1].text).toContain("OCR 识别文本");
    expect(tesseract.recognize).toHaveBeenCalled();
  });

  it("OCRs image files with Chinese and English enabled", async () => {
    const visionClient = {
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [
              {
                message: {
                  content: "一张产品后台数据看板截图"
                }
              }
            ]
          }))
        }
      }
    };
    const result = await parseDeckInputFiles(
      [
        {
          bytes: new Uint8Array([1, 2, 3]),
          name: "screen.png",
          size: 3,
          type: "image/png"
        }
      ],
      {
        visionClient
      }
    );

    expect(result.parsedFiles[0].parser).toBe("image");
    expect(result.sources[0]).toMatchObject({
      kind: "image",
      sourceId: "src_f001_c001"
    });
    expect(result.sources[0].text).toContain("视觉说明：一张产品后台数据看板截图");
    expect(result.sources[0].text).toContain("OCR文字：OCR 识别文本。");
    expect(tesseract.recognize).toHaveBeenCalledWith(
      expect.any(Buffer),
      "chi_sim+eng",
      expect.any(Object)
    );
    expect(visionClient.chat.completions.create).toHaveBeenCalled();
  });

  it("reuses cached OCR text when available", async () => {
    const bytes = new Uint8Array([7, 8, 9]);

    await parseDeckInputFiles(
      [
        {
          bytes,
          name: "cached.png",
          size: 3,
          type: "image/png"
        }
      ],
      {
        ocrCacheDir
      }
    );

    tesseract.recognize.mockClear();
    const result = await parseDeckInputFiles(
      [
        {
          bytes,
          name: "cached.png",
          size: 3,
          type: "image/png"
        }
      ],
      {
        ocrCacheDir
      }
    );

    expect(result.sources[0].text).toContain("OCR 识别文本");
    expect(tesseract.recognize).not.toHaveBeenCalled();
  });
});
