import {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateAssetSource,
  TemplateElementAssetKind,
  type Prisma
} from "@prisma/client";

import {
  templateElementAssetAiSearchSchema,
  templateElementAssetCreateSchema,
  templateElementAssetUpdateSchema,
  type TemplateElementAssetAiSearchInput,
  type TemplateElementAssetAiSearchPayload,
  type TemplateElementAssetCreateInput,
  type TemplateElementAssetCreatePayload,
  type TemplateElementAssetUpdateInput,
  type TemplateElementAssetUpdatePayload
} from "@/lib/admin/template-assets/schemas";
import type {
  TemplateAssetModifyPermissions,
  TemplateElementAssetAiResult,
  TemplateElementAssetDto
} from "@/lib/admin/template-assets/types";
import { prisma } from "@/lib/db/prisma";

type TemplateElementAssetRecord = {
  aiModifyPermissions: Prisma.JsonValue;
  backgroundModes: Prisma.JsonValue;
  colorTags: Prisma.JsonValue;
  createdAt: Date;
  description: string | null;
  id: string;
  isEnabled: boolean;
  kind: TemplateElementAssetKind;
  keywords: Prisma.JsonValue;
  name: string;
  pageTypes: Prisma.JsonValue;
  preview: Prisma.JsonValue;
  primaryCategory: string | null;
  resource: Prisma.JsonValue;
  reviewStatus: TemplateAssetReviewStatus;
  semanticTags: Prisma.JsonValue;
  secondaryCategory: string | null;
  setKey: string;
  setKind: TemplateAssetSetKind;
  setName: string;
  sortOrder: number;
  source: TemplateAssetSource;
  style: Prisma.JsonValue;
  styleTags: Prisma.JsonValue;
  synonyms: Prisma.JsonValue;
  tags: Prisma.JsonValue;
  updatedAt: Date;
  usageScenarios: Prisma.JsonValue;
  variantKey: string | null;
};

export class TemplateElementAssetNotFoundError extends Error {
  constructor(message = "Template element asset not found") {
    super(message);
    this.name = "TemplateElementAssetNotFoundError";
  }
}

export class TemplateElementAssetValidationError extends Error {
  constructor(message = "Template element asset is invalid") {
    super(message);
    this.name = "TemplateElementAssetValidationError";
  }
}

export function serializeTemplateElementAsset(
  asset: TemplateElementAssetRecord
): TemplateElementAssetDto {
  return {
    aiModifyPermissions: parseAiModifyPermissions(asset.aiModifyPermissions),
    backgroundModes: parseStringList(asset.backgroundModes),
    colorTags: parseStringList(asset.colorTags),
    createdAt: asset.createdAt.toISOString(),
    description: asset.description,
    id: asset.id,
    isEnabled: asset.isEnabled,
    kind: asset.kind,
    keywords: parseStringList(asset.keywords),
    name: asset.name,
    pageTypes: parseStringList(asset.pageTypes),
    preview: parseJsonObject(asset.preview),
    primaryCategory: asset.primaryCategory,
    resource: parseJsonObject(asset.resource),
    reviewStatus: asset.reviewStatus,
    semanticTags: parseStringList(asset.semanticTags),
    secondaryCategory: asset.secondaryCategory,
    setKey: asset.setKey,
    setKind: asset.setKind,
    setName: asset.setName,
    sortOrder: asset.sortOrder,
    source: asset.source,
    style: parseJsonObject(asset.style),
    styleTags: parseStringList(asset.styleTags),
    synonyms: parseStringList(asset.synonyms),
    tags: parseStringList(asset.tags),
    updatedAt: asset.updatedAt.toISOString(),
    usageScenarios: parseStringList(asset.usageScenarios),
    variantKey: asset.variantKey
  };
}

export async function listTemplateElementAssets({
  backgroundMode,
  includeDisabled = true,
  includeUnapproved = true,
  kind,
  pageType,
  primaryCategory,
  query,
  reviewStatus,
  secondaryCategory,
  setKey,
  setKind,
  styleTag,
  variantKey
}: {
  backgroundMode?: string;
  includeDisabled?: boolean;
  includeUnapproved?: boolean;
  kind?: TemplateElementAssetKind;
  pageType?: string;
  primaryCategory?: string;
  query?: string;
  reviewStatus?: TemplateAssetReviewStatus;
  secondaryCategory?: string;
  setKey?: string;
  setKind?: TemplateAssetSetKind;
  styleTag?: string;
  variantKey?: string;
} = {}) {
  const keyword = query?.trim();
  const needsJsonFilter = Boolean(backgroundMode || pageType || styleTag);
  const assets = await prisma.templateElementAsset.findMany({
    orderBy: [
      {
        kind: "asc"
      },
      {
        sortOrder: "asc"
      },
      {
        updatedAt: "desc"
      }
    ],
    where: {
      ...(kind ? { kind } : {}),
      ...(includeDisabled ? {} : { isEnabled: true }),
      ...(includeUnapproved || reviewStatus
        ? {}
        : { reviewStatus: TemplateAssetReviewStatus.APPROVED }),
      ...(primaryCategory ? { primaryCategory } : {}),
      ...(reviewStatus ? { reviewStatus } : {}),
      ...(secondaryCategory ? { secondaryCategory } : {}),
      ...(setKey ? { setKey } : {}),
      ...(setKind ? { setKind } : {}),
      ...(variantKey ? { variantKey } : {}),
      ...(keyword
        ? {
            OR: [
              {
                name: {
                  contains: keyword
                }
              },
              {
                description: {
                  contains: keyword
                }
              }
            ]
          }
        : {})
    }
  });
  const serializedAssets = assets.map(serializeTemplateElementAsset);

  const filteredAssets = needsJsonFilter
    ? serializedAssets.filter((asset) =>
        (!backgroundMode ||
          asset.backgroundModes.length === 0 ||
          asset.backgroundModes.includes(backgroundMode)) &&
        (!pageType ||
          asset.pageTypes.length === 0 ||
          asset.pageTypes.includes(pageType)) &&
        (!styleTag || asset.styleTags.includes(styleTag))
      )
    : serializedAssets;

  if (!keyword) {
    return filteredAssets;
  }

  const normalizedKeyword = keyword.toLowerCase();

  return filteredAssets.filter((asset) =>
    [
      asset.name,
      asset.description ?? "",
      ...asset.tags,
      ...asset.semanticTags,
      ...asset.keywords,
      ...asset.synonyms,
      ...asset.pageTypes,
      ...asset.usageScenarios,
      ...asset.styleTags,
      ...asset.colorTags,
      ...asset.backgroundModes
    ].some((value) => value.toLowerCase().includes(normalizedKeyword))
  );
}

export async function searchTemplateElementAssetsForAi(
  input: TemplateElementAssetAiSearchInput
): Promise<TemplateElementAssetAiResult[]> {
  const parsedInput: TemplateElementAssetAiSearchPayload =
    templateElementAssetAiSearchSchema.parse(input);
  const candidateSets = buildAiCandidateSetFilters(parsedInput.setKey);
  const allCandidates: TemplateElementAssetDto[] = [];

  for (const setFilter of candidateSets) {
    const assets = await listTemplateElementAssets({
      backgroundMode: parsedInput.backgroundMode,
      includeDisabled: false,
      includeUnapproved: false,
      kind: parsedInput.kind,
      pageType: parsedInput.pageType,
      setKey: setFilter.setKey,
      setKind: setFilter.setKind
    });

    allCandidates.push(...assets);

    if (setFilter.setKind === TemplateAssetSetKind.TEMPLATE && assets.length > 0) {
      break;
    }
  }

  return allCandidates
    .map((asset) => ({
      ...asset,
      matchScore: scoreTemplateElementAssetForAi(asset, parsedInput),
      usageSuggestion: buildUsageSuggestion(asset, parsedInput)
    }))
    .filter(
      (asset) =>
        asset.isEnabled &&
        asset.reviewStatus === TemplateAssetReviewStatus.APPROVED &&
        asset.matchScore > 0
    )
    .sort(
      (first, second) =>
        second.matchScore - first.matchScore ||
        first.sortOrder - second.sortOrder ||
        Date.parse(second.updatedAt) - Date.parse(first.updatedAt)
    )
    .slice(0, parsedInput.limit);
}

export async function getTemplateElementAsset(assetId: string) {
  const asset = await prisma.templateElementAsset.findUnique({
    where: {
      id: assetId
    }
  });

  if (!asset) {
    throw new TemplateElementAssetNotFoundError();
  }

  return serializeTemplateElementAsset(asset);
}

export async function createTemplateElementAsset(
  input: TemplateElementAssetCreateInput
) {
  const parsedInput: TemplateElementAssetCreatePayload =
    templateElementAssetCreateSchema.parse(input);
  const asset = await prisma.templateElementAsset.create({
    data: {
      aiModifyPermissions: toInputJson(parsedInput.aiModifyPermissions),
      backgroundModes: toInputJson(parsedInput.backgroundModes),
      colorTags: toInputJson(parsedInput.colorTags),
      description: parsedInput.description,
      isEnabled: parsedInput.isEnabled,
      kind: parsedInput.kind,
      keywords: toInputJson(parsedInput.keywords),
      name: parsedInput.name,
      pageTypes: toInputJson(parsedInput.pageTypes),
      preview: toInputJson(parsedInput.preview),
      primaryCategory: parsedInput.primaryCategory ?? null,
      resource: toInputJson(parsedInput.resource),
      reviewStatus: parsedInput.reviewStatus,
      semanticTags: toInputJson(parsedInput.semanticTags),
      secondaryCategory: parsedInput.secondaryCategory ?? null,
      setKey: parsedInput.setKey,
      setKind: parsedInput.setKind,
      setName: parsedInput.setName,
      sortOrder: parsedInput.sortOrder,
      source: parsedInput.source,
      style: toInputJson(parsedInput.style),
      styleTags: toInputJson(parsedInput.styleTags),
      synonyms: toInputJson(parsedInput.synonyms),
      tags: toInputJson(parsedInput.tags),
      usageScenarios: toInputJson(parsedInput.usageScenarios),
      variantKey: parsedInput.variantKey ?? null
    }
  });

  return serializeTemplateElementAsset(asset);
}

export async function updateTemplateElementAsset(
  assetId: string,
  input: TemplateElementAssetUpdateInput
) {
  const parsedInput: TemplateElementAssetUpdatePayload =
    templateElementAssetUpdateSchema.parse(input);

  const existingAsset = await assertTemplateElementAssetExists(assetId);

  if (parsedInput.aiModifyPermissions) {
    assertTypeSpecificAiModifyPermissions(
      parsedInput.kind ?? existingAsset.kind,
      parsedInput.aiModifyPermissions
    );
  }

  const data: Prisma.TemplateElementAssetUpdateInput = {};

  if (parsedInput.aiModifyPermissions !== undefined) {
    data.aiModifyPermissions = toInputJson(parsedInput.aiModifyPermissions);
  }

  if (parsedInput.backgroundModes !== undefined) {
    data.backgroundModes = toInputJson(parsedInput.backgroundModes);
  }

  if (parsedInput.colorTags !== undefined) {
    data.colorTags = toInputJson(parsedInput.colorTags);
  }

  if ("description" in parsedInput) {
    data.description = parsedInput.description;
  }

  if (parsedInput.isEnabled !== undefined) {
    data.isEnabled = parsedInput.isEnabled;
  }

  if (parsedInput.kind !== undefined) {
    data.kind = parsedInput.kind;
  }

  if (parsedInput.keywords !== undefined) {
    data.keywords = toInputJson(parsedInput.keywords);
  }

  if (parsedInput.name !== undefined) {
    data.name = parsedInput.name;
  }

  if (parsedInput.pageTypes !== undefined) {
    data.pageTypes = toInputJson(parsedInput.pageTypes);
  }

  if (parsedInput.preview !== undefined) {
    data.preview = toInputJson(parsedInput.preview);
  }

  if ("primaryCategory" in parsedInput) {
    data.primaryCategory = parsedInput.primaryCategory ?? null;
  }

  if (parsedInput.semanticTags !== undefined) {
    data.semanticTags = toInputJson(parsedInput.semanticTags);
  }

  if (parsedInput.resource !== undefined) {
    data.resource = toInputJson(parsedInput.resource);
  }

  if (parsedInput.reviewStatus !== undefined) {
    data.reviewStatus = parsedInput.reviewStatus;
  }

  if ("secondaryCategory" in parsedInput) {
    data.secondaryCategory = parsedInput.secondaryCategory ?? null;
  }

  if (parsedInput.setKey !== undefined) {
    data.setKey = parsedInput.setKey;
  }

  if (parsedInput.setKind !== undefined) {
    data.setKind = parsedInput.setKind;
  }

  if (parsedInput.setName !== undefined) {
    data.setName = parsedInput.setName;
  }

  if (parsedInput.sortOrder !== undefined) {
    data.sortOrder = parsedInput.sortOrder;
  }

  if (parsedInput.source !== undefined) {
    data.source = parsedInput.source;
  }

  if (parsedInput.style !== undefined) {
    data.style = toInputJson(parsedInput.style);
  }

  if (parsedInput.styleTags !== undefined) {
    data.styleTags = toInputJson(parsedInput.styleTags);
  }

  if (parsedInput.synonyms !== undefined) {
    data.synonyms = toInputJson(parsedInput.synonyms);
  }

  if (parsedInput.tags !== undefined) {
    data.tags = toInputJson(parsedInput.tags);
  }

  if (parsedInput.usageScenarios !== undefined) {
    data.usageScenarios = toInputJson(parsedInput.usageScenarios);
  }

  if ("variantKey" in parsedInput) {
    data.variantKey = parsedInput.variantKey ?? null;
  }

  const asset = await prisma.templateElementAsset.update({
    data,
    where: {
      id: assetId
    }
  });

  return serializeTemplateElementAsset(asset);
}

export async function deleteTemplateElementAsset(assetId: string) {
  const result = await prisma.templateElementAsset.deleteMany({
    where: {
      id: assetId
    }
  });

  if (result.count === 0) {
    throw new TemplateElementAssetNotFoundError();
  }
}

async function assertTemplateElementAssetExists(assetId: string) {
  const asset = await prisma.templateElementAsset.findUnique({
    where: {
      id: assetId
    }
  });

  if (!asset) {
    throw new TemplateElementAssetNotFoundError();
  }

  return asset;
}

function parseStringList(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseAiModifyPermissions(
  value: Prisma.JsonValue
): TemplateAssetModifyPermissions {
  const permissions = parseJsonObject(value);

  return {
    allowAutoLayout: readBoolean(permissions.allowAutoLayout, false),
    allowMove: readBoolean(permissions.allowMove, true),
    allowRecolor: readBoolean(permissions.allowRecolor, true),
    allowResize: readBoolean(permissions.allowResize, true),
    allowStretch: readBoolean(permissions.allowStretch, false),
    allowTextShrink: readBoolean(permissions.allowTextShrink, false)
  };
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function assertTypeSpecificAiModifyPermissions(
  kind: TemplateElementAssetKind,
  permissions: TemplateAssetModifyPermissions
) {
  if (
    kind === TemplateElementAssetKind.TEXT_STYLE &&
    permissions.allowStretch
  ) {
    throw new TemplateElementAssetValidationError(
      "Text style assets cannot allow stretch"
    );
  }

  if (kind === TemplateElementAssetKind.LINE && permissions.allowTextShrink) {
    throw new TemplateElementAssetValidationError(
      "Line assets cannot allow text shrink"
    );
  }
}

function buildAiCandidateSetFilters(setKey?: string) {
  return [
    ...(setKey
      ? [
          {
            setKey,
            setKind: TemplateAssetSetKind.TEMPLATE
          }
        ]
      : []),
    {
      setKey: "common",
      setKind: TemplateAssetSetKind.COMMON
    }
  ];
}

function scoreTemplateElementAssetForAi(
  asset: TemplateElementAssetDto,
  input: TemplateElementAssetAiSearchPayload
) {
  let score = asset.setKind === TemplateAssetSetKind.TEMPLATE ? 30 : 10;
  const requestedTerms = uniqueLowercase([
    input.pageSemantic,
    input.pageType,
    ...input.semanticTags,
    ...input.styleTags
  ]);
  const semanticTerms = uniqueLowercase([
    asset.primaryCategory ?? "",
    asset.secondaryCategory ?? "",
    asset.variantKey ?? "",
    ...asset.semanticTags,
    ...asset.keywords,
    ...asset.synonyms
  ]);
  const styleTerms = uniqueLowercase([
    ...asset.tags,
    ...asset.styleTags,
    ...asset.colorTags
  ]);

  for (const term of requestedTerms) {
    if (semanticTerms.some((candidate) => candidate.includes(term))) {
      score += 18;
    } else if (styleTerms.some((candidate) => candidate.includes(term))) {
      score += 8;
    } else if (asset.usageScenarios.some((item) => includesTerm(item, term))) {
      score += 5;
    }
  }

  if (input.pageType && asset.pageTypes.includes(input.pageType)) {
    score += 12;
  }

  if (
    input.backgroundMode &&
    asset.backgroundModes.includes(input.backgroundMode)
  ) {
    score += 6;
  }

  score += Math.max(0, 100000 - asset.sortOrder) / 100000;

  return Number(score.toFixed(4));
}

function buildUsageSuggestion(
  asset: TemplateElementAssetDto,
  input: TemplateElementAssetAiSearchPayload
) {
  const pageTypeText = input.pageType ? `用于 ${input.pageType} 页面` : "用于当前页面";
  const semanticText =
    asset.semanticTags.length > 0 ? `匹配 ${asset.semanticTags.join("、")}` : "按语义匹配";

  return `${pageTypeText}，${semanticText}，遵循资源修改权限。`;
}

function includesTerm(value: string, term: string) {
  return value.toLowerCase().includes(term);
}

function uniqueLowercase(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase() ?? "")
        .filter(Boolean)
    )
  );
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
