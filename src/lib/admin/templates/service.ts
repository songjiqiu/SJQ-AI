import { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ZodError } from "zod";

import {
  getPptTemplateCategoryQueryValues,
  normalizePptTemplateCategoryId,
  pptTemplateCategoryIds,
  type PptTemplateCategoryId
} from "@/lib/admin/templates/categories";
import { buildDefaultTemplateSlide } from "@/lib/admin/templates/defaults";
import {
  pptTemplateCreateSchema,
  PptTemplateCreateInput,
  PptTemplateUpdateInput
} from "@/lib/admin/templates/schemas";
import type { PptTemplateDto } from "@/lib/admin/templates/types";
import {
  type AnalyzeDeckRequest,
  type SemanticSlidePlan,
  slideCompositionPlanSchema,
  type SlideCompositionPlan,
  type UnifiedVisualSpec
} from "@/lib/ai-deck/schema";
import { prisma } from "@/lib/db/prisma";
import { isMissingPrismaModelStorageError } from "@/lib/db/prisma-errors";

const universalTemplatePackageDir = path.join(
  process.cwd(),
  "assets",
  "templates",
  "universal-v1"
);
const universalTemplateManifestVersion = "ppt-template-manifest-v1";

export class PptTemplateNotFoundError extends Error {
  constructor(message = "PPT template not found") {
    super(message);
    this.name = "PptTemplateNotFoundError";
  }
}

export class PptTemplatePackageImportError extends Error {
  constructor(message = "PPT template package import failed") {
    super(message);
    this.name = "PptTemplatePackageImportError";
  }
}

export const legacyPptTemplateSlideCompatibilityWarning =
  "Template slide JSON is incompatible with the current schema and was loaded from the category default.";

type PptTemplateRecord = {
  category: string;
  createdAt: Date;
  customCategoryKey: string | null;
  customCategoryName: string | null;
  description: string | null;
  id: string;
  isEnabled: boolean;
  name: string;
  slide: unknown;
  sortOrder: number;
  tags: unknown;
  updatedAt: Date;
};

type UniversalTemplateManifest = {
  formatVersion: string;
  packageId: string;
  templateCount: number;
  templates: Array<{
    category: string;
    file: string;
    id: string;
    name: string;
    sortOrder: number;
    style: string;
    styleName: string;
  }>;
};

export function serializePptTemplate(
  template: PptTemplateRecord
): PptTemplateDto {
  const category = normalizePptTemplateCategoryId(template.category);

  if (!category) {
    throw new PptTemplateNotFoundError("Unsupported PPT template category");
  }

  const slideResult = normalizeStoredSlideForCategory(template.slide, category);

  return {
    category,
    ...(slideResult.warning
      ? { compatibilityWarning: slideResult.warning }
      : {}),
    createdAt: template.createdAt.toISOString(),
    customCategoryKey: template.customCategoryKey,
    customCategoryName: template.customCategoryName,
    description: template.description,
    id: template.id,
    isEnabled: template.isEnabled,
    name: template.name,
    slide: slideResult.slide,
    sortOrder: template.sortOrder,
    tags: parseTags(template.tags),
    updatedAt: template.updatedAt.toISOString()
  };
}

export async function listPptTemplates({
  category,
  includeDisabled = true
}: {
  category?: PptTemplateCategoryId;
  includeDisabled?: boolean;
} = {}) {
  const templates = await prisma.pptTemplate.findMany({
    where: {
      ...(category
        ? { category: { in: getPptTemplateCategoryQueryValues(category) } }
        : {}),
      ...(includeDisabled ? {} : { isEnabled: true })
    },
    orderBy: [
      {
        category: "asc"
      },
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });

  return templates.map(serializePptTemplate);
}

export async function selectPptTemplateForSlide({
  input,
  semanticPlan,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  semanticPlan: SemanticSlidePlan;
  unifiedVisualSpec: UnifiedVisualSpec;
}): Promise<PptTemplateDto | null> {
  const categories = getTemplateCandidateCategories(semanticPlan);

  if (categories.length === 0) {
    return null;
  }

  try {
    const templates = await listPptTemplates({
      includeDisabled: false
    });
    const candidates = templates.filter((template) =>
      categories.includes(template.category)
    );

    if (candidates.length === 0) {
      return null;
    }

    return candidates
      .map((template) => ({
        score: scoreTemplateForSlide(template, {
          categories,
          input,
          semanticPlan,
          unifiedVisualSpec
        }),
        template
      }))
      .sort(
        (first, second) =>
          second.score - first.score ||
          first.template.sortOrder - second.template.sortOrder ||
          Date.parse(first.template.createdAt) - Date.parse(second.template.createdAt)
      )[0]?.template ?? null;
  } catch (error) {
    if (isMissingPrismaModelStorageError(error, "PptTemplate")) {
      return null;
    }

    throw error;
  }
}

export async function getPptTemplate(templateId: string) {
  const template = await prisma.pptTemplate.findUnique({
    where: {
      id: templateId
    }
  });

  if (!template) {
    throw new PptTemplateNotFoundError();
  }

  return serializePptTemplate(template);
}

export async function createPptTemplate(input: PptTemplateCreateInput) {
  const category = input.category;
  const slide = normalizeSlideForCategory(
    input.slide ?? buildDefaultTemplateSlide(category),
    category
  );
  const template = await prisma.pptTemplate.create({
    data: {
      category,
      customCategoryKey: input.customCategoryKey ?? null,
      customCategoryName: input.customCategoryName ?? null,
      description: input.description ?? null,
      isEnabled: input.isEnabled,
      name: input.name,
      slide: toInputJson(slide),
      sortOrder: input.sortOrder,
      tags: toInputJson(input.tags)
    }
  });

  return serializePptTemplate(template);
}

export async function updatePptTemplate(
  templateId: string,
  input: PptTemplateUpdateInput
) {
  const existingTemplate = await assertPptTemplateExists(templateId);
  const existingCategory = normalizePptTemplateCategoryId(
    existingTemplate.category
  );
  const category = input.category ?? existingCategory;

  const data: Prisma.PptTemplateUpdateInput = {};

  if (input.category !== undefined) {
    data.category = input.category;
  } else if (existingCategory) {
    data.category = existingCategory;
  }

  if (input.customCategoryKey !== undefined) {
    data.customCategoryKey = input.customCategoryKey ?? null;
  }

  if (input.customCategoryName !== undefined) {
    data.customCategoryName = input.customCategoryName ?? null;
  }

  if (input.description !== undefined) {
    data.description = input.description ?? null;
  }

  if (input.isEnabled !== undefined) {
    data.isEnabled = input.isEnabled;
  }

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.slide !== undefined) {
    data.slide = toInputJson(
      category
        ? normalizeSlideForCategory(input.slide, category)
        : normalizeSlide(input.slide)
    );
  }

  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder;
  }

  if (input.tags !== undefined) {
    data.tags = toInputJson(input.tags);
  }

  const template = await prisma.pptTemplate.update({
    where: {
      id: templateId
    },
    data
  });

  return serializePptTemplate(template);
}

export async function deletePptTemplate(templateId: string) {
  const result = await prisma.pptTemplate.deleteMany({
    where: {
      id: templateId
    }
  });

  if (result.count === 0) {
    throw new PptTemplateNotFoundError();
  }
}

export async function importUniversalPptTemplatesV1() {
  const templates = await readUniversalTemplatePackage();

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.pptTemplate.deleteMany({
      where: {
        category: {
          in: [...pptTemplateCategoryIds]
        }
      }
    });

    const createdTemplates: PptTemplateDto[] = [];

    for (const input of templates) {
      const slide = normalizeSlideForCategory(input.slide, input.category);
      const template = await tx.pptTemplate.create({
        data: {
          category: input.category,
          customCategoryKey: input.customCategoryKey ?? null,
          customCategoryName: input.customCategoryName ?? null,
          description: input.description ?? null,
          isEnabled: input.isEnabled,
          name: input.name,
          slide: toInputJson(slide),
          sortOrder: input.sortOrder,
          tags: toInputJson(input.tags)
        }
      });

      createdTemplates.push(serializePptTemplate(template));
    }

    const latestTemplates = await tx.pptTemplate.findMany({
      orderBy: [
        {
          category: "asc"
        },
        {
          sortOrder: "asc"
        },
        {
          createdAt: "asc"
        }
      ]
    });

    return {
      createdCount: createdTemplates.length,
      deletedCount: deleted.count,
      templates: latestTemplates.map(serializePptTemplate)
    };
  });
}

function normalizeSlide(slide: SlideCompositionPlan) {
  return slideCompositionPlanSchema.parse(slide);
}

function normalizeSlideForCategory(
  slide: unknown,
  category: PptTemplateCategoryId
) {
  const normalizedSlide = slideCompositionPlanSchema.parse(slide);
  const layoutTemplate = normalizePptTemplateCategoryId(
    normalizedSlide.designPlan.layoutTemplate
  );

  if (layoutTemplate) {
    return {
      ...normalizedSlide,
      designPlan: {
        ...normalizedSlide.designPlan,
        layoutTemplate: category
      }
    };
  }

  return normalizedSlide;
}

function normalizeStoredSlideForCategory(
  slide: unknown,
  category: PptTemplateCategoryId
) {
  try {
    return {
      slide: normalizeSlideForCategory(slide, category)
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        slide: buildDefaultTemplateSlide(category),
        warning: legacyPptTemplateSlideCompatibilityWarning
      };
    }

    throw error;
  }
}

async function assertPptTemplateExists(templateId: string) {
  const template = await prisma.pptTemplate.findUnique({
    where: {
      id: templateId
    },
    select: {
      category: true
    }
  });

  if (!template) {
    throw new PptTemplateNotFoundError();
  }

  return template;
}

function parseTags(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getTemplateCandidateCategories(semanticPlan: SemanticSlidePlan) {
  return Array.from(
    new Set([
      semanticPlan.layoutSelection.selectedLayoutType,
      ...semanticPlan.layoutSelection.candidates
        .sort((first, second) => second.score - first.score)
        .map((candidate) => candidate.layoutType)
    ])
  );
}

function scoreTemplateForSlide(
  template: PptTemplateDto,
  {
    categories,
    input,
    semanticPlan,
    unifiedVisualSpec
  }: {
    categories: PptTemplateCategoryId[];
    input: AnalyzeDeckRequest;
    semanticPlan: SemanticSlidePlan;
    unifiedVisualSpec: UnifiedVisualSpec;
  }
) {
  const categoryIndex = categories.indexOf(template.category);
  const preferredStyle = getPreferredTemplateStyle(input.deckType);
  const haystack = normalizeSearchTerms([
    template.name,
    template.description ?? "",
    template.category,
    template.slide.pageIntent.pageRole,
    template.slide.pageIntent.contentDensity,
    template.slide.designPlan.visualStrategy,
    ...template.tags,
    ...unifiedVisualSpec.pptTypeVisualTone.visualKeywords,
    unifiedVisualSpec.pptTypeVisualTone.recommendedTone,
    semanticPlan.pageIntent.pageRole,
    semanticPlan.pageIntent.contentDensity,
    semanticPlan.pageIntent.primaryGoal,
    semanticPlan.pageIntent.coreMessage
  ]);
  const semanticTerms = normalizeSearchTerms([
    semanticPlan.content.title,
    semanticPlan.content.visualIntent,
    semanticPlan.pageIntent.coreMessage,
    semanticPlan.pageIntent.pageRole,
    semanticPlan.pageIntent.contentDensity,
    ...semanticPlan.content.bodyPoints,
    ...unifiedVisualSpec.pptTypeVisualTone.visualKeywords,
    unifiedVisualSpec.pptTypeVisualTone.recommendedTone
  ]);
  let score = Math.max(0, 120 - Math.max(0, categoryIndex) * 24);

  if (template.category === semanticPlan.layoutSelection.selectedLayoutType) {
    score += 36;
  }

  if (preferredStyle && haystack.includes(preferredStyle.toLowerCase())) {
    score += 34;
  }

  if (template.slide.pageIntent.pageRole === semanticPlan.pageIntent.pageRole) {
    score += 16;
  }

  if (
    template.slide.pageIntent.contentDensity ===
    semanticPlan.pageIntent.contentDensity
  ) {
    score += 10;
  }

  for (const term of semanticTerms) {
    if (term.length >= 2 && haystack.includes(term)) {
      score += 4;
    }
  }

  score += Math.max(0, 100000 - template.sortOrder) / 100000;

  return Number(score.toFixed(4));
}

function getPreferredTemplateStyle(deckType: AnalyzeDeckRequest["deckType"]) {
  if (
    deckType === "product-launch" ||
    deckType === "fundraising-pitch" ||
    deckType === "growth-experiment" ||
    deckType === "industry-insight"
  ) {
    return "AI 科技感";
  }

  if (
    deckType === "research-report" ||
    deckType === "data-analysis" ||
    deckType === "personal-review" ||
    deckType === "portfolio"
  ) {
    return "极简咨询风";
  }

  return "中国商务通用";
}

function normalizeSearchTerms(values: string[]) {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

async function readUniversalTemplatePackage() {
  const manifest = await readJsonFile<UniversalTemplateManifest>(
    path.join(universalTemplatePackageDir, "manifest.json")
  );

  if (
    manifest.formatVersion !== universalTemplateManifestVersion ||
    manifest.packageId !== "universal-v1" ||
    manifest.templateCount !== 45 ||
    manifest.templates.length !== 45
  ) {
    throw new PptTemplatePackageImportError("Invalid universal template manifest");
  }

  return Promise.all(
    manifest.templates.map(async (item) => {
      const normalizedFile = item.file.replaceAll("\\", "/");
      const expectedPrefix = "assets/templates/universal-v1/";

      if (!normalizedFile.startsWith(expectedPrefix)) {
        throw new PptTemplatePackageImportError(
          `Unexpected template path: ${item.file}`
        );
      }

      const packageRelativeFile = normalizedFile.slice(expectedPrefix.length);

      if (
        !packageRelativeFile ||
        packageRelativeFile.split("/").some((segment) => !segment || segment === "..")
      ) {
        throw new PptTemplatePackageImportError(
          `Unexpected template path: ${item.file}`
        );
      }

      const filePath = path.join(
        universalTemplatePackageDir,
        ...packageRelativeFile.split("/")
      );
      const template = await readJsonFile<unknown>(filePath);
      const input = pptTemplateCreateSchema.parse(
        isRecord(template)
          ? Object.fromEntries(
              Object.entries(template).filter(([key]) => key !== "formatVersion")
            )
          : template
      );

      if (
        input.category !== item.category ||
        input.name !== item.name ||
        input.sortOrder !== item.sortOrder ||
        input.slide?.slideId !== item.id
      ) {
        throw new PptTemplatePackageImportError(
          `Manifest entry does not match template file: ${item.file}`
        );
      }

      return input;
    })
  );
}

async function readJsonFile<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
