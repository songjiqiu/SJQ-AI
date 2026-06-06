import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { ingestPptxFile, PptToSlotValidationError } from "@/lib/admin/ppt-to-slot/ingest";
import { analyzeSlideLayout } from "@/lib/admin/ppt-to-slot/layout-analyzer";
import { parsePptxSlides } from "@/lib/admin/ppt-to-slot/parser";
import { abstractSlideToSlotTemplate } from "@/lib/admin/ppt-to-slot/slot-abstractor";
import { validatePptSlotTemplateJson } from "@/lib/admin/ppt-to-slot/template-exporter";

const emu = 914400;

describe("PPT--To--Slot extraction", () => {
  it("rejects invalid files", async () => {
    await expect(
      ingestPptxFile({
        bytes: new Uint8Array([1, 2, 3]),
        name: "bad.txt",
        size: 3
      })
    ).rejects.toBeInstanceOf(PptToSlotValidationError);
  });

  it("parses PPTX coordinates and abstracts a left chart layout", async () => {
    const bytes = await buildPptx();
    const { zip } = await ingestPptxFile({
      bytes,
      name: "demo.pptx",
      size: bytes.byteLength
    });
    const slides = await parsePptxSlides(zip);

    expect(slides).toHaveLength(1);
    expect(slides[0].canvas).toMatchObject({
      h: 7.5,
      unit: "inch",
      w: 13.333
    });
    expect(slides[0].layers.map((layer) => layer.type)).toEqual([
      "text",
      "text",
      "chart"
    ]);
    expect(slides[0].layers[0].frame).toMatchObject({
      h: 0.6,
      w: 8,
      x: 0.7,
      y: 0.45
    });

    const analysis = analyzeSlideLayout(slides[0]);

    expect(analysis.layoutPattern).toBe("left_insights_right_chart");
    expect(analysis.regions.map((region) => region.regionId)).toEqual([
      "region_header",
      "region_left",
      "region_right"
    ]);

    const template = validatePptSlotTemplateJson(
      abstractSlideToSlotTemplate({
        analysis,
        slide: slides[0],
        sourceFile: "demo.pptx"
      })
    );

    expect(template.slots.header.placeholder).toBe("请输入页面标题");
    expect(JSON.stringify(template)).not.toContain("2026 年市场增长趋势");
    expect(template.slots.visual.roles).toContain("chart");
  });

  it("detects a three-column card group", async () => {
    const slide = {
      canvas: {
        h: 7.5,
        unit: "inch" as const,
        w: 13.333,
        x: 0,
        y: 0
      },
      layers: [
        textLayer("title", "标题", 0.7, 0.45, 8, 0.6, 28),
        textLayer("card1", "A", 0.7, 1.5, 3.2, 2, 18),
        textLayer("card2", "B", 4.2, 1.5, 3.2, 2, 18),
        textLayer("card3", "C", 7.7, 1.5, 3.2, 2, 18)
      ],
      slideIndex: 1
    };

    const analysis = analyzeSlideLayout(slide);

    expect(analysis.layoutPattern).toBe("3_column_cards");
    expect(analysis.regions.some((region) => region.regionId === "region_cards")).toBe(true);
  });
});

async function buildPptx() {
  const zip = new JSZip();
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation xmlns:p="p" xmlns:a="a"><p:sldSz cx="${13.333 * emu}" cy="${7.5 * emu}"/></p:presentation>`
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `<p:sld xmlns:p="p" xmlns:a="a" xmlns:c="c">
      ${shapeXml("1", "Title 1", "2026 年市场增长趋势", 0.7, 0.45, 8, 0.6, 2800)}
      ${shapeXml("2", "Body 1", "三条核心洞察", 0.7, 1.45, 4.1, 5.25, 1600)}
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="3" name="Chart 1"/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="${5.15 * emu}" y="${1.45 * emu}"/><a:ext cx="${7.45 * emu}" cy="${5.25 * emu}"/></p:xfrm>
        <a:graphic><a:graphicData><c:chart/></a:graphicData></a:graphic>
      </p:graphicFrame>
    </p:sld>`
  );

  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

function shapeXml(
  id: string,
  name: string,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number
) {
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="${name}"/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${x * emu}" y="${y * emu}"/><a:ext cx="${w * emu}" cy="${h * emu}"/></a:xfrm></p:spPr>
    <p:txBody><a:p><a:r><a:rPr sz="${fontSize}" b="1"/><a:t>${text}</a:t></a:r></a:p></p:txBody>
  </p:sp>`;
}

function textLayer(
  id: string,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number
) {
  return {
    frame: {
      h,
      w,
      x,
      y
    },
    id,
    name: id,
    style: {
      fontSize
    },
    text,
    type: "text" as const,
    visible: true,
    zIndex: 1
  };
}
