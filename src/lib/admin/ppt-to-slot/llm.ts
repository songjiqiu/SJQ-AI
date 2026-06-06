import OpenAI from "openai";
import { z } from "zod";

import type { AiDeckEnv } from "@/lib/ai-deck/analyzer";
import { generateValidatedJson, type JsonChatClient } from "@/lib/ai-deck/openai-json";
import type {
  PptLayoutAnalysis,
  PptRawSlide
} from "@/lib/admin/ppt-to-slot/types";
import type { SlotSemanticEnhancement } from "@/lib/admin/ppt-to-slot/slot-abstractor";

const slotEnhancementSchema = z
  .object({
    layoutPattern: z.string().trim().min(1).max(120).optional(),
    pageTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(6).optional(),
    slotLabels: z
      .record(
        z.string(),
        z
          .object({
            roles: z.array(z.string().trim().min(1).max(80)).min(1).max(8).optional(),
            slotName: z.string().trim().min(1).max(80).optional()
          })
          .strict()
      )
      .optional(),
    usage: z
      .object({
        notSuitableFor: z.array(z.string().trim().min(1).max(160)).max(4).optional(),
        suitableFor: z.array(z.string().trim().min(1).max(160)).max(4).optional()
      })
      .strict()
      .optional()
  })
  .strict();

export async function enhanceSlotSemantics({
  analysis,
  env,
  slide
}: {
  analysis: PptLayoutAnalysis;
  env: AiDeckEnv | null;
  slide: PptRawSlide;
}): Promise<{
  enhancement: SlotSemanticEnhancement | null;
  warning?: string;
}> {
  if (!env?.OPENAI_API_KEY || !env.AI_TEXT_MODEL) {
    return {
      enhancement: null
    };
  }

  try {
    const client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL || undefined
    }) as unknown as JsonChatClient;

    const enhancement = await generateValidatedJson({
      client,
      messages: [
        {
          content:
            "你是 PPT Slot 模板语义标注助手。只能补充页面类型、版式名称、Slot 名称、角色和适用场景，不能修改坐标、尺寸、图层顺序或任何几何数据。",
          role: "system"
        },
        {
          content: JSON.stringify(buildSemanticSummary(slide, analysis), null, 2),
          role: "user"
        }
      ],
      model: env.AI_TEXT_MODEL,
      retryValidation: false,
      schema: slotEnhancementSchema,
      schemaName: "ppt_slot_semantic_enhancement",
      temperature: Number(env.AI_TEXT_TEMPERATURE ?? 0.2)
    });

    return {
      enhancement
    };
  } catch (error) {
    return {
      enhancement: null,
      warning: `LLM semantic enhancement skipped: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

function buildSemanticSummary(slide: PptRawSlide, analysis: PptLayoutAnalysis) {
  return {
    candidatePageTypes: analysis.pageTypes,
    layoutPattern: analysis.layoutPattern,
    regions: analysis.regions.map((region) => ({
      id: region.regionId,
      layout: region.layout,
      possibleRoles: region.possibleRoles,
      sourceLayerTypes: region.sourceLayerIds.map(
        (id) => slide.layers.find((layer) => layer.id === id)?.type ?? "unknown"
      )
    })),
    slideIndex: slide.slideIndex,
    textSummary: slide.layers
      .filter((layer) => layer.text)
      .slice(0, 12)
      .map((layer) => ({
        frame: layer.frame,
        text: layer.text,
        type: layer.type
      }))
  };
}
