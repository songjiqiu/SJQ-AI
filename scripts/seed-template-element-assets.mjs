import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const rootDir = process.cwd();
const manifestPath = path.join(
  rootDir,
  "assets",
  "template-assets",
  "universal-v1",
  "manifest.json"
);
const expectedPackageId = "universal-template-assets-v1";
const expectedPackageName = "通用语义资产包 v1";
const expectedAssetCount = 792;
const expectedKindCounts = {
  CONTAINER: 18,
  ICON: 360,
  LINE: 168,
  NAVIGATION: 15,
  SHAPE: 216,
  TEXT_STYLE: 15
};
const dryRun = process.argv.includes("--dry-run");

const stringListSchema = z.array(z.string().trim().min(1).max(40)).max(16);
const jsonObjectSchema = z.record(z.string(), z.unknown());
const assetSchema = z
  .object({
    aiModifyPermissions: z
      .object({
        allowAutoLayout: z.boolean(),
        allowMove: z.boolean(),
        allowRecolor: z.boolean(),
        allowResize: z.boolean(),
        allowStretch: z.boolean(),
        allowTextShrink: z.boolean()
      })
      .strict(),
    backgroundModes: stringListSchema,
    colorTags: stringListSchema,
    description: z.string().trim().max(500).nullable(),
    isEnabled: z.boolean(),
    keywords: stringListSchema,
    kind: z.enum(["CONTAINER", "ICON", "LINE", "NAVIGATION", "SHAPE", "TEXT_STYLE"]),
    name: z.string().trim().min(1).max(120),
    pageTypes: stringListSchema,
    preview: jsonObjectSchema,
    primaryCategory: z.string().trim().min(1).max(80).nullable(),
    resource: jsonObjectSchema,
    reviewStatus: z.enum(["APPROVED"]),
    secondaryCategory: z.string().trim().min(1).max(80).nullable(),
    semanticTags: stringListSchema.min(1),
    setKey: z.literal("common"),
    setKind: z.literal("COMMON"),
    setName: z.literal(expectedPackageName),
    sortOrder: z.number().int().min(0).max(100000),
    source: z.enum(["MANUAL"]),
    style: jsonObjectSchema,
    styleTags: stringListSchema,
    synonyms: stringListSchema,
    tags: stringListSchema,
    usageScenarios: stringListSchema,
    variantKey: z.string().trim().min(1).max(80).nullable()
  })
  .strict();
const packageSchema = z
  .object({
    assetCount: z.literal(expectedAssetCount),
    assets: z.array(assetSchema).length(expectedAssetCount),
    formatVersion: z.literal("template-element-assets-package-v1"),
    packageId: z.literal(expectedPackageId),
    packageName: z.literal(expectedPackageName)
  })
  .strict();
const manifestSchema = z
  .object({
    assetCount: z.literal(expectedAssetCount),
    assetFile: z.string().trim().min(1),
    formatVersion: z.literal("template-element-assets-manifest-v1"),
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

async function main() {
  const { assets } = await readAssetPackage();

  assertUniqueAssetKeys(assets);

  if (dryRun) {
    console.log(`Dry run passed. ${assets.length} template element assets are valid.`);
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed template element assets.");
  }

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter });

  try {
    const conflicts = await prisma.templateElementAsset.findMany({
      select: {
        kind: true,
        name: true,
        setName: true
      },
      where: {
        OR: assets.map((asset) => ({
          kind: asset.kind,
          name: asset.name,
          setKey: asset.setKey,
          setKind: asset.setKind
        })),
        NOT: {
          setName: expectedPackageName
        }
      }
    });

    if (conflicts.length > 0) {
      console.error("Found name conflicts outside the universal asset package:");

      for (const conflict of conflicts.slice(0, 50)) {
        console.error(
          `- ${conflict.kind} / ${conflict.name} / setName=${conflict.setName}`
        );
      }

      if (conflicts.length > 50) {
        console.error(`...and ${conflicts.length - 50} more conflicts.`);
      }

      throw new Error("Aborted to avoid overwriting manually maintained assets.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.templateElementAsset.deleteMany({
        where: {
          setKey: "common",
          setKind: "COMMON",
          setName: expectedPackageName
        }
      });
      await tx.templateElementAsset.createMany({
        data: assets.map((asset) => ({
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
          resource: toJson(asset.resource),
          reviewStatus: asset.reviewStatus,
          secondaryCategory: asset.secondaryCategory,
          semanticTags: toJson(asset.semanticTags),
          setKey: asset.setKey,
          setKind: asset.setKind,
          setName: asset.setName,
          sortOrder: asset.sortOrder,
          source: asset.source,
          style: toJson(asset.style),
          styleTags: toJson(asset.styleTags),
          synonyms: toJson(asset.synonyms),
          tags: toJson(asset.tags),
          usageScenarios: toJson(asset.usageScenarios),
          variantKey: asset.variantKey
        }))
      });

      return {
        createdCount: assets.length,
        deletedCount: deleted.count
      };
    });

    console.log(
      `Seeded ${result.createdCount} template element assets. Deleted ${result.deletedCount} old package assets.`
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

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
