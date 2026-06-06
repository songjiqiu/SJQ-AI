import {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind
} from "@prisma/client";
import { z } from "zod";

export const templateElementAssetKindSchema = z.enum(TemplateElementAssetKind);
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

const nullableNumberSchema = z.coerce.number().finite().nullable().optional();
const optionalStringSchema = z.string().trim().min(1).max(160).nullable().optional();
const requiredShortStringSchema = z.string().trim().min(1).max(120);

export const templateIconAssetDetailSchema = z
  .object({
    cornerRadius: nullableNumberSchema,
    fillMode: optionalStringSchema,
    iconName: requiredShortStringSchema,
    iconStyle: z.string().trim().min(1).max(40).default("line"),
    strokeColor: optionalStringSchema,
    strokeWidth: nullableNumberSchema
  })
  .strict();

export const templateShapeAssetDetailSchema = z
  .object({
    cornerRadius: nullableNumberSchema,
    fillColor: optionalStringSchema,
    opacity: nullableNumberSchema,
    shadow: z.boolean().default(false),
    shapeType: z.string().trim().min(1).max(80),
    strokeColor: optionalStringSchema,
    strokeWidth: nullableNumberSchema
  })
  .strict();

export const templateLineAssetDetailSchema = z
  .object({
    cap: z.string().trim().min(1).max(40).default("round"),
    connectorType: z.string().trim().min(1).max(80).default("straight"),
    dash: z.string().trim().min(1).max(40).default("solid"),
    direction: z.string().trim().min(1).max(80).default("horizontal"),
    endArrowType: z.string().trim().min(1).max(80).default("none"),
    startArrowType: z.string().trim().min(1).max(80).default("none"),
    strokeColor: optionalStringSchema,
    strokeWidth: nullableNumberSchema
  })
  .strict();

export const templateTextStyleAssetDetailSchema = z
  .object({
    color: optionalStringSchema,
    fontFamily: optionalStringSchema,
    fontSize: nullableNumberSchema,
    fontWeight: z.coerce.number().int().min(100).max(1000).nullable().optional(),
    letterSpacing: nullableNumberSchema,
    lineHeight: nullableNumberSchema,
    maxLines: z.coerce.number().int().min(1).max(12).nullable().optional(),
    textRole: z.string().trim().min(1).max(100)
  })
  .strict();

export const templateContainerAssetDetailSchema = z
  .object({
    allowedContentTypes: templateElementAssetStringListSchema
      .optional()
      .default(["text"]),
    autoLayout: z.boolean().default(false),
    containerRole: z.string().trim().min(1).max(100),
    fillColor: optionalStringSchema,
    gap: nullableNumberSchema,
    padding: nullableNumberSchema,
    recommendedHeight: nullableNumberSchema,
    recommendedWidth: nullableNumberSchema,
    strokeColor: optionalStringSchema,
    strokeWidth: nullableNumberSchema
  })
  .strict();

export const templateNavigationAssetDetailSchema = z
  .object({
    activeColor: optionalStringSchema,
    displayMode: z.string().trim().min(1).max(80),
    fixedPosition: z.string().trim().min(1).max(40).default("bottom"),
    inactiveColor: optionalStringSchema,
    navigationRole: z.string().trim().min(1).max(100),
    showOnCover: z.boolean().default(false),
    showOnEnding: z.boolean().default(false)
  })
  .strict();

const detailSchemaByKind = {
  CONTAINER: templateContainerAssetDetailSchema,
  ICON: templateIconAssetDetailSchema,
  LINE: templateLineAssetDetailSchema,
  NAVIGATION: templateNavigationAssetDetailSchema,
  SHAPE: templateShapeAssetDetailSchema,
  TEXT_STYLE: templateTextStyleAssetDetailSchema
} as const;

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
  preview: optionalJsonObjectSchema.optional().default({}),
  primaryCategory: templateElementAssetNullableCategoryKeySchema,
  resource: optionalJsonObjectSchema.optional().default({}),
  secondaryCategory: templateElementAssetNullableCategoryKeySchema,
  setKey: templateAssetSetKeySchema.default("common"),
  setKind: templateAssetSetKindSchema.default(TemplateAssetSetKind.COMMON),
  setName: templateAssetSetNameSchema.default("通用套装"),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional().default(0),
  source: templateAssetSourceSchema.optional().default(TemplateAssetSource.MANUAL),
  style: optionalJsonObjectSchema.optional().default({}),
  styleTags: templateElementAssetStringListSchema.optional().default([]),
  synonyms: templateElementAssetStringListSchema.optional().default([]),
  tags: templateElementAssetStringListSchema.optional().default([]),
  usageScenarios: templateElementAssetStringListSchema.optional().default([]),
  variantKey: templateElementAssetNullableCategoryKeySchema
};

export const templateElementAssetCreateSchema = z
  .object({
    ...templateElementAssetBaseSchema,
    detail: z.record(z.string(), z.unknown()).optional(),
    kind: templateElementAssetKindSchema,
    reviewStatus: templateAssetReviewStatusSchema.optional(),
    semanticTags: templateElementAssetRequiredStringListSchema
  })
  .strict()
  .transform((value) => {
    const detail = parseDetailForKind(
      value.kind,
      value.detail ?? buildDetailFromLegacyFields(value.kind, value.style, value.resource, value.preview)
    );

    return {
      ...value,
      aiModifyPermissions:
        value.aiModifyPermissions ??
        buildDefaultAiModifyPermissions(value.kind),
      detail,
      reviewStatus:
        value.reviewStatus ??
        (value.source === TemplateAssetSource.AI_GENERATED
          ? TemplateAssetReviewStatus.PENDING_REVIEW
          : TemplateAssetReviewStatus.APPROVED)
    };
  })
  .superRefine(validateTypeSpecificPermissions);

export const templateElementAssetUpdateSchema = z
  .object({
    aiModifyPermissions: aiModifyPermissionsSchema.optional(),
    backgroundModes: templateElementAssetOptionalStringListSchema.optional(),
    colorTags: templateElementAssetOptionalStringListSchema.optional(),
    description: templateElementAssetBaseSchema.description,
    detail: z.record(z.string(), z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
    keywords: templateElementAssetOptionalStringListSchema.optional(),
    name: templateElementAssetBaseSchema.name.optional(),
    pageTypes: templateElementAssetOptionalStringListSchema.optional(),
    preview: emptyJsonObjectSchema.optional(),
    primaryCategory: templateElementAssetNullableCategoryKeySchema,
    resource: emptyJsonObjectSchema.optional(),
    reviewStatus: templateAssetReviewStatusSchema.optional(),
    secondaryCategory: templateElementAssetNullableCategoryKeySchema,
    semanticTags: templateElementAssetOptionalStringListSchema.optional(),
    setKey: templateAssetSetKeySchema.optional(),
    setKind: templateAssetSetKindSchema.optional(),
    setName: templateAssetSetNameSchema.optional(),
    sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
    source: templateAssetSourceSchema.optional(),
    style: emptyJsonObjectSchema.optional(),
    styleTags: templateElementAssetOptionalStringListSchema.optional(),
    synonyms: templateElementAssetOptionalStringListSchema.optional(),
    tags: templateElementAssetOptionalStringListSchema.optional(),
    usageScenarios: templateElementAssetOptionalStringListSchema.optional(),
    variantKey: templateElementAssetNullableCategoryKeySchema
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

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

export function buildDefaultAiModifyPermissions(kind: TemplateElementAssetKind) {
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

export function parseDetailForKind(
  kind: TemplateElementAssetKind,
  detail: Record<string, unknown>
) {
  return detailSchemaByKind[kind].parse(detail);
}

export function buildDetailFromLegacyFields(
  kind: TemplateElementAssetKind,
  style: Record<string, unknown>,
  resource: Record<string, unknown>,
  preview: Record<string, unknown>
) {
  if (kind === TemplateElementAssetKind.ICON) {
    return {
      cornerRadius: readNumber(style.cornerRadius),
      fillMode: readString(style.fillMode),
      iconName:
        readString(preview.iconName) ??
        readString(resource.semanticKey) ??
        readString(resource.iconName) ??
        "semantic-icon",
      iconStyle: readString(style.iconStyle) ?? "line",
      strokeColor: readString(style.strokeColor),
      strokeWidth: readNumber(style.strokeWidth)
    };
  }

  if (kind === TemplateElementAssetKind.SHAPE) {
    return {
      cornerRadius: readNumber(style.cornerRadius),
      fillColor: readString(style.fillColor),
      opacity: readNumber(style.opacity),
      shadow: readBoolean(style.shadow),
      shapeType:
        readString(resource.shapeType) ??
        readString(style.shapeType) ??
        readString(preview.shape) ??
        "roundedRect",
      strokeColor: readString(style.strokeColor),
      strokeWidth: readNumber(style.strokeWidth)
    };
  }

  if (kind === TemplateElementAssetKind.LINE) {
    return {
      cap: readString(style.cap) ?? "round",
      connectorType:
        readString(resource.connectorType) ??
        readString(style.connectorType) ??
        "straight",
      dash: readString(style.dash) ?? "solid",
      direction:
        readString(resource.direction) ??
        readString(style.direction) ??
        readString(preview.direction) ??
        "horizontal",
      endArrowType:
        readString(resource.endArrowType) ??
        readString(style.endArrowType) ??
        "none",
      startArrowType:
        readString(resource.startArrowType) ??
        readString(style.startArrowType) ??
        "none",
      strokeColor: readString(style.strokeColor),
      strokeWidth: readNumber(style.strokeWidth)
    };
  }

  if (kind === TemplateElementAssetKind.TEXT_STYLE) {
    return {
      color: readString(style.color),
      fontFamily: readString(style.fontFamily),
      fontSize: readNumber(style.fontSize),
      fontWeight: readNumber(style.fontWeight),
      letterSpacing: readNumber(style.letterSpacing),
      lineHeight: readNumber(style.lineHeight),
      maxLines: readNumber(style.maxLines),
      textRole:
        readString(resource.textRole) ??
        readString(style.textRole) ??
        readString(preview.textRole) ??
        "body"
    };
  }

  if (kind === TemplateElementAssetKind.CONTAINER) {
    return {
      allowedContentTypes: readStringArray(style.allowedContentTypes, ["text"]),
      autoLayout: readBoolean(style.autoLayout),
      containerRole:
        readString(resource.containerRole) ??
        readString(style.containerRole) ??
        readString(preview.containerRole) ??
        "container",
      fillColor: readString(style.fillColor),
      gap: readNumber(style.gap),
      padding: readNumber(style.padding),
      recommendedHeight: readNumber(style.recommendedHeight),
      recommendedWidth: readNumber(style.recommendedWidth),
      strokeColor: readString(style.strokeColor),
      strokeWidth: readNumber(style.strokeWidth)
    };
  }

  return {
    activeColor: readString(style.activeColor),
    displayMode:
      readString(resource.displayMode) ??
      readString(style.displayMode) ??
      readString(preview.displayMode) ??
      "label",
    fixedPosition: readString(style.fixedPosition) ?? "bottom",
    inactiveColor: readString(style.inactiveColor),
    navigationRole:
      readString(resource.navigationRole) ??
      readString(style.navigationRole) ??
      readString(preview.navigationRole) ??
      "page-number",
    showOnCover: readBoolean(style.showOnCover),
    showOnEnding: readBoolean(style.showOnEnding)
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

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}
