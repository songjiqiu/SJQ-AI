import { z } from "zod";

import {
  analyzeDeckRequestSchema,
  deckOutlineResultSchema,
  slideContentSchema,
  unifiedVisualSpecSchema
} from "@/lib/ai-deck/schema";
import {
  deckStyleSchemaIds,
  deckTypeIds,
  paletteIds
} from "@/lib/create-deck/options";
import {
  deckInputMaxFileCharacters,
  deckInputMaxFileCount,
  deckInputMaxFileSize
} from "@/lib/create-deck/file-options";

const textFileInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    size: z.number().int().min(0).max(deckInputMaxFileSize),
    type: z.string().trim().max(120).optional(),
    content: z.string().trim().min(1).max(deckInputMaxFileCharacters)
  })
  .strict();

export const createDeckOutlineDraftSchema = z
  .object({
    idea: z.string().trim().min(10).max(12000),
    sourceText: z.string().trim().max(12000).optional().default(""),
    textFiles: z
      .array(textFileInputSchema)
      .max(deckInputMaxFileCount)
      .optional()
      .default([]),
    audience: z.string().trim().min(2).max(120),
    goal: z.string().trim().min(2).max(160),
    pageCount: z.coerce.number().int().min(3).max(12),
    deckType: z.enum(deckTypeIds).default("business-report"),
    style: z.enum(deckStyleSchemaIds).default("strategic"),
    palette: z.enum(paletteIds),
    locale: z.enum(["zh-CN", "en-US"])
  })
  .strict();

export const updateDeckOutlineDraftSchema = z
  .object({
    deckTitle: z.string().trim().min(2).max(100),
    deckSummary: z.string().trim().min(8).max(300),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(slideContentSchema).min(3).max(12)
  })
  .strict();

export const deckOutlineDraftSchema = deckOutlineResultSchema
  .extend({
    id: z.string().min(3).max(120),
    input: analyzeDeckRequestSchema,
    fileSummaries: z
      .array(
        z
          .object({
            name: z.string().min(1).max(255),
            size: z.number().int().min(0).max(deckInputMaxFileSize),
            characterCount: z.number().int().min(0).max(deckInputMaxFileCharacters)
          })
          .strict()
      )
      .max(deckInputMaxFileCount),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  })
  .strict();

export const deckOutlineDraftListItemSchema = z
  .object({
    id: z.string().min(3).max(120),
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    mode: z.enum(["ai-json", "mock"]),
    slideCount: z.number().int().min(3).max(12),
    updatedAt: z.string().min(1),
    createdAt: z.string().min(1)
  })
  .strict();

export type CreateDeckOutlineDraftInput = z.infer<
  typeof createDeckOutlineDraftSchema
>;
export type UpdateDeckOutlineDraftInput = z.infer<
  typeof updateDeckOutlineDraftSchema
>;
export type DeckOutlineDraft = z.infer<typeof deckOutlineDraftSchema>;
export type DeckOutlineDraftListItem = z.infer<
  typeof deckOutlineDraftListItemSchema
>;
