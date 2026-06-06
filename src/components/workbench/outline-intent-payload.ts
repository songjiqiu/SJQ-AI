"use client";

import type {
  DeckIntentAnalysisResult,
  DeckStructureOutline
} from "@/lib/ai-deck/schema";
import { deckPageCountMax, deckPageCountMin } from "@/lib/deck-input/schema";

export function buildConfirmedOutlinePayload({
  analysis,
  audience,
  coreMessage,
  goal,
  pageCount,
  structureOutline
}: {
  analysis: DeckIntentAnalysisResult;
  audience: string;
  coreMessage: string;
  goal: string;
  pageCount: number;
  structureOutline: DeckStructureOutline;
}) {
  return {
    ...analysis.input,
    pageCount,
    confirmedPlan: {
      input: {
        ...analysis.input,
        pageCount
      },
      fileSummaries: analysis.fileSummaries,
      deckType: analysis.deckType,
      audience,
      goal,
      coreMessage,
      recommendedPageCount: pageCount,
      lightweightOutline: syncLightweightOutlineWithStructure(
        analysis,
        structureOutline,
        pageCount
      ),
      structureOutline
    }
  };
}

export function isConfirmedOutlinePayloadValid({
  audience,
  coreMessage,
  goal,
  pageCount,
  structureOutline
}: {
  audience: string;
  coreMessage: string;
  goal: string;
  pageCount: number;
  structureOutline: DeckStructureOutline | null;
}) {
  return (
    audience.trim().length >= 2 &&
    goal.trim().length >= 2 &&
    coreMessage.trim().length >= 2 &&
    pageCount >= deckPageCountMin &&
    pageCount <= deckPageCountMax &&
    Boolean(structureOutline) &&
    structureOutline!.deckTitle.trim().length >= 2 &&
    structureOutline!.deckSummary.trim().length >= 8 &&
    structureOutline!.slides.length === pageCount &&
    structureOutline!.slides.every(
      (slide) =>
        slide.title.trim().length >= 2 &&
        slide.purpose.trim().length >= 6 &&
        slide.keyMessage.trim().length >= 4
    )
  );
}

export function syncStructureSlideCount(
  outline: DeckStructureOutline,
  pageCount: number
): DeckStructureOutline {
  const safeCount = Math.min(
    deckPageCountMax,
    Math.max(deckPageCountMin, pageCount)
  );
  const slides = outline.slides.slice(0, safeCount);

  while (slides.length < safeCount) {
    const index = slides.length + 1;

    slides.push({
      chapterId: safeCount <= 6 ? "chapter-1" : index === 1 ? "chapter-1" : index === safeCount ? "chapter-3" : "chapter-2",
      slideId: `slide-${index}`,
      index,
      layoutType: index === safeCount ? "ending" : "title-body-points",
      narrativeRole: index === safeCount ? "call-to-action" : "argument",
      pageNumber: index,
      pageType: "content",
      title: `第 ${index} 页`,
      purpose: `说明第 ${index} 页与整体表达目标的关系。`,
      keyMessage: "补充本页核心信息。",
      sourceIds: [],
      visualDirection: "使用清晰主视觉配合文字信息。"
    });
  }

  return {
    ...outline,
    slides: slides.map((slide, index) => ({
      ...slide,
      index: index + 1,
      chapterId:
        slide.chapterId ??
        (safeCount <= 6
          ? "chapter-1"
          : index === 0
            ? "chapter-1"
            : index === safeCount - 1
              ? "chapter-3"
              : "chapter-2"),
      layoutType:
        slide.layoutType ??
        (index === 0
          ? "cover-title"
          : index === safeCount - 1
            ? "ending"
            : "title-body-points"),
      narrativeRole:
        slide.narrativeRole ??
        (index === 0
          ? "setup"
          : index === safeCount - 1
            ? "call-to-action"
            : "argument"),
      pageNumber: index + 1,
      pageType: slide.pageType ?? "content",
      sourceIds: slide.sourceIds ?? [],
      slideId: slide.slideId || `slide-${index + 1}`
    }))
  };
}

function syncLightweightOutlineWithStructure(
  analysis: DeckIntentAnalysisResult,
  structureOutline: DeckStructureOutline,
  pageCount: number
): DeckIntentAnalysisResult["lightweightOutline"] {
  const chapters =
    pageCount <= 6
      ? [
          {
            chapterId: "chapter-1",
            pageRange: {
              end: pageCount,
              start: 1
            },
            purpose: structureOutline.deckSummary,
            title: structureOutline.deckTitle
          }
        ]
      : [
          {
            chapterId: "chapter-1",
            pageRange: {
              end: 1,
              start: 1
            },
            purpose:
              analysis.input.locale === "zh-CN"
                ? "建立演示主题和阅读预期。"
                : "Establish the topic and reading expectation.",
            title: analysis.input.locale === "zh-CN" ? "开场定位" : "Opening Frame"
          },
          {
            chapterId: "chapter-2",
            pageRange: {
              end: pageCount - 1,
              start: 2
            },
            purpose: structureOutline.deckSummary,
            title: analysis.input.locale === "zh-CN" ? "主体展开" : "Main Flow"
          },
          {
            chapterId: "chapter-3",
            pageRange: {
              end: pageCount,
              start: pageCount
            },
            purpose:
              analysis.input.locale === "zh-CN"
                ? "总结核心信息并引导下一步。"
                : "Summarize the message and guide next steps.",
            title: analysis.input.locale === "zh-CN" ? "总结行动" : "Closing Action"
          }
        ];

  return {
    ...analysis.lightweightOutline,
    chapters,
    deckTitle: structureOutline.deckTitle,
    globalTheme: {
      objective: structureOutline.deckSummary,
      theme: structureOutline.deckTitle
    },
    pageCount,
    pages: structureOutline.slides.map((slide, index) => ({
      chapterId:
        slide.chapterId ??
        findChapterIdForPage(chapters, index + 1),
      keyMessage: slide.keyMessage,
      layoutType:
        slide.layoutType ??
        (index === 0
          ? "cover-title"
          : index === pageCount - 1
            ? "ending"
            : "title-body-points"),
      narrativeRole:
        slide.narrativeRole ??
        (index === 0
          ? "setup"
          : index === pageCount - 1
            ? "call-to-action"
            : "argument"),
      pageNumber: index + 1,
      pageType:
        slide.pageType ??
        (index === 0
          ? "cover"
          : index === pageCount - 1
            ? "summary"
            : "content"),
      purpose: slide.purpose,
      sourceIds: slide.sourceIds ?? [],
      title: slide.title
    }))
  };
}

function findChapterIdForPage(
  chapters: DeckIntentAnalysisResult["lightweightOutline"]["chapters"],
  pageNumber: number
) {
  return (
    chapters.find(
      (chapter) =>
        pageNumber >= chapter.pageRange.start && pageNumber <= chapter.pageRange.end
    )?.chapterId ?? "chapter-1"
  );
}
