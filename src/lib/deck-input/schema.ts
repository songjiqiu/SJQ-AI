import { z } from "zod";

import {
  deckInputMaxFileCharacters,
  deckInputMaxFileCount,
  deckInputMaxFileSize
} from "@/lib/create-deck/file-options";
import { deckTypeIds, paletteIds } from "@/lib/create-deck/options";

export const deckPageCountMin = 6;
export const deckPageCountMax = 40;

export const semanticContentBlockTypeIds = [
  "heading",
  "text",
  "list",
  "image",
  "table",
  "chart",
  "quote",
  "callout",
  "metric",
  "comparison",
  "timeline",
  "steps",
  "summary",
  "conclusion",
  "source"
] as const;

export const deckInputFileParserIds = [
  "text",
  "markdown",
  "csv",
  "json",
  "docx",
  "pptx",
  "xlsx",
  "pdf",
  "image",
  "unsupported"
] as const;

export const deckInputSourceKindIds = [
  "text",
  "table",
  "slide",
  "page",
  "image",
  "summary"
] as const;

export const deckInputSourceSchema = z
  .object({
    chunkIndex: z.number().int().min(1),
    fileId: z.string().min(3).max(80),
    fileName: z.string().min(1).max(255),
    kind: z.enum(deckInputSourceKindIds).default("text"),
    label: z.string().min(1).max(160),
    pageNumber: z.number().int().min(1).max(10000).optional(),
    sheetName: z.string().min(1).max(120).optional(),
    slideNumber: z.number().int().min(1).max(10000).optional(),
    sourceId: z.string().min(6).max(80),
    text: z.string().trim().min(1).max(3000)
  })
  .strict();

export const parsedDeckInputFileSchema = z
  .object({
    characterCount: z.number().int().min(0).max(deckInputMaxFileCharacters),
    extension: z.string().min(1).max(24),
    id: z.string().min(3).max(80),
    keyPoints: z.array(z.string().min(1).max(220)).max(8).default([]),
    mimeType: z.string().max(120).optional().default(""),
    name: z.string().min(1).max(255),
    parser: z.enum(deckInputFileParserIds),
    size: z.number().int().min(0).max(deckInputMaxFileSize),
    sourceIds: z.array(z.string().min(6).max(80)).max(200).default([]),
    summary: z.string().max(800).default(""),
    text: z.string().max(deckInputMaxFileCharacters).default(""),
    warnings: z.array(z.string().min(1).max(240)).max(12).default([])
  })
  .strict();

export const generationInputSchema = z
  .object({
    allowedContentBlockTypes: z
      .array(z.enum(semanticContentBlockTypeIds))
      .default([...semanticContentBlockTypeIds]),
    deckType: z.enum(deckTypeIds).default("business-report"),
    idea: z.string().trim().min(10).max(12000),
    locale: z.enum(["zh-CN", "en-US"]),
    maxContentBlocksPerPage: z.literal(12).default(12),
    pageCount: z.coerce
      .number()
      .int()
      .min(deckPageCountMin)
      .max(deckPageCountMax)
      .optional(),
    palette: z.enum(paletteIds),
    parsedFiles: z
      .array(parsedDeckInputFileSchema)
      .max(deckInputMaxFileCount)
      .default([]),
    sourceText: z.string().trim().max(12000).optional().default(""),
    sources: z.array(deckInputSourceSchema).max(1000).default([])
  })
  .strip()
  .superRefine((input, ctx) => {
    const sourceIds = new Set(input.sources.map((source) => source.sourceId));

    for (const file of input.parsedFiles) {
      for (const sourceId of file.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          ctx.addIssue({
            code: "custom",
            message: "parsedFiles.sourceIds must reference existing sources",
            path: ["parsedFiles", input.parsedFiles.indexOf(file), "sourceIds"]
          });
        }
      }
    }

    for (const type of semanticContentBlockTypeIds) {
      if (!input.allowedContentBlockTypes.includes(type)) {
        ctx.addIssue({
          code: "custom",
          message: "allowedContentBlockTypes must include the complete schema enum",
          path: ["allowedContentBlockTypes"]
        });
        break;
      }
    }
  });

export type DeckInputSource = z.infer<typeof deckInputSourceSchema>;
export type ParsedDeckInputFile = z.infer<typeof parsedDeckInputFileSchema>;
export type GenerationInput = z.infer<typeof generationInputSchema>;
export type SemanticContentBlockType =
  (typeof semanticContentBlockTypeIds)[number];
