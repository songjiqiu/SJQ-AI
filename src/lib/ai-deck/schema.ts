import { z } from "zod";

import { deckTypeIds, paletteIds } from "@/lib/create-deck/options";
import {
  deckInputMaxFileCharacters,
  deckInputMaxFileCount,
  deckInputMaxFileSize
} from "@/lib/create-deck/file-options";
import {
  deckInputSourceSchema,
  deckPageCountMax,
  deckPageCountMin,
  generationInputSchema,
  parsedDeckInputFileSchema,
  semanticContentBlockTypeIds
} from "@/lib/deck-input/schema";

export const canvasAspectRatio = "16:9";
export const slideCanvasUnit = "inch";
export const slideCanvasWidth = 13.333;
export const slideCanvasHeight = 7.5;
export const slideCanvasSafeMargin = 0.5;
export const slideCanvasPixelWidth = 1920;
export const slideCanvasPixelHeight = 1080;
export const slideCanvasGridGutterPx = 24;
export const slideContentBlockMaxCount = 12;
export const slideElementMaxCount = 24;

export {
  deckInputSourceSchema,
  deckPageCountMax,
  deckPageCountMin,
  generationInputSchema,
  parsedDeckInputFileSchema,
  semanticContentBlockTypeIds
};

export const deckTextFileInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    size: z.number().int().min(0).max(deckInputMaxFileSize),
    type: z.string().trim().max(120).optional(),
    content: z.string().trim().min(1).max(deckInputMaxFileCharacters)
  })
  .strict();

export const deckOutlineFileSummarySchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(0).max(deckInputMaxFileSize),
    characterCount: z.number().int().min(0).max(deckInputMaxFileCharacters),
    summary: z.string().max(500).optional().default(""),
    snippets: z
      .array(z.string().min(1).max(1200))
      .max(4)
      .optional()
      .default([])
  })
  .strict();

export const deckOutlineIntentInputSchema = z
  .object({
    idea: z.string().trim().min(10).max(12000),
    sourceText: z.string().trim().max(12000).optional().default(""),
    textFiles: z
      .array(deckTextFileInputSchema)
      .max(deckInputMaxFileCount)
      .optional()
      .default([]),
    parsedFiles: z
      .array(parsedDeckInputFileSchema)
      .max(deckInputMaxFileCount)
      .optional(),
    sources: z.array(deckInputSourceSchema).max(1000).optional(),
    pageCount: z.coerce
      .number()
      .int()
      .min(deckPageCountMin)
      .max(deckPageCountMax)
      .optional(),
    deckType: z.enum(deckTypeIds).default("business-report"),
    palette: z.enum(paletteIds),
    locale: z.enum(["zh-CN", "en-US"])
  })
  .strip();

export const confirmedDeckIntentSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    audience: z.string().trim().min(2).max(120),
    goal: z.string().trim().min(2).max(160),
    coreMessage: z.string().trim().min(2).max(300),
    recommendedPageCount: z.number().int().min(deckPageCountMin).max(deckPageCountMax)
  })
  .strip();

export const analyzeDeckRequestSchema = z
  .object({
    sourceText: z.string().trim().min(10).max(12000),
    audience: z.string().trim().min(2).max(120),
    goal: z.string().trim().min(2).max(160),
    coreMessage: z
      .string()
      .trim()
      .min(2)
      .max(300)
      .default("围绕输入内容提炼核心信息"),
    pageCount: z.coerce.number().int().min(deckPageCountMin).max(deckPageCountMax),
    deckType: z.enum(deckTypeIds).default("business-report"),
    palette: z.enum(paletteIds),
    locale: z.enum(["zh-CN", "en-US"]),
    parsedFiles: z
      .array(parsedDeckInputFileSchema)
      .max(deckInputMaxFileCount)
      .optional(),
    sources: z.array(deckInputSourceSchema).max(1000).optional()
  })
  .strip();

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/, "HEX color must be uppercase #RRGGBB");

const paletteColorSchema = z
  .object({
    hex: hexColorSchema,
    name: z.string().min(1).max(40),
    usage: z.string().min(4).max(160)
  })
  .strict();

const typographyTextLimitsSchema = z
  .object({
    bodyBulletMaxChineseChars: z.literal(24),
    bodyModuleBulletCount: z.string().min(4).max(120),
    coverTitleMaxLines: z.literal(2),
    iconLabelMaxChineseChars: z.literal(10),
    noteMaxChineseChars: z.literal(32),
    pageTitleMaxLines: z.literal(2),
    sectionTitleMaxLines: z.string().min(4).max(80),
    textBoxRule: z.string().min(4).max(180)
  })
  .strict();

const transparencyRuleSchema = z
  .object({
    baseHex: hexColorSchema,
    opacity: z.number().min(0.04).max(0.95),
    usage: z.string().min(4).max(160)
  })
  .strict();

const componentRulesSchema = z
  .object({
    card: z.string().min(6).max(320),
    chart: z.string().min(6).max(360),
    icon: z.string().min(6).max(260),
    metric: z.string().min(6).max(260),
    table: z.string().min(6).max(320),
    tag: z.string().min(6).max(260)
  })
  .strict();

export const unifiedVisualSpecSchema = z
  .object({
    componentRules: componentRulesSchema,
    themeName: z.string().min(2).max(80),
    designIntent: z.string().min(6).max(240),
    usageConvenience: z.string().min(4).max(180),
    visualStyle: z.string().min(6).max(240),
    colorPalette: z
      .object({
        accent: z.array(paletteColorSchema).min(1).max(2),
        chart: z.array(paletteColorSchema).min(4).max(8),
        neutral: z.array(paletteColorSchema).min(2).max(4),
        primary: z.array(paletteColorSchema).length(1),
        secondary: z.array(paletteColorSchema).min(2).max(3)
      })
      .strict(),
    typography: z.string().min(6).max(160),
    imageStyle: z.string().min(6).max(240),
    consistencyRules: z.array(z.string().min(4).max(180)).min(2).max(8),
    forbiddenRules: z.array(z.string().min(4).max(160)).min(1).max(6),
    pageSpec: z
      .object({
        aspectRatio: z.literal(canvasAspectRatio),
        canvasPixels: z
          .object({
            height: z.literal(slideCanvasPixelHeight),
            width: z.literal(slideCanvasPixelWidth)
          })
          .strict(),
        gridColumns: z.literal(12),
        gridGutterPx: z.literal(slideCanvasGridGutterPx),
        height: z.literal(slideCanvasHeight),
        layoutInstruction: z.string().min(8).max(240),
        safeMargin: z.literal(slideCanvasSafeMargin),
        safeMarginPxRange: z
          .object({
            horizontal: z.string().min(4).max(40),
            vertical: z.string().min(4).max(40)
          })
          .strict(),
        unit: z.literal(slideCanvasUnit),
        width: z.literal(slideCanvasWidth)
      })
      .strict(),
    typographyRules: z
      .object({
        defaultFontSize: z.number().min(8).max(40),
        fontFallback: z.array(z.string().min(1).max(80)).min(2).max(6),
        lineHeight: z.number().min(1).max(1.8),
        maxLines: z.number().int().min(1).max(9),
        minFontSize: z.number().min(8).max(18),
        scale: z
          .object({
            coverTitle: typographyRuleScaleItemSchema(),
            coverSubtitle: typographyRuleScaleItemSchema(),
            pageTitle: typographyRuleScaleItemSchema(),
            sectionTitle: typographyRuleScaleItemSchema(),
            body: typographyRuleScaleItemSchema(),
            annotation: typographyRuleScaleItemSchema(),
            chartLabel: typographyRuleScaleItemSchema(),
            iconLabel: typographyRuleScaleItemSchema()
          })
          .strict(),
        textLimits: typographyTextLimitsSchema
      })
      .strict(),
    colorRoles: z
      .object({
        accent: z.string().min(3).max(180),
        background: z.string().min(3).max(180),
        bodyText: z.string().min(3).max(180),
        borderDivider: z.string().min(3).max(180),
        chart: z.string().min(3).max(180),
        contrastRequirement: z.string().min(6).max(180),
        decorative: z.string().min(3).max(180),
        highlight: z.string().min(3).max(180),
        surface: z.string().min(3).max(180),
        titleText: z.string().min(3).max(180)
      })
      .strict(),
    transparencyRules: z.array(transparencyRuleSchema).min(2).max(8),
    imageRules: z
      .object({
        aspectRatio: z.enum(["16:9", "4:3", "1:1", "3:4", "9:16"]),
        backgroundAvoidsHighContrastTextArea: z.boolean(),
        forbiddenItems: z.array(z.string().min(2).max(120)).min(2).max(8),
        imagePromptStyle: z.string().min(12).max(500),
        imageType: z.enum([
          "photo",
          "illustration",
          "icon",
          "diagram",
          "texture",
          "background",
          "cutout"
        ]),
        subjectAvoidsTitleArea: z.boolean(),
        usageNotes: z.array(z.string().min(4).max(180)).min(2).max(6)
      })
      .strict(),
    pptTypeVisualTone: z
      .object({
        deckType: z.enum(deckTypeIds),
        deckTypeName: z.string().min(2).max(80),
        recommendedTone: z.string().min(2).max(120),
        visualKeywords: z.array(z.string().min(1).max(60)).min(2).max(8)
      })
      .strict(),
    informationDensityRules: z
      .object({
        defaultLevel: z.enum(["low", "medium", "high"]),
        businessReport: z.string().min(6).max(220),
        trainingCourse: z.string().min(6).max(220),
        brandMarketing: z.string().min(6).max(220),
        researchReport: z.string().min(6).max(220)
      })
      .strict(),
    layoutRules: z
      .object({
        pageMargin: z.string().min(4).max(180),
        sectionGap: z.string().min(4).max(180),
        elementGap: z.string().min(4).max(180),
        whitespace: z.string().min(4).max(220)
      })
      .strict(),
    chartVisualRules: z
      .object({
        chartTypes: z.string().min(4).max(220),
        axisAndGrid: z.string().min(4).max(220),
        labelRules: z.string().min(4).max(220),
        colorUsage: z.string().min(4).max(220),
        sourceNotes: z.string().min(4).max(220)
      })
      .strict(),
    imageIllustrationRules: z
      .object({
        style: z.string().min(4).max(220),
        composition: z.string().min(4).max(220),
        background: z.string().min(4).max(220),
        consistency: z.string().min(4).max(220)
      })
      .strict(),
    iconStyleRules: z
      .object({
        style: z.enum(["line", "filled", "duotone", "monochrome"]),
        stroke: z.string().min(2).max(160),
        usage: z.string().min(4).max(220),
        consistency: z.string().min(4).max(220)
      })
      .strict(),
    emphasisRules: z
      .object({
        highlight: z.string().min(4).max(220),
        keyNumbers: z.string().min(4).max(220),
        keywords: z.string().min(4).max(220),
        conclusion: z.string().min(4).max(220)
      })
      .strict(),
    forbiddenVisualRules: z.array(z.string().min(4).max(180)).min(3).max(10)
  })
  .strict()
  .superRefine((spec, ctx) => {
    const paletteColors = new Set(
      Object.values(spec.colorPalette)
        .flat()
        .map((color) => color.hex)
    );
    const allowedColors = new Set([...paletteColors, "#000000", "#FFFFFF"]);
    const roleValues = Object.entries(spec.colorRoles);
    const hexPattern = /#[0-9A-Fa-f]{6}\b/g;

    for (const [role, value] of roleValues) {
      for (const rawColor of value.match(hexPattern) ?? []) {
        const color = rawColor.toUpperCase();

        if (!allowedColors.has(color)) {
          ctx.addIssue({
            code: "custom",
            message: "color role references a color outside the palette",
            path: ["colorRoles", role]
          });
        }
      }
    }

    for (const [index, rule] of spec.transparencyRules.entries()) {
      if (!paletteColors.has(rule.baseHex)) {
        ctx.addIssue({
          code: "custom",
          message: "transparency baseHex must come from colorPalette",
          path: ["transparencyRules", index, "baseHex"]
        });
      }
    }
  });

function typographyRuleScaleItemSchema() {
  return z
    .object({
      fontSize: z.number().min(6).max(72),
      fontWeight: z.enum(["regular", "medium", "semibold", "bold"]),
      lineHeight: z.number().min(1).max(1.8),
      usage: z.string().min(4).max(180)
    })
    .strict();
}

export const slideNarrativeRoleSchema = z.enum([
  "setup",
  "argument",
  "turning-point",
  "climax",
  "summary",
  "call-to-action"
]);

export const slideExplanationDepthSchema = z.enum([
  "focus",
  "transition",
  "summary",
  "supporting"
]);

export const slideSourceRequirementCategorySchema = z.enum([
  "data",
  "case",
  "quote",
  "course-material",
  "user-input",
  "none"
]);

export const slideAudienceFocusLensSchema = z.enum([
  "business-conclusion",
  "teaching-understanding",
  "sales-value",
  "research-evidence",
  "general"
]);

export const slideViewerObjectiveTypeSchema = z.enum([
  "understand",
  "believe",
  "remember",
  "act"
]);

export const slidePageRoleSchema = z.enum([
  "cover",
  "agenda",
  "section",
  "content",
  "data",
  "comparison",
  "process",
  "summary"
]);

export const legacySlideContentBlockTypeSchema = z.enum([
  "title",
  "body",
  "metric",
  "chart",
  "quote",
  "tag",
  "step",
  "comparison",
  "conclusion",
  "note"
]);

export const slideContentBlockTypeSchema = z.enum(semanticContentBlockTypeIds);

const legacyToSemanticContentBlockTypeMap: Record<
  z.infer<typeof legacySlideContentBlockTypeSchema>,
  z.infer<typeof slideContentBlockTypeSchema>
> = {
  body: "text",
  chart: "chart",
  comparison: "comparison",
  conclusion: "conclusion",
  metric: "metric",
  note: "source",
  quote: "quote",
  step: "steps",
  tag: "callout",
  title: "heading"
};

const semanticToLegacyContentBlockTypeMap: Record<
  z.infer<typeof slideContentBlockTypeSchema>,
  z.infer<typeof legacySlideContentBlockTypeSchema>
> = {
  callout: "tag",
  chart: "chart",
  comparison: "comparison",
  conclusion: "conclusion",
  heading: "title",
  image: "note",
  list: "body",
  metric: "metric",
  quote: "quote",
  source: "note",
  steps: "step",
  summary: "conclusion",
  table: "chart",
  text: "body",
  timeline: "step"
};

const slideContentBlockSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const rawType = record.type ?? record.blockType;
  const semanticType = slideContentBlockTypeSchema.safeParse(rawType).success
    ? rawType
    : legacySlideContentBlockTypeSchema.safeParse(rawType).success
      ? legacyToSemanticContentBlockTypeMap[
          rawType as z.infer<typeof legacySlideContentBlockTypeSchema>
        ]
      : undefined;
  const content = record.content ?? record.text;
  const legacyType =
    semanticType && slideContentBlockTypeSchema.safeParse(semanticType).success
      ? semanticToLegacyContentBlockTypeMap[
          semanticType as z.infer<typeof slideContentBlockTypeSchema>
        ]
      : record.blockType;

  return {
    ...record,
    blockType: legacyType,
    content,
    sourceIds: Array.isArray(record.sourceIds) ? record.sourceIds : [],
    text: content,
    type: semanticType ?? rawType
  };
}, z
  .object({
    blockType: legacySlideContentBlockTypeSchema,
    content: z.string().min(2).max(500).optional(),
    priority: z.number().int().min(1).max(5),
    sourceIds: z.array(z.string().min(6).max(80)).max(24).optional(),
    text: z.string().min(2).max(500),
    type: slideContentBlockTypeSchema.optional()
  })
  .strict());

export const slideContentBlocksSchema = z
  .array(slideContentBlockSchema)
  .min(3)
  .max(slideContentBlockMaxCount);

export const slideContentLayerIndexSchema = z.number().int().min(0).max(slideContentBlockMaxCount - 1);

export const slideContentLayersSchema = z
  .object({
    primary: z.array(slideContentLayerIndexSchema).min(1).max(4),
    supporting: z.array(slideContentLayerIndexSchema).min(1).max(6),
    supplementary: z.array(slideContentLayerIndexSchema).max(5)
  })
  .strict()
  .superRefine((layers, ctx) => {
    const seen = new Map<number, string>();

    for (const group of ["primary", "supporting", "supplementary"] as const) {
      layers[group].forEach((index, itemIndex) => {
        const existing = seen.get(index);

        if (existing) {
          ctx.addIssue({
            code: "custom",
            message: "contentLayers indexes must be unique across layers",
            path: [group, itemIndex]
          });
          return;
        }

        seen.set(index, group);
      });
    }
  });

const slideContentBaseSchema = z
  .object({
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(deckPageCountMax),
    title: z.string().min(2).max(80),
    pageType: slidePageRoleSchema.optional(),
    subtitle: z.string().max(120).optional(),
    bodyPoints: z.array(z.string().min(2).max(120)).min(2).max(5),
    contentBlocks: slideContentBlocksSchema
      .optional()
      .default([
        {
          blockType: "title",
          content: "页面标题",
          priority: 1,
          sourceIds: [],
          text: "页面标题",
          type: "heading"
        },
        {
          blockType: "conclusion",
          content: "页面核心结论",
          priority: 1,
          sourceIds: [],
          text: "页面核心结论",
          type: "conclusion"
        },
        {
          blockType: "body",
          content: "页面正文要点",
          priority: 2,
          sourceIds: [],
          text: "页面正文要点",
          type: "text"
        }
      ]),
    speakerGoal: z.string().min(6).max(180),
    visualIntent: z.string().min(6).max(220),
    coreStatement: z.string().min(4).max(220),
    narrativeRole: slideNarrativeRoleSchema,
    contentLayers: slideContentLayersSchema,
    slideTransition: z
      .object({
        fromPrevious: z.string().min(4).max(220),
        toNext: z.string().min(4).max(220)
      })
      .strict(),
    explanationDepth: slideExplanationDepthSchema,
    sourceRequirement: z
      .object({
        required: z.boolean(),
        categories: z
          .array(slideSourceRequirementCategorySchema)
          .min(1)
          .max(5),
        note: z.string().min(4).max(220)
      })
      .strict(),
    adaptationRules: z
      .object({
        splitWhen: z.string().min(4).max(220),
        splitCandidates: z.array(z.string().min(2).max(120)).min(1).max(5),
        mergeWhen: z.string().min(4).max(220),
        mergeWith: z.string().min(2).max(120)
      })
      .strict(),
    audienceFocus: z
      .object({
        lens: slideAudienceFocusLensSchema,
        focus: z.string().min(4).max(220)
      })
      .strict(),
    viewerObjective: z
      .object({
        type: slideViewerObjectiveTypeSchema,
        description: z.string().min(4).max(220)
      })
      .strict(),
    contentBoundary: z
      .object({
        inScope: z.string().min(4).max(220),
        outOfScope: z.array(z.string().min(2).max(160)).min(1).max(6)
      })
      .strict()
  })
  .strict();

export const slideContentSchema = slideContentBaseSchema.superRefine((slide, ctx) => {
    const assigned = new Set<number>();

    for (const group of ["primary", "supporting", "supplementary"] as const) {
      slide.contentLayers[group].forEach((blockIndex, layerIndex) => {
        if (blockIndex >= slide.contentBlocks.length) {
          ctx.addIssue({
            code: "custom",
            message: "contentLayers index must reference contentBlocks",
            path: ["contentLayers", group, layerIndex]
          });
          return;
        }

        assigned.add(blockIndex);
      });
    }

    slide.contentBlocks.forEach((_, blockIndex) => {
      if (!assigned.has(blockIndex)) {
        ctx.addIssue({
          code: "custom",
          message: "every contentBlock must be assigned to contentLayers",
          path: ["contentBlocks", blockIndex]
        });
      }
    });
});

const inchBoundsSchema = z
  .object({
    x: z.number().min(0).max(slideCanvasWidth),
    y: z.number().min(0).max(slideCanvasHeight),
    width: z.number().min(0.05).max(slideCanvasWidth),
    height: z.number().min(0.05).max(slideCanvasHeight)
  })
  .strict()
  .superRefine((bounds, ctx) => {
    if (bounds.x + bounds.width > slideCanvasWidth) {
      ctx.addIssue({
        code: "custom",
        message: `bounds.x + bounds.width must be <= ${slideCanvasWidth}`,
        path: ["width"]
      });
    }

    if (bounds.y + bounds.height > slideCanvasHeight) {
      ctx.addIssue({
        code: "custom",
        message: `bounds.y + bounds.height must be <= ${slideCanvasHeight}`,
        path: ["height"]
      });
    }
  });

export const slideCanvasSchema = z
  .object({
    aspectRatio: z.literal(canvasAspectRatio),
    height: z.literal(slideCanvasHeight),
    safeMargin: z.literal(slideCanvasSafeMargin),
    unit: z.literal(slideCanvasUnit),
    width: z.literal(slideCanvasWidth)
  })
  .strict();

export const slideElementTypeSchema = z.enum([
  "text",
  "generatedImage",
  "shape",
  "icon",
  "chartPlaceholder"
]);

export const slideElementSemanticTypeSchema = z.enum([
  "title",
  "subtitle",
  "body",
  "heroVisual",
  "supportingVisual",
  "accentShape",
  "icon",
  "chart",
  "card",
  "badge",
  "background",
  "footer"
]);

export const slidePrimaryGoalSchema = z.enum([
  "inform",
  "explain",
  "persuade",
  "compare",
  "summarize",
  "spark-interest"
]);

export const slideContentDensitySchema = z.enum(["low", "medium", "high"]);

export const slidePageIntentSchema = z
  .object({
    audienceTakeaway: z.string().min(4).max(220),
    contentDensity: slideContentDensitySchema,
    coreMessage: z.string().min(2).max(180),
    pageRole: slidePageRoleSchema,
    primaryGoal: slidePrimaryGoalSchema
  })
  .strict();

export const slideLayoutTypeIds = [
  "chapter",
  "cover-title",
  "title-body-points",
  "big-image-background",
  "left-image-right-text",
  "left-text-right-image",
  "left-text-right-chart",
  "big-chart",
  "two-column-compare",
  "quote",
  "time-axis",
  "process-steps",
  "key-metrics",
  "quadrant-matrix",
  "ending"
] as const;

export const slideLayoutTypeSchema = z.enum(slideLayoutTypeIds);

export const lightweightNarrativeStyleIds = [
  "problem-solution",
  "insight-evidence",
  "teaching-progressive",
  "proposal-persuasive",
  "review-summary",
  "portfolio-showcase"
] as const;

export const lightweightNarrativeStyleSchema = z.enum(
  lightweightNarrativeStyleIds
);

export const slideLayoutSelectionSchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            fitReason: z.string().min(4).max(220),
            layoutType: slideLayoutTypeSchema,
            risk: z.string().min(2).max(180),
            score: z.number().int().min(0).max(100)
          })
          .strict()
      )
      .min(2)
      .max(3),
    selectedLayoutType: slideLayoutTypeSchema,
    selectionReason: z.string().min(4).max(240)
  })
  .strict()
  .superRefine((selection, ctx) => {
    if (
      !selection.candidates.some(
        (candidate) => candidate.layoutType === selection.selectedLayoutType
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "selectedLayoutType must be included in layout candidates",
        path: ["selectedLayoutType"]
      });
    }
  });

export const slideDesignConstraintsSchema = z
  .object({
    coreMessagePresent: z.boolean(),
    densityLimit: slideContentDensitySchema,
    maxHeroVisuals: z.literal(1),
    renderNotes: z.array(z.string().min(2).max(180)).min(1).max(8),
    safeMargin: z
      .object({
        appliesTo: z.array(z.string().min(2).max(80)).min(1).max(6),
        unit: z.literal(slideCanvasUnit),
        value: z.literal(slideCanvasSafeMargin)
      })
      .strict(),
    subjectAvoidsTitleArea: z.boolean(),
    titleUnique: z.boolean()
  })
  .strict();

const designQualityDimensionSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    summary: z.string().min(2).max(180)
  })
  .strict();

export const slideDesignQualityScoreSchema = z
  .object({
    dimensions: z
      .object({
        contentDensity: designQualityDimensionSchema,
        expressionCompleteness: designQualityDimensionSchema,
        informationHierarchy: designQualityDimensionSchema,
        renderability: designQualityDimensionSchema,
        visualConsistency: designQualityDimensionSchema
      })
      .strict(),
    issues: z.array(z.string().min(2).max(180)).max(10),
    repairStatus: z.enum(["not-needed", "repaired", "failed", "still-low"]),
    suggestions: z.array(z.string().min(2).max(180)).max(10),
    totalScore: z.number().int().min(0).max(100)
  })
  .strict();

export const slideElementTextStyleSchema = z
  .object({
    align: z.enum(["left", "center", "right"]).default("left"),
    color: z.string().min(3).max(40).optional(),
    fontSize: z.number().min(8).max(40).default(14),
    fontWeight: z.enum(["regular", "medium", "semibold", "bold"]).default("regular"),
    lineHeight: z.number().min(1).max(1.8).default(1.25),
    maxLines: z.number().int().min(1).max(9).optional()
  })
  .strict();

export const slideElementAssetBindingSchema = z
  .object({
    assetId: z.string().min(3).max(100),
    kind: z.enum([
      "ICON",
      "SHAPE",
      "LINE",
      "TEXT_STYLE",
      "CONTAINER",
      "NAVIGATION"
    ]),
    matchScore: z.number().min(0).max(200).optional(),
    name: z.string().min(1).max(120),
    semanticKey: z.string().min(1).max(100).optional(),
    setKey: z.string().min(1).max(80),
    setKind: z.enum(["COMMON", "TEMPLATE"]),
    usageSuggestion: z.string().min(2).max(180).optional(),
    variantKey: z.string().min(1).max(100).optional()
  })
  .strict();

export const slideElementAssetStyleSchema = z
  .object({
    activeColor: z.string().min(3).max(40).optional(),
    containerRole: z.string().min(1).max(100).optional(),
    cornerRadius: z.number().min(0).max(80).optional(),
    dash: z.enum(["solid", "dashed", "dotted"]).optional(),
    displayMode: z.string().min(1).max(80).optional(),
    endArrowType: z.string().min(1).max(80).optional(),
    fillColor: z.string().min(3).max(40).optional(),
    iconName: z.string().min(1).max(100).optional(),
    inactiveColor: z.string().min(3).max(40).optional(),
    lineHeight: z.number().min(1).max(1.8).optional(),
    lineType: z.string().min(1).max(80).optional(),
    navigationRole: z.string().min(1).max(100).optional(),
    opacity: z.number().min(0).max(1).optional(),
    shapeType: z.string().min(1).max(80).optional(),
    startArrowType: z.string().min(1).max(80).optional(),
    strokeColor: z.string().min(3).max(40).optional(),
    strokeWidth: z.number().min(0).max(12).optional(),
    textRole: z.string().min(1).max(100).optional()
  })
  .strict();

export const slideElementSchema = z
  .object({
    id: z.string().min(3).max(60),
    type: slideElementTypeSchema,
    role: z.string().min(2).max(80),
    content: z.string().max(500).optional(),
    bounds: inchBoundsSchema,
    editable: z.boolean().default(true),
    hierarchyLevel: z.number().int().min(1).max(5).default(3),
    semanticType: slideElementSemanticTypeSchema.default("body"),
    zIndex: z.number().int().min(0).max(100),
    styleNotes: z.string().min(2).max(220),
    requiresImageGeneration: z.boolean(),
    textStyle: slideElementTextStyleSchema.optional(),
    imageRequestId: z.string().min(3).max(80).optional(),
    contentBlockIndex: z
      .number()
      .int()
      .min(0)
      .max(slideContentBlockMaxCount - 1)
      .optional(),
    assetBinding: slideElementAssetBindingSchema.optional(),
    assetStyle: slideElementAssetStyleSchema.optional()
  })
  .strict()
  .superRefine((element, ctx) => {
    if (element.type === "generatedImage" && !element.imageRequestId) {
      ctx.addIssue({
        code: "custom",
        message: "generatedImage elements must reference imageRequestId",
        path: ["imageRequestId"]
      });
    }

    if (element.type === "text" && !element.content) {
      ctx.addIssue({
        code: "custom",
        message: "text elements must include content",
        path: ["content"]
      });
    }
  });

export const imageLayerRequestSchema = z
  .object({
    id: z.string().min(3).max(80),
    elementId: z.string().min(3).max(60),
    purpose: z.string().min(4).max(120),
    imageType: z
      .enum(["photo", "illustration", "icon", "diagram", "texture", "background", "cutout"])
      .default("illustration"),
    keywords: z.array(z.string().min(1).max(40)).max(12).default([]),
    prompt: z.string().min(12).max(900),
    negativePrompt: z.string().min(4).max(400).default("不要文字、不要水印、不要复杂背景、不要低清晰度"),
    avoid: z.string().min(4).max(400).default("不要文字、不要水印、不要复杂背景、不要低清晰度"),
    transparentBackground: z.boolean(),
    aspectRatio: z.enum(["16:9", "4:3", "1:1", "3:4", "9:16"]),
    visualNotes: z.string().min(4).max(240)
  })
  .strict();

export const generatedImageLayerSchema = z
  .object({
    id: z.string().min(3).max(100),
    requestId: z.string().min(3).max(80),
    elementId: z.string().min(3).max(60),
    assetId: z.string().min(3).max(120),
    provider: z.string().min(2).max(80),
    mimeType: z.string().min(4).max(120),
    url: z.string().min(1).max(2048),
    prompt: z.string().min(12).max(900),
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
    transparentBackground: z.boolean(),
    visualNotes: z.string().min(4).max(240),
    qualityReview: z
      .object({
        method: z.enum(["rules", "llm", "rules-only-fallback"]),
        passed: z.boolean(),
        score: z.number().int().min(0).max(100),
        summary: z.string().min(2).max(240),
        warnings: z.array(z.string().min(1).max(160)).max(8)
      })
      .strict()
      .optional()
  })
  .strict();

export const slideContentHierarchySchema = z
  .object({
    primaryMessage: z.string().min(2).max(180),
    levels: z
      .array(
        z
          .object({
            label: z.string().min(1).max(80),
            level: z.number().int().min(1).max(5),
            summary: z.string().min(2).max(180)
          })
          .strict()
      )
      .min(1)
      .max(8),
    tiers: z
      .array(
        z
          .object({
            items: z
              .array(
                z
                  .object({
                    content: z.string().min(1).max(220),
                    role: z.string().min(1).max(80)
                  })
                  .strict()
              )
              .min(1)
              .max(8),
            label: z.string().min(1).max(80),
            level: z.number().int().min(1).max(3)
          })
          .strict()
      )
      .length(3)
  })
  .strict()
  .superRefine((hierarchy, ctx) => {
    const levels = hierarchy.tiers.map((tier) => tier.level);

    for (const expected of [1, 2, 3]) {
      if (!levels.includes(expected)) {
        ctx.addIssue({
          code: "custom",
          message: `contentHierarchy.tiers must include level ${expected}`,
          path: ["tiers"]
        });
      }
    }
  });

export const semanticElementCategorySchema = z.enum([
  "text",
  "visual",
  "infographic",
  "navigation",
  "container"
]);

export const semanticSlideElementSchema = z
  .object({
    category: semanticElementCategorySchema,
    constraints: z.array(z.string().min(2).max(160)).max(6).default([]),
    content: z.string().max(500).optional(),
    contentBlockIndex: z
      .number()
      .int()
      .min(0)
      .max(slideContentBlockMaxCount - 1)
      .optional(),
    elementType: slideElementTypeSchema,
    hierarchyLevel: z.number().int().min(1).max(3),
    id: z.string().min(3).max(80),
    priority: z.number().int().min(1).max(5),
    role: z.string().min(2).max(100),
    semanticType: slideElementSemanticTypeSchema,
    styleRole: z.string().min(1).max(100).optional()
  })
  .strict();

export const slidePageDesignSchema = z
  .object({
    expressionIntent: z.string().min(4).max(240),
    layoutTemplate: z.string().min(2).max(120),
    visualStrategy: z.string().min(4).max(240),
    readingOrder: z.array(z.string().min(1).max(80)).min(1).max(24)
  })
  .strict();

export const slideLayoutDiagnosticsSchema = z
  .object({
    density: z.number().min(0).max(1),
    hasOverflow: z.boolean(),
    needsUserConfirmation: z.boolean(),
    overflowFixes: z
      .array(
        z.enum([
          "reduce-font-size",
          "compress-copy",
          "adjust-layout",
          "suggest-split",
          "needs-user-confirmation"
        ])
      )
      .max(8),
    splitSuggestion: z.string().max(240).optional(),
    warnings: z.array(z.string().min(1).max(180)).max(8)
  })
  .strict();

export const motionPresetSchema = z.enum(["fade", "rise", "focus", "none"]);

export const slideMotionPlanSchema = z
  .object({
    preset: motionPresetSchema,
    durationMs: z.number().int().min(0).max(5000),
    delayMs: z.number().int().min(0).max(5000),
    staggerMs: z.number().int().min(0).max(1000),
    elements: z
      .array(
        z
          .object({
            elementId: z.string().min(3).max(60),
            preset: motionPresetSchema,
            delayMs: z.number().int().min(0).max(5000),
            durationMs: z.number().int().min(0).max(5000)
          })
          .strict()
      )
      .max(slideElementMaxCount)
  })
  .strict();

export const contentReviewSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    riskLevel: z.enum(["low", "medium", "high"]),
    summary: z.string().min(4).max(240),
    warnings: z.array(z.string().min(2).max(160)).max(8),
    suggestions: z.array(z.string().min(2).max(160)).max(8)
  })
  .strict();

export const consistencyReportSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    summary: z.string().min(4).max(240),
    checks: z
      .array(
        z
          .object({
            name: z.string().min(2).max(80),
            score: z.number().int().min(0).max(100),
            message: z.string().min(4).max(180)
          })
          .strict()
      )
      .min(2)
      .max(8),
    suggestions: z.array(z.string().min(2).max(160)).max(8)
  })
  .strict();

export const deckAnalysisResultSchema = z
  .object({
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(slideContentSchema).min(deckPageCountMin).max(deckPageCountMax)
  })
  .strict();

export const deckStructureSlideSchema = z
  .object({
    chapterId: z.string().min(3).max(60).optional(),
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(deckPageCountMax),
    layoutType: slideLayoutTypeSchema.optional(),
    narrativeRole: slideNarrativeRoleSchema.optional(),
    pageNumber: z.number().int().min(1).max(deckPageCountMax).optional(),
    pageType: slidePageRoleSchema.optional(),
    title: z.string().min(2).max(80),
    purpose: z.string().min(6).max(180),
    keyMessage: z.string().min(4).max(180),
    sourceIds: z.array(z.string().min(6).max(80)).max(24).optional(),
    visualDirection: z.string().min(6).max(220)
  })
  .strict();

export const deckStructureOutlineSchema = z
  .object({
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    slides: z.array(deckStructureSlideSchema).min(deckPageCountMin).max(deckPageCountMax)
  })
  .strict();

export const deckStructureOutlineResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    slides: z.array(deckStructureSlideSchema).min(deckPageCountMin).max(deckPageCountMax)
  })
  .strip();

const lightweightOutlineForbiddenFields = new Set([
  "bodyPoints",
  "bounds",
  "chartData",
  "chartSeries",
  "children",
  "contentBlocks",
  "dataPoints",
  "elementHierarchy",
  "elements",
  "height",
  "hierarchyLevel",
  "imageKeywords",
  "imageLayerRequests",
  "imagePrompt",
  "keywords",
  "layers",
  "level",
  "prompt",
  "style",
  "textStyle",
  "visualDirection",
  "visualIntent",
  "visualStyle",
  "width",
  "x",
  "y",
  "zIndex"
]);

function collectForbiddenLightweightOutlineFields(
  value: unknown,
  path: Array<string | number> = [],
  issues: Array<{ path: Array<string | number>; key: string }> = []
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectForbiddenLightweightOutlineFields(item, [...path, index], issues)
    );

    return issues;
  }

  if (typeof value !== "object" || value === null) {
    return issues;
  }

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (lightweightOutlineForbiddenFields.has(key)) {
      issues.push({
        key,
        path: [...path, key]
      });
    }

    collectForbiddenLightweightOutlineFields(item, [...path, key], issues);
  }

  return issues;
}

function inferLegacyLightweightNarrativeStyle(deckType: unknown) {
  if (
    deckType === "training-course" ||
    deckType === "teaching-deck" ||
    deckType === "knowledge-sharing"
  ) {
    return "teaching-progressive";
  }

  if (
    deckType === "research-report" ||
    deckType === "data-analysis" ||
    deckType === "industry-insight"
  ) {
    return "insight-evidence";
  }

  if (
    deckType === "sales-proposal" ||
    deckType === "proposal" ||
    deckType === "fundraising-pitch"
  ) {
    return "proposal-persuasive";
  }

  if (deckType === "portfolio") {
    return "portfolio-showcase";
  }

  if (deckType === "personal-review" || deckType === "retrospective-summary") {
    return "review-summary";
  }

  return "problem-solution";
}

function normalizeLegacyLightweightOutline(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  if ("pages" in record || !("slides" in record)) {
    return value;
  }

  const slides = Array.isArray(record.slides) ? record.slides : [];
  const pageCount = slides.length;
  const isChinese = String(record.deckTitle ?? "").match(/[\u4e00-\u9fa5]/);

  return {
    deckTitle: record.deckTitle,
    deckType: record.deckType,
    narrativeStyle: inferLegacyLightweightNarrativeStyle(record.deckType),
    pageCount,
    globalTheme: {
      theme: record.deckTitle ?? (isChinese ? "结构大纲" : "Structure outline"),
      objective:
        record.deckSummary ??
        (isChinese
          ? "围绕输入内容形成清晰的演示结构。"
          : "Create a clear presentation structure from the input.")
    },
    chapters: [
      {
        chapterId: "chapter-1",
        pageRange: {
          end: pageCount,
          start: 1
        },
        purpose:
          record.deckSummary ??
          (isChinese
            ? "组织整套演示的核心结构。"
            : "Organize the core structure of the deck."),
        title: record.deckTitle ?? (isChinese ? "整体结构" : "Overall Structure")
      }
    ],
    pages: slides.map((slide, index) => {
      const slideRecord =
        typeof slide === "object" && slide !== null && !Array.isArray(slide)
          ? (slide as Record<string, unknown>)
          : {};
      const pageNumber =
        typeof slideRecord.index === "number" ? slideRecord.index : index + 1;
      const pageType =
        slidePageRoleSchema.safeParse(slideRecord.pageType).success
          ? slideRecord.pageType
          : pageNumber === 1
            ? "cover"
            : pageNumber === pageCount
              ? "summary"
              : "content";

      return {
        chapterId: "chapter-1",
        keyMessage: slideRecord.keyMessage,
        layoutType:
          slideLayoutTypeSchema.safeParse(slideRecord.layoutType).success
            ? slideRecord.layoutType
            : pageNumber === 1
            ? "cover-title"
            : pageNumber === pageCount
              ? "ending"
              : "title-body-points",
        narrativeRole:
          pageNumber === 1
            ? "setup"
            : pageNumber === pageCount
              ? "call-to-action"
              : "argument",
        pageNumber,
        pageType,
        purpose: slideRecord.purpose,
        sourceIds: slideRecord.sourceIds,
        title: slideRecord.title
      };
    })
  };
}

const lightweightPageRangeSchema = z
  .object({
    end: z.number().int().min(1).max(deckPageCountMax),
    start: z.number().int().min(1).max(deckPageCountMax)
  })
  .strict()
  .refine((range) => range.end >= range.start, {
    message: "chapter pageRange.end must be greater than or equal to start",
    path: ["end"]
  });

export const lightweightOutlineChapterSchema = z
  .object({
    chapterId: z.string().min(3).max(60),
    pageRange: lightweightPageRangeSchema,
    purpose: z.string().min(6).max(180),
    title: z.string().min(2).max(80)
  })
  .strict();

export const lightweightOutlinePageSchema = z
  .object({
    chapterId: z.string().min(3).max(60),
    keyMessage: z.string().min(4).max(180),
    layoutType: slideLayoutTypeSchema,
    narrativeRole: slideNarrativeRoleSchema,
    pageNumber: z.number().int().min(1).max(deckPageCountMax),
    pageType: slidePageRoleSchema,
    purpose: z.string().min(6).max(180),
    sourceIds: z.array(z.string().min(6).max(80)).max(24).default([]),
    title: z.string().min(2).max(80)
  })
  .strict();

export const lightweightOutlineSchema = z.preprocess(
  normalizeLegacyLightweightOutline,
  z
    .object({
      chapters: z
        .array(lightweightOutlineChapterSchema)
        .min(1)
        .max(deckPageCountMax),
      deckTitle: z.string().min(2).max(100),
      deckType: z.enum(deckTypeIds),
      globalTheme: z
        .object({
          objective: z.string().min(6).max(220),
          theme: z.string().min(2).max(100)
        })
        .strict(),
      narrativeStyle: lightweightNarrativeStyleSchema,
      pageCount: z.number().int().min(deckPageCountMin).max(deckPageCountMax),
      pages: z
        .array(lightweightOutlinePageSchema)
        .min(deckPageCountMin)
        .max(deckPageCountMax)
    })
    .strict()
    .superRefine((outline, ctx) => {
      const forbiddenIssues = collectForbiddenLightweightOutlineFields(outline);

      for (const issue of forbiddenIssues) {
        ctx.addIssue({
          code: "custom",
          message: `lightweight outline must not include ${issue.key}`,
          path: issue.path
        });
      }

      if (outline.pages.length !== outline.pageCount) {
        ctx.addIssue({
          code: "custom",
          message: "pageCount must equal pages.length",
          path: ["pages"]
        });
      }

      const pageNumbers = new Set<number>();

      for (const page of outline.pages) {
        if (pageNumbers.has(page.pageNumber)) {
          ctx.addIssue({
            code: "custom",
            message: "pageNumber must not repeat",
            path: ["pages", outline.pages.indexOf(page), "pageNumber"]
          });
        }

        pageNumbers.add(page.pageNumber);
      }

      for (let pageNumber = 1; pageNumber <= outline.pageCount; pageNumber += 1) {
        if (!pageNumbers.has(pageNumber)) {
          ctx.addIssue({
            code: "custom",
            message: "pageNumber must be continuous from 1 to pageCount",
            path: ["pages"]
          });
          break;
        }
      }

      const chapterIds = new Set(outline.chapters.map((chapter) => chapter.chapterId));
      const coveredPages = new Set<number>();

      for (const [chapterIndex, chapter] of outline.chapters.entries()) {
        if (chapter.pageRange.end > outline.pageCount) {
          ctx.addIssue({
            code: "custom",
            message: "chapter pageRange must stay within pageCount",
            path: ["chapters", chapterIndex, "pageRange"]
          });
        }

        for (
          let pageNumber = chapter.pageRange.start;
          pageNumber <= chapter.pageRange.end;
          pageNumber += 1
        ) {
          if (coveredPages.has(pageNumber)) {
            ctx.addIssue({
              code: "custom",
              message: "chapter pageRange must not overlap",
              path: ["chapters", chapterIndex, "pageRange"]
            });
          }

          coveredPages.add(pageNumber);
        }
      }

      for (let pageNumber = 1; pageNumber <= outline.pageCount; pageNumber += 1) {
        if (!coveredPages.has(pageNumber)) {
          ctx.addIssue({
            code: "custom",
            message: "chapter pageRange must cover every page",
            path: ["chapters"]
          });
          break;
        }
      }

      for (const [pageIndex, page] of outline.pages.entries()) {
        if (!chapterIds.has(page.chapterId)) {
          ctx.addIssue({
            code: "custom",
            message: "page.chapterId must reference an existing chapter",
            path: ["pages", pageIndex, "chapterId"]
          });
        }

        const chapter = outline.chapters.find(
          (item) => item.chapterId === page.chapterId
        );

        if (
          chapter &&
          (page.pageNumber < chapter.pageRange.start ||
            page.pageNumber > chapter.pageRange.end)
        ) {
          ctx.addIssue({
            code: "custom",
            message: "pageNumber must be inside its chapter pageRange",
            path: ["pages", pageIndex, "chapterId"]
          });
        }
      }

      const firstPage = outline.pages.find((page) => page.pageNumber === 1);
      const lastPage = outline.pages.find(
        (page) => page.pageNumber === outline.pageCount
      );

      if (firstPage && firstPage.pageType !== "cover") {
        ctx.addIssue({
          code: "custom",
          message: "first page must use pageType cover",
          path: ["pages", 0, "pageType"]
        });
      }

      if (
        lastPage &&
        !["summary", "content"].includes(lastPage.pageType) &&
        lastPage.narrativeRole !== "call-to-action"
      ) {
        ctx.addIssue({
          code: "custom",
          message: "last page must close the narrative",
          path: ["pages", outline.pages.indexOf(lastPage), "pageType"]
        });
      }

      const roleOrder: Record<z.infer<typeof slideNarrativeRoleSchema>, number> = {
        argument: 1,
        "call-to-action": 5,
        climax: 3,
        setup: 0,
        summary: 4,
        "turning-point": 2
      };
      let previousRoleOrder = -1;

      for (const page of [...outline.pages].sort(
        (left, right) => left.pageNumber - right.pageNumber
      )) {
        const currentRoleOrder = roleOrder[page.narrativeRole];

        if (currentRoleOrder < previousRoleOrder) {
          ctx.addIssue({
            code: "custom",
            message: "narrativeRole order must not go backwards",
            path: ["pages", outline.pages.indexOf(page), "narrativeRole"]
          });
        }

        previousRoleOrder = Math.max(previousRoleOrder, currentRoleOrder);
      }
    })
);

function buildStructureOutlineFromLightweightOutline(
  outline: z.infer<typeof lightweightOutlineSchema>
) {
  return {
    deckSummary: outline.globalTheme.objective,
    deckTitle: outline.deckTitle,
    slides: [...outline.pages]
      .sort((left, right) => left.pageNumber - right.pageNumber)
      .map((page) => ({
        index: page.pageNumber,
        keyMessage: page.keyMessage,
        layoutType: page.layoutType,
        narrativeRole: page.narrativeRole,
        pageType: page.pageType,
        purpose: page.purpose,
        sourceIds: page.sourceIds,
        slideId: `slide-${page.pageNumber}`,
        title: page.title,
        visualDirection:
          page.pageType === "cover"
            ? "承接轻量大纲主题，后续统一视觉阶段再定义具体视觉表达。"
            : "承接轻量大纲结构，后续详细大纲阶段再定义视觉意图。"
      }))
  };
}

export const detailedSlideOutlineSchema = slideContentBaseSchema
  .pick({
    adaptationRules: true,
    audienceFocus: true,
    contentBoundary: true,
    coreStatement: true,
    explanationDepth: true,
    index: true,
    narrativeRole: true,
    pageType: true,
    slideId: true,
    slideTransition: true,
    sourceRequirement: true,
    speakerGoal: true,
    title: true,
    viewerObjective: true,
    visualIntent: true
  })
  .extend({
    pageType: slidePageRoleSchema
  })
  .strict();

export const slideDisplayContentSchema = z
  .object({
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(deckPageCountMax),
    title: z.string().min(2).max(80),
    subtitle: z.string().max(120).optional(),
    bodyPoints: z.array(z.string().min(2).max(120)).min(2).max(5),
    contentBlocks: slideContentBlocksSchema,
    contentLayers: slideContentLayersSchema
  })
  .strict()
  .superRefine((slide, ctx) => {
    const assigned = new Set<number>();

    for (const group of ["primary", "supporting", "supplementary"] as const) {
      slide.contentLayers[group].forEach((blockIndex, layerIndex) => {
        if (blockIndex >= slide.contentBlocks.length) {
          ctx.addIssue({
            code: "custom",
            message: "contentLayers index must reference contentBlocks",
            path: ["contentLayers", group, layerIndex]
          });
          return;
        }

        assigned.add(blockIndex);
      });
    }

    slide.contentBlocks.forEach((_, blockIndex) => {
      if (!assigned.has(blockIndex)) {
        ctx.addIssue({
          code: "custom",
          message: "every contentBlock must be assigned to contentLayers",
          path: ["contentBlocks", blockIndex]
        });
      }
    });
  });

function normalizeDeckIntentAnalysisResult(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const rawLightweightOutline =
    record.lightweightOutline ??
    (typeof record.structureOutline === "object" &&
    record.structureOutline !== null &&
    !Array.isArray(record.structureOutline)
      ? {
          ...(record.structureOutline as Record<string, unknown>),
          deckType: record.deckType
        }
      : record.structureOutline);
  const parsedLightweightOutline =
    lightweightOutlineSchema.safeParse(rawLightweightOutline);

  if (!parsedLightweightOutline.success) {
    return value;
  }

  const lightweightOutline = parsedLightweightOutline.data;
  const structureOutline =
    "structureOutline" in record &&
    deckStructureOutlineSchema.safeParse(record.structureOutline).success
      ? record.structureOutline
      : buildStructureOutlineFromLightweightOutline(lightweightOutline);

  return {
    ...record,
    deckType: record.deckType ?? lightweightOutline.deckType,
    lightweightOutline,
    recommendedPageCount:
      typeof record.recommendedPageCount === "number"
        ? record.recommendedPageCount
        : lightweightOutline.pageCount,
    structureOutline
  };
}

export const deckIntentAnalysisResultSchema = z.preprocess(
  normalizeDeckIntentAnalysisResult,
  confirmedDeckIntentSchema
    .extend({
      input: deckOutlineIntentInputSchema,
      fileSummaries: z
        .array(deckOutlineFileSummarySchema)
        .max(deckInputMaxFileCount),
      lightweightOutline: lightweightOutlineSchema,
      structureOutline: deckStructureOutlineSchema
    })
    .strip()
).superRefine((result, ctx) => {
    if (
      result.input.pageCount !== undefined &&
      result.recommendedPageCount !== result.input.pageCount
    ) {
      ctx.addIssue({
        code: "custom",
        message: "recommendedPageCount must match the user-specified pageCount",
        path: ["recommendedPageCount"]
      });
    }

    if (result.structureOutline.slides.length !== result.recommendedPageCount) {
      ctx.addIssue({
        code: "custom",
        message: "structureOutline.slides length must match recommendedPageCount",
        path: ["structureOutline", "slides"]
      });
    }

    if (result.lightweightOutline.pageCount !== result.recommendedPageCount) {
      ctx.addIssue({
        code: "custom",
        message: "lightweightOutline.pageCount must match recommendedPageCount",
        path: ["lightweightOutline", "pageCount"]
      });
    }

    if (result.lightweightOutline.deckType !== result.deckType) {
      ctx.addIssue({
        code: "custom",
        message: "lightweightOutline.deckType must match deckType",
        path: ["lightweightOutline", "deckType"]
      });
    }

    const allowedSourceIds = new Set(
      (result.input.sources ?? []).map((source) => source.sourceId)
    );

    for (const [pageIndex, page] of result.lightweightOutline.pages.entries()) {
      for (const sourceId of page.sourceIds) {
        if (!allowedSourceIds.has(sourceId)) {
          ctx.addIssue({
            code: "custom",
            message: "lightweightOutline sourceIds must reference existing sources",
            path: ["lightweightOutline", "pages", pageIndex, "sourceIds"]
          });
        }
      }
    }
  });

export const deckDetailedOutlineResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(detailedSlideOutlineSchema).min(deckPageCountMin).max(deckPageCountMax)
  })
  .strict();

export const deckDisplayContentResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    detailedOutline: z.array(detailedSlideOutlineSchema).min(deckPageCountMin).max(deckPageCountMax),
    slides: z.array(slideDisplayContentSchema).min(deckPageCountMin).max(deckPageCountMax)
  })
  .strict();

export const deckPageCopyResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(slideContentSchema).min(deckPageCountMin).max(deckPageCountMax)
  })
  .strip();

export const deckOutlineResultSchema = deckAnalysisResultSchema
  .extend({
    mode: z.enum(["ai-json", "mock"])
  })
  .strict();

export const slideCompositionPlanSchema = z
  .object({
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(deckPageCountMax),
    content: slideContentSchema,
    pageIntent: slidePageIntentSchema,
    contentHierarchy: slideContentHierarchySchema,
    layoutSelection: slideLayoutSelectionSchema,
    constraints: slideDesignConstraintsSchema,
    designQualityScore: slideDesignQualityScoreSchema,
    expressionIntent: z.string().min(4).max(240),
    designPlan: slidePageDesignSchema,
    layoutDiagnostics: slideLayoutDiagnosticsSchema,
    semanticElements: z.array(semanticSlideElementSchema).min(3).max(14),
    elements: z.array(slideElementSchema).min(3).max(slideElementMaxCount),
    imageLayerRequests: z.array(imageLayerRequestSchema).max(5),
    canvas: slideCanvasSchema
  })
  .strict()
  .superRefine((plan, ctx) => {
    const imageRequestIds = new Set(
      plan.imageLayerRequests.map((request) => request.id)
    );

    for (const element of plan.elements) {
      if (
        element.type === "generatedImage" &&
        element.imageRequestId &&
        !imageRequestIds.has(element.imageRequestId)
      ) {
        ctx.addIssue({
          code: "custom",
          message: "generatedImage element references a missing image request",
          path: ["elements", plan.elements.indexOf(element), "imageRequestId"]
        });
      }
    }

    const titleElements = plan.elements.filter(
      (element) => element.type === "text" && element.semanticType === "title"
    );

    if (titleElements.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "slide must contain exactly one primary title text element",
        path: ["elements"]
      });
    }

    if (!plan.constraints.titleUnique) {
      ctx.addIssue({
        code: "custom",
        message: "constraints.titleUnique must be true",
        path: ["constraints", "titleUnique"]
      });
    }

    if (!plan.constraints.coreMessagePresent) {
      ctx.addIssue({
        code: "custom",
        message: "constraints.coreMessagePresent must be true",
        path: ["constraints", "coreMessagePresent"]
      });
    }

    if (!plan.contentHierarchy.tiers.some((tier) => tier.level === 1 && tier.items.length > 0)) {
      ctx.addIssue({
        code: "custom",
        message: "contentHierarchy must include a non-empty level 1 tier",
        path: ["contentHierarchy", "tiers"]
      });
    }

    const elementIds = new Set(plan.elements.map((element) => element.id));

    for (const request of plan.imageLayerRequests) {
      if (!elementIds.has(request.elementId)) {
        ctx.addIssue({
          code: "custom",
          message: "image request elementId must reference an existing element",
          path: ["imageLayerRequests", plan.imageLayerRequests.indexOf(request), "elementId"]
        });
      }
    }
  });

export const semanticSlidePlanSchema = z
  .object({
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(deckPageCountMax),
    content: slideContentSchema,
    pageIntent: slidePageIntentSchema,
    contentHierarchy: slideContentHierarchySchema,
    layoutSelection: slideLayoutSelectionSchema,
    constraints: slideDesignConstraintsSchema,
    expressionIntent: z.string().min(4).max(240),
    designPlan: slidePageDesignSchema,
    layoutDiagnostics: slideLayoutDiagnosticsSchema,
    semanticElements: z.array(semanticSlideElementSchema).min(3).max(14)
  })
  .strict();

export const analyzedDeckResultSchema = z
  .object({
    mode: z.enum(["ai-json", "mock"]),
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(slideCompositionPlanSchema).min(deckPageCountMin).max(deckPageCountMax)
  })
  .strict();

export const generatedSlideResultSchema = slideCompositionPlanSchema.extend({
  generatedImageLayers: z.array(generatedImageLayerSchema).max(5),
  motionPlan: slideMotionPlanSchema
});

export const generatedDeckResultSchema = z
  .object({
    id: z.string().min(3).max(120),
    mode: z.enum(["ai-json", "mock"]),
    status: z.enum(["GENERATING", "READY", "FAILED"]),
    deckTitle: z.string().min(2).max(120),
    deckSummary: z.string().min(8).max(500),
    input: analyzeDeckRequestSchema,
    unifiedVisualSpec: unifiedVisualSpecSchema,
    contentReview: contentReviewSchema,
    consistencyReport: consistencyReportSchema,
    slides: z.array(generatedSlideResultSchema).min(deckPageCountMin).max(deckPageCountMax),
    pptxUrl: z.string().min(1).max(2048).optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  })
  .strict();

export type DeckTextFileInput = z.infer<typeof deckTextFileInputSchema>;
export type DeckOutlineFileSummary = z.infer<
  typeof deckOutlineFileSummarySchema
>;
export type DeckOutlineIntentInput = z.infer<
  typeof deckOutlineIntentInputSchema
>;
export type ConfirmedDeckIntent = z.infer<typeof confirmedDeckIntentSchema>;
export type DeckIntentAnalysisResult = z.infer<
  typeof deckIntentAnalysisResultSchema
>;
export type AnalyzeDeckRequest = z.infer<typeof analyzeDeckRequestSchema>;
export type UnifiedVisualSpec = z.infer<typeof unifiedVisualSpecSchema>;
export type SlideContent = z.infer<typeof slideContentSchema>;
export type SlideElement = z.infer<typeof slideElementSchema>;
export type SlidePageIntent = z.infer<typeof slidePageIntentSchema>;
export type SlideLayoutType = z.infer<typeof slideLayoutTypeSchema>;
export type SlideLayoutSelection = z.infer<typeof slideLayoutSelectionSchema>;
export type SlideDesignConstraints = z.infer<typeof slideDesignConstraintsSchema>;
export type SlideDesignQualityScore = z.infer<typeof slideDesignQualityScoreSchema>;
export type SemanticSlideElement = z.infer<typeof semanticSlideElementSchema>;
export type ImageLayerRequest = z.infer<typeof imageLayerRequestSchema>;
export type GeneratedImageLayer = z.infer<typeof generatedImageLayerSchema>;
export type SlideMotionPlan = z.infer<typeof slideMotionPlanSchema>;
export type ContentReview = z.infer<typeof contentReviewSchema>;
export type ConsistencyReport = z.infer<typeof consistencyReportSchema>;
export type DeckAnalysisResult = z.infer<typeof deckAnalysisResultSchema>;
export type LightweightNarrativeStyle = z.infer<
  typeof lightweightNarrativeStyleSchema
>;
export type LightweightOutline = z.infer<typeof lightweightOutlineSchema>;
export type LightweightOutlineChapter = z.infer<
  typeof lightweightOutlineChapterSchema
>;
export type LightweightOutlinePage = z.infer<
  typeof lightweightOutlinePageSchema
>;
export type DeckStructureSlide = z.infer<typeof deckStructureSlideSchema>;
export type DeckStructureOutline = z.infer<
  typeof deckStructureOutlineSchema
>;
export type DeckStructureOutlineResult = z.infer<
  typeof deckStructureOutlineResultSchema
>;
export type DetailedSlideOutline = z.infer<typeof detailedSlideOutlineSchema>;
export type SlideDisplayContent = z.infer<typeof slideDisplayContentSchema>;
export type DeckDetailedOutlineResult = z.infer<
  typeof deckDetailedOutlineResultSchema
>;
export type DeckDisplayContentResult = z.infer<
  typeof deckDisplayContentResultSchema
>;
export type DeckPageCopyResult = z.infer<typeof deckPageCopyResultSchema>;
export type DeckOutlineResult = z.infer<typeof deckOutlineResultSchema>;
export type SlideCompositionPlan = z.infer<typeof slideCompositionPlanSchema>;
export type SemanticSlidePlan = z.infer<typeof semanticSlidePlanSchema>;
export type AnalyzedDeckResult = z.infer<typeof analyzedDeckResultSchema>;
export type GeneratedSlideResult = z.infer<typeof generatedSlideResultSchema>;
export type GeneratedDeckResult = z.infer<typeof generatedDeckResultSchema>;
