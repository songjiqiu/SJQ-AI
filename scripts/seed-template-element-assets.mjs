import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const rootDir = process.cwd();
const packageDir = path.join(
  rootDir,
  "assets",
  "template-assets",
  "common-fallback-v1"
);
const manifestPath = path.join(packageDir, "manifest.json");
const expectedPackageId = "common-template-assets-fallback-v1";
const expectedPackageName = "通用语义兜底资产 v1";
const expectedAssetCount = 18;
const expectedKindCounts = {
  CONTAINER: 3,
  ICON: 3,
  LINE: 3,
  NAVIGATION: 3,
  SHAPE: 3,
  TEXT_STYLE: 3
};
const dryRun = process.argv.includes("--dry-run");

const stringListSchema = z.array(z.string().trim().min(1).max(40)).max(16);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const kindSchema = z.enum([
  "CONTAINER",
  "ICON",
  "LINE",
  "NAVIGATION",
  "SHAPE",
  "TEXT_STYLE"
]);
const aiModifyPermissionsSchema = z
  .object({
    allowAutoLayout: z.boolean(),
    allowMove: z.boolean(),
    allowRecolor: z.boolean(),
    allowResize: z.boolean(),
    allowStretch: z.boolean(),
    allowTextShrink: z.boolean()
  })
  .strict();
const baseAssetSchema = z
  .object({
    aiModifyPermissions: aiModifyPermissionsSchema,
    backgroundModes: stringListSchema,
    colorTags: stringListSchema,
    description: z.string().trim().max(500).nullable(),
    detail: jsonObjectSchema,
    isEnabled: z.literal(true),
    keywords: stringListSchema,
    kind: kindSchema,
    name: z.string().trim().min(1).max(120),
    pageTypes: stringListSchema,
    preview: jsonObjectSchema,
    primaryCategory: z.string().trim().min(1).max(80).nullable(),
    resource: jsonObjectSchema,
    reviewStatus: z.literal("APPROVED"),
    secondaryCategory: z.string().trim().min(1).max(80).nullable(),
    semanticTags: stringListSchema.min(1),
    setKey: z.literal("common"),
    setKind: z.literal("COMMON"),
    setName: z.literal(expectedPackageName),
    sortOrder: z.number().int().min(0).max(100000),
    source: z.literal("MANUAL"),
    style: jsonObjectSchema,
    styleTags: stringListSchema,
    synonyms: stringListSchema,
    tags: stringListSchema,
    usageScenarios: stringListSchema,
    variantKey: z.string().trim().min(1).max(80).nullable()
  })
  .strict()
  .superRefine((asset, context) => {
    const result = detailSchemaByKind[asset.kind].safeParse(asset.detail);

    if (!result.success) {
      context.addIssue({
        code: "custom",
        message: `Invalid ${asset.kind} detail: ${result.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
        path: ["detail"]
      });
    }
  });
const packageSchema = z
  .object({
    assetCount: z.literal(expectedAssetCount),
    assets: z.array(baseAssetSchema).length(expectedAssetCount),
    formatVersion: z.literal("template-assets-fallback-package-v1"),
    packageId: z.literal(expectedPackageId),
    packageName: z.literal(expectedPackageName)
  })
  .strict();
const manifestSchema = z
  .object({
    assetCount: z.literal(expectedAssetCount),
    assetFile: z.string().trim().min(1),
    formatVersion: z.literal("template-assets-fallback-manifest-v1"),
    kindCounts: z.object({
      CONTAINER: z.literal(expectedKindCounts.CONTAINER),
      ICON: z.literal(expectedKindCounts.ICON),
      LINE: z.literal(expectedKindCounts.LINE),
      NAVIGATION: z.literal(expectedKindCounts.NAVIGATION),
      SHAPE: z.literal(expectedKindCounts.SHAPE),
      TEXT_STYLE: z.literal(expectedKindCounts.TEXT_STYLE)
    }),
    packageId: z.literal(expectedPackageId),
    packageName: z.literal(expectedPackageName)
  })
  .strict();

const detailSchemaByKind = {
  CONTAINER: z
    .object({
      allowedContentTypes: stringListSchema,
      autoLayout: z.boolean(),
      containerRole: z.string().trim().min(1),
      fillColor: z.string().trim().nullable(),
      gap: z.number().nullable(),
      padding: z.number().nullable(),
      recommendedHeight: z.number().nullable(),
      recommendedWidth: z.number().nullable(),
      strokeColor: z.string().trim().nullable(),
      strokeWidth: z.number().nullable()
    })
    .strict(),
  ICON: z
    .object({
      cornerRadius: z.number().nullable(),
      fillMode: z.string().trim().nullable(),
      iconName: z.string().trim().min(1),
      iconStyle: z.string().trim().min(1),
      strokeColor: z.string().trim().nullable(),
      strokeWidth: z.number().nullable()
    })
    .strict(),
  LINE: z
    .object({
      cap: z.string().trim().min(1),
      connectorType: z.string().trim().min(1),
      dash: z.string().trim().min(1),
      direction: z.string().trim().min(1),
      endArrowType: z.string().trim().min(1),
      startArrowType: z.string().trim().min(1),
      strokeColor: z.string().trim().nullable(),
      strokeWidth: z.number().nullable()
    })
    .strict(),
  NAVIGATION: z
    .object({
      activeColor: z.string().trim().nullable(),
      displayMode: z.string().trim().min(1),
      fixedPosition: z.string().trim().min(1),
      inactiveColor: z.string().trim().nullable(),
      navigationRole: z.string().trim().min(1),
      showOnCover: z.boolean(),
      showOnEnding: z.boolean()
    })
    .strict(),
  SHAPE: z
    .object({
      cornerRadius: z.number().nullable(),
      fillColor: z.string().trim().nullable(),
      opacity: z.number().nullable(),
      shadow: z.boolean(),
      shapeType: z.string().trim().min(1),
      strokeColor: z.string().trim().nullable(),
      strokeWidth: z.number().nullable()
    })
    .strict(),
  TEXT_STYLE: z
    .object({
      color: z.string().trim().nullable(),
      fontFamily: z.string().trim().nullable(),
      fontSize: z.number().nullable(),
      fontWeight: z.number().int().nullable(),
      letterSpacing: z.number().nullable(),
      lineHeight: z.number().nullable(),
      maxLines: z.number().int().nullable(),
      textRole: z.string().trim().min(1)
    })
    .strict()
};

async function main() {
  const { assets } = await readAssetPackage();

  assertUniqueAssetKeys(assets);
  assertKindCounts(assets);

  if (dryRun) {
    console.log(`Dry run passed. ${assets.length} template fallback assets are valid.`);
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed template fallback assets.");
  }

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.templateAsset.deleteMany({
        where: {
          setKey: "common",
          setKind: "COMMON",
          setName: expectedPackageName
        }
      });

      for (const asset of assets) {
        const createdAsset = await tx.templateAsset.create({
          data: {
            aiModifyPermissions: toJson(asset.aiModifyPermissions),
            backgroundModes: toJson(asset.backgroundModes),
            colorTags: toJson(asset.colorTags),
            description: asset.description,
            isEnabled: asset.isEnabled,
            keywords: toJson(asset.keywords),
            kind: asset.kind,
            name: asset.name,
            pageTypes: toJson(asset.pageTypes),
            preview: toJson(asset.preview),
            primaryCategory: asset.primaryCategory,
            reviewStatus: asset.reviewStatus,
            secondaryCategory: asset.secondaryCategory,
            semanticTags: toJson(asset.semanticTags),
            setKey: asset.setKey,
            setKind: asset.setKind,
            setName: asset.setName,
            sortOrder: asset.sortOrder,
            source: asset.source,
            styleTags: toJson(asset.styleTags),
            synonyms: toJson(asset.synonyms),
            tags: toJson(asset.tags),
            usageScenarios: toJson(asset.usageScenarios),
            variantKey: asset.variantKey
          }
        });

        await createDetail(tx, asset.kind, createdAsset.id, asset.detail);
      }

      return {
        createdCount: assets.length,
        deletedCount: deleted.count
      };
    });

    console.log(
      `Seeded ${result.createdCount} template fallback assets. Deleted ${result.deletedCount} old fallback assets.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function readAssetPackage() {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8"))
  );
  const assetFilePath = path.join(rootDir, ...manifest.assetFile.split("/"));
  const assetPackage = packageSchema.parse(
    JSON.parse(await readFile(assetFilePath, "utf8"))
  );

  return assetPackage;
}

function assertUniqueAssetKeys(assets) {
  const keys = new Set();

  for (const asset of assets) {
    const key = `${asset.setKind}:${asset.setKey}:${asset.kind}:${asset.name}`;

    if (keys.has(key)) {
      throw new Error(`Duplicate package asset key: ${key}`);
    }

    keys.add(key);
  }
}

function assertKindCounts(assets) {
  const actualCounts = Object.fromEntries(
    Object.keys(expectedKindCounts).map((kind) => [kind, 0])
  );

  for (const asset of assets) {
    actualCounts[asset.kind] += 1;
  }

  for (const [kind, expectedCount] of Object.entries(expectedKindCounts)) {
    if (actualCounts[kind] !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} ${kind} fallback assets, got ${actualCounts[kind]}.`
      );
    }
  }
}

async function createDetail(tx, kind, assetId, detail) {
  if (kind === "ICON") {
    await tx.templateIconAsset.create({
      data: {
        ...detail,
        assetId
      }
    });
    return;
  }

  if (kind === "SHAPE") {
    await tx.templateShapeAsset.create({
      data: {
        ...detail,
        assetId
      }
    });
    return;
  }

  if (kind === "LINE") {
    await tx.templateLineAsset.create({
      data: {
        ...detail,
        assetId
      }
    });
    return;
  }

  if (kind === "TEXT_STYLE") {
    await tx.templateTextStyleAsset.create({
      data: {
        ...detail,
        assetId
      }
    });
    return;
  }

  if (kind === "CONTAINER") {
    await tx.templateContainerAsset.create({
      data: {
        ...detail,
        allowedContentTypes: toJson(detail.allowedContentTypes),
        assetId
      }
    });
    return;
  }

  await tx.templateNavigationAsset.create({
    data: {
      ...detail,
      assetId
    }
  });
}

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
