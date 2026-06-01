import { z } from "zod";

import { normalizePptTemplateCategoryId } from "@/lib/admin/templates/categories";
import { slideCompositionPlanSchema } from "@/lib/ai-deck/schema";

export const pptTemplateCategorySchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const category = normalizePptTemplateCategoryId(value);

    if (!category) {
      ctx.addIssue({
        code: "custom",
        message: "Unsupported PPT template category"
      });
      return z.NEVER;
    }

    return category;
  });

export const pptTemplateTagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(12)
  .default([]);

const pptTemplateOptionalTagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(12);

export const pptTemplateCreateSchema = z
  .object({
    category: pptTemplateCategorySchema,
    customCategoryKey: z.string().trim().min(1).max(80).optional().nullable(),
    customCategoryName: z.string().trim().min(1).max(120).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    isEnabled: z.boolean().optional().default(true),
    name: z.string().trim().min(1).max(120),
    slide: slideCompositionPlanSchema.optional(),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(0),
    tags: pptTemplateTagsSchema.optional().default([])
  })
  .strict();

export const pptTemplateUpdateSchema = z
  .object({
    category: pptTemplateCategorySchema.optional(),
    customCategoryKey: z.string().trim().min(1).max(80).optional().nullable(),
    customCategoryName: z.string().trim().min(1).max(120).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    isEnabled: z.boolean().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    slide: slideCompositionPlanSchema.optional(),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
    tags: pptTemplateOptionalTagsSchema.optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const pptTemplateListQuerySchema = z
  .object({
    category: pptTemplateCategorySchema.optional(),
    includeDisabled: z
      .string()
      .optional()
      .transform((value) => value !== "false")
  })
  .strict();

export type PptTemplateCreateInput = z.infer<typeof pptTemplateCreateSchema>;
export type PptTemplateUpdateInput = z.infer<typeof pptTemplateUpdateSchema>;
