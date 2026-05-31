import { z } from "zod";

import { deckStyleSchemaIds, deckTypeIds, paletteIds } from "./options";

export const createDeckHiddenDefaultsByLocale = {
  "zh-CN": {
    audience: "通用受众",
    goal: "清晰传达核心内容",
    pageCount: 6
  },
  "en-US": {
    audience: "general audience",
    goal: "communicate the core message clearly",
    pageCount: 6
  }
} as const;

export function getCreateDeckHiddenDefaults(locale: "zh-CN" | "en-US") {
  return createDeckHiddenDefaultsByLocale[locale];
}

export const createDeckFormDefaults = {
  idea: "",
  audience: createDeckHiddenDefaultsByLocale["zh-CN"].audience,
  goal: createDeckHiddenDefaultsByLocale["zh-CN"].goal,
  pageCount: 6,
  deckType: "business-report",
  style: "strategic",
  palette: "star-map"
} satisfies CreateDeckForm;

export const createDeckFormSchema = z.object({
  idea: z.string().trim().min(10, "idea.tooShort").max(12000),
  audience: z
    .string()
    .trim()
    .min(2, "audience.tooShort")
    .default(createDeckHiddenDefaultsByLocale["zh-CN"].audience),
  goal: z
    .string()
    .trim()
    .min(2, "goal.tooShort")
    .default(createDeckHiddenDefaultsByLocale["zh-CN"].goal),
  pageCount: z.coerce
    .number()
    .int("pageCount.integer")
    .min(3)
    .max(18)
    .default(createDeckHiddenDefaultsByLocale["zh-CN"].pageCount),
  deckType: z.enum(deckTypeIds).default("business-report"),
  style: z.enum(deckStyleSchemaIds).default("strategic"),
  palette: z.enum(paletteIds)
});

export type CreateDeckFormInput = z.input<typeof createDeckFormSchema>;
export type CreateDeckForm = z.infer<typeof createDeckFormSchema>;
