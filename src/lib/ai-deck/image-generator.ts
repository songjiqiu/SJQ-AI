import { randomUUID } from "node:crypto";

import OpenAI from "openai";

import type {
  ImageLayerRequest,
  SlideCompositionPlan,
  UnifiedVisualSpec
} from "./schema";

export type ImageLayerGenerationContext = {
  request: ImageLayerRequest;
  slide: SlideCompositionPlan;
  unifiedVisualSpec: UnifiedVisualSpec;
};

export type ImageLayerGeneration = {
  bytes: Buffer;
  filename: string;
  height: number;
  metadata: Record<string, unknown>;
  mimeType: string;
  provider: string;
  width: number;
};

export interface ImageLayerGenerator {
  generateLayer(
    context: ImageLayerGenerationContext
  ): Promise<ImageLayerGeneration>;
}

export type AiImageEnv = {
  AI_IMAGE_MODEL?: string;
  IMAGE_API_KEY?: string;
  IMAGE_BASE_URL?: string;
};

type OpenAIImagesClient = {
  images: {
    generate: (payload: Record<string, unknown>) => Promise<{
      data?: Array<{
        b64_json?: string;
        revised_prompt?: string;
        url?: string;
      }>;
      output_format?: "png" | "webp" | "jpeg";
      size?: string;
    }>;
  };
};

export class MockImageLayerGenerator implements ImageLayerGenerator {
  async generateLayer({
    request,
    slide,
    unifiedVisualSpec
  }: ImageLayerGenerationContext): Promise<ImageLayerGeneration> {
    const { width, height } = getDimensions(request.aspectRatio);
    const colors = unifiedVisualSpec.colorPalette;
    const primary = normalizeColor(colors[0], "#246bfe");
    const secondary = normalizeColor(colors[1], "#0f4bc7");
    const soft = normalizeColor(colors[2], "#dbe8ff");
    const title = escapeXml(slide.content.title);
    const role = escapeXml(request.purpose);
    const notes = escapeXml(request.visualNotes);
    const background = request.transparentBackground
      ? ""
      : `<rect width="100%" height="100%" rx="40" fill="${soft}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${background}
  <defs>
    <linearGradient id="accent" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${secondary}" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect x="${width * 0.08}" y="${height * 0.12}" width="${width * 0.84}" height="${height * 0.76}" rx="36" fill="url(#accent)" opacity="0.92"/>
  <circle cx="${width * 0.75}" cy="${height * 0.24}" r="${Math.min(width, height) * 0.16}" fill="#ffffff" opacity="0.18"/>
  <path d="M ${width * 0.16} ${height * 0.68} C ${width * 0.34} ${height * 0.38}, ${width * 0.52} ${height * 0.86}, ${width * 0.82} ${height * 0.42}" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" opacity="0.54"/>
  <text x="${width * 0.16}" y="${height * 0.38}" fill="#ffffff" font-size="${Math.round(width * 0.05)}" font-family="Microsoft YaHei, Arial, sans-serif" font-weight="700">${title}</text>
  <text x="${width * 0.16}" y="${height * 0.52}" fill="#ffffff" font-size="${Math.round(width * 0.028)}" font-family="Microsoft YaHei, Arial, sans-serif" opacity="0.88">${role}</text>
  <text x="${width * 0.16}" y="${height * 0.62}" fill="#ffffff" font-size="${Math.round(width * 0.022)}" font-family="Microsoft YaHei, Arial, sans-serif" opacity="0.72">${notes}</text>
</svg>`;

    return {
      bytes: Buffer.from(svg),
      filename: `${safeFilePart(request.id)}-${randomUUID()}.svg`,
      height,
      metadata: {
        aspectRatio: request.aspectRatio,
        transparentBackground: request.transparentBackground
      },
      mimeType: "image/svg+xml",
      provider: "mock-svg",
      width
    };
  }
}

export class OpenAIImageLayerGenerator implements ImageLayerGenerator {
  private readonly client: OpenAIImagesClient;
  private readonly fallback = new MockImageLayerGenerator();
  private readonly model: string;

  constructor({
    client,
    env
  }: {
    client?: OpenAIImagesClient;
    env: AiImageEnv;
  }) {
    this.model = env.AI_IMAGE_MODEL || "gpt-image-2";
    this.client =
      client ??
      (new OpenAI({
        apiKey: env.IMAGE_API_KEY,
        baseURL: env.IMAGE_BASE_URL || undefined
      }) as unknown as OpenAIImagesClient);
  }

  async generateLayer(
    context: ImageLayerGenerationContext
  ): Promise<ImageLayerGeneration> {
    try {
      const size = getImageApiSize(context.request.aspectRatio, this.model);
      const response = await this.client.images.generate({
        background: getImageBackground(context.request, this.model),
        model: this.model,
        moderation: "auto",
        n: 1,
        output_format: "png",
        prompt: buildImagePrompt(context),
        quality: "auto",
        size
      });
      const image = response.data?.[0];

      if (!image) {
        throw new Error("Image generation response did not include an image.");
      }

      const bytes = await readGeneratedImageBytes(image);
      const { width, height } = getDimensions(context.request.aspectRatio);

      return {
        bytes,
        filename: `${safeFilePart(context.request.id)}-${randomUUID()}.png`,
        height,
        metadata: {
          aspectRatio: context.request.aspectRatio,
          model: this.model,
          requestedSize: size,
          revisedPrompt: image?.revised_prompt,
          transparentBackground: context.request.transparentBackground
        },
        mimeType: "image/png",
        provider: this.model,
        width
      };
    } catch (error) {
      const generated = await this.fallback.generateLayer(context);

      return {
        ...generated,
        metadata: {
          ...generated.metadata,
          fallbackReason: error instanceof Error ? error.message : String(error),
          requestedModel: this.model
        },
        provider: `${this.model}-fallback-mock-svg`
      };
    }
  }
}

export function createImageLayerGenerator(
  env: AiImageEnv = {
    AI_IMAGE_MODEL: process.env.AI_IMAGE_MODEL,
    IMAGE_API_KEY: process.env.IMAGE_API_KEY,
    IMAGE_BASE_URL: process.env.IMAGE_BASE_URL
  }
): ImageLayerGenerator {
  if (!env.IMAGE_API_KEY) {
    return new MockImageLayerGenerator();
  }

  return new OpenAIImageLayerGenerator({ env });
}

function getDimensions(aspectRatio: ImageLayerRequest["aspectRatio"]) {
  if (aspectRatio === "1:1") {
    return { width: 1024, height: 1024 };
  }

  if (aspectRatio === "3:4") {
    return { width: 900, height: 1200 };
  }

  if (aspectRatio === "9:16") {
    return { width: 900, height: 1600 };
  }

  if (aspectRatio === "4:3") {
    return { width: 1200, height: 900 };
  }

  return { width: 1280, height: 720 };
}

function getImageApiSize(
  aspectRatio: ImageLayerRequest["aspectRatio"],
  model: string
) {
  if (model.startsWith("gpt-image-2")) {
    if (aspectRatio === "1:1") {
      return "1024x1024";
    }

    if (aspectRatio === "3:4") {
      return "1024x1536";
    }

    if (aspectRatio === "9:16") {
      return "1024x1792";
    }

    if (aspectRatio === "4:3") {
      return "1536x1152";
    }

    return "1536x864";
  }

  if (aspectRatio === "1:1") {
    return "1024x1024";
  }

  if (aspectRatio === "3:4" || aspectRatio === "9:16") {
    return "1024x1536";
  }

  return "1536x1024";
}

function getImageBackground(request: ImageLayerRequest, model: string) {
  if (model.startsWith("gpt-image-2")) {
    return "auto";
  }

  return request.transparentBackground ? "transparent" : "opaque";
}

function buildImagePrompt({
  request,
  slide,
  unifiedVisualSpec
}: ImageLayerGenerationContext) {
  return [
    request.prompt,
    "",
    "PPT context:",
    `- Slide title: ${slide.content.title}`,
    slide.content.subtitle ? `- Subtitle: ${slide.content.subtitle}` : "",
    `- Purpose: ${request.purpose}`,
    `- Visual notes: ${request.visualNotes}`,
    "",
    "Unified visual spec:",
    `- Theme: ${unifiedVisualSpec.themeName}`,
    `- Style: ${unifiedVisualSpec.visualStyle}`,
    `- Image style: ${unifiedVisualSpec.imageStyle}`,
    `- Typography: ${unifiedVisualSpec.typography}`,
    `- Palette: ${unifiedVisualSpec.colorPalette.join(", ")}`,
    "",
    "Constraints:",
    `- Avoid: ${request.negativePrompt}`,
    "- Keep the image clean enough for a professional presentation.",
    "- Do not add text unless the request explicitly asks for text."
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 32000);
}

async function readGeneratedImageBytes(image: {
  b64_json?: string;
  url?: string;
}) {
  if (image?.b64_json) {
    return Buffer.from(image.b64_json, "base64");
  }

  if (image?.url) {
    const response = await fetch(image.url);

    if (!response.ok) {
      throw new Error("Generated image URL could not be downloaded.");
    }

    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("Image generation response did not include image data.");
}

function normalizeColor(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value ?? "")
    ? value!
    : fallback;
}

function escapeXml(value: string) {
  return value
    .slice(0, 42)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}
