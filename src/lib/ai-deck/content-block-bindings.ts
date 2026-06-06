import {
  slideCanvasHeight,
  slideCanvasSafeMargin,
  slideContentBlockMaxCount,
  slideCanvasWidth,
  type SlideCompositionPlan,
  type SlideElement
} from "./schema";

type ContentBlock = SlideCompositionPlan["content"]["contentBlocks"][number];
type SlideWithContentBlocks = Pick<SlideCompositionPlan, "content" | "elements">;
type SlideWithRenderableContentBlocks = Pick<
  SlideCompositionPlan,
  "content" | "elements" | "slideId"
>;

type ContentBlockSemanticType = NonNullable<ContentBlock["type"]>;

export type SlideContentBlockBindings = {
  contentBlockIndexByElementId: Map<string, number>;
  elementIdByContentBlockIndex: Map<number, string>;
};

export type DedupeSlideContentBlocksResult = {
  contentBlocks: ContentBlock[];
  indexMap: Map<number, number>;
  removedIndexes: Set<number>;
};

export function dedupeSlideContentBlocks(
  contentBlocks: ContentBlock[],
  options: {
    pageType?: SlideCompositionPlan["content"]["pageType"];
  } = {}
): DedupeSlideContentBlocksResult {
  const selected = new Map<
    string,
    {
      block: ContentBlock;
      index: number;
    }
  >();

  contentBlocks.forEach((block, index) => {
    const content = contentBlockText(block);

    if (content.trim().length < 2) {
      return;
    }

    const key = contentBlockDedupeKey(block, options);
    const existing = selected.get(key);

    if (!key) {
      return;
    }

    if (
      !existing ||
      shouldPreferContentBlock({
        candidate: block,
        candidateIndex: index,
        existing: existing.block,
        existingIndex: existing.index
      })
    ) {
      selected.set(key, {
        block,
        index
      });
    }
  });

  const chosen = Array.from(selected.values())
    .sort((current, next) => current.index - next.index)
    .slice(0, slideContentBlockMaxCount);
  const indexMap = new Map<number, number>();
  const removedIndexes = new Set<number>();

  chosen.forEach((item, nextIndex) => {
    indexMap.set(item.index, nextIndex);
  });

  contentBlocks.forEach((_, index) => {
    if (!indexMap.has(index)) {
      removedIndexes.add(index);
    }
  });

  return {
    contentBlocks: chosen.map((item) => item.block),
    indexMap,
    removedIndexes
  };
}

export function dedupeSlideContentBlocksForComposition<
  T extends Pick<SlideCompositionPlan, "content" | "elements" | "slideId">
>(slide: T): T {
  const deduped = dedupeSlideContentBlocks(slide.content.contentBlocks, {
    pageType: slide.content.pageType
  });

  if (deduped.removedIndexes.size === 0) {
    return slide;
  }

  const elements = slide.elements.flatMap((element) => {
    const index = validContentBlockIndex(element.contentBlockIndex, slide.content);

    if (index === undefined) {
      return [omitContentBlockIndex(element)];
    }

    const nextIndex = deduped.indexMap.get(index);

    if (nextIndex !== undefined) {
      return [
        {
          ...element,
          contentBlockIndex: nextIndex
        }
      ];
    }

    if (isGeneratedContentBlockTextElement(element, slide.slideId)) {
      return [];
    }

    return [omitContentBlockIndex(element)];
  });

  return {
    ...slide,
    content: {
      ...slide.content,
      contentBlocks: deduped.contentBlocks,
      contentLayers: remapContentLayersAfterDedupe(
        slide.content.contentLayers,
        deduped.indexMap,
        deduped.contentBlocks
      )
    },
    elements
  };
}

function remapContentLayersAfterDedupe(
  layers: SlideCompositionPlan["content"]["contentLayers"],
  indexMap: Map<number, number>,
  contentBlocks: ContentBlock[]
): SlideCompositionPlan["content"]["contentLayers"] {
  const used = new Set<number>();
  const remapped: SlideCompositionPlan["content"]["contentLayers"] = {
    primary: [],
    supporting: [],
    supplementary: []
  };

  for (const group of ["primary", "supporting", "supplementary"] as const) {
    const maxItems = group === "primary" ? 4 : group === "supporting" ? 6 : 5;

    for (const oldIndex of layers[group]) {
      const nextIndex = indexMap.get(oldIndex);

      if (
        nextIndex !== undefined &&
        !used.has(nextIndex) &&
        remapped[group].length < maxItems
      ) {
        used.add(nextIndex);
        remapped[group].push(nextIndex);
      }
    }
  }

  const ordered = contentBlocks
    .map((block, index) => ({ index, priority: block.priority }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index);
  const add = (
    group: keyof SlideCompositionPlan["content"]["contentLayers"],
    index: number
  ) => {
    const maxItems = group === "primary" ? 4 : group === "supporting" ? 6 : 5;

    if (used.has(index) || remapped[group].length >= maxItems) {
      return false;
    }

    used.add(index);
    remapped[group].push(index);
    return true;
  };

  if (remapped.primary.length === 0) {
    ordered.some(({ index }) => add("primary", index));
  }

  if (remapped.supporting.length === 0) {
    ordered.some(({ index }) => add("supporting", index));
  }

  for (const { index, priority } of ordered) {
    if (used.has(index)) {
      continue;
    }

    if (priority <= 1 && add("primary", index)) {
      continue;
    }

    if (priority <= 3 && add("supporting", index)) {
      continue;
    }

    if (add("supplementary", index)) {
      continue;
    }

    if (add("supporting", index)) {
      continue;
    }

    add("primary", index);
  }

  return remapped;
}

export function resolveSlideContentBlockBindings(
  slide: SlideWithContentBlocks
): SlideContentBlockBindings {
  const contentBlockIndexByElementId = new Map<string, number>();
  const elementIdByContentBlockIndex = new Map<number, string>();
  const normalizedBlocks = slide.content.contentBlocks.map((block, index) => ({
    block,
    index,
    normalizedText: normalizeContentBlockText(contentBlockText(block))
  }));

  for (const element of slide.elements) {
    const explicitContentBlockIndex = validContentBlockIndex(
      element.contentBlockIndex,
      slide.content
    );

    if (explicitContentBlockIndex === undefined) {
      continue;
    }

    if (elementIdByContentBlockIndex.has(explicitContentBlockIndex)) {
      continue;
    }

    if (
      !contentBlockTypeMatchesElement(
        slide.content.contentBlocks[explicitContentBlockIndex],
        element
      )
    ) {
      continue;
    }

    contentBlockIndexByElementId.set(element.id, explicitContentBlockIndex);
    elementIdByContentBlockIndex.set(explicitContentBlockIndex, element.id);
  }

  for (const element of slide.elements) {
    if (contentBlockIndexByElementId.has(element.id)) {
      continue;
    }

    const contentBlockIndex = inferContentBlockIndexForElement({
      element,
      normalizedBlocks,
      usedBlockIndexes: new Set(elementIdByContentBlockIndex.keys())
    });

    if (contentBlockIndex === undefined) {
      continue;
    }

    contentBlockIndexByElementId.set(element.id, contentBlockIndex);
    elementIdByContentBlockIndex.set(contentBlockIndex, element.id);
  }

  return {
    contentBlockIndexByElementId,
    elementIdByContentBlockIndex
  };
}

export function bindElementsToContentBlocks(
  slide: SlideWithContentBlocks
): SlideElement[] {
  const { contentBlockIndexByElementId } = resolveSlideContentBlockBindings(slide);

  return slide.elements.map((element) => {
    const contentBlockIndex = contentBlockIndexByElementId.get(element.id);

    if (contentBlockIndex === undefined) {
      return omitContentBlockIndex(element);
    }

    return {
      ...element,
      contentBlockIndex
    };
  });
}

export function completeElementsForContentBlocks(
  slide: SlideWithRenderableContentBlocks
): SlideElement[] {
  const boundElements = bindElementsToContentBlocks(slide);
  const aggregateElementIds = findAggregateTextElementIds({
    contentBlocks: slide.content.contentBlocks,
    elements: boundElements
  });
  let elements = boundElements.filter(
    (element) => !aggregateElementIds.has(element.id)
  );

  elements = bindPreferredTitleBlock({
    contentBlocks: slide.content.contentBlocks,
    elements
  });

  const bindings = resolveSlideContentBlockBindings({
    content: slide.content,
    elements
  });
  const missingBlockIndexes = slide.content.contentBlocks
    .map((_, index) => index)
    .filter((index) => !bindings.elementIdByContentBlockIndex.has(index));

  if (missingBlockIndexes.length === 0) {
    return bindElementsToContentBlocks({
      content: slide.content,
      elements
    });
  }

  const layoutRegion = pickContentBlockLayoutRegion({
    fallbackElements: elements,
    removedElements: boundElements.filter((element) =>
      aggregateElementIds.has(element.id)
    )
  });
  const usedIds = new Set(elements.map((element) => element.id));
  const additions = buildMissingContentBlockElements({
    blockIndexes: missingBlockIndexes,
    contentBlocks: slide.content.contentBlocks,
    hasPrimaryTitleElement: elements.some(
      (element) => element.type === "text" && element.semanticType === "title"
    ),
    region: layoutRegion,
    slideId: slide.slideId,
    usedIds
  });

  return bindElementsToContentBlocks({
    content: slide.content,
    elements: [...elements, ...additions]
  });
}

export function getMissingContentBlockIndexes(
  slide: SlideWithContentBlocks
): number[] {
  const bindings = resolveSlideContentBlockBindings(slide);

  return slide.content.contentBlocks
    .map((_, index) => index)
    .filter((index) => !bindings.elementIdByContentBlockIndex.has(index));
}

function inferContentBlockIndexForElement({
  element,
  normalizedBlocks,
  usedBlockIndexes
}: {
  element: SlideElement;
  normalizedBlocks: Array<{
    block: ContentBlock;
    index: number;
    normalizedText: string;
  }>;
  usedBlockIndexes: Set<number>;
}) {
  if (element.type !== "text" || !element.content) {
    return undefined;
  }

  const elementText = normalizeContentBlockText(element.content);
  const candidates = normalizedBlocks.filter(
    (item) =>
      !usedBlockIndexes.has(item.index) &&
      contentBlockTypeMatchesElement(item.block, element)
  );
  const exactMatches = candidates.filter(
    (item) => item.normalizedText === elementText
  );

  if (exactMatches.length === 1) {
    return exactMatches[0].index;
  }

  const containedMatches = candidates.filter(
    (item) =>
      item.normalizedText.length >= 2 && elementText.includes(item.normalizedText)
  );

  if (containedMatches.length === 1) {
    return containedMatches[0].index;
  }

  return undefined;
}

function findAggregateTextElementIds({
  contentBlocks,
  elements
}: {
  contentBlocks: ContentBlock[];
  elements: SlideElement[];
}) {
  const aggregateIds = new Set<string>();

  for (const element of elements) {
    if (
      element.type !== "text" ||
      !element.content ||
      !(element.semanticType === "body" || element.semanticType === "card")
    ) {
      continue;
    }

    const elementText = normalizeContentBlockText(element.content);
    const matchCount = contentBlocks.filter((block) => {
      const blockText = normalizeContentBlockText(contentBlockText(block));

      return blockText.length >= 2 && elementText.includes(blockText);
    }).length;

    if (matchCount >= 2) {
      aggregateIds.add(element.id);
    }
  }

  return aggregateIds;
}

function bindPreferredTitleBlock({
  contentBlocks,
  elements
}: {
  contentBlocks: ContentBlock[];
  elements: SlideElement[];
}) {
  const titleBlockIndex = contentBlocks.findIndex(
    (block) => contentBlockSemanticType(block) === "heading"
  );

  if (titleBlockIndex < 0) {
    return elements;
  }

  const bindings = resolveSlideContentBlockBindings({
    content: {
      contentBlocks
    } as SlideCompositionPlan["content"],
    elements
  });

  if (bindings.elementIdByContentBlockIndex.has(titleBlockIndex)) {
    return elements;
  }

  const titleElement = elements.find(
    (element) =>
      element.type === "text" &&
      element.semanticType === "title" &&
      !bindings.contentBlockIndexByElementId.has(element.id)
  );

  if (!titleElement) {
    return elements;
  }

  return elements.map((element) =>
    element.id === titleElement.id
      ? {
          ...element,
          content: contentBlockText(contentBlocks[titleBlockIndex]),
          contentBlockIndex: titleBlockIndex
        }
      : element
  );
}

function pickContentBlockLayoutRegion({
  fallbackElements,
  removedElements
}: {
  fallbackElements: SlideElement[];
  removedElements: SlideElement[];
}) {
  const removedTextRegion = unionBounds(
    removedElements.filter((element) => element.type === "text")
  );

  if (removedTextRegion) {
    return expandRegionWithinCanvas(removedTextRegion, 0.08);
  }

  const bodyTextRegion = unionBounds(
    fallbackElements.filter(
      (element) =>
        element.type === "text" &&
        (element.semanticType === "body" || element.semanticType === "card")
    )
  );

  if (bodyTextRegion) {
    return expandRegionWithinCanvas(bodyTextRegion, 0.08);
  }

  const titleBottom = Math.max(
    1.25,
    ...fallbackElements
      .filter((element) => element.semanticType === "title")
      .map((element) => element.bounds.y + element.bounds.height + 0.28)
  );
  const rightVisual = fallbackElements.find(
    (element) =>
      ["generatedImage", "chartPlaceholder"].includes(element.type) &&
      element.bounds.x > slideCanvasWidth / 2
  );
  const x = slideCanvasSafeMargin + 0.22;
  const width = rightVisual
    ? Math.max(4.8, rightVisual.bounds.x - x - 0.38)
    : slideCanvasWidth - x - slideCanvasSafeMargin - 0.22;
  const y = Math.min(titleBottom, slideCanvasHeight - 1.4);

  return {
    height: Math.max(1.1, slideCanvasHeight - y - slideCanvasSafeMargin - 0.28),
    width,
    x,
    y
  };
}

function unionBounds(elements: SlideElement[]) {
  if (elements.length === 0) {
    return null;
  }

  const minX = Math.min(...elements.map((element) => element.bounds.x));
  const minY = Math.min(...elements.map((element) => element.bounds.y));
  const maxX = Math.max(
    ...elements.map((element) => element.bounds.x + element.bounds.width)
  );
  const maxY = Math.max(
    ...elements.map((element) => element.bounds.y + element.bounds.height)
  );

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY
  };
}

function expandRegionWithinCanvas(
  region: SlideElement["bounds"],
  padding: number
) {
  const x = Math.max(slideCanvasSafeMargin, region.x - padding);
  const y = Math.max(slideCanvasSafeMargin, region.y - padding);
  const maxWidth = slideCanvasWidth - x - slideCanvasSafeMargin;
  const maxHeight = slideCanvasHeight - y - slideCanvasSafeMargin;

  return {
    height: Math.max(0.5, Math.min(maxHeight, region.height + padding * 2)),
    width: Math.max(1.8, Math.min(maxWidth, region.width + padding * 2)),
    x,
    y
  };
}

function buildMissingContentBlockElements({
  blockIndexes,
  contentBlocks,
  hasPrimaryTitleElement,
  region,
  slideId,
  usedIds
}: {
  blockIndexes: number[];
  contentBlocks: ContentBlock[];
  hasPrimaryTitleElement: boolean;
  region: SlideElement["bounds"];
  slideId: string;
  usedIds: Set<string>;
}) {
  const columns = blockIndexes.length >= 7 && region.width >= 5.6 ? 2 : 1;
  const rows = Math.ceil(blockIndexes.length / columns);
  const gapX = columns > 1 ? 0.24 : 0;
  const gapY = 0.1;
  const cellWidth = (region.width - gapX * (columns - 1)) / columns;
  const cellHeight = Math.max(
    0.34,
    (region.height - gapY * Math.max(0, rows - 1)) / rows
  );
  const compactFontSize =
    blockIndexes.length >= 10 ? 10 : blockIndexes.length >= 7 ? 11 : 12;

  return blockIndexes.map((blockIndex, itemIndex) => {
    const block = contentBlocks[blockIndex];
    const column = itemIndex % columns;
    const row = Math.floor(itemIndex / columns);

    return contentBlockTextElement({
      block,
      blockIndex,
      bounds: {
        height: roundCanvasValue(cellHeight),
        width: roundCanvasValue(cellWidth),
        x: roundCanvasValue(region.x + column * (cellWidth + gapX)),
        y: roundCanvasValue(region.y + row * (cellHeight + gapY))
      },
      fontSize: compactFontSize,
      id: uniqueContentBlockElementId(slideId, blockIndex, usedIds),
      semanticType:
        contentBlockSemanticType(block) === "heading" && hasPrimaryTitleElement
          ? "body"
          : undefined
    });
  });
}

function contentBlockTextElement({
  block,
  blockIndex,
  bounds,
  fontSize,
  id,
  semanticType
}: {
  block: ContentBlock;
  blockIndex: number;
  bounds: SlideElement["bounds"];
  fontSize: number;
  id: string;
  semanticType?: SlideElement["semanticType"];
}): SlideElement {
  return {
    id,
    type: "text",
    role: contentBlockRole(block, blockIndex),
    content: contentBlockText(block),
    bounds,
    contentBlockIndex: blockIndex,
    editable: true,
    hierarchyLevel: block.priority <= 1 ? 1 : block.priority <= 3 ? 2 : 3,
    semanticType: semanticType ?? semanticTypeForContentBlock(contentBlockSemanticType(block)),
    zIndex: 36 + blockIndex,
    styleNotes: "由可展示内容补齐层生成，确保内容块可在画布和元素编排中选择。",
    requiresImageGeneration: false,
    textStyle: {
      align: contentBlockSemanticType(block) === "heading" ? "left" : "left",
      fontSize,
      fontWeight:
        block.priority <= 1
          ? "bold"
          : block.priority <= 3
            ? "medium"
            : "regular",
      lineHeight: 1.2,
      maxLines: bounds.height < 0.5 ? 1 : 2
    }
  };
}

function semanticTypeForContentBlock(blockType: ContentBlockSemanticType): SlideElement["semanticType"] {
  if (blockType === "heading") {
    return "title";
  }

  if (blockType === "metric" || blockType === "callout") {
    return "badge";
  }

  if (blockType === "chart" || blockType === "table") {
    return "chart";
  }

  if (blockType === "quote" || blockType === "summary" || blockType === "conclusion") {
    return "subtitle";
  }

  if (blockType === "steps" || blockType === "timeline" || blockType === "comparison") {
    return "card";
  }

  return "body";
}

function contentBlockRole(block: ContentBlock, blockIndex: number) {
  const roleByType: Record<ContentBlockSemanticType, string> = {
    callout: "可展示强调",
    chart: "可展示图表说明",
    comparison: "可展示对比项",
    conclusion: "可展示结论",
    heading: "可展示标题",
    image: "可展示图片说明",
    list: "可展示列表",
    metric: "可展示指标",
    quote: "可展示引用",
    source: "可展示来源",
    steps: "可展示步骤",
    summary: "可展示摘要",
    table: "可展示表格",
    text: "可展示正文",
    timeline: "可展示时间线"
  };

  return `${roleByType[contentBlockSemanticType(block)]} ${blockIndex + 1}`;
}

function uniqueContentBlockElementId(
  slideId: string,
  blockIndex: number,
  usedIds: Set<string>
) {
  const prefix = slideId.length > 42 ? slideId.slice(0, 42) : slideId;
  let id = `${prefix}-cb-${blockIndex + 1}`;
  let suffix = 2;

  while (usedIds.has(id)) {
    const suffixText = `-${suffix}`;
    id = `${prefix.slice(0, 60 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function validContentBlockIndex(
  index: number | undefined,
  content: SlideCompositionPlan["content"]
) {
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= content.contentBlocks.length
  ) {
    return undefined;
  }

  return index;
}

function contentBlockTypeMatchesElement(block: ContentBlock | undefined, element: SlideElement) {
  if (!block) {
    return false;
  }

  const blockType = contentBlockLegacyType(block);
  const semanticType = contentBlockSemanticType(block);

  if (element.semanticType === "title") {
    return blockType === "title";
  }

  if (element.semanticType === "subtitle") {
    return blockType === "conclusion" || blockType === "quote" || blockType === "body";
  }

  if (element.semanticType === "badge") {
    return blockType === "metric" || blockType === "tag";
  }

  if (element.semanticType === "body" || element.semanticType === "card") {
    return (
      blockType === "title" ||
      blockType === "body" ||
      blockType === "step" ||
      blockType === "comparison" ||
      blockType === "conclusion" ||
      blockType === "note" ||
      blockType === "metric" ||
      blockType === "tag"
    );
  }

  if (element.semanticType === "chart") {
    return blockType === "chart";
  }

  if (
    element.type === "generatedImage" ||
    element.type === "icon" ||
    element.semanticType === "heroVisual" ||
    element.semanticType === "supportingVisual" ||
    element.semanticType === "icon"
  ) {
    return semanticType === "image";
  }

  return false;
}

export function contentBlockText(block: ContentBlock) {
  return block.content ?? block.text;
}

function contentBlockSemanticType(
  block: ContentBlock
): ContentBlockSemanticType {
  return block.type ?? semanticContentBlockTypeForLegacy(block.blockType);
}

function contentBlockLegacyType(block: ContentBlock) {
  return block.blockType;
}

function semanticContentBlockTypeForLegacy(
  blockType: ContentBlock["blockType"]
): ContentBlockSemanticType {
  const map: Record<ContentBlock["blockType"], ContentBlockSemanticType> = {
    body: "text",
    chart: "chart",
    comparison: "comparison",
    conclusion: "conclusion",
    metric: "metric",
    note: "source",
    quote: "quote",
    step: "steps",
    tag: "callout",
    title: "heading"
  };

  return map[blockType];
}

export function normalizeContentBlockText(value: string) {
  return value
    .normalize("NFKC")
    .replace(
      /^(页脚|页眉|脚注|备注|注|说明|主题|课件主题|课程主题|课件名|课程名|封面|标题|作者|作者信息|来源|出处|footer|header|note|remark|theme|topic|course|courseware|author|source)\s*[:：\-—–|｜]?\s*/iu,
      ""
    )
    .replace(/^\d{1,2}\s*/u, "")
    .replace(/[\s《》「」『』“”"'，。！？、：:；;,.!?()[\]（）【】_\-|｜]/gu, "")
    .toLowerCase();
}

function contentBlockDedupeKey(
  block: ContentBlock,
  options: {
    pageType?: SlideCompositionPlan["content"]["pageType"];
  }
) {
  const text = contentBlockText(block);
  const normalized = normalizeContentBlockText(text);

  if (isAuthorContentBlock(text)) {
    return `author:${normalized}`;
  }

  if (options.pageType === "cover" && isCoursewareMetaContentBlock(text)) {
    return "cover-meta:courseware";
  }

  return normalized;
}

function shouldPreferContentBlock({
  candidate,
  candidateIndex,
  existing,
  existingIndex
}: {
  candidate: ContentBlock;
  candidateIndex: number;
  existing: ContentBlock;
  existingIndex: number;
}) {
  const candidateScore = contentBlockPreferenceScore(candidate);
  const existingScore = contentBlockPreferenceScore(existing);

  if (candidateScore !== existingScore) {
    return candidateScore > existingScore;
  }

  if (candidate.priority !== existing.priority) {
    return candidate.priority < existing.priority;
  }

  return candidateIndex < existingIndex;
}

function contentBlockPreferenceScore(block: ContentBlock) {
  const text = contentBlockText(block);
  const type = contentBlockSemanticType(block);
  let score = Math.min(text.length, 120);

  if (type === "heading") {
    score += 120;
  }

  if (isAuthorContentBlock(text) && hasDecorativePrefix(text)) {
    score += 60;
  }

  if (isCoursewareMetaContentBlock(text)) {
    score += Math.min(text.length, 80);
  }

  score += Math.max(0, 6 - block.priority) * 8;

  return score;
}

function hasDecorativePrefix(text: string) {
  return /^(?:作者|作者信息|来源|出处|author|source)\s*[:：\-—–|｜]/iu.test(
    text.normalize("NFKC").trim()
  );
}

function isAuthorContentBlock(text: string) {
  const normalized = text.normalize("NFKC").trim();

  return (
    /^(?:作者|作者信息|author)\s*[:：\-—–|｜]/iu.test(normalized) ||
    /^[\p{Script=Han}·]{2,12}(?:（[^）]{1,12}）|\([^)]{1,12}\))$/u.test(normalized)
  );
}

function isCoursewareMetaContentBlock(text: string) {
  const normalized = text.normalize("NFKC").trim();
  const compact = normalizeContentBlockText(normalized);

  return (
    /(?:课件|课程|精品课|精品课程|精讲|讲课件|统编版|部编版|人教版|苏教版|北师大版|年级|上册|下册|册|教材|语文|数学|英语|物理|化学|历史|地理|政治|生物)/u.test(
      normalized
    ) &&
    !/作者|author/iu.test(normalized) &&
    compact.length <= 36
  );
}

function isGeneratedContentBlockTextElement(
  element: SlideElement,
  slideId: string
) {
  return (
    element.type === "text" &&
    element.id.startsWith(`${slideId}-cb-`) &&
    element.styleNotes.includes("可展示内容补齐层")
  );
}

function roundCanvasValue(value: number) {
  return Math.round(value * 100) / 100;
}

function omitContentBlockIndex(element: SlideElement): SlideElement {
  if (element.contentBlockIndex === undefined) {
    return element;
  }

  const rest = { ...element };

  delete rest.contentBlockIndex;

  return rest;
}
