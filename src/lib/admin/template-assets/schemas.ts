import {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind
} from "@prisma/client";
import { z } from "zod";

export const templateElementAssetKindSchema = z.enum(
  TemplateElementAssetKind
);
export const templateAssetSetKindSchema = z.enum(TemplateAssetSetKind);
export const templateAssetReviewStatusSchema = z.enum(
  TemplateAssetReviewStatus
);
export const templateAssetSourceSchema = z.enum(TemplateAssetSource);

export const templateElementAssetStringListSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(16)
  .default([]);

const templateElementAssetRequiredStringListSchema = z
  .array(z.string().trim().min(1).max(40))
  .min(1)
  .max(16);

const templateElementAssetCategoryKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80);

const templateElementAssetNullableCategoryKeySchema =
  templateElementAssetCategoryKeySchema.nullable().optional();

const templateElementAssetOptionalStringListSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(16);

const templateAssetSetKeySchema = z.string().trim().min(1).max(80);
const templateAssetSetNameSchema = z.string().trim().min(1).max(120);

const jsonObjectSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length > 0, {
    message: "JSON object cannot be empty"
  });

const emptyJsonObjectSchema = z.record(z.string(), z.unknown());
const optionalJsonObjectSchema = emptyJsonObjectSchema.default({});

const aiModifyPermissionsSchema = z
  .object({
    allowAutoLayout: z.boolean().default(false),
    allowMove: z.boolean().default(true),
    allowRecolor: z.boolean().default(true),
    allowResize: z.boolean().default(true),
    allowStretch: z.boolean().default(false),
    allowTextShrink: z.boolean().default(false)
  })
  .strict();

const templateElementAssetBaseSchema = {
  aiModifyPermissions: aiModifyPermissionsSchema.optional(),
  backgroundModes: templateElementAssetStringListSchema.optional().default([
    "light",
    "dark"
  ]),
  colorTags: templateElementAssetStringListSchema.optional().default([]),
  description: z.string().trim().max(500).optional().nullable(),
  isEnabled: z.boolean().optional().default(true),
  keywords: templateElementAssetStringListSchema.optional().default([]),
  name: z.string().trim().min(1).max(120),
  pageTypes: templateElementAssetStringListSchema.optional().default([]),
  preview: jsonObjectSchema,
  primaryCategory: templateElementAssetNullableCategoryKeySchema,
  resource: optionalJsonObjectSchema.optional().default({}),
  secondaryCategory: templateElementAssetNullableCategoryKeySchema,
  setKey: templateAssetSetKeySchema.default("common"),
  setKind: templateAssetSetKindSchema.default(TemplateAssetSetKind.COMMON),
  setName: templateAssetSetNameSchema.default("通用套装"),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(0),
  source: templateAssetSourceSchema.optional().default(TemplateAssetSource.MANUAL),
  style: jsonObjectSchema,
  styleTags: templateElementAssetStringListSchema.optional().default([]),
  synonyms: templateElementAssetStringListSchema.optional().default([]),
  tags: templateElementAssetStringListSchema.optional().default([]),
  usageScenarios: templateElementAssetStringListSchema.optional().default([]),
  variantKey: templateElementAssetNullableCategoryKeySchema
};

export const templateElementAssetCreateSchema = z
  .object({
    ...templateElementAssetBaseSchema,
    kind: templateElementAssetKindSchema,
    reviewStatus: templateAssetReviewStatusSchema.optional(),
    semanticTags: templateElementAssetRequiredStringListSchema
  })
  .strict()
  .transform((value) => ({
    ...value,
    aiModifyPermissions:
      value.aiModifyPermissions ??
      buildDefaultAiModifyPermissions(value.kind),
    reviewStatus:
      value.reviewStatus ??
      (value.source === TemplateAssetSource.AI_GENERATED
        ? TemplateAssetReviewStatus.PENDING_REVIEW
        : TemplateAssetReviewStatus.APPROVED)
  }))
  .superRefine(validateTypeSpecificPermissions);

export const templateElementAssetUpdateSchema = z
  .object({
    aiModifyPermissions: aiModifyPermissionsSchema.optional(),
    backgroundModes: templateElementAssetOptionalStringListSchema.optional(),
    colorTags: templateElementAssetOptionalStringListSchema.optional(),
    description: templateElementAssetBaseSchema.description,
    isEnabled: z.boolean().optional(),
    kind: templateElementAssetKindSchema.optional(),
    keywords: templateElementAssetOptionalStringListSchema.optional(),
    name: templateElementAssetBaseSchema.name.optional(),
    pageTypes: templateElementAssetOptionalStringListSchema.optional(),
    preview: jsonObjectSchema.optional(),
    primaryCategory: templateElementAssetNullableCategoryKeySchema,
    resource: emptyJsonObjectSchema.optional(),
    reviewStatus: templateAssetReviewStatusSchema.optional(),
    semanticTags: templateElementAssetOptionalStringListSchema.optional(),
    secondaryCategory: templateElementAssetNullableCategoryKeySchema,
    setKey: templateAssetSetKeySchema.optional(),
    setKind: templateAssetSetKindSchema.optional(),
    setName: templateAssetSetNameSchema.optional(),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
    source: templateAssetSourceSchema.optional(),
    style: jsonObjectSchema.optional(),
    styleTags: templateElementAssetOptionalStringListSchema.optional(),
    synonyms: templateElementAssetOptionalStringListSchema.optional(),
    tags: templateElementAssetOptionalStringListSchema.optional(),
    usageScenarios: templateElementAssetOptionalStringListSchema.optional(),
    variantKey: templateElementAssetNullableCategoryKeySchema
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  })
  .superRefine(validateTypeSpecificPermissions);

export const templateElementAssetListQuerySchema = z
  .object({
    backgroundMode: templateElementAssetCategoryKeySchema.optional(),
    includeDisabled: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    includeUnapproved: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    kind: templateElementAssetKindSchema.optional(),
    pageType: templateElementAssetCategoryKeySchema.optional(),
    primaryCategory: templateElementAssetCategoryKeySchema.optional(),
    query: z.string().trim().max(120).optional(),
    reviewStatus: templateAssetReviewStatusSchema.optional(),
    secondaryCategory: templateElementAssetCategoryKeySchema.optional(),
    setKey: templateElementAssetCategoryKeySchema.optional(),
    setKind: templateAssetSetKindSchema.optional(),
    styleTag: templateElementAssetCategoryKeySchema.optional(),
    variantKey: templateElementAssetCategoryKeySchema.optional()
  })
  .strict();

export const templateElementAssetAiSearchSchema = z
  .object({
    backgroundMode: templateElementAssetCategoryKeySchema.optional(),
    kind: templateElementAssetKindSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(12),
    pageSemantic: z.string().trim().max(120).optional(),
    pageType: templateElementAssetCategoryKeySchema.optional(),
    semanticTags: templateElementAssetOptionalStringListSchema.optional().default(
      []
    ),
    setKey: templateElementAssetCategoryKeySchema.optional(),
    styleTags: templateElementAssetOptionalStringListSchema.optional().default([])
  })
  .strict();

export type TemplateElementAssetCreateInput = z.input<
  typeof templateElementAssetCreateSchema
>;
export type TemplateElementAssetCreatePayload = z.output<
  typeof templateElementAssetCreateSchema
>;
export type TemplateElementAssetUpdateInput = z.input<
  typeof templateElementAssetUpdateSchema
>;
export type TemplateElementAssetUpdatePayload = z.output<
  typeof templateElementAssetUpdateSchema
>;
export type TemplateElementAssetAiSearchInput = z.input<
  typeof templateElementAssetAiSearchSchema
>;
export type TemplateElementAssetAiSearchPayload = z.output<
  typeof templateElementAssetAiSearchSchema
>;

function buildDefaultAiModifyPermissions(kind: TemplateElementAssetKind) {
  return {
    allowAutoLayout:
      kind === TemplateElementAssetKind.CONTAINER ||
      kind === TemplateElementAssetKind.NAVIGATION,
    allowMove: true,
    allowRecolor: true,
    allowResize: true,
    allowStretch:
      kind === TemplateElementAssetKind.SHAPE ||
      kind === TemplateElementAssetKind.CONTAINER,
    allowTextShrink: kind === TemplateElementAssetKind.TEXT_STYLE
  };
}

function validateTypeSpecificPermissions(
  value: {
    aiModifyPermissions?: z.infer<typeof aiModifyPermissionsSchema>;
    kind?: TemplateElementAssetKind;
  },
  context: z.RefinementCtx
) {
  if (!value.kind || !value.aiModifyPermissions) {
    return;
  }

  if (
    value.kind === TemplateElementAssetKind.TEXT_STYLE &&
    value.aiModifyPermissions.allowStretch
  ) {
    context.addIssue({
      code: "custom",
      message: "Text style assets cannot allow stretch",
      path: ["aiModifyPermissions", "allowStretch"]
    });
  }

  if (
    value.kind === TemplateElementAssetKind.LINE &&
    value.aiModifyPermissions.allowTextShrink
  ) {
    context.addIssue({
      code: "custom",
      message: "Line assets cannot allow text shrink",
      path: ["aiModifyPermissions", "allowTextShrink"]
    });
  }
}
