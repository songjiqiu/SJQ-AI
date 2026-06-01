import { createHash, randomUUID } from "node:crypto";

import { Prisma, ReusableImageAssetStatus } from "@prisma/client";
import OpenAI from "openai";

import { prisma } from "@/lib/db/prisma";
import {
  copyStorageFileToDeck,
  readStorageFile,
  writeDeckFile,
  writeReusableAssetFile
} from "@/lib/decks/storage";

import type {
  GeneratedImageLayer,
  ImageLayerRequest,
  SlideCompositionPlan,
  UnifiedVisualSpec
} from "./schema";
import type { ImageLayerGeneration, ImageLayerGenerator } from "./image-generator";

export type ImageQualityReviewEnv = {
  AI_TEXT_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
};

export type ImageQualityReviewer = (context: {
  generated: ImageLayerGeneration;
  request: ImageLayerRequest;
}) => Promise<ImageQualityReview | null>;

export type ImageQualityReview = {
  method: "rules" | "llm" | "rules-only-fallback";
  passed: boolean;
  score: number;
  summary: string;
  warnings: string[];
};

const imageQualityReviewTimeoutMs = 30_000;

export type MaterializedImageLayer = {
  assetId: string;
  bytes: Buffer;
  generatedImageLayer: GeneratedImageLayer;
  mimeType: string;
};

export async function materializeImageLayer({
  generator,
  projectId,
  qualityReviewer,
  request,
  slide,
  unifiedVisualSpec,
  userId
}: {
  generator: ImageLayerGenerator;
  projectId: string;
  qualityReviewer?: ImageQualityReviewer;
  request: ImageLayerRequest;
  slide: SlideCompositionPlan;
  unifiedVisualSpec: UnifiedVisualSpec;
  userId: string;
}): Promise<MaterializedImageLayer> {
  const cacheKey = buildImageAssetCacheKey({
    modelId: generator.modelId ?? "mock-svg",
    request,
    unifiedVisualSpec,
    userId
  });
  const cached = await findReusableImageAsset(userId, cacheKey);

  if (cached) {
    const copied = await copyStorageFileToDeck({
      filename: `${safeFilePart(request.id)}-${cached.id}.${extensionFromMime(cached.mimeType)}`,
      projectId,
      sourceRelativePath: cached.relativePath
    });
    const file = await readStorageFile(copied?.relativePath ?? cached.relativePath);

    if (copied && file) {
      const assetId = randomUUID();
      const publicUrl = `/api/decks/${projectId}/assets/${assetId}`;

      await prisma.deckAsset.create({
        data: {
          id: assetId,
          projectId,
          elementId: request.elementId,
          requestId: request.id,
          kind: "IMAGE_LAYER",
          provider: cached.provider,
          mimeType: cached.mimeType,
          filename: copied.filename,
          relativePath: copied.relativePath,
          publicUrl,
          sizeBytes: copied.sizeBytes,
          sourceReusableAssetId: cached.id,
          metadata: toInputJson({
            cacheHit: true,
            cacheKey,
            qualityReview: cached.qualityReview
          })
        }
      });

      return {
        assetId,
        bytes: file.bytes,
        mimeType: cached.mimeType,
        generatedImageLayer: {
          id: `${request.id}-layer`,
          requestId: request.id,
          elementId: request.elementId,
          assetId,
          provider: cached.provider,
          mimeType: cached.mimeType,
          url: publicUrl,
          prompt: request.prompt,
          width: cached.width,
          height: cached.height,
          transparentBackground: request.transparentBackground,
          visualNotes: request.visualNotes,
          qualityReview: cached.qualityReview as ImageQualityReview
        }
      };
    }
  }

  const generated = await generator.generateLayer({
    request,
    slide,
    unifiedVisualSpec
  });
  const qualityReview = await reviewGeneratedImage({
    generated,
    qualityReviewer,
    request
  });
  const reusableStored = await writeReusableAssetFile({
    bytes: generated.bytes,
    filename: generated.filename,
    userId
  });
  const reusable = await prisma.reusableImageAsset.upsert({
    where: {
      userId_cacheKey: {
        cacheKey,
        userId
      }
    },
    create: {
      userId,
      cacheKey,
      status: qualityReview.passed
        ? ReusableImageAssetStatus.APPROVED
        : ReusableImageAssetStatus.REJECTED,
      provider: generated.provider,
      modelId: generator.modelId ?? generated.provider,
      imageType: request.imageType,
      aspectRatio: request.aspectRatio,
      transparentBackground: request.transparentBackground,
      prompt: request.prompt,
      avoid: request.avoid,
      keywords: toInputJson(request.keywords),
      visualStyle: unifiedVisualSpec.visualStyle.slice(0, 500),
      mimeType: generated.mimeType,
      filename: reusableStored.filename,
      relativePath: reusableStored.relativePath,
      sizeBytes: reusableStored.sizeBytes,
      width: generated.width,
      height: generated.height,
      qualityReview: toInputJson(qualityReview),
      metadata: toInputJson(generated.metadata)
    },
    update: {
      status: qualityReview.passed
        ? ReusableImageAssetStatus.APPROVED
        : ReusableImageAssetStatus.REJECTED,
      provider: generated.provider,
      modelId: generator.modelId ?? generated.provider,
      mimeType: generated.mimeType,
      filename: reusableStored.filename,
      relativePath: reusableStored.relativePath,
      sizeBytes: reusableStored.sizeBytes,
      width: generated.width,
      height: generated.height,
      qualityReview: toInputJson(qualityReview),
      metadata: toInputJson(generated.metadata)
    }
  });
  const assetId = randomUUID();
  const deckStored = await writeDeckFile({
    bytes: generated.bytes,
    filename: generated.filename,
    projectId
  });
  const publicUrl = `/api/decks/${projectId}/assets/${assetId}`;

  await prisma.deckAsset.create({
    data: {
      id: assetId,
      projectId,
      elementId: request.elementId,
      requestId: request.id,
      kind: "IMAGE_LAYER",
      provider: generated.provider,
      mimeType: generated.mimeType,
      filename: deckStored.filename,
      relativePath: deckStored.relativePath,
      publicUrl,
      sizeBytes: deckStored.sizeBytes,
      sourceReusableAssetId: qualityReview.passed ? reusable.id : null,
      metadata: toInputJson({
        cacheHit: false,
        cacheKey,
        qualityReview,
        reusableStatus: reusable.status,
        ...generated.metadata
      })
    }
  });

  return {
    assetId,
    bytes: generated.bytes,
    mimeType: generated.mimeType,
    generatedImageLayer: {
      id: `${request.id}-layer`,
      requestId: request.id,
      elementId: request.elementId,
      assetId,
      provider: generated.provider,
      mimeType: generated.mimeType,
      url: publicUrl,
      prompt: request.prompt,
      width: generated.width,
      height: generated.height,
      transparentBackground: request.transparentBackground,
      visualNotes: request.visualNotes,
      qualityReview
    }
  };
}

export function buildImageAssetCacheKey({
  modelId,
  request,
  unifiedVisualSpec,
  userId
}: {
  modelId: string;
  request: ImageLayerRequest;
  unifiedVisualSpec: UnifiedVisualSpec;
  userId: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        aspectRatio: request.aspectRatio,
        avoid: normalizeText(request.avoid || request.negativePrompt),
        imageType: request.imageType,
        keywords: request.keywords.map(normalizeText).sort(),
        modelId: normalizeText(modelId),
        prompt: normalizeText(request.prompt),
        transparentBackground: request.transparentBackground,
        userId,
        visualStyle: normalizeText(unifiedVisualSpec.visualStyle)
      })
    )
    .digest("hex");
}

export function createImageQualityReviewer(
  env?: ImageQualityReviewEnv | null
): ImageQualityReviewer | undefined {
  if (!env?.OPENAI_API_KEY) {
    return undefined;
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || undefined
  });
  const model = env.AI_TEXT_MODEL || "gpt-4.1-mini";

  return async ({ generated, request }) => {
    if (
      generated.mimeType === "image/svg+xml" ||
      generated.bytes.byteLength > 4 * 1024 * 1024
    ) {
      return null;
    }

    try {
      const response = await client.chat.completions.create(
        {
          messages: [
            {
              role: "system",
              content:
                "你是 PPT 图片素材质量审核员。只输出 JSON，不要解释。JSON 字段：passed(boolean), score(number 0-100), summary(string), warnings(string[])."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `请审核这张 PPT 图片素材是否满足用途：${request.purpose}\nPrompt: ${request.prompt}\nAvoid: ${request.avoid}`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${generated.mimeType};base64,${generated.bytes.toString("base64")}`
                  }
                }
              ]
            }
          ],
          model,
          response_format: {
            type: "json_object"
          },
          temperature: 0
        },
        {
          timeout: imageQualityReviewTimeoutMs
        }
      );
      const content = response.choices[0]?.message?.content;
      const parsed = content ? JSON.parse(content) : null;

      if (!isRecord(parsed)) {
        return null;
      }

      return {
        method: "llm",
        passed: Boolean(parsed.passed),
        score:
          typeof parsed.score === "number"
            ? Math.max(0, Math.min(100, Math.round(parsed.score)))
            : 70,
        summary:
          typeof parsed.summary === "string"
            ? parsed.summary.slice(0, 240)
            : "视觉 LLM 审核完成。",
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings
              .filter((item): item is string => typeof item === "string")
              .slice(0, 8)
          : []
      };
    } catch {
      return null;
    }
  };
}

async function findReusableImageAsset(userId: string, cacheKey: string) {
  const asset = await prisma.reusableImageAsset.findFirst({
    where: {
      cacheKey,
      status: "APPROVED",
      userId
    }
  });

  if (!asset) {
    return null;
  }

  const file = await readStorageFile(asset.relativePath);

  return file ? asset : null;
}

async function reviewGeneratedImage({
  generated,
  qualityReviewer,
  request
}: {
  generated: ImageLayerGeneration;
  qualityReviewer?: ImageQualityReviewer;
  request: ImageLayerRequest;
}): Promise<ImageQualityReview> {
  const warnings: string[] = [];

  if (generated.bytes.byteLength < 200) {
    warnings.push("图片文件过小，可能为空图。");
  }

  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(generated.mimeType)) {
    warnings.push("图片 MIME 类型不在允许范围内。");
  }

  if (generated.width < 256 || generated.height < 256) {
    warnings.push("图片尺寸过小。");
  }

  if (/fallback/i.test(generated.provider)) {
    warnings.push("图片模型生成失败，已使用本地 fallback 图层。");
  }

  if (/(色情|暴力|仇恨|诈骗|terror|porn|violence|hate)/i.test(request.prompt)) {
    warnings.push("Prompt 命中潜在禁用内容，需要人工确认。");
  }

  const passed = warnings.length === 0 || warnings.every((warning) => warning.includes("fallback"));

  const rulesReview: ImageQualityReview = {
    method: "rules-only-fallback",
    passed,
    score: Math.max(40, 96 - warnings.length * 14),
    summary: passed
      ? "规则审核通过；视觉 LLM 审核作为可选增强未阻断生成。"
      : "规则审核发现风险，素材需要用户确认。",
    warnings
  };

  if (!rulesReview.passed || !qualityReviewer) {
    return rulesReview;
  }

  const llmReview = await qualityReviewer({
    generated,
    request
  });

  return llmReview ?? rulesReview;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function extensionFromMime(mimeType: string) {
  if (mimeType.includes("svg")) {
    return "svg";
  }

  if (mimeType.includes("jpeg")) {
    return "jpg";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  return "png";
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
