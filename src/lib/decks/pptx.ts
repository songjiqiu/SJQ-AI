import pptxgen from "pptxgenjs";

import type {
  GeneratedSlideResult,
  SlideElement,
  UnifiedVisualSpec
} from "@/lib/ai-deck/schema";

export type PptxImageAsset = {
  assetId: string;
  bytes: Buffer;
  mimeType: string;
};

export async function createDeckPptxBuffer({
  deckSummary,
  deckTitle,
  imageAssets,
  slides,
  unifiedVisualSpec
}: {
  deckSummary: string;
  deckTitle: string;
  imageAssets: PptxImageAsset[];
  slides: GeneratedSlideResult[];
  unifiedVisualSpec: UnifiedVisualSpec;
}) {
  const pptx = new pptxgen();
  const imageAssetMap = new Map(imageAssets.map((asset) => [asset.assetId, asset]));
  const palette = unifiedVisualSpec.colorPalette;
  const primary = toPptColor(palette[0], "246BFE");
  const secondary = toPptColor(palette[1], "0F4BC7");
  const soft = toPptColor(palette[2], "DBE8FF");

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "PPT Creator Master";
  pptx.subject = deckSummary;
  pptx.title = deckTitle;
  pptx.company = "SJQ";
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei"
  };

  for (const slidePlan of slides) {
    const slide = pptx.addSlide();

    slide.background = { color: "F6F8FB" };
    slide.addText(deckTitle, {
      x: 0.35,
      y: 7.12,
      w: 7.2,
      h: 0.18,
      fontFace: "Microsoft YaHei",
      fontSize: 6,
      color: "7A8693",
      margin: 0
    });
    slide.addText(String(slidePlan.index).padStart(2, "0"), {
      x: 12.25,
      y: 7.05,
      w: 0.72,
      h: 0.24,
      align: "right",
      fontFace: "Microsoft YaHei",
      fontSize: 8,
      color: secondary,
      margin: 0
    });

    for (const element of [...slidePlan.elements].sort((a, b) => a.zIndex - b.zIndex)) {
      const box = toPptBox(element);

      if (element.type === "text") {
        slide.addText(element.content ?? "", {
          ...box,
          breakLine: false,
          color: element.role.includes("标题") || element.role.toLowerCase().includes("title")
            ? "17202A"
            : "3C4856",
          fit: "shrink",
          fontFace: "Microsoft YaHei",
          fontSize:
            element.textStyle?.fontSize ??
            (element.semanticType === "title" ? 25 : 13),
          bold:
            element.textStyle?.fontWeight === "bold" ||
            element.textStyle?.fontWeight === "semibold" ||
            element.semanticType === "title",
          margin: 0.08,
          valign: "middle"
        });
        continue;
      }

      if (element.type === "generatedImage") {
        const layer = slidePlan.generatedImageLayers.find(
          (item) => item.requestId === element.imageRequestId
        );
        const asset = layer ? imageAssetMap.get(layer.assetId) : null;

        if (asset) {
          slide.addImage({
            data: toDataUri(asset),
            ...box
          });
          continue;
        }
      }

      slide.addShape(pptx.ShapeType.rect, {
        ...box,
        fill: {
          color:
            element.type === "shape"
              ? soft
              : element.type === "chartPlaceholder"
                ? "FFF4D6"
                : "EAF2FF",
          transparency: element.type === "shape" ? 18 : 4
        },
        line: {
          color: element.type === "shape" ? soft : primary,
          transparency: element.type === "shape" ? 100 : 20
        }
      });
      slide.addText(element.role, {
        ...box,
        align: "center",
        color: element.type === "chartPlaceholder" ? "A15C00" : primary,
        fit: "shrink",
        fontFace: "Microsoft YaHei",
        fontSize: 11,
        margin: 0.08,
        valign: "middle"
      });
    }

    slide.addNotes(
      [
        `PPT创造大师 Web 动效元数据：${slidePlan.motionPlan.preset}`,
        JSON.stringify(slidePlan.motionPlan)
      ].join("\n")
    );
  }

  return Buffer.from((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}

function toPptBox(element: SlideElement) {
  return {
    x: round(element.bounds.x),
    y: round(element.bounds.y),
    w: round(element.bounds.width),
    h: round(element.bounds.height)
  };
}

function toDataUri(asset: PptxImageAsset) {
  return `data:${asset.mimeType};base64,${asset.bytes.toString("base64")}`;
}

function toPptColor(value: string | undefined, fallback: string) {
  return value?.replace("#", "").toUpperCase() || fallback;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
