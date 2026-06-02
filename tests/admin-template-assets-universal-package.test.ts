import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { templateElementAssetCreateSchema } from "@/lib/admin/template-assets/schemas";
import { templateElementAssetCategories } from "@/lib/admin/template-assets/categories";

const execFileAsync = promisify(execFile);

type UniversalAssetPackage = {
  assetCount: number;
  assets: Array<{
    kind: keyof typeof templateElementAssetCategories;
    name: string;
    preview: Record<string, unknown>;
    primaryCategory: string | null;
    resource: Record<string, unknown>;
    secondaryCategory: string | null;
    setKey: string;
    setKind: string;
    setName: string;
    style: Record<string, unknown>;
    variantKey: string | null;
  }>;
  formatVersion: string;
  packageId: string;
  packageName: string;
};

const packagePath = path.join(
  process.cwd(),
  "assets",
  "template-assets",
  "universal-v1",
  "assets.json"
);
const expectedKindCounts = {
  CONTAINER: 18,
  ICON: 360,
  LINE: 168,
  NAVIGATION: 15,
  SHAPE: 216,
  TEXT_STYLE: 15
} as const;
const expectedAssetCount = Object.values(expectedKindCounts).reduce(
  (total, count) => total + count,
  0
);

async function readPackage() {
  return JSON.parse(await readFile(packagePath, "utf8")) as UniversalAssetPackage;
}

describe("universal template element asset package", () => {
  it("contains one common asset for every configured category variant", async () => {
    const assetPackage = await readPackage();

    expect(assetPackage.formatVersion).toBe(
      "template-element-assets-package-v1"
    );
    expect(assetPackage.packageId).toBe("universal-template-assets-v1");
    expect(assetPackage.assetCount).toBe(expectedAssetCount);
    expect(assetPackage.assets).toHaveLength(expectedAssetCount);

    const assetsByCategory = new Set(
      assetPackage.assets.map(
        (asset) =>
          `${asset.kind}:${asset.primaryCategory}:${asset.secondaryCategory}:${asset.variantKey}`
      )
    );

    for (const [kind, categories] of Object.entries(
      templateElementAssetCategories
    )) {
      for (const primary of categories) {
        for (const secondary of primary.secondaries) {
          for (const variant of secondary.variants) {
            expect(assetsByCategory).toContain(
              `${kind}:${primary.key}:${secondary.key}:${variant.key}`
            );
          }
        }
      }
    }
  });

  it("matches the expected kind counts", async () => {
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

  it("validates every asset with the create schema", async () => {
    const assetPackage = await readPackage();

    for (const asset of assetPackage.assets) {
      expect(() => templateElementAssetCreateSchema.parse(asset)).not.toThrow();
    }
  });

  it("does not duplicate the common set unique key", async () => {
    const assetPackage = await readPackage();
    const keys = assetPackage.assets.map(
      (asset) =>
        `${asset.setKind}:${asset.setKey}:${asset.kind}:${asset.name}`
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stores distinct line metadata for arrows, direction and line styles", async () => {
    const assetPackage = await readPackage();
    const lineByVariant = new Map(
      assetPackage.assets
        .filter((asset) => asset.kind === "LINE")
        .map((asset) => [asset.variantKey, asset])
    );

    expect(lineByVariant.get("no-arrow-line")).toEqual(
      expect.objectContaining({
        preview: expect.objectContaining({
          direction: "horizontal",
          lineType: "straight"
        }),
        resource: expect.objectContaining({
          direction: "horizontal",
          endArrowType: "none",
          startArrowType: "none"
        }),
        style: expect.objectContaining({
          direction: "horizontal",
          endArrowType: "none",
          startArrowType: "none"
        })
      })
    );
    expect(lineByVariant.get("one-way-arrow")).toEqual(
      expect.objectContaining({
        preview: expect.objectContaining({
          direction: "horizontal",
          lineType: "arrow"
        }),
        resource: expect.objectContaining({
          endArrowType: "triangle",
          startArrowType: "none"
        })
      })
    );
    expect(lineByVariant.get("two-way-arrow")).toEqual(
      expect.objectContaining({
        resource: expect.objectContaining({
          endArrowType: "triangle",
          startArrowType: "triangle"
        }),
        style: expect.objectContaining({
          endArrowType: "triangle",
          startArrowType: "triangle"
        })
      })
    );
    expect(lineByVariant.get("left-arrow")).toEqual(
      expect.objectContaining({
        preview: expect.objectContaining({
          direction: "left"
        }),
        resource: expect.objectContaining({
          direction: "left"
        })
      })
    );
    expect(lineByVariant.get("up-arrow")).toEqual(
      expect.objectContaining({
        preview: expect.objectContaining({
          direction: "up"
        }),
        resource: expect.objectContaining({
          direction: "up"
        })
      })
    );
    expect(lineByVariant.get("down-arrow")).toEqual(
      expect.objectContaining({
        preview: expect.objectContaining({
          direction: "down"
        }),
        resource: expect.objectContaining({
          direction: "down"
        })
      })
    );
    expect(lineByVariant.get("dashed-line")).toEqual(
      expect.objectContaining({
        preview: expect.objectContaining({
          lineType: "straight"
        }),
        style: expect.objectContaining({
          dash: "dash"
        })
      })
    );
    expect(lineByVariant.get("dotted-line")).toEqual(
      expect.objectContaining({
        style: expect.objectContaining({
          dash: "dot"
        })
      })
    );
    expect(lineByVariant.get("double-line")).toEqual(
      expect.objectContaining({
        preview: expect.objectContaining({
          lineType: "double"
        })
      })
    );
  });

  it("stores specific shape metadata for basic geometry assets", async () => {
    const assetPackage = await readPackage();
    const shapeByVariant = new Map(
      assetPackage.assets
        .filter((asset) => asset.kind === "SHAPE")
        .map((asset) => [asset.variantKey, asset])
    );

    for (const [variantKey, shapeType] of [
      ["rect", "rect"],
      ["rounded-rect", "roundedRect"],
      ["square", "square"],
      ["parallelogram", "parallelogram"],
      ["circle", "circle"],
      ["ellipse", "ellipse"],
      ["sector", "sector"],
      ["arc", "arc"],
      ["triangle", "triangle"],
      ["diamond", "diamond"],
      ["trapezoid", "trapezoid"],
      ["hexagon", "hexagon"]
    ]) {
      expect(shapeByVariant.get(variantKey)).toEqual(
        expect.objectContaining({
          preview: expect.objectContaining({
            shape: shapeType
          }),
          resource: expect.objectContaining({
            shapeType
          }),
          style: expect.objectContaining({
            shapeType
          })
        })
      );
    }
  });

  it("stores specific preview metadata for containers, navigation and text styles", async () => {
    const assetPackage = await readPackage();
    const assetsByKindAndVariant = new Map(
      assetPackage.assets.map((asset) => [`${asset.kind}:${asset.variantKey}`, asset])
    );

    for (const [variantKey, shape] of [
      ["image-area", "image"],
      ["chart-area", "chart"],
      ["placeholder", "placeholder"],
      ["image-text-card", "image-text"],
      ["metric-card", "metric"],
      ["two-column", "columns"],
      ["bullet-list", "list"],
      ["warning-box", "warning"]
    ]) {
      expect(assetsByKindAndVariant.get(`CONTAINER:${variantKey}`)).toEqual(
        expect.objectContaining({
          preview: expect.objectContaining({
            containerRole: variantKey,
            shape
          }),
          resource: expect.objectContaining({
            containerRole: variantKey,
            displayRole: shape
          }),
          style: expect.objectContaining({
            containerRole: variantKey
          })
        })
      );
    }

    for (const [variantKey, displayMode] of [
      ["toc-grid", "grid"],
      ["toc-sidebar", "list"],
      ["page-number", "label"],
      ["linear-progress", "progress"],
      ["dot-progress", "progress"],
      ["current-step", "step"],
      ["completed-step", "step"]
    ]) {
      expect(assetsByKindAndVariant.get(`NAVIGATION:${variantKey}`)).toEqual(
        expect.objectContaining({
          preview: expect.objectContaining({
            displayMode,
            navigationRole: variantKey
          }),
          resource: expect.objectContaining({
            displayMode,
            navigationRole: variantKey
          }),
          style: expect.objectContaining({
            displayMode,
            navigationRole: variantKey
          })
        })
      );
    }

    for (const [variantKey, sampleText] of [
      ["cover-subtitle", "战略简报副标题"],
      ["bullet-point", "关键要点"],
      ["tag", "标签"],
      ["footer", "来源说明"],
      ["source-note", "来源说明"],
      ["number-emphasis", "86%"]
    ]) {
      expect(assetsByKindAndVariant.get(`TEXT_STYLE:${variantKey}`)).toEqual(
        expect.objectContaining({
          preview: expect.objectContaining({
            sampleText,
            textRole: variantKey
          }),
          resource: expect.objectContaining({
            textRole: variantKey
          }),
          style: expect.objectContaining({
            textRole: variantKey
          })
        })
      );
    }
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
      `Dry run passed. ${expectedAssetCount} template element assets are valid.`
    );
  });
});
