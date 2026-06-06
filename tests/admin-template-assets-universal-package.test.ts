import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { templateElementAssetCreateSchema } from "@/lib/admin/template-assets/schemas";

const execFileAsync = promisify(execFile);

type FallbackAssetPackage = {
  assetCount: number;
  assets: Array<{
    detail: Record<string, unknown>;
    kind: "CONTAINER" | "ICON" | "LINE" | "NAVIGATION" | "SHAPE" | "TEXT_STYLE";
    name: string;
    preview: Record<string, unknown>;
    resource: Record<string, unknown>;
    setKey: string;
    setKind: string;
    setName: string;
    style: Record<string, unknown>;
  }>;
  formatVersion: string;
  packageId: string;
  packageName: string;
};

const packagePath = path.join(
  process.cwd(),
  "assets",
  "template-assets",
  "common-fallback-v1",
  "assets.json"
);
const expectedKindCounts = {
  CONTAINER: 3,
  ICON: 3,
  LINE: 3,
  NAVIGATION: 3,
  SHAPE: 3,
  TEXT_STYLE: 3
} as const;
const expectedAssetCount = Object.values(expectedKindCounts).reduce(
  (total, count) => total + count,
  0
);

async function readPackage() {
  return JSON.parse(await readFile(packagePath, "utf8")) as FallbackAssetPackage;
}

describe("common template asset fallback package", () => {
  it("contains a small approved COMMON/common fallback set", async () => {
    const assetPackage = await readPackage();

    expect(assetPackage.formatVersion).toBe(
      "template-assets-fallback-package-v1"
    );
    expect(assetPackage.packageId).toBe("common-template-assets-fallback-v1");
    expect(assetPackage.assetCount).toBe(expectedAssetCount);
    expect(assetPackage.assets).toHaveLength(expectedAssetCount);
    expect(
      assetPackage.assets.every(
        (asset) =>
          asset.setKind === "COMMON" &&
          asset.setKey === "common" &&
          asset.setName === "通用语义兜底资产 v1"
      )
    ).toBe(true);
  });

  it("keeps exactly three fallback assets per semantic asset kind", async () => {
    const assetPackage = await readPackage();
    const actualCounts = assetPackage.assets.reduce<Record<string, number>>(
      (counts, asset) => {
        counts[asset.kind] = (counts[asset.kind] ?? 0) + 1;
        return counts;
      },
      {}
    );

    expect(actualCounts).toEqual(expectedKindCounts);
  });

  it("validates every fallback asset with the create schema", async () => {
    const assetPackage = await readPackage();

    for (const asset of assetPackage.assets) {
      expect(() => templateElementAssetCreateSchema.parse(asset)).not.toThrow();
    }
  });

  it("does not duplicate common set asset names", async () => {
    const assetPackage = await readPackage();
    const keys = assetPackage.assets.map(
      (asset) => `${asset.setKind}:${asset.setKey}:${asset.kind}:${asset.name}`
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stores strongly typed detail for each asset kind", async () => {
    const assetPackage = await readPackage();
    const byKind = new Map(
      assetPackage.assets.map((asset) => [asset.kind, asset.detail])
    );

    expect(byKind.get("ICON")).toEqual(
      expect.objectContaining({
        iconName: expect.any(String),
        iconStyle: expect.any(String)
      })
    );
    expect(byKind.get("SHAPE")).toEqual(
      expect.objectContaining({
        shapeType: expect.any(String)
      })
    );
    expect(byKind.get("LINE")).toEqual(
      expect.objectContaining({
        connectorType: expect.any(String),
        endArrowType: expect.any(String),
        startArrowType: expect.any(String)
      })
    );
    expect(byKind.get("TEXT_STYLE")).toEqual(
      expect.objectContaining({
        fontSize: expect.any(Number),
        textRole: expect.any(String)
      })
    );
    expect(byKind.get("CONTAINER")).toEqual(
      expect.objectContaining({
        allowedContentTypes: expect.any(Array),
        containerRole: expect.any(String)
      })
    );
    expect(byKind.get("NAVIGATION")).toEqual(
      expect.objectContaining({
        displayMode: expect.any(String),
        navigationRole: expect.any(String)
      })
    );
  });

  it("supports dry-run validation without writing the database", async () => {
    const { stdout } = await execFileAsync(
      process.platform === "win32" ? "node.exe" : "node",
      ["scripts/seed-template-element-assets.mjs", "--dry-run"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: ""
        }
      }
    );

    expect(stdout).toContain(
      `Dry run passed. ${expectedAssetCount} template fallback assets are valid.`
    );
  });
});
