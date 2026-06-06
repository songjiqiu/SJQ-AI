import {
  type PptLayoutAnalysis,
  type PptRawLayer,
  type PptRawSlide,
  type PptRegionCandidate,
  type SlotFrame
} from "@/lib/admin/ppt-to-slot/types";

export function analyzeSlideLayout(slide: PptRawSlide): PptLayoutAnalysis {
  const importantLayers = slide.layers.filter((layer) =>
    isImportantLayer(layer, slide.canvas)
  );
  const header = findHeaderLayer(importantLayers, slide.canvas.h);
  const contentLayers = importantLayers.filter((layer) => layer.id !== header?.id);
  const cardGroup = findCardGroup(contentLayers);
  const regions: PptRegionCandidate[] = [];

  if (header) {
    regions.push({
      frame: expandFrame(header.frame, slide.canvas, 0.04),
      possibleRoles: ["header", "page_title"],
      regionId: "region_header",
      sourceLayerIds: [header.id]
    });
  }

  if (cardGroup) {
    regions.push(cardGroup);
  } else {
    regions.push(...buildMainRegions(contentLayers, slide.canvas));
  }

  const safeArea = computeSafeArea(importantLayers, slide.canvas);
  const alignmentLines = computeAlignmentLines(importantLayers);
  const layoutPattern = inferLayoutPattern(regions);

  return {
    alignmentLines,
    layoutPattern,
    pageTypes: inferPageTypes(regions, contentLayers),
    regions,
    safeArea
  };
}

function isImportantLayer(layer: PptRawLayer, canvas: { h: number; w: number }) {
  if (!layer.visible) {
    return false;
  }

  const areaRatio = (layer.frame.w * layer.frame.h) / (canvas.w * canvas.h);

  if (areaRatio > 0.86 && layer.type === "shape") {
    return false;
  }

  if (layer.frame.w < 0.04 || layer.frame.h < 0.04) {
    return false;
  }

  return true;
}

function findHeaderLayer(layers: PptRawLayer[], canvasHeight: number) {
  const candidates = layers.filter(
    (layer) =>
      layer.type === "text" &&
      layer.frame.y <= canvasHeight * 0.25 &&
      (layer.text ?? "").length <= 120
  );

  return candidates.sort((first, second) => {
    const fontDiff = (second.style.fontSize ?? 0) - (first.style.fontSize ?? 0);

    return fontDiff || first.frame.y - second.frame.y || first.zIndex - second.zIndex;
  })[0];
}

function computeSafeArea(
  layers: PptRawLayer[],
  canvas: { h: number; w: number }
): SlotFrame {
  if (layers.length === 0) {
    return {
      h: round(canvas.h - 1),
      w: round(canvas.w - 1),
      x: 0.5,
      y: 0.5
    };
  }

  const left = Math.min(...layers.map((layer) => layer.frame.x));
  const top = Math.min(...layers.map((layer) => layer.frame.y));
  const right = Math.max(...layers.map((layer) => layer.frame.x + layer.frame.w));
  const bottom = Math.max(...layers.map((layer) => layer.frame.y + layer.frame.h));

  return {
    h: round(Math.max(0.1, bottom - top)),
    w: round(Math.max(0.1, right - left)),
    x: round(Math.max(0, left)),
    y: round(Math.max(0, top))
  };
}

function computeAlignmentLines(layers: PptRawLayer[]) {
  return {
    x: clusterLines(
      layers.flatMap((layer) => [
        layer.frame.x,
        layer.frame.x + layer.frame.w,
        layer.frame.x + layer.frame.w / 2
      ])
    ),
    y: clusterLines(
      layers.flatMap((layer) => [
        layer.frame.y,
        layer.frame.y + layer.frame.h,
        layer.frame.y + layer.frame.h / 2
      ])
    )
  };
}

function clusterLines(values: number[]) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .map(round)
    .sort((first, second) => first - second);
  const clusters: number[][] = [];

  for (const value of sorted) {
    const last = clusters.at(-1);

    if (!last || Math.abs(avg(last) - value) > 0.05) {
      clusters.push([value]);
    } else {
      last.push(value);
    }
  }

  return clusters.map((cluster) => round(avg(cluster)));
}

function buildMainRegions(
  layers: PptRawLayer[],
  canvas: { h: number; w: number }
): PptRegionCandidate[] {
  if (layers.length === 0) {
    return [];
  }

  const left = layers.filter((layer) => layer.frame.x + layer.frame.w / 2 < canvas.w / 2);
  const right = layers.filter((layer) => layer.frame.x + layer.frame.w / 2 >= canvas.w / 2);

  if (left.length > 0 && right.length > 0) {
    return [
      buildRegion("region_left", left, ["left", "key_points", "summary"]),
      buildRegion("region_right", right, inferVisualRoles(right))
    ];
  }

  return [buildRegion("region_main", layers, inferVisualRoles(layers))];
}

function findCardGroup(layers: PptRawLayer[]): PptRegionCandidate | null {
  const candidates = layers
    .filter((layer) => layer.frame.w >= 1 && layer.frame.h >= 0.5)
    .sort((first, second) => first.frame.x - second.frame.x);

  for (const count of [4, 3]) {
    const groups = groupBySimilarY(candidates).filter((group) => group.length >= count);

    for (const group of groups) {
      const sample = group.slice(0, count);
      const widths = sample.map((layer) => layer.frame.w);
      const heights = sample.map((layer) => layer.frame.h);

      if (spread(widths) <= 0.35 && spread(heights) <= 0.35) {
        const sorted = sample.sort((first, second) => first.frame.x - second.frame.x);
        const gaps = sorted
          .slice(1)
          .map((layer, index) =>
            round(layer.frame.x - (sorted[index].frame.x + sorted[index].frame.w))
          );

        return {
          frame: unionFrame(sorted.map((layer) => layer.frame)),
          layout: {
            count,
            gap: gaps.length > 0 ? round(avg(gaps)) : 0,
            type: "columns"
          },
          possibleRoles: ["cards", "metric_card", "comparison_item", "feature_card"],
          regionId: "region_cards",
          sourceLayerIds: sorted.map((layer) => layer.id)
        };
      }
    }
  }

  return null;
}

function groupBySimilarY(layers: PptRawLayer[]) {
  const groups: PptRawLayer[][] = [];

  for (const layer of layers) {
    const group = groups.find((item) => Math.abs(avg(item.map((entry) => entry.frame.y)) - layer.frame.y) <= 0.2);

    if (group) {
      group.push(layer);
    } else {
      groups.push([layer]);
    }
  }

  return groups;
}

function buildRegion(
  regionId: string,
  layers: PptRawLayer[],
  possibleRoles: string[]
): PptRegionCandidate {
  return {
    frame: unionFrame(layers.map((layer) => layer.frame)),
    possibleRoles,
    regionId,
    sourceLayerIds: layers.map((layer) => layer.id)
  };
}

function inferVisualRoles(layers: PptRawLayer[]) {
  if (layers.some((layer) => layer.type === "chart")) {
    return ["chart", "visual"];
  }

  if (layers.some((layer) => layer.type === "table")) {
    return ["table", "main"];
  }

  if (layers.some((layer) => layer.type === "image")) {
    return ["image", "visual"];
  }

  return ["main", "body", "key_points"];
}

function inferLayoutPattern(regions: PptRegionCandidate[]) {
  if (regions.some((region) => region.regionId === "region_cards")) {
    const count = regions.find((region) => region.regionId === "region_cards")?.layout?.count ?? 0;

    return `${count}_column_cards`;
  }

  if (
    regions.some((region) => region.regionId === "region_left") &&
    regions.some((region) => region.regionId === "region_right")
  ) {
    const right = regions.find((region) => region.regionId === "region_right");

    if (right?.possibleRoles.includes("chart")) {
      return "left_insights_right_chart";
    }

    if (right?.possibleRoles.includes("image")) {
      return "left_text_right_image";
    }

    return "two_column";
  }

  return "single_main";
}

function inferPageTypes(regions: PptRegionCandidate[], layers: PptRawLayer[]) {
  if (layers.some((layer) => layer.type === "chart")) {
    return ["data_insight", "analysis"];
  }

  if (layers.some((layer) => layer.type === "table")) {
    return ["table", "analysis"];
  }

  if (regions.some((region) => region.regionId === "region_cards")) {
    return ["title_body_points", "comparison"];
  }

  return ["content"];
}

function expandFrame(
  frame: SlotFrame,
  canvas: { h: number; w: number },
  padding: number
) {
  const x = Math.max(0, frame.x - padding);
  const y = Math.max(0, frame.y - padding);
  const right = Math.min(canvas.w, frame.x + frame.w + padding);
  const bottom = Math.min(canvas.h, frame.y + frame.h + padding);

  return {
    h: round(bottom - y),
    w: round(right - x),
    x: round(x),
    y: round(y)
  };
}

function unionFrame(frames: SlotFrame[]): SlotFrame {
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.w));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.h));

  return {
    h: round(bottom - top),
    w: round(right - left),
    x: round(left),
    y: round(top)
  };
}

function avg(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function spread(values: number[]) {
  return Math.max(...values) - Math.min(...values);
}

function round(value: number) {
  return Number(value.toFixed(3));
}
