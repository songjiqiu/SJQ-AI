import {
  TemplateAssetReviewStatus,
  TemplateAssetSetKind,
  TemplateElementAssetKind,
  type Prisma
} from "@prisma/client";

import {
  buildDefaultAiModifyPermissions,
  buildDetailFromLegacyFields,
  parseDetailForKind,
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
  TemplateAssetAiResult,
  TemplateAssetDetail,
  TemplateAssetDto,
  TemplateAssetModifyPermissions,
  TemplateContainerAssetDetail,
  TemplateIconAssetDetail,
  TemplateLineAssetDetail,
  TemplateNavigationAssetDetail,
  TemplateShapeAssetDetail,
  TemplateTextStyleAssetDetail
} from "@/lib/admin/template-assets/types";
import { prisma } from "@/lib/db/prisma";

type DetailModelName =
  | "templateContainerAsset"
  | "templateIconAsset"
  | "templateLineAsset"
  | "templateNavigationAsset"
  | "templateShapeAsset"
  | "templateTextStyleAsset";

type TemplateAssetWithDetails = Prisma.TemplateAssetGetPayload<{
  include: typeof templateAssetDetailInclude;
}>;

const templateAssetDetailInclude = {
  container: true,
  icon: true,
  line: true,
  navigation: true,
  shape: true,
  textStyle: true
} satisfies Prisma.TemplateAssetInclude;

const detailModelByKind: Record<TemplateElementAssetKind, DetailModelName> = {
  [TemplateElementAssetKind.CONTAINER]: "templateContainerAsset",
  [TemplateElementAssetKind.ICON]: "templateIconAsset",
  [TemplateElementAssetKind.LINE]: "templateLineAsset",
  [TemplateElementAssetKind.NAVIGATION]: "templateNavigationAsset",
  [TemplateElementAssetKind.SHAPE]: "templateShapeAsset",
  [TemplateElementAssetKind.TEXT_STYLE]: "templateTextStyleAsset"
};

export class TemplateAssetNotFoundError extends Error {
  constructor(message = "Template asset not found") {
    super(message);
    this.name = "TemplateAssetNotFoundError";
  }
}

export class TemplateAssetValidationError extends Error {
  constructor(message = "Template asset is invalid") {
    super(message);
    this.name = "TemplateAssetValidationError";
  }
}

export class TemplateElementAssetNotFoundError extends TemplateAssetNotFoundError {
  constructor(message = "Template asset not found") {
    super(message);
    this.name = "TemplateElementAssetNotFoundError";
  }
}

export class TemplateElementAssetValidationError extends TemplateAssetValidationError {
  constructor(message = "Template asset is invalid") {
    super(message);
    this.name = "TemplateElementAssetValidationError";
  }
}

export function serializeTemplateAsset(
  asset: TemplateAssetWithDetails
): TemplateAssetDto {
  const detail = serializeDetail(asset);
  const style = buildStyleFromDetail(asset.kind, detail);
  const resource = buildResourceFromDetail(asset.kind, detail, asset);

  return {
    aiModifyPermissions: parseAiModifyPermissions(asset.aiModifyPermissions),
    backgroundModes: parseStringList(asset.backgroundModes),
    colorTags: parseStringList(asset.colorTags),
    createdAt: asset.createdAt.toISOString(),
    description: asset.description,
    detail,
    id: asset.id,
    isEnabled: asset.isEnabled,
    keywords: parseStringList(asset.keywords),
    kind: asset.kind,
    name: asset.name,
    pageTypes: parseStringList(asset.pageTypes),
    preview: parseJsonObject(asset.preview),
    primaryCategory: asset.primaryCategory,
    resource,
    reviewStatus: asset.reviewStatus,
    secondaryCategory: asset.secondaryCategory,
    semanticTags: parseStringList(asset.semanticTags),
    setKey: asset.setKey,
    setKind: asset.setKind,
    setName: asset.setName,
    sortOrder: asset.sortOrder,
    source: asset.source,
    style,
    styleTags: parseStringList(asset.styleTags),
    synonyms: parseStringList(asset.synonyms),
    tags: parseStringList(asset.tags),
    updatedAt: asset.updatedAt.toISOString(),
    usageScenarios: parseStringList(asset.usageScenarios),
    variantKey: asset.variantKey
  };
}

export async function listTemplateAssetsByKind(
  kind: TemplateElementAssetKind,
  filters: {
    backgroundMode?: string;
    includeDisabled?: boolean;
    includeUnapproved?: boolean;
    pageType?: string;
    primaryCategory?: string;
    query?: string;
    reviewStatus?: TemplateAssetReviewStatus;
    secondaryCategory?: string;
    setKey?: string;
    setKind?: TemplateAssetSetKind;
    styleTag?: string;
    variantKey?: string;
  } = {}
) {
  const {
    backgroundMode,
    includeDisabled = true,
    includeUnapproved = true,
    pageType,
    primaryCategory,
    query,
    reviewStatus,
    secondaryCategory,
    setKey,
    setKind,
    styleTag,
    variantKey
  } = filters;
  const keyword = query?.trim();
  const needsJsonFilter = Boolean(backgroundMode || pageType || styleTag);
  const assets = await prisma.templateAsset.findMany({
    include: templateAssetDetailInclude,
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
      kind,
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
  const serializedAssets = assets.map(serializeTemplateAsset);

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

export async function searchTemplateAssetsForAiByKind(
  kind: TemplateElementAssetKind,
  input: TemplateElementAssetAiSearchInput
): Promise<TemplateAssetAiResult[]> {
  const parsedInput: TemplateElementAssetAiSearchPayload =
    templateElementAssetAiSearchSchema.parse(input);
  const candidateSets = buildAiCandidateSetFilters(parsedInput.setKey);
  const allCandidates: TemplateAssetDto[] = [];

  for (const setFilter of candidateSets) {
    const assets = await listTemplateAssetsByKind(kind, {
      backgroundMode: parsedInput.backgroundMode,
      includeDisabled: false,
      includeUnapproved: false,
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
      matchScore: scoreTemplateAssetForAi(asset, parsedInput),
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

export async function getTemplateAssetByKind(
  kind: TemplateElementAssetKind,
  assetId: string
) {
  const asset = await prisma.templateAsset.findFirst({
    include: templateAssetDetailInclude,
    where: {
      id: assetId,
      kind
    }
  });

  if (!asset) {
    throw new TemplateElementAssetNotFoundError();
  }

  return serializeTemplateAsset(asset);
}

export async function createTemplateAssetByKind(
  kind: TemplateElementAssetKind,
  input: Omit<TemplateElementAssetCreateInput, "kind"> &
    Partial<Pick<TemplateElementAssetCreateInput, "kind">>
) {
  const parsedInput: TemplateElementAssetCreatePayload =
    templateElementAssetCreateSchema.parse({
      ...input,
      kind
    });
  const detail = normalizeDetailForKind(kind, parsedInput.detail);
  const asset = await prisma.$transaction(async (tx) => {
    const createdAsset = await tx.templateAsset.create({
      data: {
        aiModifyPermissions: toInputJson(parsedInput.aiModifyPermissions),
        backgroundModes: toInputJson(parsedInput.backgroundModes),
        colorTags: toInputJson(parsedInput.colorTags),
        description: parsedInput.description,
        isEnabled: parsedInput.isEnabled,
        keywords: toInputJson(parsedInput.keywords),
        kind,
        name: parsedInput.name,
        pageTypes: toInputJson(parsedInput.pageTypes),
        preview: toInputJson(
          Object.keys(parsedInput.preview).length > 0
            ? parsedInput.preview
            : buildPreviewFromDetail(kind, detail)
        ),
        primaryCategory: parsedInput.primaryCategory ?? null,
        reviewStatus: parsedInput.reviewStatus,
        secondaryCategory: parsedInput.secondaryCategory ?? null,
        semanticTags: toInputJson(parsedInput.semanticTags),
        setKey: parsedInput.setKey,
        setKind: parsedInput.setKind,
        setName: parsedInput.setName,
        sortOrder: parsedInput.sortOrder,
        source: parsedInput.source,
        styleTags: toInputJson(parsedInput.styleTags),
        synonyms: toInputJson(parsedInput.synonyms),
        tags: toInputJson(parsedInput.tags),
        usageScenarios: toInputJson(parsedInput.usageScenarios),
        variantKey: parsedInput.variantKey ?? null
      }
    });

    await createDetail(tx, kind, createdAsset.id, detail);

    return tx.templateAsset.findUniqueOrThrow({
      include: templateAssetDetailInclude,
      where: {
        id: createdAsset.id
      }
    });
  });

  return serializeTemplateAsset(asset);
}

export async function updateTemplateAssetByKind(
  kind: TemplateElementAssetKind,
  assetId: string,
  input: TemplateElementAssetUpdateInput
) {
  const parsedInput: TemplateElementAssetUpdatePayload =
    templateElementAssetUpdateSchema.parse(input);
  const existingAsset = await assertTemplateAssetExists(kind, assetId);
  const nextDetailInput =
    parsedInput.detail ??
    (parsedInput.style || parsedInput.resource || parsedInput.preview
      ? buildDetailFromLegacyFields(
          kind,
          parsedInput.style ?? buildStyleFromDetail(kind, serializeDetail(existingAsset)),
          parsedInput.resource ?? buildResourceFromDetail(kind, serializeDetail(existingAsset), existingAsset),
          parsedInput.preview ?? parseJsonObject(existingAsset.preview)
        )
      : undefined);

  if (parsedInput.aiModifyPermissions) {
    assertTypeSpecificAiModifyPermissions(kind, parsedInput.aiModifyPermissions);
  }

  const updatedAsset = await prisma.$transaction(async (tx) => {
    const data: Prisma.TemplateAssetUpdateInput = {};

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

    if (parsedInput.reviewStatus !== undefined) {
      data.reviewStatus = parsedInput.reviewStatus;
    }

    if ("secondaryCategory" in parsedInput) {
      data.secondaryCategory = parsedInput.secondaryCategory ?? null;
    }

    if (parsedInput.semanticTags !== undefined) {
      data.semanticTags = toInputJson(parsedInput.semanticTags);
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

    await tx.templateAsset.update({
      data,
      where: {
        id: assetId
      }
    });

    if (nextDetailInput) {
      await updateDetail(
        tx,
        kind,
        assetId,
        normalizeDetailForKind(kind, parseDetailForKind(kind, nextDetailInput))
      );
    }

    return tx.templateAsset.findUniqueOrThrow({
      include: templateAssetDetailInclude,
      where: {
        id: assetId
      }
    });
  });

  return serializeTemplateAsset(updatedAsset);
}

export async function deleteTemplateAssetByKind(
  kind: TemplateElementAssetKind,
  assetId: string
) {
  const result = await prisma.templateAsset.deleteMany({
    where: {
      id: assetId,
      kind
    }
  });

  if (result.count === 0) {
    throw new TemplateElementAssetNotFoundError();
  }
}

export const listTemplateIconAssets = (filters = {}) =>
  listTemplateAssetsByKind(TemplateElementAssetKind.ICON, filters);
export const listTemplateShapeAssets = (filters = {}) =>
  listTemplateAssetsByKind(TemplateElementAssetKind.SHAPE, filters);
export const listTemplateLineAssets = (filters = {}) =>
  listTemplateAssetsByKind(TemplateElementAssetKind.LINE, filters);
export const listTemplateTextStyleAssets = (filters = {}) =>
  listTemplateAssetsByKind(TemplateElementAssetKind.TEXT_STYLE, filters);
export const listTemplateContainerAssets = (filters = {}) =>
  listTemplateAssetsByKind(TemplateElementAssetKind.CONTAINER, filters);
export const listTemplateNavigationAssets = (filters = {}) =>
  listTemplateAssetsByKind(TemplateElementAssetKind.NAVIGATION, filters);

export const searchTemplateIconAssetsForAi = (input: TemplateElementAssetAiSearchInput) =>
  searchTemplateAssetsForAiByKind(TemplateElementAssetKind.ICON, input);
export const searchTemplateShapeAssetsForAi = (input: TemplateElementAssetAiSearchInput) =>
  searchTemplateAssetsForAiByKind(TemplateElementAssetKind.SHAPE, input);
export const searchTemplateLineAssetsForAi = (input: TemplateElementAssetAiSearchInput) =>
  searchTemplateAssetsForAiByKind(TemplateElementAssetKind.LINE, input);
export const searchTemplateTextStyleAssetsForAi = (
  input: TemplateElementAssetAiSearchInput
) => searchTemplateAssetsForAiByKind(TemplateElementAssetKind.TEXT_STYLE, input);
export const searchTemplateContainerAssetsForAi = (
  input: TemplateElementAssetAiSearchInput
) => searchTemplateAssetsForAiByKind(TemplateElementAssetKind.CONTAINER, input);
export const searchTemplateNavigationAssetsForAi = (
  input: TemplateElementAssetAiSearchInput
) => searchTemplateAssetsForAiByKind(TemplateElementAssetKind.NAVIGATION, input);

export async function listTemplateElementAssets({
  kind,
  ...filters
}: Parameters<typeof listTemplateAssetsByKind>[1] & {
  kind?: TemplateElementAssetKind;
} = {}) {
  if (!kind) {
    const entries = await Promise.all(
      Object.values(TemplateElementAssetKind).map((assetKind) =>
        listTemplateAssetsByKind(assetKind, filters)
      )
    );

    return entries.flat().sort(compareAssets);
  }

  return listTemplateAssetsByKind(kind, filters);
}

export async function searchTemplateElementAssetsForAi(
  input: TemplateElementAssetAiSearchInput & {
    kind?: TemplateElementAssetKind;
  }
) {
  if (!input.kind) {
    const entries = await Promise.all(
      Object.values(TemplateElementAssetKind).map((kind) =>
        searchTemplateAssetsForAiByKind(kind, input)
      )
    );

    return entries
      .flat()
      .sort(compareAiAssets)
      .slice(0, typeof input.limit === "number" ? input.limit : 12);
  }

  return searchTemplateAssetsForAiByKind(input.kind, input);
}

export async function getTemplateElementAsset(assetId: string) {
  const asset = await prisma.templateAsset.findUnique({
    include: templateAssetDetailInclude,
    where: {
      id: assetId
    }
  });

  if (!asset) {
    throw new TemplateElementAssetNotFoundError();
  }

  return serializeTemplateAsset(asset);
}

export async function createTemplateElementAsset(
  input: TemplateElementAssetCreateInput
) {
  return createTemplateAssetByKind(input.kind, input);
}

export async function updateTemplateElementAsset(
  assetId: string,
  input: TemplateElementAssetUpdateInput
) {
  const existingAsset = await getTemplateElementAsset(assetId);

  return updateTemplateAssetByKind(existingAsset.kind, assetId, input);
}

export async function deleteTemplateElementAsset(assetId: string) {
  const result = await prisma.templateAsset.deleteMany({
    where: {
      id: assetId
    }
  });

  if (result.count === 0) {
    throw new TemplateElementAssetNotFoundError();
  }
}

async function assertTemplateAssetExists(
  kind: TemplateElementAssetKind,
  assetId: string
) {
  const asset = await prisma.templateAsset.findFirst({
    include: templateAssetDetailInclude,
    where: {
      id: assetId,
      kind
    }
  });

  if (!asset) {
    throw new TemplateElementAssetNotFoundError();
  }

  return asset;
}

async function createDetail(
  tx: Prisma.TransactionClient,
  kind: TemplateElementAssetKind,
  assetId: string,
  detail: TemplateAssetDetail
) {
  const modelName = detailModelByKind[kind];

  await (tx[modelName] as unknown as DetailModelDelegate).create({
    data: {
      ...toDetailCreateData(kind, detail),
      assetId
    }
  });
}

async function updateDetail(
  tx: Prisma.TransactionClient,
  kind: TemplateElementAssetKind,
  assetId: string,
  detail: TemplateAssetDetail
) {
  const modelName = detailModelByKind[kind];

  await (tx[modelName] as unknown as DetailModelDelegate).upsert({
    create: {
      ...toDetailCreateData(kind, detail),
      assetId
    },
    update: toDetailCreateData(kind, detail),
    where: {
      assetId
    }
  });
}

type DetailModelDelegate = {
  create(input: { data: Record<string, unknown> }): Promise<unknown>;
  upsert(input: {
    create: Record<string, unknown>;
    update: Record<string, unknown>;
    where: { assetId: string };
  }): Promise<unknown>;
};

function toDetailCreateData(
  kind: TemplateElementAssetKind,
  detail: TemplateAssetDetail
) {
  if (kind === TemplateElementAssetKind.ICON) {
    const value = detail as TemplateIconAssetDetail;

    return value;
  }

  if (kind === TemplateElementAssetKind.SHAPE) {
    const value = detail as TemplateShapeAssetDetail;

    return value;
  }

  if (kind === TemplateElementAssetKind.LINE) {
    const value = detail as TemplateLineAssetDetail;

    return value;
  }

  if (kind === TemplateElementAssetKind.TEXT_STYLE) {
    const value = detail as TemplateTextStyleAssetDetail;

    return value;
  }

  if (kind === TemplateElementAssetKind.CONTAINER) {
    const value = detail as TemplateContainerAssetDetail;

    return {
      ...value,
      allowedContentTypes: toInputJson(value.allowedContentTypes)
    };
  }

  const value = detail as TemplateNavigationAssetDetail;

  return value;
}

function normalizeDetailForKind(
  kind: TemplateElementAssetKind,
  detail: ReturnType<typeof parseDetailForKind>
): TemplateAssetDetail {
  if (kind === TemplateElementAssetKind.ICON) {
    const value = detail as Partial<TemplateIconAssetDetail>;

    return {
      cornerRadius: value.cornerRadius ?? null,
      fillMode: value.fillMode ?? null,
      iconName: value.iconName ?? "semantic-icon",
      iconStyle: value.iconStyle ?? "line",
      strokeColor: value.strokeColor ?? null,
      strokeWidth: value.strokeWidth ?? null
    };
  }

  if (kind === TemplateElementAssetKind.SHAPE) {
    const value = detail as Partial<TemplateShapeAssetDetail>;

    return {
      cornerRadius: value.cornerRadius ?? null,
      fillColor: value.fillColor ?? null,
      opacity: value.opacity ?? null,
      shadow: value.shadow ?? false,
      shapeType: value.shapeType ?? "roundedRect",
      strokeColor: value.strokeColor ?? null,
      strokeWidth: value.strokeWidth ?? null
    };
  }

  if (kind === TemplateElementAssetKind.LINE) {
    const value = detail as Partial<TemplateLineAssetDetail>;

    return {
      cap: value.cap ?? "round",
      connectorType: value.connectorType ?? "straight",
      dash: value.dash ?? "solid",
      direction: value.direction ?? "horizontal",
      endArrowType: value.endArrowType ?? "none",
      startArrowType: value.startArrowType ?? "none",
      strokeColor: value.strokeColor ?? null,
      strokeWidth: value.strokeWidth ?? null
    };
  }

  if (kind === TemplateElementAssetKind.TEXT_STYLE) {
    const value = detail as Partial<TemplateTextStyleAssetDetail>;

    return {
      color: value.color ?? null,
      fontFamily: value.fontFamily ?? null,
      fontSize: value.fontSize ?? null,
      fontWeight: value.fontWeight ?? null,
      letterSpacing: value.letterSpacing ?? null,
      lineHeight: value.lineHeight ?? null,
      maxLines: value.maxLines ?? null,
      textRole: value.textRole ?? "body"
    };
  }

  if (kind === TemplateElementAssetKind.CONTAINER) {
    const value = detail as Partial<TemplateContainerAssetDetail>;

    return {
      allowedContentTypes: value.allowedContentTypes ?? ["text"],
      autoLayout: value.autoLayout ?? false,
      containerRole: value.containerRole ?? "container",
      fillColor: value.fillColor ?? null,
      gap: value.gap ?? null,
      padding: value.padding ?? null,
      recommendedHeight: value.recommendedHeight ?? null,
      recommendedWidth: value.recommendedWidth ?? null,
      strokeColor: value.strokeColor ?? null,
      strokeWidth: value.strokeWidth ?? null
    };
  }

  const value = detail as Partial<TemplateNavigationAssetDetail>;

  return {
    activeColor: value.activeColor ?? null,
    displayMode: value.displayMode ?? "label",
    fixedPosition: value.fixedPosition ?? "bottom",
    inactiveColor: value.inactiveColor ?? null,
    navigationRole: value.navigationRole ?? "page-number",
    showOnCover: value.showOnCover ?? false,
    showOnEnding: value.showOnEnding ?? false
  };
}

function serializeDetail(asset: TemplateAssetWithDetails): TemplateAssetDetail {
  if (asset.kind === TemplateElementAssetKind.ICON && asset.icon) {
    return {
      cornerRadius: asset.icon.cornerRadius,
      fillMode: asset.icon.fillMode,
      iconName: asset.icon.iconName,
      iconStyle: asset.icon.iconStyle,
      strokeColor: asset.icon.strokeColor,
      strokeWidth: asset.icon.strokeWidth
    };
  }

  if (asset.kind === TemplateElementAssetKind.SHAPE && asset.shape) {
    return {
      cornerRadius: asset.shape.cornerRadius,
      fillColor: asset.shape.fillColor,
      opacity: asset.shape.opacity,
      shadow: asset.shape.shadow,
      shapeType: asset.shape.shapeType,
      strokeColor: asset.shape.strokeColor,
      strokeWidth: asset.shape.strokeWidth
    };
  }

  if (asset.kind === TemplateElementAssetKind.LINE && asset.line) {
    return {
      cap: asset.line.cap,
      connectorType: asset.line.connectorType,
      dash: asset.line.dash,
      direction: asset.line.direction,
      endArrowType: asset.line.endArrowType,
      startArrowType: asset.line.startArrowType,
      strokeColor: asset.line.strokeColor,
      strokeWidth: asset.line.strokeWidth
    };
  }

  if (asset.kind === TemplateElementAssetKind.TEXT_STYLE && asset.textStyle) {
    return {
      color: asset.textStyle.color,
      fontFamily: asset.textStyle.fontFamily,
      fontSize: asset.textStyle.fontSize,
      fontWeight: asset.textStyle.fontWeight,
      letterSpacing: asset.textStyle.letterSpacing,
      lineHeight: asset.textStyle.lineHeight,
      maxLines: asset.textStyle.maxLines,
      textRole: asset.textStyle.textRole
    };
  }

  if (asset.kind === TemplateElementAssetKind.CONTAINER && asset.container) {
    return {
      allowedContentTypes: parseStringList(asset.container.allowedContentTypes),
      autoLayout: asset.container.autoLayout,
      containerRole: asset.container.containerRole,
      fillColor: asset.container.fillColor,
      gap: asset.container.gap,
      padding: asset.container.padding,
      recommendedHeight: asset.container.recommendedHeight,
      recommendedWidth: asset.container.recommendedWidth,
      strokeColor: asset.container.strokeColor,
      strokeWidth: asset.container.strokeWidth
    };
  }

  if (asset.kind === TemplateElementAssetKind.NAVIGATION && asset.navigation) {
    return {
      activeColor: asset.navigation.activeColor,
      displayMode: asset.navigation.displayMode,
      fixedPosition: asset.navigation.fixedPosition,
      inactiveColor: asset.navigation.inactiveColor,
      navigationRole: asset.navigation.navigationRole,
      showOnCover: asset.navigation.showOnCover,
      showOnEnding: asset.navigation.showOnEnding
    };
  }

  throw new TemplateElementAssetValidationError(
    `Missing ${asset.kind} detail record`
  );
}

function buildStyleFromDetail(
  kind: TemplateElementAssetKind,
  detail: TemplateAssetDetail
) {
  if (kind === TemplateElementAssetKind.ICON) {
    const value = detail as TemplateIconAssetDetail;

    return removeNullish({
      cornerRadius: value.cornerRadius,
      fillMode: value.fillMode,
      iconStyle: value.iconStyle,
      strokeColor: value.strokeColor,
      strokeWidth: value.strokeWidth
    });
  }

  if (kind === TemplateElementAssetKind.SHAPE) {
    const value = detail as TemplateShapeAssetDetail;

    return removeNullish({
      cornerRadius: value.cornerRadius,
      fillColor: value.fillColor,
      opacity: value.opacity,
      shadow: value.shadow,
      shapeType: value.shapeType,
      strokeColor: value.strokeColor,
      strokeWidth: value.strokeWidth
    });
  }

  if (kind === TemplateElementAssetKind.LINE) {
    const value = detail as TemplateLineAssetDetail;

    return removeNullish({
      cap: value.cap,
      connectorType: value.connectorType,
      dash: value.dash,
      direction: value.direction,
      endArrowType: value.endArrowType,
      startArrowType: value.startArrowType,
      strokeColor: value.strokeColor,
      strokeWidth: value.strokeWidth
    });
  }

  if (kind === TemplateElementAssetKind.TEXT_STYLE) {
    const value = detail as TemplateTextStyleAssetDetail;

    return removeNullish({
      color: value.color,
      fontFamily: value.fontFamily,
      fontSize: value.fontSize,
      fontWeight: value.fontWeight,
      letterSpacing: value.letterSpacing,
      lineHeight: value.lineHeight,
      maxLines: value.maxLines,
      textRole: value.textRole
    });
  }

  if (kind === TemplateElementAssetKind.CONTAINER) {
    const value = detail as TemplateContainerAssetDetail;

    return removeNullish({
      allowedContentTypes: value.allowedContentTypes,
      autoLayout: value.autoLayout,
      containerRole: value.containerRole,
      fillColor: value.fillColor,
      gap: value.gap,
      padding: value.padding,
      recommendedHeight: value.recommendedHeight,
      recommendedWidth: value.recommendedWidth,
      strokeColor: value.strokeColor,
      strokeWidth: value.strokeWidth
    });
  }

  const value = detail as TemplateNavigationAssetDetail;

  return removeNullish({
    activeColor: value.activeColor,
    displayMode: value.displayMode,
    fixedPosition: value.fixedPosition,
    inactiveColor: value.inactiveColor,
    navigationRole: value.navigationRole,
    showOnCover: value.showOnCover,
    showOnEnding: value.showOnEnding
  });
}

function buildResourceFromDetail(
  kind: TemplateElementAssetKind,
  detail: TemplateAssetDetail,
  asset: Pick<
    TemplateAssetWithDetails,
    "primaryCategory" | "secondaryCategory" | "variantKey"
  >
) {
  const base = removeNullish({
    primaryCategory: asset.primaryCategory,
    secondaryCategory: asset.secondaryCategory,
    semanticKey: asset.variantKey,
    variantKey: asset.variantKey
  });

  if (kind === TemplateElementAssetKind.ICON) {
    const value = detail as TemplateIconAssetDetail;

    return {
      ...base,
      iconName: value.iconName,
      type: "line-icon"
    };
  }

  if (kind === TemplateElementAssetKind.SHAPE) {
    const value = detail as TemplateShapeAssetDetail;

    return {
      ...base,
      shapeType: value.shapeType,
      type: "ppt-shape"
    };
  }

  if (kind === TemplateElementAssetKind.LINE) {
    const value = detail as TemplateLineAssetDetail;

    return {
      ...base,
      connectorType: value.connectorType,
      direction: value.direction,
      endArrowType: value.endArrowType,
      startArrowType: value.startArrowType,
      type: "ppt-line"
    };
  }

  if (kind === TemplateElementAssetKind.TEXT_STYLE) {
    const value = detail as TemplateTextStyleAssetDetail;

    return {
      ...base,
      textRole: value.textRole,
      type: "typography-token"
    };
  }

  if (kind === TemplateElementAssetKind.CONTAINER) {
    const value = detail as TemplateContainerAssetDetail;

    return {
      ...base,
      containerRole: value.containerRole,
      type: "layout-container"
    };
  }

  const value = detail as TemplateNavigationAssetDetail;

  return {
    ...base,
    displayMode: value.displayMode,
    navigationRole: value.navigationRole,
    type: "deck-navigation"
  };
}

function buildPreviewFromDetail(
  kind: TemplateElementAssetKind,
  detail: TemplateAssetDetail
) {
  if (kind === TemplateElementAssetKind.ICON) {
    const value = detail as TemplateIconAssetDetail;

    return {
      iconName: value.iconName,
      shape: "lineIcon"
    };
  }

  if (kind === TemplateElementAssetKind.SHAPE) {
    const value = detail as TemplateShapeAssetDetail;

    return {
      shape: value.shapeType
    };
  }

  if (kind === TemplateElementAssetKind.LINE) {
    const value = detail as TemplateLineAssetDetail;

    return {
      direction: value.direction,
      lineType: value.connectorType
    };
  }

  if (kind === TemplateElementAssetKind.TEXT_STYLE) {
    const value = detail as TemplateTextStyleAssetDetail;

    return {
      shape: "textStyle",
      textRole: value.textRole
    };
  }

  if (kind === TemplateElementAssetKind.CONTAINER) {
    const value = detail as TemplateContainerAssetDetail;

    return {
      containerRole: value.containerRole,
      shape: "container"
    };
  }

  const value = detail as TemplateNavigationAssetDetail;

  return {
    displayMode: value.displayMode,
    navigationRole: value.navigationRole,
    shape: "navigation"
  };
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

function scoreTemplateAssetForAi(
  asset: TemplateAssetDto,
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
  asset: TemplateAssetDto,
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

function removeNullish<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined)
  );
}

function compareAssets(first: TemplateAssetDto, second: TemplateAssetDto) {
  return first.kind.localeCompare(second.kind) || first.sortOrder - second.sortOrder;
}

function compareAiAssets(first: TemplateAssetAiResult, second: TemplateAssetAiResult) {
  return (
    second.matchScore - first.matchScore ||
    first.sortOrder - second.sortOrder ||
    Date.parse(second.updatedAt) - Date.parse(first.updatedAt)
  );
}

function toInputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export { buildDefaultAiModifyPermissions };
