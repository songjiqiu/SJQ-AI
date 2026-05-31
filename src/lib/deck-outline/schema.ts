import { z } from "zod";

import {
  analyzeDeckRequestSchema,
  confirmedDeckIntentSchema,
  deckIntentAnalysisResultSchema,
  deckOutlineFileSummarySchema,
  deckOutlineIntentInputSchema,
  deckOutlineResultSchema,
  slideContentSchema,
  unifiedVisualSpecSchema
} from "@/lib/ai-deck/schema";

export const createDeckOutlineDraftSchema = deckOutlineIntentInputSchema
  .extend({
    confirmedIntent: confirmedDeckIntentSchema
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.confirmedIntent.deckType !== input.deckType) {
      ctx.addIssue({
        code: "custom",
        message: "confirmedIntent.deckType must match deckType",
        path: ["confirmedIntent", "deckType"]
      });
    }

    if (input.confirmedIntent.style !== input.style) {
      ctx.addIssue({
        code: "custom",
        message: "confirmedIntent.style must match style",
        path: ["confirmedIntent", "style"]
      });
    }
  });

export const updateDeckOutlineDraftSchema = z
  .object({
    deckTitle: z.string().trim().min(2).max(100),
    deckSummary: z.string().trim().min(8).max(300),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(slideContentSchema).min(3).max(18)
  })
  .strict();

export const deckOutlineDraftSchema = deckOutlineResultSchema
  .extend({
    id: z.string().min(3).max(120),
    input: analyzeDeckRequestSchema,
    fileSummaries: z.array(deckOutlineFileSummarySchema),
    intentAnalysis: deckIntentAnalysisResultSchema.optional(),
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
    slideCount: z.number().int().min(3).max(18),
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
