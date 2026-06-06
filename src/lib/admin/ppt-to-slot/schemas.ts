import { z } from "zod";

import {
  pptSlotTemplateReviewStatuses,
  pptToSlotArtifactKinds
} from "@/lib/admin/ppt-to-slot/types";

export const pptToSlotMaxFileSize = 10 * 1024 * 1024;

export const pptSlotTemplateReviewStatusSchema = z.enum(
  pptSlotTemplateReviewStatuses
);

export const pptToSlotArtifactKindSchema = z.enum(pptToSlotArtifactKinds);

export const slotFrameSchema = z
  .object({
    h: z.number().positive(),
    w: z.number().positive(),
    x: z.number().min(0),
    y: z.number().min(0)
  })
  .strict();

export const slotCanvasSchema = slotFrameSchema
  .extend({
    unit: z.literal("inch")
  })
  .strict();

const slotSchema = z
  .object({
    constraints: z.record(z.string(), z.unknown()).default({}),
    frame: slotFrameSchema,
    id: z.string().trim().min(1).max(80),
    layout: z.record(z.string(), z.unknown()).optional(),
    placeholder: z.string().trim().max(120).optional(),
    required: z.boolean(),
    roles: z.array(z.string().trim().min(1).max(80)).min(1).max(8)
  })
  .strict();

export const pptSlotTemplateJsonSchema = z
  .object({
    alignmentLines: z
      .object({
        x: z.array(z.number()).max(80),
        y: z.array(z.number()).max(80)
      })
      .strict(),
    canvas: slotCanvasSchema,
    id: z.string().trim().min(1).max(120),
    layoutPattern: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(120),
    pageTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
    rules: z.record(z.string(), z.unknown()).default({}),
    safeArea: slotFrameSchema,
    slots: z.record(z.string(), slotSchema).refine(
      (slots) => Object.keys(slots).length > 0,
      "At least one slot is required"
    ),
    source: z
      .object({
        file: z.string().trim().min(1).max(255),
        slideIndex: z.number().int().min(1)
      })
      .strict(),
    styleTokens: z.record(z.string(), z.unknown()).default({}),
    usage: z
      .object({
        notSuitableFor: z.array(z.string().trim().min(1).max(160)).max(8),
        suitableFor: z.array(z.string().trim().min(1).max(160)).max(8)
      })
      .strict(),
    version: z.literal("1.0.0")
  })
  .strict()
  .superRefine((template, ctx) => {
    for (const [slotId, slot] of Object.entries(template.slots)) {
      if (!isFrameInsideCanvas(slot.frame, template.canvas)) {
        ctx.addIssue({
          code: "custom",
          message: `Slot ${slotId} frame must stay inside the slide canvas`,
          path: ["slots", slotId, "frame"]
        });
      }
    }

    const slots = Object.entries(template.slots);
    for (let index = 0; index < slots.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < slots.length; nextIndex += 1) {
        const [firstId, first] = slots[index];
        const [secondId, second] = slots[nextIndex];
        const overlapRatio = frameOverlapRatio(first.frame, second.frame);

        if (overlapRatio > 0.82) {
          ctx.addIssue({
            code: "custom",
            message: `Slot ${firstId} overlaps ${secondId} too much`,
            path: ["slots", firstId, "frame"]
          });
        }
      }
    }
  });

export const pptSlotTemplateUpdateSchema = z
  .object({
    alignmentLines: z
      .object({
        x: z.array(z.number()).max(80),
        y: z.array(z.number()).max(80)
      })
      .strict()
      .optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isEnabled: z.boolean().optional(),
    layoutPattern: z.string().trim().min(1).max(120).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    pageTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(6).optional(),
    reviewNotes: z.string().trim().max(1000).nullable().optional(),
    reviewStatus: pptSlotTemplateReviewStatusSchema.optional(),
    rules: z.record(z.string(), z.unknown()).optional(),
    safeArea: slotFrameSchema.optional(),
    slots: z.record(z.string(), slotSchema).optional(),
    styleTokens: z.record(z.string(), z.unknown()).optional(),
    usage: z
      .object({
        notSuitableFor: z.array(z.string().trim().min(1).max(160)).max(8),
        suitableFor: z.array(z.string().trim().min(1).max(160)).max(8)
      })
      .strict()
      .optional()
  })
  .strict();

function isFrameInsideCanvas(
  frame: { h: number; w: number; x: number; y: number },
  canvas: { h: number; w: number }
) {
  return frame.x + frame.w <= canvas.w + 0.001 && frame.y + frame.h <= canvas.h + 0.001;
}

function frameOverlapRatio(
  first: { h: number; w: number; x: number; y: number },
  second: { h: number; w: number; x: number; y: number }
) {
  const x = Math.max(0, Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x));
  const y = Math.max(0, Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y));
  const overlap = x * y;
  const smallerArea = Math.min(first.w * first.h, second.w * second.h);

  return smallerArea > 0 ? overlap / smallerArea : 0;
}
