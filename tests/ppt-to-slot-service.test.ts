import { afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const db = vi.hoisted(() => ({
  prisma: {
    pptSlotTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

const storage = vi.hoisted(() => ({
  readPptToSlotArtifact: vi.fn(),
  writePptToSlotArtifact: vi.fn()
}));

const aiConfig = vi.hoisted(() => ({
  getUserDefaultAiEnv: vi.fn(async () => null)
}));

const overlay = vi.hoisted(() => ({
  renderPptSlotOverlay: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: db.prisma
}));

vi.mock("@/lib/admin/ppt-to-slot/storage", () => storage);
vi.mock("@/lib/ai-config/service", () => aiConfig);
vi.mock("@/lib/admin/ppt-to-slot/overlay-renderer", () => overlay);

import {
  PptToSlotValidationError,
  createPptToSlotJob,
  getPptSlotTemplate,
  listPptSlotTemplates,
  readPptSlotTemplateArtifact,
  updatePptSlotTemplate
} from "@/lib/admin/ppt-to-slot/service";

const now = new Date("2026-06-05T00:00:00.000Z");
const record = {
  alignmentLines: {
    x: [0.7],
    y: [0.45]
  },
  artifactPaths: {
    layoutCandidates: "ppt-to-slot/job/layout.json",
    overlay: "ppt-to-slot/job/overlay.png",
    rawLayers: "ppt-to-slot/job/raw.json",
    reviewReport: "ppt-to-slot/job/report.md",
    template: "ppt-to-slot/job/template.json"
  },
  canvas: {
    h: 7.5,
    unit: "inch",
    w: 13.333,
    x: 0,
    y: 0
  },
  createdAt: now,
  description: "说明",
  id: "slot-1",
  isEnabled: false,
  layoutPattern: "single_main",
  name: "Slot 模板",
  overlayPath: "ppt-to-slot/job/overlay.png",
  pageTypes: ["content"],
  reviewNotes: null,
  reviewStatus: "PENDING_REVIEW",
  rules: {},
  safeArea: {
    h: 6,
    w: 11,
    x: 0.7,
    y: 0.45
  },
  slots: {
    main: {
      constraints: {},
      frame: {
        h: 5,
        w: 10,
        x: 1,
        y: 1
      },
      id: "main",
      required: true,
      roles: ["main"]
    }
  },
  sourceFile: "demo.pptx",
  sourceSlideIndex: 1,
  styleTokens: {},
  updatedAt: now,
  usage: {
    notSuitableFor: [],
    suitableFor: ["通用内容页"]
  }
};

describe("PPT--To--Slot service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists and serializes Slot templates", async () => {
    db.prisma.pptSlotTemplate.findMany.mockResolvedValue([record]);

    const templates = await listPptSlotTemplates();

    expect(db.prisma.pptSlotTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            createdAt: "desc"
          }
        ]
      })
    );
    expect(templates[0]).toMatchObject({
      createdAt: "2026-06-05T00:00:00.000Z",
      id: "slot-1",
      reviewStatus: "PENDING_REVIEW"
    });
  });

  it("updates review status and enabled state", async () => {
    db.prisma.pptSlotTemplate.findUnique.mockResolvedValue(record);
    db.prisma.pptSlotTemplate.update.mockResolvedValue({
      ...record,
      isEnabled: true,
      reviewStatus: "APPROVED"
    });

    const template = await updatePptSlotTemplate("slot-1", {
      isEnabled: true,
      reviewStatus: "APPROVED"
    });

    expect(db.prisma.pptSlotTemplate.update).toHaveBeenCalledWith({
      data: {
        isEnabled: true,
        reviewStatus: "APPROVED"
      },
      where: {
        id: "slot-1"
      }
    });
    expect(template.isEnabled).toBe(true);
  });

  it("reads artifacts from the saved artifact path", async () => {
    db.prisma.pptSlotTemplate.findUnique.mockResolvedValue(record);
    storage.readPptToSlotArtifact.mockResolvedValue({
      bytes: Buffer.from("{}"),
      lastModified: now,
      sizeBytes: 2
    });

    const artifact = await readPptSlotTemplateArtifact({
      kind: "template",
      templateId: "slot-1"
    });

    expect(storage.readPptToSlotArtifact).toHaveBeenCalledWith(
      "ppt-to-slot/job/template.json"
    );
    expect(artifact.contentType).toBe("application/json; charset=utf-8");
  });

  it("throws when a template does not exist", async () => {
    db.prisma.pptSlotTemplate.findUnique.mockResolvedValue(null);

    await expect(getPptSlotTemplate("missing")).rejects.toThrow(
      "PPT Slot template not found"
    );
  });

  it("returns an actionable validation error when canvas native bindings are missing", async () => {
    const bytes = await buildPptx();

    overlay.renderPptSlotOverlay.mockRejectedValue(
      new Error("Cannot find native binding for @napi-rs/canvas")
    );

    const promise = createPptToSlotJob({
      file: {
        bytes,
        name: "demo.pptx",
        size: bytes.byteLength
      },
      userId: "admin-1"
    });

    await expect(promise).rejects.toMatchObject({
      details: {
        message:
          "缺少 @napi-rs/canvas 原生依赖，请运行 pnpm install 后重启开发服务。",
        package: "@napi-rs/canvas"
      },
      name: "PptToSlotValidationError"
    });
    await expect(promise).rejects.toBeInstanceOf(PptToSlotValidationError);
  });
});

const emu = 914400;

async function buildPptx() {
  const zip = new JSZip();

  zip.file(
    "ppt/presentation.xml",
    `<p:presentation xmlns:p="p" xmlns:a="a"><p:sldSz cx="${13.333 * emu}" cy="${7.5 * emu}"/></p:presentation>`
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `<p:sld xmlns:p="p" xmlns:a="a">
      <p:sp>
        <p:nvSpPr><p:cNvPr id="1" name="Title 1"/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="${0.7 * emu}" y="${0.45 * emu}"/><a:ext cx="${8 * emu}" cy="${0.6 * emu}"/></a:xfrm></p:spPr>
        <p:txBody><a:p><a:r><a:rPr sz="2800" b="1"/><a:t>标题</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:sld>`
  );

  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}
