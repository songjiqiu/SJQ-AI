import { z } from "zod";

import { deckTypeIds, paletteIds } from "@/lib/create-deck/options";
import {
  deckInputMaxFileCharacters,
  deckInputMaxFileCount,
  deckInputMaxFileSize
} from "@/lib/create-deck/file-options";

export const canvasAspectRatio = "16:9";
export const slideCanvasUnit = "inch";
export const slideCanvasWidth = 13.333;
export const slideCanvasHeight = 7.5;
export const slideCanvasSafeMargin = 0.5;

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
    pageCount: z.coerce.number().int().min(3).max(18).optional(),
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
    recommendedPageCount: z.number().int().min(3).max(18)
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
    pageCount: z.coerce.number().int().min(3).max(18),
    deckType: z.enum(deckTypeIds).default("business-report"),
    palette: z.enum(paletteIds),
    locale: z.enum(["zh-CN", "en-US"])
  })
  .strip();

export const unifiedVisualSpecSchema = z
  .object({
    themeName: z.string().min(2).max(80),
    visualStyle: z.string().min(6).max(240),
    colorPalette: z.array(z.string().min(3).max(40)).min(3).max(6),
    typography: z.string().min(6).max(160),
    imageStyle: z.string().min(6).max(240),
    layoutRules: z.array(z.string().min(4).max(160)).min(2).max(6),
    consistencyRules: z.array(z.string().min(4).max(180)).min(2).max(8),
    forbiddenRules: z.array(z.string().min(4).max(160)).min(1).max(6),
    pageSpec: z
      .object({
        aspectRatio: z.literal(canvasAspectRatio),
        gridColumns: z.literal(12),
        height: z.literal(slideCanvasHeight),
        layoutInstruction: z.string().min(8).max(240),
        safeMargin: z.literal(slideCanvasSafeMargin),
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
            pageTitle: typographyRuleScaleItemSchema(),
            body: typographyRuleScaleItemSchema(),
            annotation: typographyRuleScaleItemSchema(),
            chartLabel: typographyRuleScaleItemSchema()
          })
          .strict()
      })
      .strict(),
    colorRoles: z
      .object({
        accent: z.string().min(3).max(180),
        background: z.string().min(3).max(180),
        bodyText: z.string().min(3).max(180),
        chart: z.string().min(3).max(180),
        contrastRequirement: z.string().min(6).max(180),
        decorative: z.string().min(3).max(180),
        highlight: z.string().min(3).max(180),
        surface: z.string().min(3).max(180),
        titleText: z.string().min(3).max(180)
      })
      .strict(),
    imageRules: z
      .object({
        backgroundAvoidsHighContrastTextArea: z.boolean(),
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
    spacingRules: z
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
  .strict();

function typographyRuleScaleItemSchema() {
  return z
    .object({
      fontSize: z.number().min(6).max(60),
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

export const slideContentSchema = z
  .object({
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(18),
    title: z.string().min(2).max(80),
    subtitle: z.string().max(120).optional(),
    bodyPoints: z.array(z.string().min(2).max(120)).min(2).max(5),
    speakerGoal: z.string().min(6).max(180),
    visualIntent: z.string().min(6).max(220),
    coreStatement: z.string().min(4).max(220),
    narrativeRole: slideNarrativeRoleSchema,
    contentLayers: z
      .object({
        primary: z.array(z.string().min(2).max(160)).min(1).max(4),
        supporting: z.array(z.string().min(2).max(160)).min(1).max(6),
        supplementary: z.array(z.string().min(2).max(160)).max(5)
      })
      .strict(),
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
    imageRequestId: z.string().min(3).max(80).optional()
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
    elementType: slideElementTypeSchema,
    hierarchyLevel: z.number().int().min(1).max(3),
    id: z.string().min(3).max(80),
    priority: z.number().int().min(1).max(5),
    role: z.string().min(2).max(100),
    semanticType: slideElementSemanticTypeSchema
  })
  .strict();

export const slidePageDesignSchema = z
  .object({
    expressionIntent: z.string().min(4).max(240),
    layoutTemplate: z.string().min(2).max(120),
    visualStrategy: z.string().min(4).max(240),
    readingOrder: z.array(z.string().min(1).max(80)).min(1).max(10)
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
      .max(12)
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
    slides: z.array(slideContentSchema).min(3).max(18)
  })
  .strict();

export const deckStructureSlideSchema = z
  .object({
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(18),
    title: z.string().min(2).max(80),
    purpose: z.string().min(6).max(180),
    keyMessage: z.string().min(4).max(180),
    visualDirection: z.string().min(6).max(220)
  })
  .strict();

export const deckStructureOutlineSchema = z
  .object({
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    slides: z.array(deckStructureSlideSchema).min(3).max(18)
  })
  .strict();

export const deckStructureOutlineResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    slides: z.array(deckStructureSlideSchema).min(3).max(18)
  })
  .strip();

export const deckIntentAnalysisResultSchema = confirmedDeckIntentSchema
  .extend({
    input: deckOutlineIntentInputSchema,
    fileSummaries: z.array(deckOutlineFileSummarySchema).max(deckInputMaxFileCount),
    structureOutline: deckStructureOutlineSchema
  })
  .strip()
  .superRefine((result, ctx) => {
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
  });

export const deckPageCopyResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(slideContentSchema).min(3).max(18)
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
    index: z.number().int().min(1).max(18),
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
    elements: z.array(slideElementSchema).min(3).max(10),
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
    index: z.number().int().min(1).max(18),
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
    slides: z.array(slideCompositionPlanSchema).min(3).max(18)
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
    slides: z.array(generatedSlideResultSchema).min(3).max(18),
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
export type DeckStructureSlide = z.infer<typeof deckStructureSlideSchema>;
export type DeckStructureOutline = z.infer<
  typeof deckStructureOutlineSchema
>;
export type DeckStructureOutlineResult = z.infer<
  typeof deckStructureOutlineResultSchema
>;
export type DeckPageCopyResult = z.infer<typeof deckPageCopyResultSchema>;
export type DeckOutlineResult = z.infer<typeof deckOutlineResultSchema>;
export type SlideCompositionPlan = z.infer<typeof slideCompositionPlanSchema>;
export type SemanticSlidePlan = z.infer<typeof semanticSlidePlanSchema>;
export type AnalyzedDeckResult = z.infer<typeof analyzedDeckResultSchema>;
export type GeneratedSlideResult = z.infer<typeof generatedSlideResultSchema>;
export type GeneratedDeckResult = z.infer<typeof generatedDeckResultSchema>;
