import {
  deckPageCountMin,
  deckIntentAnalysisResultSchema,
  type AnalyzeDeckRequest,
  type AnalyzedDeckResult,
  type DeckIntentAnalysisResult,
  type DeckOutlineIntentInput,
  type SlideCompositionPlan,
  type SlideContent,
  type UnifiedVisualSpec
} from "./schema";
import { buildFallbackUnifiedVisualSpec } from "./visual-spec-defaults";
import { normalizeSlideCompositionPlan } from "./postprocess";
import { dedupeSlideContentBlocks } from "./content-block-bindings";
import {
  buildSemanticPlanFromSlide,
  composeSlideFromSemanticPlan
} from "./semantic-layout";

const deckTypeCopy = {
  "zh-CN": {
    "brand-marketing": "品牌营销",
    "business-report": "商务汇报",
    "community-sharing": "社群分享",
    "data-analysis": "数据分析",
    "event-promotion": "活动宣发",
    "fundraising-pitch": "融资路演",
    "growth-experiment": "增长实验",
    "industry-insight": "行业洞察",
    "knowledge-sharing": "知识科普",
    "operation-plan": "运营方案",
    "personal-review": "个人述职",
    portfolio: "作品集",
    product: "产品发布",
    "product-launch": "产品发布",
    "project-plan": "项目计划",
    proposal: "方案提案",
    "research-report": "研究报告",
    "retrospective-summary": "复盘总结",
    "sales-proposal": "销售提案",
    "teaching-deck": "教学课件",
    "training-course": "课程培训"
  },
  "en-US": {
    "brand-marketing": "Brand marketing",
    "business-report": "Business report",
    "community-sharing": "Community sharing",
    "data-analysis": "Data analysis",
    "event-promotion": "Event promotion",
    "fundraising-pitch": "Fundraising pitch",
    "growth-experiment": "Growth experiment",
    "industry-insight": "Industry insight",
    "knowledge-sharing": "Knowledge sharing",
    "operation-plan": "Operation plan",
    "personal-review": "Personal review",
    portfolio: "Portfolio",
    product: "Product launch",
    "product-launch": "Product launch",
    "project-plan": "Project plan",
    proposal: "Proposal",
    "research-report": "Research report",
    "retrospective-summary": "Retrospective summary",
    "sales-proposal": "Sales proposal",
    "teaching-deck": "Teaching deck",
    "training-course": "Training course"
  }
};

const slideTitles = {
  "zh-CN": [
    "开场定位",
    "核心问题",
    "关键判断",
    "方案路径",
    "证据支撑",
    "执行节奏",
    "风险回应",
    "下一步行动"
  ],
  "en-US": [
    "Opening Frame",
    "Core Problem",
    "Key Judgment",
    "Solution Path",
    "Evidence",
    "Execution Rhythm",
    "Risk Response",
    "Next Action"
  ]
};

function compactText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}...`
    : normalized;
}

function buildSourceTextFromIntent(input: DeckOutlineIntentInput) {
  const sections = [
    ["创作想法", input.idea],
    ["补充文本", input.sourceText],
    ...(input.sources ?? []).map(
      (source) => [`来源 ${source.sourceId}：${source.label}`, source.text] as const
    ),
    ...input.textFiles.map((file) => [`文件：${file.name}`, file.content] as const)
  ]
    .filter(([, content]) => content.trim().length > 0)
    .map(([title, content]) => `【${title}】\n${content.trim()}`);
  const merged = sections.join("\n\n").replace(/\s+\n/g, "\n").trim();

  return merged.length > 12000 ? merged.slice(0, 12000) : merged;
}

export function buildMockDeckIntentAnalysis(
  input: DeckOutlineIntentInput
): DeckIntentAnalysisResult {
  const isChinese = input.locale === "zh-CN";
  const sourceText = buildSourceTextFromIntent(input);
  const compact = compactText(sourceText, isChinese ? 80 : 120);
  const recommendedPageCount =
    input.pageCount ??
    (sourceText.length > 1800 ? 8 : sourceText.length > 900 ? 6 : deckPageCountMin);
  const titleSeed = compactText(sourceText, isChinese ? 28 : 42);
  const slides = Array.from({ length: recommendedPageCount }, (_, slideIndex) => {
    const index = slideIndex + 1;
    const titlePool = slideTitles[input.locale];
    const title = titlePool[slideIndex] ?? titlePool[titlePool.length - 1];

    return {
      slideId: `slide-${index}`,
      index,
      title,
      purpose: isChinese
        ? `说明第 ${index} 页与整体表达目标的关系。`
        : `Explain how slide ${index} supports the overall goal.`,
      keyMessage: isChinese
        ? `围绕“${compactText(compact, 60)}”提炼第 ${index} 个结构重点。`
        : `Extract structure point ${index} from "${compactText(compact, 80)}".`,
      visualDirection: isChinese
        ? "使用清晰主视觉配合简洁文字，形成稳定阅读顺序。"
        : "Use a clear hero visual with concise text and stable reading order."
    };
  });
  const deckTitle = isChinese ? `${titleSeed}｜结构大纲` : `${titleSeed} | Outline`;
  const deckSummary = isChinese
    ? `围绕输入内容组织 ${recommendedPageCount} 页结构大纲，先确认表达目标，再扩展详细文案。`
    : `A ${recommendedPageCount}-slide structure outline for confirmation before detailed copy generation.`;
  const chapters =
    recommendedPageCount <= 6
      ? [
          {
            chapterId: "chapter-1",
            pageRange: {
              end: recommendedPageCount,
              start: 1
            },
            purpose: deckSummary,
            title: deckTitle
          }
        ]
      : [
          {
            chapterId: "chapter-1",
            pageRange: {
              end: 1,
              start: 1
            },
            purpose: isChinese
              ? "建立演示主题和阅读预期。"
              : "Establish the topic and reading expectation.",
            title: isChinese ? "开场定位" : "Opening Frame"
          },
          {
            chapterId: "chapter-2",
            pageRange: {
              end: recommendedPageCount - 1,
              start: 2
            },
            purpose: deckSummary,
            title: isChinese ? "主体展开" : "Main Flow"
          },
          {
            chapterId: "chapter-3",
            pageRange: {
              end: recommendedPageCount,
              start: recommendedPageCount
            },
            purpose: isChinese
              ? "收束核心信息并引导下一步。"
              : "Summarize the message and guide next steps.",
            title: isChinese ? "总结行动" : "Closing Action"
          }
        ];

  return deckIntentAnalysisResultSchema.parse({
    input,
    fileSummaries:
      (input.parsedFiles ?? []).length > 0
        ? (input.parsedFiles ?? []).map((file) => ({
            characterCount: file.characterCount,
            name: file.name,
            size: file.size,
            summary: compactText(file.summary || file.text, 220),
            snippets: buildTextSnippets(file.text || file.summary)
          }))
        : input.textFiles.map((file) => ({
            characterCount: file.content.length,
            name: file.name,
            size: file.size,
            summary: compactText(file.content, 220),
            snippets: buildTextSnippets(file.content)
          })),
    deckType: input.deckType,
    audience: isChinese ? "通用受众" : "general audience",
    goal: isChinese ? "清晰传达核心内容" : "communicate the core message clearly",
    coreMessage: isChinese
      ? `围绕“${compact}”提炼一条清晰、可被记住的核心表达。`
      : `Turn "${compact}" into one clear, memorable core message.`,
    recommendedPageCount,
    lightweightOutline: {
      deckTitle,
      deckType: input.deckType,
      narrativeStyle: fallbackNarrativeStyle(input.deckType),
      pageCount: recommendedPageCount,
      globalTheme: {
        objective: deckSummary,
        theme: deckTitle
      },
      chapters,
      pages: slides.map((slide) => ({
        chapterId: fallbackChapterId(slide.index, recommendedPageCount),
        keyMessage: slide.keyMessage,
        layoutType:
          slide.index === 1
            ? "cover-title"
            : slide.index === recommendedPageCount
              ? "ending"
              : "title-body-points",
        narrativeRole:
          slide.index === 1
            ? "setup"
            : slide.index === recommendedPageCount
              ? "call-to-action"
              : "argument",
        pageNumber: slide.index,
        pageType:
          slide.index === 1
            ? "cover"
            : slide.index === recommendedPageCount
              ? "summary"
              : "content",
        purpose: slide.purpose,
        sourceIds: [],
        title: slide.title
      }))
    },
    structureOutline: {
      deckTitle,
      deckSummary,
      slides
    }
  });
}

function buildTextSnippets(text: string) {
  return text
    .split(/\n{2,}|(?<=[。！？.!?])\s+/)
    .map((item) => compactText(item, 360))
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

function fallbackNarrativeStyle(deckType: DeckOutlineIntentInput["deckType"]) {
  if (
    deckType === "training-course" ||
    deckType === "teaching-deck" ||
    deckType === "knowledge-sharing"
  ) {
    return "teaching-progressive";
  }

  if (
    deckType === "research-report" ||
    deckType === "data-analysis" ||
    deckType === "industry-insight"
  ) {
    return "insight-evidence";
  }

  if (
    deckType === "sales-proposal" ||
    deckType === "proposal" ||
    deckType === "fundraising-pitch"
  ) {
    return "proposal-persuasive";
  }

  if (deckType === "portfolio") {
    return "portfolio-showcase";
  }

  if (deckType === "personal-review" || deckType === "retrospective-summary") {
    return "review-summary";
  }

  return "problem-solution";
}

function fallbackChapterId(pageNumber: number, pageCount: number) {
  if (pageCount <= 6) {
    return "chapter-1";
  }

  if (pageNumber === 1) {
    return "chapter-1";
  }

  if (pageNumber === pageCount) {
    return "chapter-3";
  }

  return "chapter-2";
}

export function buildMockAnalyzedDeck(input: AnalyzeDeckRequest): AnalyzedDeckResult {
  const locale = input.locale;
  const deckTypeName = deckTypeCopy[locale][input.deckType];
  const titleSeed = compactText(input.sourceText, locale === "zh-CN" ? 28 : 42);
  const isChinese = locale === "zh-CN";
  const deckTitle =
    isChinese
      ? `${titleSeed}｜${deckTypeName}`
      : `${titleSeed} | ${deckTypeName}`;

  const unifiedVisualSpec = {
    ...buildFallbackUnifiedVisualSpec(input),
    themeName: isChinese ? `统一视觉：${deckTypeName}` : `Unified Visual: ${deckTypeName}`,
    visualStyle: isChinese
      ? `面向${deckTypeName}场景，保持清晰层级、克制装饰和稳定留白，突出每页一个中心判断。`
      : `For a ${deckTypeName} scenario, keep clear hierarchy, restrained decoration, and stable spacing to keep one core point per slide.`
  } satisfies UnifiedVisualSpec;

  const slides = Array.from({ length: input.pageCount }, (_, slideIndex) => {
    const index = slideIndex + 1;
    const slideId = `slide-${index}`;
    const titlePool = slideTitles[locale];
    const title = titlePool[slideIndex] ?? titlePool[titlePool.length - 1];
    const bodyPoints = isChinese
      ? [
          `围绕“${compactText(input.goal, 42)}”组织本页信息。`,
          `承接核心信息：${compactText(input.coreMessage, 48)}。`,
          `面向${compactText(input.audience, 32)}说明关键判断。`,
          `从原始文本中提炼第 ${index} 个表达重点。`
        ]
      : [
          `Organize this slide around "${compactText(input.goal, 52)}".`,
          `Carry the core message: ${compactText(input.coreMessage, 58)}.`,
          `Explain the key point for ${compactText(input.audience, 42)}.`,
          `Extract focus point ${index} from the source text.`
        ];

    const coreStatement = bodyPoints[0];
    const pageType =
      index === 1
        ? "cover"
        : index === input.pageCount
          ? "summary"
          : /数据|指标|增长|%|data|metric|\d/i.test(bodyPoints.join(" "))
          ? "data"
          : "content";
    const contentBlocks = dedupeSlideContentBlocks(
      [
        {
          blockType: "title" as const,
          priority: 1,
          text: title
        },
        {
          blockType: "conclusion" as const,
          priority: 1,
          text: coreStatement
        },
        ...bodyPoints.map((point, pointIndex) => ({
          blockType:
            pageType === "data" && /数据|指标|增长|%|data|metric|\d/i.test(point)
              ? ("metric" as const)
              : ("body" as const),
          priority: Math.min(5, pointIndex + 2),
          text: point
        }))
      ],
      {
        pageType
      }
    ).contentBlocks;
    const content = {
      slideId,
      index,
      pageType,
      title,
      subtitle: isChinese ? `第 ${index} 页内容拆解` : `Slide ${index} content split`,
      bodyPoints,
      contentBlocks,
      speakerGoal: isChinese
        ? `让${input.audience}理解本页与整体目标的关系。`
        : `Help ${input.audience} understand how this slide supports the overall goal.`,
      visualIntent: isChinese
        ? "使用一个主视觉图层配合文字信息，形成清晰阅读顺序。"
        : "Use one hero visual layer with text blocks to create a clear reading order.",
      coreStatement,
      narrativeRole:
        index === 1
          ? "setup"
          : index === input.pageCount
            ? "call-to-action"
            : index === input.pageCount - 1
              ? "summary"
              : index === Math.ceil(input.pageCount / 2)
                ? "turning-point"
                : "argument",
      contentLayers: {
        primary: [0],
        supporting: contentBlocks.map((_, blockIndex) => blockIndex).slice(1, 7),
        supplementary: []
      },
      slideTransition: {
        fromPrevious:
          slideIndex === 0
            ? isChinese
              ? "作为开场页，先建立主题边界和阅读预期。"
              : "As the opening slide, establish the topic boundary and reading expectation."
            : isChinese
              ? `承接上一页“${titlePool[slideIndex - 1] ?? ""}”。`
              : `Continue from "${titlePool[slideIndex - 1] ?? ""}".`,
        toNext:
          slideIndex === input.pageCount - 1
            ? isChinese
              ? "收束整套表达，并提示后续行动。"
              : "Close the deck and cue follow-up action."
            : isChinese
              ? `自然引出下一页“${titlePool[slideIndex + 1] ?? title}”。`
              : `Lead naturally into "${titlePool[slideIndex + 1] ?? title}".`
      },
      explanationDepth:
        index === input.pageCount
          ? "summary"
          : index === 1 || index === Math.ceil(input.pageCount / 2)
            ? "transition"
            : "focus",
      sourceRequirement: {
        required: true,
        categories: ["user-input"],
        note: isChinese
          ? "本页主要基于用户输入；涉及数据或引用时在页脚标注来源。"
          : "This slide mainly uses user input; cite sources in the footer when data or quotes appear."
      },
      adaptationRules: {
        splitWhen: isChinese
          ? "当正文要点超过 5 条或出现两个以上结论时拆页。"
          : "Split when body points exceed five or more than two conclusions compete.",
        splitCandidates: bodyPoints.slice(1, 4),
        mergeWhen: isChinese
          ? "当只剩一个支撑点且没有独立图表时可与相邻页合并。"
          : "Merge when only one support point remains and no standalone chart is needed.",
        mergeWith: titlePool[slideIndex + 1] ?? titlePool[slideIndex - 1] ?? title
      },
      audienceFocus: {
        lens:
          input.deckType === "training-course" || input.deckType === "teaching-deck"
            ? "teaching-understanding"
            : input.deckType === "research-report" || input.deckType === "data-analysis"
              ? "research-evidence"
              : input.deckType === "sales-proposal" || input.deckType === "brand-marketing"
                ? "sales-value"
                : "business-conclusion",
        focus: isChinese
          ? "围绕受众最关心的结论、价值或证据组织信息。"
          : "Organize information around the audience's conclusion, value, or evidence needs."
      },
      viewerObjective: {
        type: index === input.pageCount ? "act" : "understand",
        description: isChinese
          ? `看完本页后，观众应该理解：${compactText(coreStatement, 80)}`
          : `After this slide, the audience should understand: ${compactText(coreStatement, 90)}`
      },
      contentBoundary: {
        inScope: isChinese
          ? `本页只展开“${title}”相关的核心观点和必要支撑。`
          : `This slide only expands the core point and necessary support for "${title}".`,
        outOfScope: isChinese
          ? ["不展开无关背景", "不重复整套方案细节", "不加入未经说明的数据来源"]
          : ["Do not expand unrelated background", "Do not repeat full deck details", "Do not add unexplained data sources"]
      }
    } satisfies SlideContent;

    return buildMockSlideCompositionPlanFromContent({
      input,
      slide: content,
      unifiedVisualSpec
    });
  });

  return {
    mode: "mock",
    deckTitle,
    deckSummary:
      locale === "zh-CN"
        ? `面向${input.audience}的${deckTypeName}，围绕“${input.goal}”和“${input.coreMessage}”拆分为 ${input.pageCount} 页结构化演示。`
        : `A ${input.pageCount}-slide ${deckTypeName} deck for ${input.audience}, organized around "${input.goal}" and "${input.coreMessage}".`,
    unifiedVisualSpec,
    slides
  };
}

export function buildMockSlideCompositionPlanFromContent({
  input,
  slide,
  unifiedVisualSpec
}: {
  input: AnalyzeDeckRequest;
  slide: SlideContent;
  unifiedVisualSpec: UnifiedVisualSpec;
}): SlideCompositionPlan {
  return normalizeSlideCompositionPlan(
    composeSlideFromSemanticPlan({
      input,
      semanticPlan: buildSemanticPlanFromSlide({
        input,
        slide,
        unifiedVisualSpec
      }),
      unifiedVisualSpec
    }),
    {
      completeContentBlocks: true
    }
  );
}
