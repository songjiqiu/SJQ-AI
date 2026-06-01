import { z } from "zod";

import {
  analyzeDeckRequestSchema,
  deckIntentAnalysisResultSchema,
  deckOutlineFileSummarySchema,
  deckOutlineIntentInputSchema,
  deckOutlineResultSchema,
  slideContentSchema,
  unifiedVisualSpecSchema
} from "@/lib/ai-deck/schema";

export const createDeckOutlineDraftSchema = deckOutlineIntentInputSchema
  .extend({
    confirmedPlan: deckIntentAnalysisResultSchema
  })
  .strip()
  .superRefine((input, ctx) => {
    if (input.confirmedPlan.deckType !== input.deckType) {
      ctx.addIssue({
        code: "custom",
        message: "confirmedPlan.deckType must match deckType",
        path: ["confirmedPlan", "deckType"]
      });
    }

    if (input.confirmedPlan.input.deckType !== input.deckType) {
      ctx.addIssue({
        code: "custom",
        message: "confirmedPlan.input.deckType must match deckType",
        path: ["confirmedPlan", "input", "deckType"]
      });
    }

    if (input.confirmedPlan.input.locale !== input.locale) {
      ctx.addIssue({
        code: "custom",
        message: "confirmedPlan.input.locale must match locale",
        path: ["confirmedPlan", "input", "locale"]
      });
    }

    if (input.confirmedPlan.input.palette !== input.palette) {
      ctx.addIssue({
        code: "custom",
        message: "confirmedPlan.input.palette must match palette",
        path: ["confirmedPlan", "input", "palette"]
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
