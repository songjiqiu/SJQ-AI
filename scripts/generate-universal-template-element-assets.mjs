import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const rootDir = process.cwd();
const categoriesFile = path.join(
  rootDir,
  "src",
  "lib",
  "admin",
  "template-assets",
  "categories.ts"
);
const packageDir = path.join(
  rootDir,
  "assets",
  "template-assets",
  "universal-v1"
);
const manifestPath = path.join(packageDir, "manifest.json");
const assetsPath = path.join(packageDir, "assets.json");

const formatVersion = "template-element-assets-package-v1";
const manifestFormatVersion = "template-element-assets-manifest-v1";
const packageId = "universal-template-assets-v1";
const packageName = "通用语义资产包 v1";
const packageSetName = packageName;
const expectedCounts = {
  CONTAINER: 18,
  ICON: 360,
  LINE: 168,
  NAVIGATION: 15,
  SHAPE: 216,
  TEXT_STYLE: 15
};
const pageTypes = [
  "chapter",
  "cover-title",
  "title-body-points",
  "big-image-background",
  "left-image-right-text",
  "left-text-right-image",
  "left-text-right-chart",
  "big-chart",
  "two-column-compare",
  "quote",
  "time-axis",
  "process-steps",
  "key-metrics",
  "quadrant-matrix",
  "ending"
];
const kindLabels = {
  CONTAINER: "容器",
  ICON: "图标",
  LINE: "线条",
  NAVIGATION: "导航",
  SHAPE: "图形",
  TEXT_STYLE: "文本样式"
};
const sortBaseByKind = {
  CONTAINER: 10000,
  ICON: 20000,
  LINE: 30000,
  NAVIGATION: 40000,
  SHAPE: 50000,
  TEXT_STYLE: 60000
};

async function main() {
  const categoryTree = await readCategoryTree();
  const assets = buildAssets(categoryTree);
  const kindCounts = countByKind(assets);

  assertPackageIntegrity(assets, kindCounts);
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    assetsPath,
    `${JSON.stringify(
      {
        assetCount: assets.length,
        assets,
        formatVersion,
        packageId,
        packageName
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        assetCount: assets.length,
        assetFile: "assets/template-assets/universal-v1/assets.json",
        formatVersion: manifestFormatVersion,
        kindCounts,
        packageId,
        packageName
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Generated ${assets.length} template element assets.`);
}

async function readCategoryTree() {
  const sourceText = await readFile(categoriesFile, "utf8");
  const sourceFile = ts.createSourceFile(
    categoriesFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const declaration = findCategoryDeclaration(sourceFile);

  if (!declaration || !ts.isObjectLiteralExpression(declaration.initializer)) {
    throw new Error("Cannot find templateElementAssetCategories object.");
  }

  const categoryTree = {};

  for (const property of declaration.initializer.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const kind = property.name.getText(sourceFile);
    const initializer = property.initializer;

    if (
      !ts.isCallExpression(initializer) ||
      initializer.expression.getText(sourceFile) !== "buildCategories" ||
      initializer.arguments.length !== 1 ||
      !ts.isArrayLiteralExpression(initializer.arguments[0])
    ) {
      throw new Error(`Unsupported category initializer for ${kind}.`);
    }

    categoryTree[kind] = initializer.arguments[0].elements.map((primaryCall) =>
      readPrimary(sourceFile, primaryCall)
    );
  }

  return categoryTree;
}

function findCategoryDeclaration(sourceFile) {
  let declaration = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === "templateElementAssetCategories"
    ) {
      declaration = node;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declaration;
}

function readPrimary(sourceFile, node) {
  assertCall(sourceFile, node, "primary", 4);

  const [keyNode, zhNode, enNode, secondariesNode] = node.arguments;

  if (!ts.isArrayLiteralExpression(secondariesNode)) {
    throw new Error("Primary category secondaries must be an array.");
  }

  return {
    enUS: readString(sourceFile, enNode),
    key: readString(sourceFile, keyNode),
    secondaries: secondariesNode.elements.map((secondaryCall) =>
      readSecondary(sourceFile, secondaryCall)
    ),
    zhCN: readString(sourceFile, zhNode)
  };
}

function readSecondary(sourceFile, node) {
  assertCall(sourceFile, node, "secondary", 4);

  const [keyNode, zhNode, enNode, variantsNode] = node.arguments;

  if (!ts.isArrayLiteralExpression(variantsNode)) {
    throw new Error("Secondary category variants must be an array.");
  }

  return {
    enUS: readString(sourceFile, enNode),
    key: readString(sourceFile, keyNode),
    variants: variantsNode.elements.map((variantNode) =>
      readVariant(sourceFile, variantNode)
    ),
    zhCN: readString(sourceFile, zhNode)
  };
}

function readVariant(sourceFile, node) {
  if (!ts.isArrayLiteralExpression(node) || node.elements.length !== 3) {
    throw new Error("Variant definition must be a string tuple.");
  }

  return {
    enUS: readString(sourceFile, node.elements[2]),
    key: readString(sourceFile, node.elements[0]),
    zhCN: readString(sourceFile, node.elements[1])
  };
}

function assertCall(sourceFile, node, name, argumentCount) {
  if (
    !ts.isCallExpression(node) ||
    node.expression.getText(sourceFile) !== name ||
    node.arguments.length !== argumentCount
  ) {
    throw new Error(`Expected ${name}(${argumentCount}) call.`);
  }
}

function readString(sourceFile, node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  throw new Error(`Expected string literal, got ${node.getText(sourceFile)}.`);
}

function buildAssets(categoryTree) {
  const duplicateBaseNames = collectDuplicateBaseNames(categoryTree);
  const assets = [];

  for (const kind of Object.keys(expectedCounts)) {
    const categories = categoryTree[kind] ?? [];
    let index = 0;

    for (const primary of categories) {
      for (const secondary of primary.secondaries) {
        for (const variant of secondary.variants) {
          index += 1;
          assets.push(
            buildAsset({
              duplicateBaseNames,
              index,
              kind,
              primary,
              secondary,
              variant
            })
          );
        }
      }
    }
  }

  return assets;
}

function collectDuplicateBaseNames(categoryTree) {
  const duplicateBaseNames = {};

  for (const kind of Object.keys(expectedCounts)) {
    const counts = new Map();

    for (const primary of categoryTree[kind] ?? []) {
      for (const secondary of primary.secondaries) {
        for (const variant of secondary.variants) {
          const baseName = `${variant.zhCN}${kindLabels[kind]}（通用V1）`;
          counts.set(baseName, (counts.get(baseName) ?? 0) + 1);
        }
      }
    }

    duplicateBaseNames[kind] = new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name)
    );
  }

  return duplicateBaseNames;
}

function buildAsset({ duplicateBaseNames, index, kind, primary, secondary, variant }) {
  const kindLabel = kindLabels[kind];
  const name = buildAssetName({
    duplicateBaseNames,
    kind,
    kindLabel,
    secondary,
    variant
  });
  const semanticTags = uniqueShortStrings([
    variant.zhCN,
    secondary.zhCN,
    primary.zhCN,
    variant.key,
    secondary.key,
    primary.key,
    variant.enUS,
    secondary.enUS
  ]);

  return {
    aiModifyPermissions: buildPermissions(kind),
    backgroundModes: ["light", "dark"],
    colorTags: buildColorTags(kind, variant.key),
    description: `用于${primary.zhCN} / ${secondary.zhCN}中的${variant.zhCN}表达，供 AI 生成 PPT 时检索复用。`,
    isEnabled: true,
    keywords: uniqueShortStrings([
      variant.key,
      secondary.key,
      primary.key,
      variant.enUS.toLowerCase(),
      secondary.enUS.toLowerCase(),
      primary.enUS.toLowerCase()
    ]),
    kind,
    name,
    pageTypes,
    preview: buildPreview(kind, variant, secondary),
    primaryCategory: primary.key,
    resource: buildResource(kind, primary, secondary, variant),
    reviewStatus: "APPROVED",
    secondaryCategory: secondary.key,
    semanticTags,
    setKey: "common",
    setKind: "COMMON",
    setName: packageSetName,
    sortOrder: sortBaseByKind[kind] + index,
    source: "MANUAL",
    style: buildStyle(kind, primary, secondary, variant),
    styleTags: buildStyleTags(kind, primary, secondary, variant),
    synonyms: uniqueShortStrings([
      variant.zhCN,
      variant.enUS,
      variant.key,
      secondary.zhCN,
      secondary.enUS
    ]).slice(0, 8),
    tags: uniqueShortStrings([
      kindLabel,
      primary.zhCN,
      secondary.zhCN,
      "通用语义资产包 v1",
      "通用V1",
      "AI 生成检索"
    ]),
    usageScenarios: uniqueShortStrings([
      primary.zhCN,
      secondary.zhCN,
      "模板工作区",
      "AI 生成检索",
      "通用 PPT 生成"
    ]),
    variantKey: variant.key
  };
}

function buildAssetName({
  duplicateBaseNames,
  kind,
  kindLabel,
  secondary,
  variant
}) {
  const baseName = `${variant.zhCN}${kindLabel}（通用V1）`;

  if (!duplicateBaseNames[kind]?.has(baseName)) {
    return baseName;
  }

  return `${variant.zhCN}${kindLabel}（${secondary.zhCN}通用V1）`;
}

function buildPermissions(kind) {
  return {
    allowAutoLayout: kind === "CONTAINER" || kind === "NAVIGATION",
    allowMove: true,
    allowRecolor: true,
    allowResize: true,
    allowStretch: kind === "SHAPE" || kind === "CONTAINER",
    allowTextShrink: kind === "TEXT_STYLE"
  };
}

function buildColorTags(kind, variantKey) {
  if (variantKey.includes("warning") || variantKey.includes("risk")) {
    return ["amber", "red", "neutral"];
  }

  if (variantKey.includes("success") || variantKey.includes("growth")) {
    return ["green", "blue", "neutral"];
  }

  if (kind === "TEXT_STYLE") {
    return ["neutral", "blue"];
  }

  return ["blue", "neutral"];
}

function buildStyleTags(kind, primary, secondary, variant) {
  return uniqueShortStrings([
    "universal-v1",
    "minimal",
    "ai-ready",
    kind.toLowerCase().replace("_", "-"),
    primary.key,
    secondary.key,
    variant.key.includes("tech") ? "tech" : "",
    variant.key.includes("warning") ? "warning" : ""
  ]);
}

function buildPreview(kind, variant, secondary) {
  if (kind === "ICON") {
    return {
      iconName: variant.key,
      label: variant.zhCN,
      shape: "lineIcon"
    };
  }

  if (kind === "SHAPE") {
    return {
      label: variant.zhCN,
      shape: pickShapeType(variant.key, secondary.key)
    };
  }

  if (kind === "LINE") {
    return {
      direction: pickLineDirection(variant.key, secondary.key),
      label: variant.zhCN,
      lineType: pickLineType(variant.key, secondary.key)
    };
  }

  if (kind === "TEXT_STYLE") {
    return {
      sampleText: pickTextSample(variant.key, variant.zhCN),
      shape: "textStyle",
      textRole: variant.key
    };
  }

  if (kind === "CONTAINER") {
    return {
      containerRole: variant.key,
      label: variant.zhCN,
      shape: pickContainerPreviewType(variant.key)
    };
  }

  return {
    displayMode: pickNavigationDisplayMode(variant.key, secondary.key),
    label: variant.zhCN,
    navigationRole: variant.key,
    shape: pickNavigationPreviewType(variant.key)
  };
}

function buildResource(kind, primary, secondary, variant) {
  const base = {
    packageId,
    primaryCategory: primary.key,
    secondaryCategory: secondary.key,
    semanticKey: variant.key,
    variantLabel: variant.zhCN
  };

  if (kind === "ICON") {
    return {
      ...base,
      replaceable: true,
      source: "semantic-key",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      type: "line-icon"
    };
  }

  if (kind === "SHAPE") {
    return {
      ...base,
      shapeType: pickShapeType(variant.key, secondary.key),
      type: "ppt-shape"
    };
  }

  if (kind === "LINE") {
    return {
      ...base,
      connectorType: pickConnectorType(variant.key, secondary.key),
      direction: pickLineDirection(variant.key, secondary.key),
      endArrowType: pickLineEndArrow(variant.key),
      startArrowType: pickLineStartArrow(variant.key),
      type: "ppt-line"
    };
  }

  if (kind === "TEXT_STYLE") {
    return {
      ...base,
      textRole: variant.key,
      type: "typography-token"
    };
  }

  if (kind === "CONTAINER") {
    return {
      ...base,
      displayRole: pickContainerPreviewType(variant.key),
      containerRole: variant.key,
      type: "layout-container"
    };
  }

  return {
    ...base,
    displayMode: pickNavigationDisplayMode(variant.key, secondary.key),
    navigationRole: variant.key,
    type: "deck-navigation"
  };
}

function buildStyle(kind, primary, secondary, variant) {
  if (kind === "ICON") {
    return {
      colorRole: "accent",
      cornerRadius: 12,
      fillMode: "none",
      iconStyle: "line",
      size: 24,
      strokeColor: "#2563eb",
      strokeWidth: 2
    };
  }

  if (kind === "SHAPE") {
    const shapeType = pickShapeType(variant.key, secondary.key);

    return {
      cornerRadius: pickShapeCornerRadius(shapeType, variant.key),
      fillColor: pickFillColor(variant.key),
      opacity: variant.key.includes("background") ? 0.55 : 1,
      shapeType,
      shadow: variant.key.includes("card") || variant.key.includes("panel"),
      strokeColor: pickStrokeColor(variant.key),
      strokeWidth: variant.key.includes("border") ? 2 : 1
    };
  }

  if (kind === "LINE") {
    return {
      cap: "round",
      connectorType: pickConnectorType(variant.key, secondary.key),
      dash: pickLineDash(variant.key, secondary.key),
      direction: pickLineDirection(variant.key, secondary.key),
      endArrowType: pickLineEndArrow(variant.key),
      startArrowType: pickLineStartArrow(variant.key),
      strokeColor: pickStrokeColor(variant.key),
      strokeWidth: pickLineWidth(variant.key, secondary.key)
    };
  }

  if (kind === "TEXT_STYLE") {
    return {
      ...buildTextStyle(variant.key),
      textRole: variant.key
    };
  }

  if (kind === "CONTAINER") {
    return {
      allowedContentTypes: pickContainerContentTypes(variant.key, secondary.key),
      autoLayout:
        variant.key.includes("column") ||
        variant.key.includes("list") ||
        secondary.key.includes("list"),
      containerRole: variant.key,
      fillColor: pickFillColor(variant.key),
      gap: variant.key.includes("column") ? 18 : 12,
      padding: variant.key.includes("compact") ? 12 : 18,
      recommendedHeight: pickContainerHeight(variant.key, secondary.key),
      recommendedWidth: pickContainerWidth(variant.key, secondary.key),
      strokeColor: pickStrokeColor(variant.key),
      strokeWidth: variant.key.includes("border") ? 2 : 1
    };
  }

  return {
    activeColor: "#2563eb",
    displayMode: pickNavigationDisplayMode(variant.key, secondary.key),
    fixedPosition: pickNavigationPosition(variant.key, secondary.key),
    inactiveColor: "#94a3b8",
    navigationRole: variant.key,
    showOnCover: variant.key.includes("toc") || variant.key.includes("chapter"),
    showOnEnding: false
  };
}

function pickShapeType(variantKey, secondaryKey) {
  if (variantKey === "rect") {
    return "rect";
  }

  if (variantKey.includes("parallelogram")) {
    return "parallelogram";
  }

  if (variantKey.includes("trapezoid")) {
    return "trapezoid";
  }

  if (variantKey.includes("hexagon")) {
    return "hexagon";
  }

  if (variantKey.includes("square")) {
    return "square";
  }

  if (variantKey.includes("sector")) {
    return "sector";
  }

  if (variantKey.includes("arc")) {
    return "arc";
  }

  if (variantKey.includes("circle") || variantKey.includes("dot")) {
    return "circle";
  }

  if (variantKey.includes("ellipse")) {
    return "ellipse";
  }

  if (variantKey.includes("diamond")) {
    return "diamond";
  }

  if (variantKey.includes("triangle")) {
    return "triangle";
  }

  if (variantKey.includes("pill") || variantKey.includes("tag")) {
    return "pill";
  }

  if (variantKey.includes("arrow")) {
    return "arrow";
  }

  if (secondaryKey.includes("card") || variantKey.includes("card")) {
    return "card";
  }

  return "roundedRect";
}

function pickShapeCornerRadius(shapeType, variantKey) {
  if (shapeType === "circle" || shapeType === "ellipse" || shapeType === "pill") {
    return 999;
  }

  if (variantKey.includes("card") || variantKey.includes("rounded")) {
    return 14;
  }

  return 8;
}

function pickLineType(variantKey, secondaryKey) {
  if (variantKey.includes("wave")) {
    return "wave";
  }

  if (variantKey.includes("vertical")) {
    return "vertical";
  }

  if (variantKey.includes("diagonal")) {
    return "diagonal";
  }

  if (variantKey.includes("polyline")) {
    return "polyline";
  }

  if (variantKey.includes("curve") || variantKey.includes("loop")) {
    return "curve";
  }

  if (variantKey.includes("arc")) {
    return "arc";
  }

  if (variantKey.includes("double")) {
    return "double";
  }

  if (variantKey.includes("arrow") && !variantKey.includes("no-arrow")) {
    return "arrow";
  }

  if (variantKey.includes("divider")) {
    return "divider";
  }

  if (
    variantKey.includes("turn") ||
    variantKey.includes("elbow") ||
    variantKey.includes("connector") ||
    variantKey.includes("leader") ||
    secondaryKey.includes("relation")
  ) {
    return "elbow";
  }

  return "straight";
}

function pickConnectorType(variantKey, secondaryKey) {
  const lineType = pickLineType(variantKey, secondaryKey);

  if (lineType === "curve" || lineType === "arc" || lineType === "wave") {
    return "curved";
  }

  if (lineType === "elbow" || lineType === "polyline") {
    return "elbow";
  }

  return "straight";
}

function pickLineDash(variantKey, secondaryKey) {
  if (variantKey.includes("dot")) {
    return "dot";
  }

  if (
    variantKey.includes("dash") ||
    variantKey.includes("draft") ||
    secondaryKey.includes("decorative")
  ) {
    return "dash";
  }

  return "solid";
}

function pickLineDirection(variantKey, secondaryKey) {
  if (variantKey.includes("left-arrow") || variantKey.includes("return")) {
    return "left";
  }

  if (variantKey.includes("up-arrow")) {
    return "up";
  }

  if (variantKey.includes("down-arrow")) {
    return "down";
  }

  if (variantKey.includes("vertical") || variantKey.includes("top-bottom")) {
    return "vertical";
  }

  if (variantKey.includes("diagonal") || variantKey.includes("decline")) {
    return "diagonal";
  }

  if (
    variantKey.includes("polyline") ||
    variantKey.includes("turn") ||
    variantKey.includes("elbow") ||
    variantKey.includes("connector") ||
    variantKey.includes("leader") ||
    secondaryKey.includes("relation")
  ) {
    return "polyline";
  }

  if (variantKey.includes("curve") || variantKey.includes("loop")) {
    return "curve";
  }

  if (variantKey.includes("arc")) {
    return "arc";
  }

  if (variantKey.includes("wave")) {
    return "wave";
  }

  return "horizontal";
}

function pickLineEndArrow(variantKey) {
  if (variantKey.includes("no-arrow")) {
    return "none";
  }

  if (
    variantKey.includes("arrow") ||
    variantKey.includes("flow") ||
    variantKey.includes("route") ||
    variantKey.includes("dependency")
  ) {
    return "triangle";
  }

  return "none";
}

function pickLineStartArrow(variantKey) {
  if (variantKey.includes("no-arrow")) {
    return "none";
  }

  if (
    variantKey.includes("two-way") ||
    variantKey.includes("cycle") ||
    variantKey.includes("loop")
  ) {
    return "triangle";
  }

  return "none";
}

function pickLineWidth(variantKey, secondaryKey) {
  if (variantKey.includes("bold") || secondaryKey.includes("emphasis")) {
    return 3;
  }

  if (variantKey.includes("grid")) {
    return 1;
  }

  return 2;
}

function pickFillColor(variantKey) {
  if (variantKey.includes("warning") || variantKey.includes("risk")) {
    return "#fef3c7";
  }

  if (variantKey.includes("success") || variantKey.includes("growth")) {
    return "#dcfce7";
  }

  if (variantKey.includes("tech") || variantKey.includes("ai")) {
    return "#e0f2fe";
  }

  return "#f8fafc";
}

function pickStrokeColor(variantKey) {
  if (variantKey.includes("warning") || variantKey.includes("risk")) {
    return "#d97706";
  }

  if (variantKey.includes("success") || variantKey.includes("growth")) {
    return "#16a34a";
  }

  return "#2563eb";
}

function buildTextStyle(variantKey) {
  const isCover = variantKey.includes("cover");
  const isTitle = variantKey.includes("title") || variantKey.includes("heading");
  const isNumber = variantKey.includes("number");
  const isFootnote =
    variantKey.includes("footer") ||
    variantKey.includes("source") ||
    variantKey.includes("annotation");

  return {
    color: isFootnote ? "#64748b" : isNumber ? "#2563eb" : "#111827",
    fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
    fontSize: isCover ? 42 : isTitle ? 28 : isNumber ? 38 : isFootnote ? 11 : 16,
    fontWeight: isCover || isTitle || isNumber ? 700 : 400,
    letterSpacing: 0,
    lineHeight: isCover || isTitle ? 1.18 : 1.35,
    maxLines: isCover ? 2 : isTitle ? 2 : isFootnote ? 2 : 5,
    recommendedCharacters: isCover ? 28 : isTitle ? 34 : isFootnote ? 60 : 90
  };
}

function pickTextSample(variantKey, variantLabel) {
  if (variantKey.includes("number")) {
    return "86%";
  }

  if (variantKey.includes("tag")) {
    return "标签";
  }

  if (variantKey.includes("footer") || variantKey.includes("source")) {
    return "来源说明";
  }

  if (variantKey.includes("annotation")) {
    return "注释说明";
  }

  if (variantKey.includes("bullet")) {
    return "关键要点";
  }

  if (variantKey.includes("subtitle")) {
    return "战略简报副标题";
  }

  if (variantLabel.includes("标题")) {
    return "标题层级";
  }

  if (variantLabel.includes("引用")) {
    return "核心洞察";
  }

  return "正文样式";
}

function pickContainerContentTypes(variantKey, secondaryKey) {
  if (variantKey.includes("image")) {
    return ["image", "text"];
  }

  if (variantKey.includes("chart")) {
    return ["chart", "text"];
  }

  if (variantKey.includes("metric")) {
    return ["metric", "text"];
  }

  if (secondaryKey.includes("media")) {
    return ["image", "chart"];
  }

  return ["text"];
}

function pickContainerWidth(variantKey, secondaryKey) {
  if (variantKey.includes("three-column")) {
    return 240;
  }

  if (variantKey.includes("two-column") || secondaryKey.includes("columns")) {
    return 360;
  }

  return 320;
}

function pickContainerHeight(variantKey, secondaryKey) {
  if (variantKey.includes("image") || secondaryKey.includes("media")) {
    return 220;
  }

  if (variantKey.includes("metric")) {
    return 150;
  }

  return 170;
}

function pickContainerPreviewType(variantKey) {
  if (variantKey.includes("column")) {
    return "columns";
  }

  if (variantKey.includes("metric")) {
    return "metric";
  }

  if (variantKey.includes("image")) {
    return variantKey.includes("text") ? "image-text" : "image";
  }

  if (variantKey.includes("chart")) {
    return "chart";
  }

  if (variantKey.includes("placeholder")) {
    return "placeholder";
  }

  if (variantKey.includes("list") || variantKey.includes("check")) {
    return "list";
  }

  if (variantKey.includes("quote")) {
    return "quote";
  }

  if (variantKey.includes("warning")) {
    return "warning";
  }

  if (variantKey.includes("insight")) {
    return "insight";
  }

  if (variantKey.includes("highlight")) {
    return "highlight";
  }

  if (variantKey.includes("conclusion") || variantKey.includes("summary")) {
    return "conclusion";
  }

  return "container";
}

function pickNavigationDisplayMode(variantKey, secondaryKey) {
  if (variantKey.includes("toc")) {
    return variantKey.includes("grid") ? "grid" : "list";
  }

  if (secondaryKey.includes("progress")) {
    return "progress";
  }

  if (secondaryKey.includes("step")) {
    return "step";
  }

  return "label";
}

function pickNavigationPreviewType(variantKey) {
  if (variantKey.includes("grid")) {
    return "grid-navigation";
  }

  if (variantKey.includes("toc")) {
    return "toc-navigation";
  }

  if (variantKey.includes("progress")) {
    return variantKey.includes("dot") ? "dot-progress" : "progress";
  }

  if (variantKey.includes("step")) {
    return "step-navigation";
  }

  if (variantKey.includes("page") || variantKey.includes("footer")) {
    return "page-navigation";
  }

  return "navigation";
}

function pickNavigationPosition(variantKey, secondaryKey) {
  if (variantKey.includes("footer") || secondaryKey.includes("page-index")) {
    return "bottom";
  }

  if (variantKey.includes("sidebar")) {
    return "left";
  }

  return "top";
}

function uniqueShortStrings(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .filter((value) => value.length <= 40)
    )
  ).slice(0, 16);
}

function countByKind(assets) {
  return assets.reduce((counts, asset) => {
    counts[asset.kind] = (counts[asset.kind] ?? 0) + 1;
    return counts;
  }, {});
}

function assertPackageIntegrity(assets, kindCounts) {
  const expectedTotal = Object.values(expectedCounts).reduce(
    (total, count) => total + count,
    0
  );

  if (assets.length !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} assets, got ${assets.length}.`);
  }

  for (const [kind, expectedCount] of Object.entries(expectedCounts)) {
    if (kindCounts[kind] !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} ${kind} assets, got ${kindCounts[kind] ?? 0}.`
      );
    }
  }

  const uniqueKeys = new Set();

  for (const asset of assets) {
    const key = `${asset.setKind}:${asset.setKey}:${asset.kind}:${asset.name}`;

    if (uniqueKeys.has(key)) {
      throw new Error(`Duplicate asset key: ${key}`);
    }

    uniqueKeys.add(key);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
