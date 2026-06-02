import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { pptTemplateCategoryIds } from "@/lib/admin/templates/categories";
import { slideCompositionPlanSchema } from "@/lib/ai-deck/schema";

const packageDir = path.join(
  process.cwd(),
  "assets",
  "templates",
  "universal-v1"
);
const importFormatVersion = "ppt-template-import-v1";

type TemplateImportJson = {
  category: string;
  formatVersion: string;
  isEnabled: boolean;
  name: string;
  slide: unknown;
  sortOrder: number;
  tags: string[];
};

type ManifestJson = {
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

async function listTemplateFiles() {
  const files: string[] = [];
  const categories = await readdir(packageDir, {
    withFileTypes: true
  });

  for (const entry of categories) {
    if (!entry.isDirectory()) {
      continue;
    }

    const categoryDir = path.join(packageDir, entry.name);
    const categoryFiles = await readdir(categoryDir, {
      withFileTypes: true
    });

    for (const file of categoryFiles) {
      if (file.isFile() && file.name.endsWith(".json")) {
        files.push(path.join(categoryDir, file.name));
      }
    }
  }

  return files.sort();
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

describe("universal PPT template JSON package", () => {
  it("contains 45 importable template files across the fixed categories", async () => {
    const files = await listTemplateFiles();

    expect(files).toHaveLength(45);

    const templates = files.map((file) => readJson<TemplateImportJson>(file));
    const countByCategory = new Map<string, number>();

    for (const template of templates) {
      countByCategory.set(
        template.category,
        (countByCategory.get(template.category) ?? 0) + 1
      );
    }

    expect(Array.from(countByCategory.keys()).sort()).toEqual(
      [...pptTemplateCategoryIds].sort()
    );

    for (const category of pptTemplateCategoryIds) {
      expect(countByCategory.get(category)).toBe(3);
    }
  });

  it("keeps every template compatible with SlideCompositionPlan", async () => {
    const files = await listTemplateFiles();

    for (const file of files) {
      const template = readJson<TemplateImportJson>(file);

      expect(template.formatVersion, file).toBe(importFormatVersion);
      expect(template.isEnabled, file).toBe(true);
      expect(template.tags.length, file).toBeGreaterThanOrEqual(3);

      const slide = slideCompositionPlanSchema.parse(template.slide);

      expect(slide.designPlan.layoutTemplate, file).toBe(template.category);
      expect(slide.layoutSelection.selectedLayoutType, file).toBe(
        template.category
      );
      expect(slide.elements.filter((element) => element.semanticType === "title"), file)
        .toHaveLength(1);

      const imageRequestIds = new Set(
        slide.imageLayerRequests.map((request) => request.id)
      );
      const elementIds = new Set(slide.elements.map((element) => element.id));

      for (const element of slide.elements) {
        if (element.type === "generatedImage") {
          expect(element.imageRequestId, file).toBeDefined();
          expect(imageRequestIds.has(element.imageRequestId ?? ""), file).toBe(
            true
          );
        }
      }

      for (const request of slide.imageLayerRequests) {
        expect(elementIds.has(request.elementId), file).toBe(true);
      }

      if (template.category === "big-image-background") {
        expect(slide.imageLayerRequests, file).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              imageType: "background",
              transparentBackground: false
            })
          ])
        );
      }
    }
  });

  it("uses three distinct layout signatures inside every category", async () => {
    const files = await listTemplateFiles();
    const signaturesByCategory = new Map<string, Set<string>>();

    for (const file of files) {
      const template = readJson<TemplateImportJson>(file);
      const slide = slideCompositionPlanSchema.parse(template.slide);
      const signature = buildLayoutSignature(slide);
      const signatures =
        signaturesByCategory.get(template.category) ?? new Set<string>();

      signatures.add(signature);
      signaturesByCategory.set(template.category, signatures);
    }

    for (const category of pptTemplateCategoryIds) {
      expect(signaturesByCategory.get(category)?.size, category).toBe(3);
    }
  });

  it("keeps the manifest aligned with generated JSON files", async () => {
    const manifestPath = path.join(packageDir, "manifest.json");
    const manifest = readJson<ManifestJson>(manifestPath);
    const files = await listTemplateFiles();
    const filesByManifestPath = new Map(
      files.map((file) => [
        path.relative(process.cwd(), file).replaceAll("\\", "/"),
        readJson<TemplateImportJson>(file)
      ])
    );

    expect(manifest).toMatchObject({
      formatVersion: "ppt-template-manifest-v1",
      packageId: "universal-v1",
      templateCount: 45
    });
    expect(manifest.templates).toHaveLength(45);

    for (const item of manifest.templates) {
      const template = filesByManifestPath.get(item.file);

      expect(template, item.file).toBeDefined();
      expect(template?.category, item.file).toBe(item.category);
      expect(template?.name, item.file).toBe(item.name);
      expect(template?.sortOrder, item.file).toBe(item.sortOrder);

      const slide = slideCompositionPlanSchema.parse(template?.slide);

      expect(slide.slideId, item.file).toBe(item.id);
    }
  });
});

function buildLayoutSignature(slide: ReturnType<typeof slideCompositionPlanSchema.parse>) {
  return JSON.stringify({
    elements: slide.elements.map((element) => ({
      bounds: element.bounds,
      semanticType: element.semanticType,
      type: element.type
    })),
    imageLayerRequests: slide.imageLayerRequests.map((request) => ({
      imageType: request.imageType,
      transparentBackground: request.transparentBackground
    }))
  });
}
