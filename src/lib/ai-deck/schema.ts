import { z } from "zod";

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
    characterCount: z.number().int().min(0).max(deckInputMaxFileCharacters)
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
    deckType: z.enum(deckTypeIds).default("business-report"),
    style: z.enum(deckStyleSchemaIds).default("strategic"),
    palette: z.enum(paletteIds),
    locale: z.enum(["zh-CN", "en-US"])
  })
  .strict();

export const confirmedDeckIntentSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    style: z.enum(deckStyleSchemaIds),
    audience: z.string().trim().min(2).max(120),
    goal: z.string().trim().min(2).max(160),
    coreMessage: z.string().trim().min(2).max(300),
    recommendedPageCount: z.number().int().min(3).max(18)
  })
  .strict();

export const deckIntentAnalysisResultSchema = confirmedDeckIntentSchema
  .extend({
    input: deckOutlineIntentInputSchema,
    fileSummaries: z.array(deckOutlineFileSummarySchema).max(deckInputMaxFileCount)
  })
  .strict();

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
    style: z.enum(deckStyleSchemaIds).default("strategic"),
    palette: z.enum(paletteIds),
    locale: z.enum(["zh-CN", "en-US"])
  })
  .strict();

export const unifiedVisualSpecSchema = z
  .object({
    themeName: z.string().min(2).max(80),
    visualStyle: z.string().min(6).max(240),
    colorPalette: z.array(z.string().min(3).max(40)).min(3).max(6),
    typography: z.string().min(6).max(160),
    imageStyle: z.string().min(6).max(240),
    layoutRules: z.array(z.string().min(4).max(160)).min(2).max(6),
    consistencyRules: z.array(z.string().min(4).max(180)).min(2).max(8),
    forbiddenRules: z.array(z.string().min(4).max(160)).min(1).max(6)
  })
  .strict();

export const slideContentSchema = z
  .object({
    slideId: z.string().min(3).max(60),
    index: z.number().int().min(1).max(18),
    title: z.string().min(2).max(80),
    subtitle: z.string().max(120).optional(),
    bodyPoints: z.array(z.string().min(2).max(120)).min(2).max(5),
    speakerGoal: z.string().min(6).max(180),
    visualIntent: z.string().min(6).max(220)
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

export const slideElementTextStyleSchema = z
  .object({
    align: z.enum(["left", "center", "right"]).default("left"),
    color: z.string().min(3).max(40).optional(),
    fontSize: z.number().min(8).max(40).default(14),
    fontWeight: z.enum(["regular", "medium", "semibold", "bold"]).default("regular"),
    lineHeight: z.number().min(1).max(1.8).default(1.25),
    maxLines: z.number().int().min(1).max(8).optional()
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
      .max(8)
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

export const deckStructureOutlineResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    style: z.enum(deckStyleSchemaIds),
    deckTitle: z.string().min(2).max(100),
    deckSummary: z.string().min(8).max(300),
    unifiedVisualSpec: unifiedVisualSpecSchema,
    slides: z.array(deckStructureSlideSchema).min(3).max(18)
  })
  .strict();

export const deckPageCopyResultSchema = z
  .object({
    deckType: z.enum(deckTypeIds),
    style: z.enum(deckStyleSchemaIds),
    slides: z.array(slideContentSchema).min(3).max(18)
  })
  .strict();

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
    contentHierarchy: slideContentHierarchySchema,
    expressionIntent: z.string().min(4).max(240),
    designPlan: slidePageDesignSchema,
    layoutDiagnostics: slideLayoutDiagnosticsSchema,
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
  });

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
export type ImageLayerRequest = z.infer<typeof imageLayerRequestSchema>;
export type GeneratedImageLayer = z.infer<typeof generatedImageLayerSchema>;
export type SlideMotionPlan = z.infer<typeof slideMotionPlanSchema>;
export type ContentReview = z.infer<typeof contentReviewSchema>;
export type ConsistencyReport = z.infer<typeof consistencyReportSchema>;
export type DeckAnalysisResult = z.infer<typeof deckAnalysisResultSchema>;
export type DeckStructureSlide = z.infer<typeof deckStructureSlideSchema>;
export type DeckStructureOutlineResult = z.infer<
  typeof deckStructureOutlineResultSchema
>;
export type DeckPageCopyResult = z.infer<typeof deckPageCopyResultSchema>;
export type DeckOutlineResult = z.infer<typeof deckOutlineResultSchema>;
export type SlideCompositionPlan = z.infer<typeof slideCompositionPlanSchema>;
export type AnalyzedDeckResult = z.infer<typeof analyzedDeckResultSchema>;
export type GeneratedSlideResult = z.infer<typeof generatedSlideResultSchema>;
export type GeneratedDeckResult = z.infer<typeof generatedDeckResultSchema>;
