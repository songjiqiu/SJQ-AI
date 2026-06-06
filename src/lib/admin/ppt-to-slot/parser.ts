import type JSZip from "jszip";

import {
  type PptLayerStyle,
  type PptLayerType,
  type PptRawLayer,
  type PptRawSlide,
  type SlotCanvas,
  type SlotFrame
} from "@/lib/admin/ppt-to-slot/types";

const emuPerInch = 914400;
const defaultCanvas: SlotCanvas = {
  h: 7.5,
  unit: "inch",
  w: 13.333,
  x: 0,
  y: 0
};

export async function parsePptxSlides(zip: JSZip): Promise<PptRawSlide[]> {
  const canvas = await parseCanvas(zip);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((first, second) => slideNumber(first) - slideNumber(second));

  return Promise.all(
    slideFiles.map(async (name, index) => {
      const xml = (await zip.file(name)?.async("text")) ?? "";

      return {
        canvas,
        layers: parseSlideLayers(xml, index + 1),
        slideIndex: index + 1
      };
    })
  );
}

async function parseCanvas(zip: JSZip): Promise<SlotCanvas> {
  const xml = await zip.file("ppt/presentation.xml")?.async("text");
  const sizeTag = xml?.match(/<p:sldSz\b[^>]*>/)?.[0];

  if (!sizeTag) {
    return defaultCanvas;
  }

  const w = readNumberAttr(sizeTag, "cx");
  const h = readNumberAttr(sizeTag, "cy");

  if (!w || !h) {
    return defaultCanvas;
  }

  return {
    h: roundInch(h / emuPerInch),
    unit: "inch",
    w: roundInch(w / emuPerInch),
    x: 0,
    y: 0
  };
}

export function parseSlideLayers(xml: string, slideIndex: number): PptRawLayer[] {
  const blocks = collectShapeBlocks(xml);

  return blocks
    .map((block, index) => parseLayerBlock(block, slideIndex, index))
    .filter((layer): layer is PptRawLayer => Boolean(layer));
}

function collectShapeBlocks(xml: string) {
  const blocks: Array<{
    kind: PptLayerType;
    xml: string;
  }> = [];
  const patterns: Array<[PptLayerType, RegExp]> = [
    ["shape", /<p:sp\b[\s\S]*?<\/p:sp>/g],
    ["line", /<p:cxnSp\b[\s\S]*?<\/p:cxnSp>/g],
    ["image", /<p:pic\b[\s\S]*?<\/p:pic>/g],
    ["unknown", /<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g],
    ["group", /<p:grpSp\b[\s\S]*?<\/p:grpSp>/g]
  ];

  for (const [kind, pattern] of patterns) {
    for (const match of xml.matchAll(pattern)) {
      blocks.push({
        kind,
        xml: match[0]
      });
    }
  }

  return blocks.sort(
    (first, second) => xml.indexOf(first.xml) - xml.indexOf(second.xml)
  );
}

function parseLayerBlock(
  block: { kind: PptLayerType; xml: string },
  slideIndex: number,
  index: number
): PptRawLayer | null {
  const frame = parseFrame(block.xml);

  if (!frame || frame.w <= 0 || frame.h <= 0) {
    return null;
  }

  const text = extractText(block.xml);
  const type = refineLayerType(block.kind, block.xml, text);
  const name = extractName(block.xml) || `${type}_${index + 1}`;

  return {
    frame,
    id: `slide${slideIndex}_${type}${index + 1}`,
    name,
    style: parseStyle(block.xml, type),
    text: text || undefined,
    type,
    visible: !/\bhidden="1"/.test(block.xml),
    zIndex: index + 1
  };
}

function refineLayerType(kind: PptLayerType, xml: string, text: string) {
  if (kind === "shape" && text.trim()) {
    return "text";
  }

  if (kind === "unknown") {
    if (/<c:chart\b/.test(xml)) {
      return "chart";
    }

    if (/<a:tbl\b/.test(xml)) {
      return "table";
    }
  }

  return kind;
}

function parseFrame(xml: string): SlotFrame | null {
  const xfrm = xml.match(/<(?:a|p):xfrm\b[\s\S]*?<\/(?:a|p):xfrm>/)?.[0];

  if (!xfrm) {
    return null;
  }

  const offTag = xfrm.match(/<a:off\b[^>]*>/)?.[0];
  const extTag = xfrm.match(/<a:ext\b[^>]*>/)?.[0];

  if (!offTag || !extTag) {
    return null;
  }

  const x = readNumberAttr(offTag, "x");
  const y = readNumberAttr(offTag, "y");
  const w = readNumberAttr(extTag, "cx");
  const h = readNumberAttr(extTag, "cy");

  if (x === null || y === null || w === null || h === null) {
    return null;
  }

  return {
    h: roundInch(h / emuPerInch),
    w: roundInch(w / emuPerInch),
    x: roundInch(x / emuPerInch),
    y: roundInch(y / emuPerInch)
  };
}

function parseStyle(xml: string, type: PptLayerType): PptLayerStyle {
  const runProps = xml.match(/<a:rPr\b[^>]*>/)?.[0] ?? "";
  const solidFill = xml.match(/<a:solidFill\b[\s\S]*?<\/a:solidFill>/)?.[0] ?? "";
  const line = xml.match(/<a:ln\b[\s\S]*?<\/a:ln>/)?.[0] ?? "";
  const fontSizeRaw = readNumberAttr(runProps, "sz");
  const latin = xml.match(/<a:latin\b[^>]*>/)?.[0] ?? "";

  return {
    bold: /\bb="1"/.test(runProps),
    color: extractHexColor(solidFill),
    fill: type === "text" ? null : extractHexColor(solidFill),
    fontFace: readStringAttr(latin, "typeface"),
    fontSize: fontSizeRaw ? Math.round(fontSizeRaw / 100) : null,
    line: extractHexColor(line)
  };
}

function extractName(xml: string) {
  const cNvPr = xml.match(/<p:cNvPr\b[^>]*>/)?.[0] ?? "";

  return decodeXml(readStringAttr(cNvPr, "name") ?? "");
}

function extractText(xml: string) {
  return Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
    .map((match) => decodeXml(match[1]))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHexColor(xml: string) {
  const value = xml.match(/<a:srgbClr\b[^>]*\bval="([0-9A-Fa-f]{6})"/)?.[1];

  return value ? `#${value.toUpperCase()}` : null;
}

function readNumberAttr(xml: string, attr: string) {
  const value = xml.match(new RegExp(`\\b${attr}="(-?\\d+(?:\\.\\d+)?)"`))?.[1];

  return value === undefined ? null : Number(value);
}

function readStringAttr(xml: string, attr: string) {
  return xml.match(new RegExp(`\\b${attr}="([^"]*)"`))?.[1] ?? null;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function slideNumber(path: string) {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

function roundInch(value: number) {
  return Number(value.toFixed(3));
}
