import pptxgen from "pptxgenjs";

import type {
  GeneratedSlideResult,
  SlideElement,
  UnifiedVisualSpec
} from "@/lib/ai-deck/schema";
import { resolveSlideVisualColors } from "@/lib/ai-deck/visual-colors";
import { sanitizeElementColorForPptx } from "@/lib/ai-deck/visual-element-colors";

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
  const visualColors = resolveSlideVisualColors(unifiedVisualSpec);
  const primary = toPptColor(visualColors.accent, "246BFE");
  const surface = toPptColor(visualColors.surface, "DBE8FF");
  const bodyText = toPptColor(visualColors.bodyText, "334155");
  const chart = toPptColor(visualColors.chart, primary);
  const chartSeries = visualColors.chartSeries.map((color) =>
    toPptColor(color, chart)
  );
  const decorative = toPptColor(visualColors.decorative, "16A085");
  const titleText = toPptColor(visualColors.titleText, "17202A");

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

    slide.background = { color: toPptColor(visualColors.background, "F6F8FB") };
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
      color: decorative,
      margin: 0
    });

    for (const element of [...slidePlan.elements].sort((a, b) => a.zIndex - b.zIndex)) {
      const box = toPptBox(element);

      if (element.type === "text") {
        slide.addText(element.content ?? "", {
          ...box,
          align: element.textStyle?.align ?? defaultTextAlign(element),
          breakLine: false,
          color: toPptColor(
            sanitizeElementColorForPptx(
              element.textStyle?.color ?? element.assetStyle?.strokeColor,
              textFallbackRole(element),
              unifiedVisualSpec
            ),
            defaultTextColor(element, {
              bodyText,
              decorative,
              primary,
              titleText
            })
          ),
          fit: "shrink",
          fontFace: "Microsoft YaHei",
          fontSize:
            element.textStyle?.fontSize ??
            defaultFontSize(element),
          bold:
            element.textStyle?.fontWeight === "bold" ||
            element.textStyle?.fontWeight === "semibold" ||
            element.semanticType === "title",
          margin: element.semanticType === "title" ? 0.02 : 0.04,
          valign: element.semanticType === "body" ? "top" : "middle"
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

        slide.addShape(pptx.ShapeType.rect, {
          ...box,
          fill: {
            color: surface,
            transparency: 82
          },
          line: {
            color: surface,
            transparency: 100
          }
        });
        continue;
      }

      if (element.type === "chartPlaceholder") {
        slide.addShape(pptx.ShapeType.rect, {
          ...box,
          fill: {
            color: surface,
            transparency: 35
          },
          line: {
            color: chart,
            transparency: 72
          }
        });

        const barCount = 4;
        const gap = box.w / 16;
        const barWidth = (box.w - gap * (barCount + 1)) / barCount;
        const barHeights = [0.38, 0.62, 0.48, 0.78];

        for (const [index, heightRatio] of barHeights.entries()) {
          const h = Math.max(0.08, box.h * heightRatio * 0.68);
          const barColor = chartSeries[index % chartSeries.length] ?? chart;

          slide.addShape(pptx.ShapeType.rect, {
            x: round(box.x + gap + index * (barWidth + gap)),
            y: round(box.y + box.h - h - box.h * 0.12),
            w: round(barWidth),
            h: round(h),
            fill: {
              color: barColor,
              transparency: 8
            },
            line: {
              color: barColor,
              transparency: 100
            }
          });
        }

        continue;
      }

      slide.addShape(pptx.ShapeType.rect, {
        ...box,
        fill: {
          color: toPptColor(
            sanitizeElementColorForPptx(
              element.assetStyle?.fillColor,
              isLineLikeShape(element) ? "accent" : "surface",
              unifiedVisualSpec
            ),
            isLineLikeShape(element) ? primary : surface
          ),
          transparency: getShapeTransparency(element)
        },
        line: {
          color: toPptColor(
            sanitizeElementColorForPptx(
              element.assetStyle?.strokeColor,
              isLineLikeShape(element) ? "accent" : "borderDivider",
              unifiedVisualSpec
            ),
            isLineLikeShape(element) ? primary : surface
          ),
          dashType: toPptLineDash(element.assetStyle?.dash),
          transparency: isLineLikeShape(element) ? 10 : 60,
          width: element.assetStyle?.strokeWidth ?? (isLineLikeShape(element) ? 1.2 : 0.6)
        }
      });

      if (element.type === "icon") {
        const iconColor = toPptColor(
          sanitizeElementColorForPptx(
            element.assetStyle?.strokeColor,
            "decorative",
            unifiedVisualSpec
          ),
          decorative
        );

        slide.addShape(pptx.ShapeType.ellipse, {
          x: round(box.x + box.w * 0.22),
          y: round(box.y + box.h * 0.22),
          w: round(box.w * 0.56),
          h: round(box.h * 0.56),
          fill: { color: iconColor, transparency: 100 },
          line: {
            color: iconColor,
            transparency: 0,
            width: element.assetStyle?.strokeWidth ?? 1.4
          }
        });
      }
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

function defaultTextAlign(element: SlideElement) {
  return element.semanticType === "title" || element.semanticType === "body"
    ? "left"
    : "center";
}

function defaultTextColor(
  element: SlideElement,
  colors: {
    bodyText: string;
    decorative: string;
    primary: string;
    titleText: string;
  }
) {
  if (element.semanticType === "title") {
    return colors.titleText;
  }

  if (element.semanticType === "footer") {
    return colors.decorative;
  }

  if (element.semanticType === "badge") {
    return colors.primary;
  }

  return colors.bodyText;
}

function textFallbackRole(element: SlideElement) {
  if (element.semanticType === "title" || element.semanticType === "subtitle") {
    return "titleText";
  }

  if (element.semanticType === "footer") {
    return "decorative";
  }

  if (element.semanticType === "badge") {
    return "accent";
  }

  return "bodyText";
}

function defaultFontSize(element: SlideElement) {
  if (element.semanticType === "title") {
    return 28;
  }

  if (element.semanticType === "subtitle") {
    return 18;
  }

  if (element.semanticType === "footer") {
    return 9;
  }

  return 13;
}

function isLineLikeShape(element: SlideElement) {
  return (
    element.assetBinding?.kind === "LINE" ||
    Boolean(element.assetStyle?.lineType) ||
    element.bounds.height <= 0.18 ||
    element.bounds.width <= 0.18 ||
    /line|underline|emphasis|强调线|分隔线|线/i.test(
      `${element.id} ${element.role} ${element.styleNotes}`
    )
  );
}

function getShapeTransparency(element: SlideElement) {
  if (element.assetBinding?.kind === "LINE" || isLineLikeShape(element)) {
    return 100;
  }

  if (element.assetStyle?.opacity !== undefined) {
    return Math.round((1 - element.assetStyle.opacity) * 100);
  }

  return element.type === "icon" ? 100 : 38;
}

function toPptLineDash(
  dash?: NonNullable<SlideElement["assetStyle"]>["dash"]
): "dash" | "solid" | "sysDot" | undefined {
  if (dash === "dashed") {
    return "dash";
  }

  if (dash === "dotted") {
    return "sysDot";
  }

  return undefined;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
