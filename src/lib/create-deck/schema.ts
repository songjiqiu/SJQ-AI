import { z } from "zod";

import { deckStyleSchemaIds, deckTypeIds, paletteIds } from "./options";

export const createDeckFormDefaults = {
  idea: "",
  audience: "",
  goal: "",
  pageCount: 6,
  deckType: "business-report",
  style: "strategic",
  palette: "star-map"
} satisfies CreateDeckForm;

export const createDeckFormSchema = z.object({
  idea: z.string().trim().min(10, "idea.tooShort").max(12000),
  audience: z.string().trim().min(2, "audience.tooShort"),
  goal: z.string().trim().min(2, "goal.tooShort"),
  pageCount: z.coerce.number().int("pageCount.integer").min(3).max(12),
  deckType: z.enum(deckTypeIds).default("business-report"),
  style: z.enum(deckStyleSchemaIds).default("strategic"),
  palette: z.enum(paletteIds)
});

export type CreateDeckFormInput = z.input<typeof createDeckFormSchema>;
export type CreateDeckForm = z.infer<typeof createDeckFormSchema>;
