import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  ingestPptxFile,
  PptToSlotValidationError,
  type PptToSlotUploadedFile
} from "@/lib/admin/ppt-to-slot/ingest";
import { analyzeSlideLayout } from "@/lib/admin/ppt-to-slot/layout-analyzer";
import { enhanceSlotSemantics } from "@/lib/admin/ppt-to-slot/llm";
import { renderPptSlotOverlay } from "@/lib/admin/ppt-to-slot/overlay-renderer";
import { parsePptxSlides } from "@/lib/admin/ppt-to-slot/parser";
import {
  pptSlotTemplateUpdateSchema,
  pptToSlotArtifactKindSchema
} from "@/lib/admin/ppt-to-slot/schemas";
import { abstractSlideToSlotTemplate } from "@/lib/admin/ppt-to-slot/slot-abstractor";
import {
  readPptToSlotArtifact,
  writePptToSlotArtifact
} from "@/lib/admin/ppt-to-slot/storage";
import {
  stringifyArtifactJson,
  validatePptSlotTemplateJson
} from "@/lib/admin/ppt-to-slot/template-exporter";
import type {
  PptSlotTemplateDto,
  PptSlotTemplateJson,
  PptToSlotArtifactKind,
  PptToSlotArtifactPaths
} from "@/lib/admin/ppt-to-slot/types";
import { getUserDefaultAiEnv } from "@/lib/ai-config/service";
import { prisma } from "@/lib/db/prisma";

export class PptSlotTemplateNotFoundError extends Error {
  constructor(message = "PPT Slot template not found") {
    super(message);
    this.name = "PptSlotTemplateNotFoundError";
  }
}

type PptSlotTemplateRecord = Prisma.PptSlotTemplateGetPayload<Record<string, never>>;

export async function listPptSlotTemplates() {
  const templates = await prisma.pptSlotTemplate.findMany({
    orderBy: [
      {
        createdAt: "desc"
      }
    ]
  });

  return templates.map(serializePptSlotTemplate);
}

export async function getPptSlotTemplate(templateId: string) {
  const template = await prisma.pptSlotTemplate.findUnique({
    where: {
      id: templateId
    }
  });

  if (!template) {
    throw new PptSlotTemplateNotFoundError();
  }

  return serializePptSlotTemplate(template);
}

export async function createPptToSlotJob({
  file,
  userId
}: {
  file: PptToSlotUploadedFile;
  userId: string;
}) {
  const { sourceFile, zip } = await ingestPptxFile(file);
  const jobId = `tpl_extract_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${randomUUID().slice(0, 8)}`;
  const warnings: string[] = [];
  const slides = await parsePptxSlides(zip);

  await writePptToSlotArtifact({
    bytes: file.bytes,
    filename: sourceFile,
    jobId
  });

  const env = await getUserDefaultAiEnv(userId);
  const templates: PptSlotTemplateDto[] = [];

  for (const slide of slides) {
    const analysis = analyzeSlideLayout(slide);
    const enhancementResult = await enhanceSlotSemantics({
      analysis,
      env,
      slide
    });

    if (enhancementResult.warning) {
      warnings.push(`第 ${slide.slideIndex} 页：${enhancementResult.warning}`);
    }

    const templateJson = validatePptSlotTemplateJson(
      abstractSlideToSlotTemplate({
        analysis,
        enhancement: enhancementResult.enhancement,
        slide,
        sourceFile
      })
    );
    const overlay = await renderOverlayOrThrow({
      analysis,
      slide,
      template: templateJson
    });
    const artifactPaths = await writeTemplateArtifacts({
      analysis,
      jobId,
      overlay,
      slide,
      templateJson
    });

    const template = await prisma.pptSlotTemplate.create({
      data: {
        alignmentLines: toInputJson(templateJson.alignmentLines),
        artifactPaths: toInputJson(artifactPaths),
        canvas: toInputJson(templateJson.canvas),
        description: templateJson.usage.suitableFor.join("；"),
        isEnabled: false,
        layoutPattern: templateJson.layoutPattern,
        name: templateJson.name,
        overlayPath: artifactPaths.overlay,
        pageTypes: toInputJson(templateJson.pageTypes),
        reviewStatus: "PENDING_REVIEW",
        rules: toInputJson(templateJson.rules),
        safeArea: toInputJson(templateJson.safeArea),
        slots: toInputJson(templateJson.slots),
        sourceFile,
        sourceSlideIndex: slide.slideIndex,
        styleTokens: toInputJson(templateJson.styleTokens),
        usage: toInputJson(templateJson.usage)
      }
    });

    templates.push(serializePptSlotTemplate(template));
  }

  return {
    jobId,
    templates,
    warnings
  };
}

async function renderOverlayOrThrow({
  analysis,
  slide,
  template
}: {
  analysis: Parameters<typeof renderPptSlotOverlay>[0]["analysis"];
  slide: Parameters<typeof renderPptSlotOverlay>[0]["slide"];
  template: Parameters<typeof renderPptSlotOverlay>[0]["template"];
}) {
  try {
    return await renderPptSlotOverlay({
      analysis,
      slide,
      template
    });
  } catch (error) {
    if (isCanvasNativeBindingError(error)) {
      throw new PptToSlotValidationError(
        "The PPT--To--Slot overlay renderer is unavailable. Run pnpm install and restart the dev server.",
        {
          message:
            "缺少 @napi-rs/canvas 原生依赖，请运行 pnpm install 后重启开发服务。",
          package: "@napi-rs/canvas"
        }
      );
    }

    throw error;
  }
}

function isCanvasNativeBindingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("@napi-rs/canvas") ||
    message.includes("Cannot find native binding") ||
    message.includes("Failed to load native binding")
  );
}

export async function updatePptSlotTemplate(templateId: string, input: unknown) {
  const data = pptSlotTemplateUpdateSchema.parse(input);
  const existing = await prisma.pptSlotTemplate.findUnique({
    where: {
      id: templateId
    }
  });

  if (!existing) {
    throw new PptSlotTemplateNotFoundError();
  }

  const template = await prisma.pptSlotTemplate.update({
    data: toPrismaUpdateData(data),
    where: {
      id: templateId
    }
  });

  return serializePptSlotTemplate(template);
}

function toPrismaUpdateData(
  data: ReturnType<typeof pptSlotTemplateUpdateSchema.parse>
): Prisma.PptSlotTemplateUpdateInput {
  return {
    ...(data.alignmentLines
      ? { alignmentLines: toInputJson(data.alignmentLines) }
      : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    ...(data.layoutPattern !== undefined
      ? { layoutPattern: data.layoutPattern }
      : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.pageTypes ? { pageTypes: toInputJson(data.pageTypes) } : {}),
    ...(data.reviewNotes !== undefined ? { reviewNotes: data.reviewNotes } : {}),
    ...(data.reviewStatus !== undefined ? { reviewStatus: data.reviewStatus } : {}),
    ...(data.rules ? { rules: toInputJson(data.rules) } : {}),
    ...(data.safeArea ? { safeArea: toInputJson(data.safeArea) } : {}),
    ...(data.slots ? { slots: toInputJson(data.slots) } : {}),
    ...(data.styleTokens ? { styleTokens: toInputJson(data.styleTokens) } : {}),
    ...(data.usage ? { usage: toInputJson(data.usage) } : {})
  };
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function readPptSlotTemplateArtifact({
  kind,
  templateId
}: {
  kind: string;
  templateId: string;
}) {
  const normalizedKind = pptToSlotArtifactKindSchema.parse(kind);
  const template = await getPptSlotTemplate(templateId);
  const relativePath = template.artifactPaths[normalizedKind];
  const file = await readPptToSlotArtifact(relativePath);

  if (!file) {
    throw new PptSlotTemplateNotFoundError("PPT Slot artifact not found");
  }

  return {
    ...file,
    contentType: artifactContentType(normalizedKind),
    filename: artifactFilename(normalizedKind)
  };
}

async function writeTemplateArtifacts({
  analysis,
  jobId,
  overlay,
  slide,
  templateJson
}: {
  analysis: unknown;
  jobId: string;
  overlay: Uint8Array;
  slide: unknown;
  templateJson: PptSlotTemplateJson;
}): Promise<PptToSlotArtifactPaths> {
  const slidePrefix = `slide-${String(templateJson.source.slideIndex).padStart(3, "0")}`;
  const [template, rawLayers, layoutCandidates, overlayFile, reviewReport] =
    await Promise.all([
      writePptToSlotArtifact({
        bytes: stringifyArtifactJson(templateJson),
        filename: `${slidePrefix}-template.json`,
        jobId
      }),
      writePptToSlotArtifact({
        bytes: stringifyArtifactJson(slide),
        filename: `${slidePrefix}-raw_layers.json`,
        jobId
      }),
      writePptToSlotArtifact({
        bytes: stringifyArtifactJson(analysis),
        filename: `${slidePrefix}-layout_candidates.json`,
        jobId
      }),
      writePptToSlotArtifact({
        bytes: overlay,
        filename: `${slidePrefix}-overlay.png`,
        jobId
      }),
      writePptToSlotArtifact({
        bytes: buildReviewReport(templateJson),
        filename: `${slidePrefix}-review_report.md`,
        jobId
      })
    ]);

  return {
    layoutCandidates: layoutCandidates.relativePath,
    overlay: overlayFile.relativePath,
    rawLayers: rawLayers.relativePath,
    reviewReport: reviewReport.relativePath,
    template: template.relativePath
  };
}

function buildReviewReport(template: PptSlotTemplateJson) {
  return `# PPT--To--Slot 人工确认报告

- 模板：${template.name}
- 来源文件：${template.source.file}
- 来源页码：${template.source.slideIndex}
- 页面类型：${template.pageTypes.join(", ")}
- 版式模式：${template.layoutPattern}

## Slot 清单

${Object.values(template.slots)
  .map(
    (slot) =>
      `- ${slot.id}: roles=${slot.roles.join(", ")}, frame=(${slot.frame.x}, ${slot.frame.y}, ${slot.frame.w}, ${slot.frame.h})`
  )
  .join("\n")}

## 检查项

- 页面类型是否正确
- Slot 命名是否正确
- header / main / footer 是否识别正确
- 图表区、图片区、表格区是否完整
- 卡片组是否被正确合并
- 装饰元素是否被误识别为内容区
- 安全边距是否合理
- 长标题是否有足够空间
- 内容密度是否合理
- 是否需要新增 Sequence Slot
`;
}

function serializePptSlotTemplate(
  template: PptSlotTemplateRecord
): PptSlotTemplateDto {
  return {
    alignmentLines: template.alignmentLines as PptSlotTemplateDto["alignmentLines"],
    artifactPaths: template.artifactPaths as PptToSlotArtifactPaths,
    canvas: template.canvas as PptSlotTemplateDto["canvas"],
    createdAt: template.createdAt.toISOString(),
    description: template.description,
    id: template.id,
    isEnabled: template.isEnabled,
    layoutPattern: template.layoutPattern,
    name: template.name,
    overlayPath: template.overlayPath,
    pageTypes: template.pageTypes as string[],
    reviewNotes: template.reviewNotes,
    reviewStatus: template.reviewStatus,
    rules: template.rules as Record<string, unknown>,
    safeArea: template.safeArea as PptSlotTemplateDto["safeArea"],
    slots: template.slots as PptSlotTemplateDto["slots"],
    sourceFile: template.sourceFile,
    sourceSlideIndex: template.sourceSlideIndex,
    styleTokens: template.styleTokens as Record<string, unknown>,
    updatedAt: template.updatedAt.toISOString(),
    usage: template.usage as PptSlotTemplateDto["usage"]
  };
}

function artifactContentType(kind: PptToSlotArtifactKind) {
  if (kind === "overlay") {
    return "image/png";
  }

  if (kind === "reviewReport") {
    return "text/markdown; charset=utf-8";
  }

  return "application/json; charset=utf-8";
}

function artifactFilename(kind: PptToSlotArtifactKind) {
  const names: Record<PptToSlotArtifactKind, string> = {
    layoutCandidates: "layout_candidates.json",
    overlay: "overlay.png",
    rawLayers: "raw_layers.json",
    reviewReport: "review_report.md",
    template: "template.json"
  };

  return names[kind];
}

export { PptToSlotValidationError };
