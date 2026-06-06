import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaletteProvider } from "@/components/theme/palette-provider";
import {
  CreationWorkbench,
  generatePayloadStorageKey,
  intentAnalysisStorageKey,
  intentPayloadStorageKey,
  outlinePayloadStorageKey
} from "@/components/workbench/creation-workbench";
import { DeckPreviewPage } from "@/components/workbench/deck-preview-page";
import { DeckQualityPage } from "@/components/workbench/deck-quality-page";
import { GenerateLoadingPage } from "@/components/workbench/generate-loading-page";
import { IntentConfirmPage } from "@/components/workbench/intent-confirm-page";
import {
  IntentAnalysisLoadingPage,
  OutlineLoadingPage
} from "@/components/workbench/outline-loading-page";
import { OutlineReviewPage } from "@/components/workbench/outline-review-page";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import { buildColorPaletteFromHexes } from "@/lib/ai-deck/visual-spec-defaults";
import {
  buildContentReview,
  buildConsistencyReport,
  normalizeSlideCompositionPlan,
  buildSlideMotionPlan
} from "@/lib/ai-deck/postprocess";
import { deckIntentAnalysisResultSchema } from "@/lib/ai-deck/schema";
import type {
  AnalyzeDeckRequest,
  DeckIntentAnalysisResult,
  GeneratedDeckResult,
  SlideElement
} from "@/lib/ai-deck/schema";
import type { DeckOutlineDraft } from "@/lib/deck-outline/schema";

import zhMessages from "../messages/zh-CN.json";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn()
}));

vi.mock("@/i18n/navigation", async () => {
  return {
    Link: ({ children }: { children: React.ReactNode }) => children,
    redirect: vi.fn(),
    usePathname: vi.fn(() => "/workbench"),
    useRouter: () => router
  };
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <PaletteProvider>{ui}</PaletteProvider>
    </NextIntlClientProvider>
  );
}

function buildGeneratedDeck(input: AnalyzeDeckRequest): GeneratedDeckResult {
  const analyzed = buildMockAnalyzedDeck(input);

  return {
    id: "deck-1",
    mode: analyzed.mode,
    status: "READY",
    deckTitle: analyzed.deckTitle,
    deckSummary: analyzed.deckSummary,
    input,
    unifiedVisualSpec: analyzed.unifiedVisualSpec,
    contentReview: buildContentReview(input, analyzed),
    consistencyReport: buildConsistencyReport(input, analyzed),
    slides: analyzed.slides.map((slide) => ({
      ...slide,
      generatedImageLayers: slide.imageLayerRequests.map((request) => ({
        id: `${request.id}-layer`,
        requestId: request.id,
        elementId: request.elementId,
        assetId: `${request.id}-asset`,
        provider: "mock-svg",
        mimeType: "image/svg+xml",
        url: `/api/decks/deck-1/assets/${request.id}-asset`,
        prompt: request.prompt,
        width: 1280,
        height: 720,
        transparentBackground: request.transparentBackground,
        visualNotes: request.visualNotes
      })),
      motionPlan: buildSlideMotionPlan(slide)
    })),
    pptxUrl: "/api/decks/deck-1/pptx",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildPalettePreviewDeck(input: AnalyzeDeckRequest): GeneratedDeckResult {
  const deck = buildGeneratedDeck(input);
  const paletteShape: SlideElement = {
    bounds: {
      height: 0.42,
      width: 1.2,
      x: 0.72,
      y: 6
    },
    editable: true,
    hierarchyLevel: 3,
    id: "palette-shape",
    requiresImageGeneration: false,
    role: "色板形状",
    semanticType: "card",
    styleNotes: "用于验证预览色板。",
    type: "shape",
    zIndex: 12
  };
  const paletteChart: SlideElement = {
    bounds: {
      height: 1.05,
      width: 1.8,
      x: 2.08,
      y: 5.35
    },
    editable: true,
    hierarchyLevel: 2,
    id: "palette-chart",
    requiresImageGeneration: false,
    role: "色板图表",
    semanticType: "chart",
    styleNotes: "用于验证图表占位色板。",
    type: "chartPlaceholder",
    zIndex: 13
  };

  return {
    ...deck,
    unifiedVisualSpec: {
      ...deck.unifiedVisualSpec,
      colorPalette: buildColorPaletteFromHexes(
        [
          "#AA1100",
          "#C9A96E",
          "#4A6B5D",
          "#AA1100",
          "#C9A96E",
          "#4A6B5D",
          "#2563EB",
          "#16A085",
          "#8B5CF6",
          "#F5F0E8",
          "#E8D5B7",
          "#123456",
          "#64748B",
          "#C9A96E"
        ],
        "zh-CN"
      ),
      colorRoles: {
        ...deck.unifiedVisualSpec.colorRoles,
        accent: "#AA1100 用于关键强调。",
        background: "#F5F0E8 用于页面背景。",
        bodyText: "#123456 / #C9A96E 用于正文。",
        borderDivider: "#E8D5B7 用于边框。",
        chart: "#AA1100 / #C9A96E 用于图表。",
        decorative: "#4A6B5D / #C9A96E 用于装饰。",
        highlight: "#C9A96E 用于高亮。",
        surface: "#E8D5B7 / #F5F0E8 用于卡片。",
        titleText: "#2C3E50 / #123456 / #AA1100 用于标题。"
      }
    },
    slides: deck.slides.map((slide, index) =>
      index === 0
        ? {
            ...slide,
            elements: [...slide.elements, paletteShape, paletteChart]
          }
        : slide
    )
  };
}

function buildOutlineDraft(input: AnalyzeDeckRequest): DeckOutlineDraft {
  const analyzed = buildMockAnalyzedDeck(input);

  return {
    id: "draft-1",
    mode: analyzed.mode,
    deckTitle: analyzed.deckTitle,
    deckSummary: analyzed.deckSummary,
    input,
    fileSummaries: [],
    intentAnalysis: deckIntentAnalysisResultSchema.parse({
      input: {
        idea: input.sourceText,
        sourceText: "",
        textFiles: [],
        deckType: input.deckType,
        palette: input.palette,
        locale: input.locale
      },
      fileSummaries: [],
      deckType: input.deckType,
      audience: input.audience,
      goal: input.goal,
      coreMessage: input.coreMessage,
      recommendedPageCount: input.pageCount,
      structureOutline: {
        deckTitle: analyzed.deckTitle,
        deckSummary: analyzed.deckSummary,
        slides: analyzed.slides.map((slide) => ({
          slideId: slide.slideId,
          index: slide.index,
          title: slide.content.title,
          purpose: slide.content.speakerGoal,
          keyMessage: slide.content.bodyPoints[0],
          visualDirection: slide.content.visualIntent
        }))
      }
    }),
    unifiedVisualSpec: analyzed.unifiedVisualSpec,
    slides: analyzed.slides.map((slide) => slide.content),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function writeOutlinePayload() {
  window.sessionStorage.setItem(
    outlinePayloadStorageKey,
    JSON.stringify({
      idea: request.sourceText,
      sourceText: "",
      textFiles: [],
      deckType: request.deckType,
      palette: request.palette,
      locale: request.locale,
      confirmedPlan: {
        input: {
          idea: request.sourceText,
          sourceText: "",
          textFiles: [],
          deckType: request.deckType,
          palette: request.palette,
          locale: request.locale,
          pageCount: request.pageCount
        },
        fileSummaries: [],
        deckType: request.deckType,
        audience: request.audience,
        goal: request.goal,
        coreMessage: request.coreMessage,
        recommendedPageCount: request.pageCount,
        structureOutline: buildOutlineDraft(request).intentAnalysis?.structureOutline
      }
    })
  );
}

const request: AnalyzeDeckRequest = {
  sourceText:
    "为新能源初创公司准备融资路演，重点说明市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  pageCount: 6,
  deckType: "business-report",
  palette: "star-map",
  locale: "zh-CN"
};

const intentAnalysis: DeckIntentAnalysisResult = deckIntentAnalysisResultSchema.parse({
  input: {
    idea: request.sourceText,
    sourceText: "",
    textFiles: [
      {
        name: "brief.md",
        size: 128,
        type: "text/markdown",
        content: "文件正文不应在确认页完整展示。"
      }
    ],
    deckType: "fundraising-pitch",
    palette: "star-map",
    locale: "zh-CN"
  },
  fileSummaries: [
    {
      characterCount: 18,
      name: "brief.md",
      size: 128,
      summary: "文件摘要",
      snippets: ["文件片段"]
    }
  ],
  deckType: "fundraising-pitch",
  audience: "投资人",
  goal: "获得试点合作意向",
  coreMessage: "用市场机会与试点成果证明合作价值。",
  recommendedPageCount: 6,
  structureOutline: {
    deckTitle: "新能源融资路演",
    deckSummary: "这是一份用于确认结构的大纲草稿。",
    slides: Array.from({ length: 6 }, (_, index) => index + 1).map((index) => ({
      slideId: `slide-${index}`,
      index,
      title: `第 ${index} 页`,
      purpose: `说明第 ${index} 页的表达目的。`,
      keyMessage: `第 ${index} 页核心观点。`,
      visualDirection: "使用清晰主视觉配合文字信息。"
    }))
  }
});

describe("workbench stepped flow", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-palette");
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("stores form payload and navigates to the intent analysis loading route", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/decks/outline/files")) {
        return {
          ok: true,
          json: async () => ({
            parsedFiles: [
              {
                characterCount: 24,
                extension: ".md",
                id: "src_f001",
                keyPoints: ["试点数据：转化率提升 20%。"],
                mimeType: "text/markdown",
                name: "brief.md",
                parser: "markdown",
                size: 128,
                sourceIds: ["src_f001_c001"],
                summary: "试点数据：转化率提升 20%。",
                text: "试点数据：转化率提升 20%。",
                warnings: []
              }
            ],
            sources: [
              {
                chunkIndex: 1,
                fileId: "src_f001",
                fileName: "brief.md",
                kind: "text",
                label: "brief.md",
                sourceId: "src_f001_c001",
                text: "试点数据：转化率提升 20%。"
              }
            ],
            warnings: []
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          drafts: [],
          projects: []
        })
      };
    });

    vi.stubGlobal(
      "fetch",
      fetchMock
    );
    renderWithProviders(<CreationWorkbench />);

    expect(screen.queryByLabelText("目标受众")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("表达目标")).not.toBeInTheDocument();
    expect(screen.getByLabelText("指定页数（可选）")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("原始文本/创作想法"), {
      target: { value: request.sourceText }
    });
    fireEvent.change(screen.getByLabelText("添加文件"), {
      target: {
        files: [new File(["试点数据：转化率提升 20%。"], "brief.md", { type: "text/markdown" })]
      }
    });
    fireEvent.click(screen.getByLabelText("融资路演"));

    fireEvent.click(screen.getByRole("button", { name: /生成大纲草稿/ }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        "/workbench/outline/analyze/loading"
      );
    });
    expect(
      JSON.parse(window.sessionStorage.getItem(intentPayloadStorageKey) ?? "{}")
    ).toMatchObject({
      deckType: "fundraising-pitch",
      parsedFiles: [
        expect.objectContaining({
          id: "src_f001",
          sourceIds: ["src_f001_c001"]
        })
      ],
      sourceText: "",
      sources: [
        expect.objectContaining({
          sourceId: "src_f001_c001"
        })
      ],
      textFiles: [],
      locale: "zh-CN"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decks/outline/files",
      expect.objectContaining({
        body: expect.any(FormData),
        method: "POST"
      })
    );
    expect(
      JSON.parse(window.sessionStorage.getItem(intentPayloadStorageKey) ?? "{}")
    ).not.toHaveProperty("style");
  });

  it("shows the admin return action only when requested", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          drafts: [],
          projects: []
        })
      }))
    );

    const { rerender } = renderWithProviders(<CreationWorkbench />);

    expect(screen.queryByText("返回管理端")).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
        <PaletteProvider>
          <CreationWorkbench showAdminBackLink />
        </PaletteProvider>
      </NextIntlClientProvider>
    );

    expect(screen.getByText("返回管理端")).toBeInTheDocument();
  });

  it("intent analysis loading stores analysis and shows the optional confirmation intercept", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => intentAnalysis
    }));

    window.sessionStorage.setItem(
      intentPayloadStorageKey,
      JSON.stringify(intentAnalysis.input)
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<IntentAnalysisLoadingPage />);

    expect(await screen.findByText("正在分析输入")).toBeInTheDocument();

    expect(
      await screen.findByText("结构大纲已生成")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "编辑结构" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "立即生成草稿" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decks/outline/analyze",
      expect.objectContaining({
        body: JSON.stringify(intentAnalysis.input),
        method: "POST"
      })
    );
    expect(
      JSON.parse(
        window.sessionStorage.getItem(intentAnalysisStorageKey) ?? "{}"
      )
    ).toMatchObject({
      audience: "投资人",
      recommendedPageCount: 6
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑结构" }));

    expect(router.replace).toHaveBeenCalledWith(
      "/workbench/outline/analyze/confirm"
    );
  });

  it("continues from intent analysis intercept into outline draft generation", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => intentAnalysis
    }));

    window.sessionStorage.setItem(
      intentPayloadStorageKey,
      JSON.stringify(intentAnalysis.input)
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<IntentAnalysisLoadingPage />);

    expect(
      await screen.findByRole("button", { name: "立即生成草稿" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "立即生成草稿" }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/workbench/outline/loading");
    });
    expect(
      JSON.parse(window.sessionStorage.getItem(outlinePayloadStorageKey) ?? "{}")
    ).toMatchObject({
      pageCount: 6,
      confirmedPlan: {
        audience: "投资人",
        recommendedPageCount: 6,
        structureOutline: {
          slides: expect.arrayContaining([
            expect.objectContaining({
              index: 6
            })
          ])
        }
      }
    });
    expect(window.sessionStorage.getItem(intentAnalysisStorageKey)).toBeNull();
    expect(window.sessionStorage.getItem(intentPayloadStorageKey)).toBeNull();
  });

  it("confirms structure while keeping intent analysis as hidden context", async () => {
    window.sessionStorage.setItem(
      intentAnalysisStorageKey,
      JSON.stringify(intentAnalysis)
    );

    renderWithProviders(<IntentConfirmPage />);

    expect(await screen.findByText("确认整体结构")).toBeInTheDocument();
    expect(screen.getByText("融资路演")).toBeInTheDocument();
    expect(screen.getByText("叙事风格")).toBeInTheDocument();
    expect(screen.getByText("Proposal Persuasive")).toBeInTheDocument();
    expect(screen.queryByText("数据论证")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("核心信息")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("目标受众")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("表达目标")).not.toBeInTheDocument();
    expect(screen.getByText("原始输入摘要")).toBeInTheDocument();
    expect(screen.getByText(request.sourceText)).toBeInTheDocument();
    expect(screen.getByText("已添加文件")).toBeInTheDocument();
    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.getByText("18 字符 · 128 B")).toBeInTheDocument();
    expect(screen.getByText("结构大纲")).toBeInTheDocument();
    expect(screen.getByDisplayValue("新能源融资路演")).toBeInTheDocument();
    expect(screen.queryByText("文件正文不应在确认页完整展示。")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("推荐页数"), {
      target: { value: "40" }
    });
    fireEvent.click(screen.getByRole("button", { name: /确认并生成大纲/ }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/workbench/outline/loading");
    });
    expect(
      JSON.parse(window.sessionStorage.getItem(outlinePayloadStorageKey) ?? "{}")
    ).toMatchObject({
      deckType: "fundraising-pitch",
      pageCount: 40,
      confirmedPlan: {
        deckType: "fundraising-pitch",
        coreMessage: intentAnalysis.coreMessage,
        lightweightOutline: {
          pageCount: 40
        },
        recommendedPageCount: 40,
        structureOutline: {
          slides: expect.arrayContaining([
            expect.objectContaining({
              index: 40
            })
          ])
        }
      }
    });
    const outlinePayload = JSON.parse(
      window.sessionStorage.getItem(outlinePayloadStorageKey) ?? "{}"
    );
    expect(outlinePayload).not.toHaveProperty("style");
    expect(outlinePayload.confirmedPlan).not.toHaveProperty("style");
    expect(outlinePayload.confirmedPlan.input).not.toHaveProperty("style");
  });

  it("renders recent outline drafts and deck history shortcuts", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/decks/outline")) {
        return {
          ok: true,
          json: async () => ({
            drafts: [
              {
                id: "draft-recent",
                deckTitle: "最近大纲草稿",
                deckSummary: "用于测试右侧栏入口的大纲摘要。",
                mode: "mock",
                slideCount: 5,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ]
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "deck-recent",
              deckTitle: "最近生成PPT",
              deckSummary: "用于测试右侧栏入口的生成历史摘要。",
              mode: "mock",
              pptxUrl: "/api/decks/deck-recent/pptx",
              reviewScore: 88,
              consistencyScore: 91,
              slideCount: 5,
              status: "READY",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        })
      };
    });

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<CreationWorkbench />);

    expect(screen.getByRole("region", { name: "PPT大纲草稿" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "PPT生成历史" })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /^最近大纲草稿/ }));
    expect(router.push).toHaveBeenCalledWith("/workbench/outline/draft-recent");

    fireEvent.click(await screen.findByRole("button", { name: /^最近生成PPT/ }));
    expect(router.push).toHaveBeenCalledWith("/workbench/preview/deck-recent");
  });

  it("deletes outline drafts and deck history from sidebar shortcuts", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({
            ok: true
          })
        };
      }

      if (url.endsWith("/api/decks/outline")) {
        return {
          ok: true,
          json: async () => ({
            drafts: [
              {
                id: "draft-recent",
                deckTitle: "最近大纲草稿",
                deckSummary: "用于测试右侧栏入口的大纲摘要。",
                mode: "mock",
                slideCount: 5,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ]
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          projects: [
            {
              id: "deck-recent",
              deckTitle: "最近生成PPT",
              deckSummary: "用于测试右侧栏入口的生成历史摘要。",
              mode: "mock",
              pptxUrl: "/api/decks/deck-recent/pptx",
              reviewScore: 88,
              consistencyScore: 91,
              slideCount: 5,
              status: "READY",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        })
      };
    });

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<CreationWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "删除大纲草稿：最近大纲草稿"
      })
    );
    let dialog = await screen.findByRole("alertdialog", {
      name: "确认删除"
    });
    expect(
      within(dialog).getByText("确定删除大纲草稿“最近大纲草稿”吗？")
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/decks/outline/draft-recent",
        expect.objectContaining({
          method: "DELETE"
        })
      );
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "删除生成历史：最近生成PPT"
      })
    );
    dialog = await screen.findByRole("alertdialog", {
      name: "确认删除"
    });
    expect(
      within(dialog).getByText(
        "确定删除生成历史“最近生成PPT”吗？本地 PPTX 和图片图层产物也会被清理。"
      )
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/decks/deck-recent",
        expect.objectContaining({
          method: "DELETE"
        })
      );
    });
    expect(router.push).not.toHaveBeenCalledWith("/workbench/outline/draft-recent");
    expect(router.push).not.toHaveBeenCalledWith("/workbench/preview/deck-recent");
    expect(screen.queryByText("最近大纲草稿")).not.toBeInTheDocument();
    expect(screen.queryByText("最近生成PPT")).not.toBeInTheDocument();
  });

  it("does not delete sidebar items when confirmation is canceled", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/decks/outline")) {
        return {
          ok: true,
          json: async () => ({
            drafts: [
              {
                id: "draft-recent",
                deckTitle: "最近大纲草稿",
                deckSummary: "用于测试右侧栏入口的大纲摘要。",
                mode: "mock",
                slideCount: 5,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            ]
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          projects: []
        })
      };
    });

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<CreationWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "删除大纲草稿：最近大纲草稿"
      })
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "确认删除"
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/decks/outline/draft-recent",
      expect.objectContaining({
        method: "DELETE"
      })
    );
    expect(screen.getByText("最近大纲草稿")).toBeInTheDocument();
  });

  it("places the reset and outline actions at the lower right sidebar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          drafts: [],
          projects: []
        })
      }))
    );
    renderWithProviders(<CreationWorkbench />);

    const form = screen.getByRole("form", { name: "PPT创作表单" });
    const historyRegion = screen.getByRole("region", { name: "PPT生成历史" });
    const heading = screen.getByRole("heading", {
      name: "有新的工作安排吗？"
    });
    const resetButton = screen.getByRole("button", { name: "重置" });
    const generateButton = screen.getByRole("button", {
      name: /生成大纲草稿/
    });
    const pageCountInput = screen.getByLabelText("指定页数（可选）");
    const uploadAction = screen.getByText("添加文件");
    const fileFormats = screen.getByText(
      "支持 txt / md / csv / json / docx / pptx / xlsx / pdf / 图片"
    );
    const fileLimit = screen.getByText("单个文件最大 10MB");
    const pageCountLabel = screen.getByText("指定页数（可选）");
    const deckTypeHeading = screen.getByText("PPT类型");
    const deckTypeGrid = screen
      .getByLabelText("商务汇报")
      .closest("label")?.parentElement;
    const sidebar = generateButton.closest("aside");
    const actionPanel = generateButton.closest("div[class*='lg:mt-auto']");

    expect(form.parentElement).toHaveClass(
      "lg:grid-cols-[minmax(0,1fr)_336px]"
    );
    expect(form.parentElement?.parentElement).toHaveClass("max-w-5xl");
    expect(heading).toHaveClass("sm:text-5xl");
    expect(screen.getByLabelText("原始文本/创作想法")).toHaveClass(
      "min-h-44",
      "text-lg",
      "leading-8"
    );
    expect(form).not.toContainElement(resetButton);
    expect(form).not.toContainElement(generateButton);
    expect(sidebar).toHaveClass("lg:self-stretch");
    expect(actionPanel).toContainElement(resetButton);
    expect(actionPanel).toContainElement(generateButton);
    expect(actionPanel?.firstElementChild).toHaveClass("grid");
    expect(actionPanel?.firstElementChild).not.toHaveClass("xl:grid-cols-2");
    expect(deckTypeGrid).toHaveClass("sm:grid-cols-4");
    expect(deckTypeGrid).not.toHaveClass("xl:grid-cols-5");
    expect(screen.getByLabelText("商务汇报").closest("label")).toHaveClass(
      "min-h-10",
      "text-sm"
    );
    expect(screen.queryByText("叙事风格")).not.toBeInTheDocument();
    expect(fileLimit).toHaveClass("text-xs");
    expect(fileFormats).toHaveClass("text-xs");
    expect(pageCountLabel).toHaveClass("text-xs");
    expect(pageCountInput).toHaveClass("h-11", "text-sm");
    expect(
      Boolean(
        uploadAction.compareDocumentPosition(fileLimit) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        pageCountInput.compareDocumentPosition(pageCountLabel) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        uploadAction.compareDocumentPosition(pageCountInput) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        pageCountInput.compareDocumentPosition(deckTypeHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        historyRegion.compareDocumentPosition(generateButton) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
  });

  it("outline loading creates a draft and opens the review page", async () => {
    const draft = buildOutlineDraft(request);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => draft
    }));

    writeOutlinePayload();
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineLoadingPage />);

    expect(await screen.findByText("正在生成大纲草稿")).toBeInTheDocument();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/workbench/outline/draft-1");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decks/outline",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("outline loading shows localized AI JSON errors", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        details: {
          attempts: [
            {
              error: "Expected string, received number",
              mode: "json_schema",
              responseSnippet: "{\"deckTitle\":123}",
              stage: "validation",
              zodIssues: [
                {
                  code: "invalid_type",
                  message: "Invalid input",
                  path: ["deckTitle"]
                }
              ]
            }
          ],
          message: "AI JSON output failed validation after retry.",
          model: "test-model",
          schemaName: "DeckStructureOutlineResult"
        },
        error: "AI_JSON_GENERATION_FAILED"
      })
    }));

    writeOutlinePayload();
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineLoadingPage />);

    expect(await screen.findByText("正在生成大纲草稿")).toBeInTheDocument();

    expect(
      (await screen.findAllByText(/AI 返回内容暂未通过结构化校验/)).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("失败详情")).toBeInTheDocument();
    expect(screen.getByText(/AI_JSON_GENERATION_FAILED/)).toBeInTheDocument();
    expect(screen.getByText(/DeckStructureOutlineResult/)).toBeInTheDocument();
    expect(screen.getByText(/\\"deckTitle\\":123/)).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalledWith(
      "/workbench/outline/draft-1"
    );
  });

  it("outline loading shows internal error details from the API", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        details: {
          message: "provider timeout"
        },
        error: "INTERNAL_ERROR"
      })
    }));

    writeOutlinePayload();
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineLoadingPage />);

    expect(
      (await screen.findAllByText(/provider timeout/)).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("失败详情")).toBeInTheDocument();
    expect(screen.getByText(/INTERNAL_ERROR/)).toBeInTheDocument();
    expect(screen.getAllByText(/provider timeout/).length).toBeGreaterThan(0);
  });

  it("outline loading still exposes failure details when only an error code is returned", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        error: "SOME_BACKEND_ERROR"
      })
    }));

    writeOutlinePayload();
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineLoadingPage />);

    expect(
      (await screen.findAllByText("AI 生成失败，请稍后重试。")).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("失败详情")).toBeInTheDocument();
    expect(screen.getByText(/SOME_BACKEND_ERROR/)).toBeInTheDocument();
  });

  it("renders outline drafts read-only before editing", async () => {
    const draft = buildOutlineDraft(request);
    draft.unifiedVisualSpec = {
      ...draft.unifiedVisualSpec,
      consistencyRules: [
        "所有页面沿用同一色板",
        "所有页面沿用同一色板。",
        "标题和正文层级保持一致"
      ],
      imageRules: {
        ...draft.unifiedVisualSpec.imageRules,
        usageNotes: [
          "背景图低对比",
          "背景图低对比。",
          "主体避开标题区"
        ]
      }
    };

    renderWithProviders(<OutlineReviewPage initialDraft={draft} />);

    expect(
      await screen.findByRole("region", { name: "大纲只读预览" })
    ).toBeInTheDocument();
    const editButton = screen.getByRole("button", { name: "编辑大纲" });
    const footer = editButton.closest("footer");
    const headerSection = screen
      .getByRole("heading", { name: "确认并修改大纲" })
      .closest("section");

    expect(editButton).toBeInTheDocument();
    expect(footer).toContainElement(editButton);
    expect(footer).toHaveTextContent("预览模式");
    expect(footer).toHaveTextContent("6 页");
    expect(headerSection).not.toContainElement(editButton);
    expect(headerSection).not.toHaveTextContent("预览模式");
    fireEvent.click(screen.getByText("统一视觉说明"));
    const visualSpecRegion = screen
      .getByText("统一视觉说明")
      .closest("details");

    expect(visualSpecRegion).not.toBeNull();
    expect(
      within(visualSpecRegion!).queryByText("全局视觉规范全文")
    ).not.toBeInTheDocument();
    expect(
      within(visualSpecRegion!).queryByText(/# 全局视觉统一规范/)
    ).not.toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("基础信息")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("色彩系统")).toBeInTheDocument();
    expect(
      within(visualSpecRegion!).getByText("视觉基调与 PPT 类型映射")
        .compareDocumentPosition(
          within(visualSpecRegion!).getByText("色彩系统")
        ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(within(visualSpecRegion!).getByText("版式与字体")).toBeInTheDocument();
    expect(
      within(visualSpecRegion!).getByText("完整字号层级（8 项）")
    ).toBeInTheDocument();
    expect(
      within(visualSpecRegion!).getAllByText("图片生成/使用规则").length
    ).toBeGreaterThan(0);
    expect(
      within(visualSpecRegion!).getAllByText(
        /图片\/插画保持干净、统一、低噪声/
      ).length
    ).toBeGreaterThan(0);
    expect(within(visualSpecRegion!).getByText("图片类型")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("画布比例")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("图片 Prompt 风格")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("禁用项")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("构图")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("规则 1")).toBeInTheDocument();
    expect(
      within(visualSpecRegion!).queryByText("图片/插画风格规范")
    ).not.toBeInTheDocument();
    expect(within(visualSpecRegion!).queryByText(/星图/)).not.toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("分组色板与角色")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getAllByText("关联角色").length).toBeGreaterThan(0);
    expect(visualSpecRegion!.querySelector('[data-color-token="#246BFE"]')).toBeTruthy();
    expect(visualSpecRegion!.querySelector('[data-color-token="#17202A"]')).toBeTruthy();
    expect(
      visualSpecRegion!.querySelectorAll('[data-color-system-card="#246BFE"]')
    ).toHaveLength(1);
    const titleColorCard = Array.from(
      visualSpecRegion!.querySelectorAll('[data-color-system-card="#17202A"]')
    ).find((card) => card.textContent?.includes("标题色角色"));
    const titleColorToken = titleColorCard?.querySelector(
      '[data-color-token="#17202A"]'
    );
    expect(titleColorToken).toBeTruthy();
    expect(titleColorCard?.textContent).toContain("用于标题");
    expect(titleColorCard?.textContent).toContain("标题色角色");
    expect(visualSpecRegion!.querySelector('[data-color-token="#2C3E50"]')).toBeNull();
    expect(visualSpecRegion!.querySelector('[data-color-token="#C0392B"]')).toBeNull();
    expect(screen.getAllByText(/12 栏栅格/).length).toBeGreaterThan(0);
    expect(screen.getByText("字体 fallback（每行一个）")).toBeInTheDocument();
    expect(screen.getByText("对比度要求")).toBeInTheDocument();
    expect(screen.getAllByText(/背景图避开高对比文字区域/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("本页核心表达句").length).toBeGreaterThan(0);
    expect(screen.getAllByText("叙事作用").length).toBeGreaterThan(0);
    expect(screen.getAllByText("主信息（引用可展示内容）").length).toBeGreaterThan(0);
    expect(screen.getByText("视觉基调与 PPT 类型映射")).toBeInTheDocument();
    expect(screen.getByText("推荐视觉基调")).toBeInTheDocument();
    expect(screen.getByText("视觉关键词（每行一条）")).toBeInTheDocument();
    expect(screen.getByText("商务汇报")).toBeInTheDocument();
    expect(screen.getByText("克制、可信、有层级")).toBeInTheDocument();
    expect(screen.getByText("数据图表")).toBeInTheDocument();
    expect(screen.queryByText("课程培训")).not.toBeInTheDocument();
    expect(screen.queryByText("品牌营销")).not.toBeInTheDocument();
    expect(screen.queryByText("研究报告")).not.toBeInTheDocument();
    expect(screen.getAllByText("封面标题").length).toBeGreaterThan(0);
    expect(screen.getByText("卡片/表面色角色")).toBeInTheDocument();
    expect(screen.queryByText("字号层级")).not.toBeInTheDocument();
    expect(screen.queryByText("色彩角色完整定义")).not.toBeInTheDocument();
    const advancedRulesDetails = within(visualSpecRegion!)
      .getByText(/高级规则（8 组 · \d+ 条，默认折叠）/)
      .closest("details");

    expect(advancedRulesDetails).not.toBeNull();
    expect(advancedRulesDetails).not.toHaveAttribute("open");
    fireEvent.click(
      within(visualSpecRegion!).getByText(/高级规则（8 组 · \d+ 条，默认折叠）/)
    );
    expect(within(visualSpecRegion!).getByText("图表视觉规范")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("布局规则")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("信息密度规则")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("图标风格规范")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("组件与元素规范")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("透明度规则")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("强调规则")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("禁用规则")).toBeInTheDocument();
    expect(screen.queryByText("布局规则（每行一条）")).not.toBeInTheDocument();
    expect(
      within(visualSpecRegion!).getAllByText("所有页面沿用同一色板").length
    ).toBe(1);
    expect(
      (visualSpecRegion!.textContent?.match(/背景图低对比/g) ?? []).length
    ).toBe(1);
    const consistencyRuleLabel = within(visualSpecRegion!).getByText("规则 1");
    const forbiddenRuleLabel = within(visualSpecRegion!).getByText("禁用规则");
    expect(
      document.body.textContent?.indexOf(consistencyRuleLabel.textContent ?? "")
    ).toBeLessThan(
      document.body.textContent?.indexOf(forbiddenRuleLabel.textContent ?? "") ?? 0
    );
    expect(screen.queryByDisplayValue(draft.deckTitle)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /保存大纲/ })
    ).not.toBeInTheDocument();
  });

  it("renders duplicate font fallback values without duplicate key errors", async () => {
    const draft = buildOutlineDraft(request);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    draft.unifiedVisualSpec = {
      ...draft.unifiedVisualSpec,
      typographyRules: {
        ...draft.unifiedVisualSpec.typographyRules,
        fontFallback: [
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
          "sans-serif"
        ]
      }
    };

    try {
      renderWithProviders(<OutlineReviewPage initialDraft={draft} />);
      fireEvent.click(screen.getByText("统一视觉说明"));

      expect(screen.getByText("字体 fallback（每行一个）")).toBeInTheDocument();
      expect(screen.getAllByText("sans-serif")).toHaveLength(2);
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          call.some((item) => String(item).includes("same key"))
        )
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("saves edited outlines from edit mode", async () => {
    const draft = buildOutlineDraft(request);
    const savedDraft = {
      ...draft,
      deckTitle: "更新后的大纲标题"
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => savedDraft
    }));

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineReviewPage initialDraft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑大纲" }));
    const cancelButton = screen.getByRole("button", { name: "取消编辑" });
    const footer = cancelButton.closest("footer");

    expect(footer).toContainElement(cancelButton);
    expect(footer).toHaveTextContent("编辑模式");
    expect(footer).toHaveTextContent("6 页");
    expect(footer).toContainElement(
      screen.getByRole("button", { name: /保存大纲/ })
    );

    const titleInput = await screen.findByDisplayValue(draft.deckTitle);
    fireEvent.change(titleInput, {
      target: { value: "更新后的大纲标题" }
    });
    fireEvent.click(screen.getByText("统一视觉说明"));
    expect(screen.queryByLabelText("全局视觉规范全文")).not.toBeInTheDocument();
    expect(screen.getByText("分组色板与角色")).toBeInTheDocument();
    expect(screen.getByText("颜色角色微调")).toBeInTheDocument();
    const visualSpecEditor = screen.getByText("统一视觉说明").closest("details");
    const backgroundRoleInput = within(visualSpecEditor!).getByLabelText(
      "背景色角色"
    );
    fireEvent.change(backgroundRoleInput, {
      target: { value: "#FFFFFF 用于主背景，部分页面可作为区域背景。" }
    });
    fireEvent.click(screen.getByText("高级视觉规范"));
    expect(
      screen.getAllByPlaceholderText("输入一条规则后按回车添加").length
    ).toBeGreaterThan(0);
    const advancedSection = screen
      .getByText("高级视觉规范")
      .closest("details");
    const ruleInputs = within(advancedSection!).getAllByPlaceholderText(
      "输入一条规则后按回车添加"
    );
    const forbiddenRuleInput = ruleInputs[ruleInputs.length - 1];
    fireEvent.click(
      within(advancedSection!).getAllByRole("button", {
        name: /避免高饱和大面积撞色/
      })[0]
    );
    fireEvent.change(forbiddenRuleInput, {
      target: { value: "禁止使用高饱和颜色" }
    });
    fireEvent.keyDown(forbiddenRuleInput, { key: "Enter", code: "Enter" });
    fireEvent.change(forbiddenRuleInput, {
      target: { value: "禁止使用高饱和颜色" }
    });
    fireEvent.keyDown(forbiddenRuleInput, { key: "Enter", code: "Enter" });
    fireEvent.change(forbiddenRuleInput, {
      target: { value: "避免过度阴影和3D效果" }
    });
    fireEvent.keyDown(forbiddenRuleInput, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /保存大纲/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "编辑大纲" })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decks/outline/draft-1",
      expect.objectContaining({
        body: expect.stringContaining("更新后的大纲标题"),
        method: "PATCH"
      })
    );
    const fetchCalls = fetchMock.mock.calls as unknown as Array<
      [RequestInfo | URL, RequestInit?]
    >;
    const patchCall = fetchCalls.find(
      (call) => String(call[0]) === "/api/decks/outline/draft-1"
    );
    const patchBody = JSON.parse(
      String((patchCall?.[1] as RequestInit | undefined)?.body ?? "{}")
    );
    expect(patchBody.slides[0]).toMatchObject({
      coreStatement: expect.any(String),
      contentLayers: expect.objectContaining({
        primary: expect.any(Array)
      }),
      viewerObjective: expect.objectContaining({
        type: expect.any(String)
      })
    });
    expect(patchBody.unifiedVisualSpec).toMatchObject({
      layoutRules: {
        pageMargin: expect.any(String),
        sectionGap: expect.any(String),
        elementGap: expect.any(String),
        whitespace: expect.any(String)
      },
      pptTypeVisualTone: expect.any(Object),
      typographyRules: expect.objectContaining({
        scale: expect.any(Object)
      })
    });
    expect(patchBody.unifiedVisualSpec).not.toHaveProperty("visualSpecMarkdown");
    expect(patchBody.unifiedVisualSpec.colorRoles.background).toBe(
      "#FFFFFF 用于主背景，部分页面可作为区域背景。"
    );
    expect(patchBody.unifiedVisualSpec.forbiddenVisualRules).toContain(
      "禁止使用高饱和颜色"
    );
    expect(patchBody.unifiedVisualSpec.forbiddenVisualRules).toContain(
      "避免过度阴影和3D效果"
    );
    expect(
      patchBody.unifiedVisualSpec.forbiddenVisualRules.filter(
        (item: string) => item === "禁止使用高饱和颜色"
      )
    ).toHaveLength(1);
    expect(patchBody.unifiedVisualSpec.forbiddenRules.length).toBeLessThanOrEqual(6);
    expect(patchBody.unifiedVisualSpec).not.toHaveProperty("typographyScale");
    expect(patchBody.unifiedVisualSpec).not.toHaveProperty("colorRoleDefinitions");
    expect(patchBody.unifiedVisualSpec).not.toHaveProperty("spacingRules");
    expect(router.push).not.toHaveBeenCalledWith("/workbench/generate/loading");
  });

  it("starts preview PPT generation from the read-only outline without saving first", async () => {
    const draft = buildOutlineDraft(request);
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineReviewPage initialDraft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: /生成预览PPT/ }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/workbench/generate/loading");
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      JSON.parse(window.sessionStorage.getItem(generatePayloadStorageKey) ?? "{}")
    ).toEqual({
      outlineDraftId: "draft-1"
    });
  });

  it("saves edited outlines before starting preview PPT generation", async () => {
    const draft = buildOutlineDraft(request);
    const savedDraft = {
      ...draft,
      deckTitle: "更新后的大纲标题"
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => savedDraft
    }));

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineReviewPage initialDraft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑大纲" }));
    const titleInput = await screen.findByDisplayValue(draft.deckTitle);
    fireEvent.change(titleInput, {
      target: { value: "更新后的大纲标题" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成预览PPT/ }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/workbench/generate/loading");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decks/outline/draft-1",
      expect.objectContaining({
        body: expect.stringContaining("更新后的大纲标题"),
        method: "PATCH"
      })
    );
    expect(
      JSON.parse(window.sessionStorage.getItem(generatePayloadStorageKey) ?? "{}")
    ).toEqual({
      outlineDraftId: "draft-1"
    });
  });

  it("deletes an outline draft from the review page", async () => {
    const draft = buildOutlineDraft(request);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true
      })
    }));

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<OutlineReviewPage initialDraft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "确认删除"
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/decks/outline/draft-1",
        expect.objectContaining({
          method: "DELETE"
        })
      );
      expect(router.push).toHaveBeenCalledWith("/workbench");
    });
  });

  it("generate loading sends outlineDraftId, polls status, and opens final preview", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/status")) {
        return {
          ok: true,
          json: async () => ({
            id: "deck-1",
            status: "READY"
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          id: "deck-1",
          status: "GENERATING"
        })
      };
    });

    window.sessionStorage.setItem(
      generatePayloadStorageKey,
      JSON.stringify({
        outlineDraftId: "draft-1"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<GenerateLoadingPage />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/workbench/preview/deck-1");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/decks/generate",
      expect.objectContaining({
        body: JSON.stringify({
          outlineDraftId: "draft-1"
        }),
        method: "POST"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/decks/deck-1/status");
  });

  it("generate loading opens lightweight preview before the deck is fully ready", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/status")) {
        return {
          ok: true,
          json: async () => ({
            id: "deck-1",
            previewReady: true,
            previewUrl: "/workbench/preview/deck-1",
            progress: {
              current: 5,
              message: "正在生成第 6/18 页。",
              stage: "composing",
              total: 18
            },
            status: "GENERATING"
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          id: "deck-1",
          previewReady: false,
          status: "GENERATING"
        })
      };
    });

    window.sessionStorage.setItem(
      generatePayloadStorageKey,
      JSON.stringify({
        outlineDraftId: "draft-1"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<GenerateLoadingPage />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/workbench/preview/deck-1");
    });
  });

  it("generate loading shows real async failure details from status polling", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/status")) {
        return {
          ok: true,
          json: async () => ({
            details: {
              current: 0,
              error: "AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed",
              projectId: "deck-1",
              stage: "failed",
              total: 3
            },
            error: "AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed",
            id: "deck-1",
            progress: {
              current: 0,
              message: "页面图层 JSON 校验失败。",
              stage: "failed",
              total: 3
            },
            status: "FAILED"
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          id: "deck-1",
          status: "GENERATING"
        })
      };
    });

    window.sessionStorage.setItem(
      generatePayloadStorageKey,
      JSON.stringify({
        outlineDraftId: "draft-1"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<GenerateLoadingPage />);

    expect(
      await screen.findByText("预览 PPT 生成失败")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /AI_JSON_GENERATION_FAILED: SlideCompositionPlan validation failed/
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("失败详情")).toBeInTheDocument();
    expect(screen.getByText(/projectId/)).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalledWith(
      "/workbench/preview/deck-1"
    );
  });

  it("generate loading falls back to progress message when failed status has no error", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/status")) {
        return {
          ok: true,
          json: async () => ({
            details: {
              current: 1,
              error: "图片生成失败：模型不支持当前比例。",
              projectId: "deck-1",
              stage: "failed",
              total: 3
            },
            id: "deck-1",
            progress: {
              current: 1,
              message: "图片生成失败：模型不支持当前比例。",
              stage: "failed",
              total: 3
            },
            status: "FAILED"
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          id: "deck-1",
          status: "GENERATING"
        })
      };
    });

    window.sessionStorage.setItem(
      generatePayloadStorageKey,
      JSON.stringify({
        outlineDraftId: "draft-1"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<GenerateLoadingPage />);

    expect(
      await screen.findByText("图片生成失败：模型不支持当前比例。")
    ).toBeInTheDocument();
    expect(screen.getByText("失败详情")).toBeInTheDocument();
  });

  it("generate loading keeps polling in background instead of failing on timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/status")) {
        return {
          ok: true,
          json: async () => ({
            id: "deck-1",
            previewReady: false,
            progress: {
              current: 1,
              message: "正在生成第 1 页图片素材。",
              stage: "images",
              total: 3
            },
            status: "GENERATING"
          })
        };
      }

      return {
        ok: true,
        json: async () => ({
          id: "deck-1",
          status: "GENERATING"
        })
      };
    });

    window.sessionStorage.setItem(
      generatePayloadStorageKey,
      JSON.stringify({
        outlineDraftId: "draft-1"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<GenerateLoadingPage />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/decks/deck-1/status");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(180 * 1500);
    });

    expect(
      screen.getByText("生成仍在后台继续")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("预览 PPT 生成失败")
    ).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalledWith(
      "/workbench/preview/deck-1"
    );
    vi.useRealTimers();
  });

  it("renders final deck preview editor with motion and download controls", async () => {
    const deck = buildGeneratedDeck(request);

    renderWithProviders(<DeckPreviewPage deck={deck} />);

    expect(screen.getByText("本页内容")).toBeInTheDocument();
    expect(screen.queryByText("每页可展示内容")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "编辑正文条目" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新生成当前页" })
    ).toBeInTheDocument();
    expect(screen.getByText("内容审核")).toBeInTheDocument();
    expect(screen.getByText("一致性")).toBeInTheDocument();
    expect(screen.queryByText(deck.contentReview.summary)).not.toBeInTheDocument();
    expect(
      screen.queryByText(deck.consistencyReport.summary)
    ).not.toBeInTheDocument();

    const reviewScoreCard = screen.getByTestId("deck-preview-score-card-review");
    expect(
      within(reviewScoreCard).getByText(String(deck.contentReview.score))
    ).toBeInTheDocument();
    fireEvent.mouseEnter(reviewScoreCard);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      deck.contentReview.summary
    );
    fireEvent.mouseLeave(reviewScoreCard);
    await waitFor(() => {
      expect(screen.queryByText(deck.contentReview.summary)).not.toBeInTheDocument();
    });

    const consistencyScoreCard = screen.getByTestId(
      "deck-preview-score-card-consistency"
    );
    expect(
      within(consistencyScoreCard).getByText(String(deck.consistencyReport.score))
    ).toBeInTheDocument();
    fireEvent.mouseEnter(consistencyScoreCard);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      deck.consistencyReport.summary
    );
    fireEvent.mouseLeave(consistencyScoreCard);
    await waitFor(() => {
      expect(
        screen.queryByText(deck.consistencyReport.summary)
      ).not.toBeInTheDocument();
    });

    const displayContentPanel = screen.getByTestId(
      "slide-display-content-panel"
    );
    const displayContentList = screen.getByTestId("slide-display-content-list");
    expect(displayContentPanel).not.toHaveTextContent('"slideId"');
    expect(displayContentPanel).not.toHaveTextContent('"contentBlocks"');
    expect(displayContentPanel).toHaveClass("h-full");
    expect(displayContentPanel).toHaveClass("grid-rows-[auto_minmax(0,1fr)]");
    expect(displayContentList).toHaveClass("overflow-y-auto");
    expect(displayContentList).toHaveClass("min-h-0");
    expect(displayContentList).not.toHaveClass("max-h-72");
    expect(displayContentPanel).toHaveTextContent("heading：");
    expect(displayContentPanel).toHaveTextContent("text：");
    expect(displayContentPanel).toHaveTextContent("conclusion：");
    expect(displayContentPanel).toHaveTextContent("P1");
    expect(displayContentPanel).toHaveTextContent("P3");
    expect(displayContentPanel).toHaveTextContent(
      deck.slides[0]?.content.contentBlocks[0]?.text ?? ""
    );
    const firstBoundElement = deck.slides[0]?.elements.find(
      (element) => element.contentBlockIndex === 0
    );
    const firstContentItem = screen.getByTestId("slide-display-content-item-0");
    expect(firstBoundElement).toBeDefined();
    expect(within(firstContentItem).getByLabelText("文字")).toBeInTheDocument();
    expect(firstContentItem).toHaveTextContent(
      `层级 ${firstBoundElement?.zIndex}`
    );
    expect(
      screen.getByRole("button", { name: "统一视觉说明" })
    ).toBeInTheDocument();
    const qualityButton = screen.getByRole("button", {
      name: "设计质量评分"
    });
    expect(qualityButton).toBeInTheDocument();
    const selectedElementEditor = screen.getByTestId(
      "slide-selected-element-editor"
    );
    expect(screen.queryByText("页面元素编排")).not.toBeInTheDocument();
    expect(
      selectedElementEditor.compareDocumentPosition(displayContentPanel)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByLabelText("视觉风格")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /下载PPTX/
      })
    ).toHaveAttribute("href", deck.pptxUrl);

    fireEvent.click(screen.getByRole("button", { name: "统一视觉说明" }));

    const visualSpecDialog = screen.getByRole("dialog", {
      name: "统一视觉说明"
    });
    expect(within(visualSpecDialog).getByText("基础信息")).toBeInTheDocument();
    expect(within(visualSpecDialog).getByText("色彩系统")).toBeInTheDocument();
    expect(
      within(visualSpecDialog).getByText("分组色板与角色")
    ).toBeInTheDocument();

    fireEvent.click(within(visualSpecDialog).getByRole("button", { name: "关闭" }));

    expect(
      screen.queryByRole("dialog", { name: "统一视觉说明" })
    ).not.toBeInTheDocument();

    fireEvent.click(qualityButton);
    expect(router.push).toHaveBeenCalledWith("/workbench/preview/deck-1/quality");
  });

  it("renders the standalone design quality page", () => {
    const deck = buildGeneratedDeck(request);
    const firstSlide = deck.slides[0];

    expect(firstSlide).toBeDefined();
    renderWithProviders(
      <DeckQualityPage
        deck={{
          ...deck,
          slides: deck.slides.map((slide, index) =>
            index === 0
              ? {
                  ...slide,
                  designQualityScore: {
                    ...slide.designQualityScore,
                    issues: ["页面可展示内容未完全落版。"],
                    suggestions: ["为每个可展示内容块补充对应画布元素。"]
                  }
                }
              : slide
          )
        }}
      />
    );

    expect(screen.getByRole("button", { name: "返回预览页" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: deck.deckTitle })).toBeInTheDocument();
    const slideQuality = screen.getByTestId(
      `deck-quality-slide-${firstSlide?.slideId}`
    );

    expect(within(slideQuality).getByText("总分")).toBeInTheDocument();
    expect(
      within(slideQuality).getByText(String(firstSlide?.designQualityScore.totalScore))
    ).toBeInTheDocument();
    expect(within(slideQuality).getByText("信息层级")).toBeInTheDocument();
    expect(within(slideQuality).getByText("视觉一致")).toBeInTheDocument();
    expect(within(slideQuality).getByText("内容密度")).toBeInTheDocument();
    expect(within(slideQuality).getByText("可渲染性")).toBeInTheDocument();
    expect(within(slideQuality).getByText("表达完整")).toBeInTheDocument();
    expect(
      within(slideQuality).getByText("页面可展示内容未完全落版。")
    ).toBeInTheDocument();
    expect(
      within(slideQuality).getByText("为每个可展示内容块补充对应画布元素。")
    ).toBeInTheDocument();
    expect(within(slideQuality).getByText("自动修复")).toBeInTheDocument();
    expect(within(slideQuality).getByText("候选版式")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回预览页" }));
    expect(router.push).toHaveBeenCalledWith("/workbench/preview/deck-1");
  });

  it("deduplicates cover metadata in preview content and generated layers", () => {
    const deck = buildGeneratedDeck(request);
    const slide = deck.slides[0]!;
    const titleElement = slide.elements.find(
      (element) => element.semanticType === "title"
    )!;
    const generatedAuthorElement: SlideElement = {
      ...titleElement,
      id: `${slide.slideId}-cb-2`,
      content: "作者：柳宗元（唐）",
      contentBlockIndex: 1,
      role: "可展示正文 2",
      semanticType: "body",
      styleNotes: "由可展示内容补齐层生成，确保内容块可在画布和元素编排中选择。",
      zIndex: 37
    };
    const duplicateAuthorElement: SlideElement = {
      ...generatedAuthorElement,
      id: `${slide.slideId}-cb-3`,
      content: "柳宗元（唐）",
      contentBlockIndex: 2,
      zIndex: 38
    };
    const coursewareElement: SlideElement = {
      ...generatedAuthorElement,
      id: `${slide.slideId}-cb-4`,
      content: "统编版八年级下册 文言文精讲课件。",
      contentBlockIndex: 3,
      zIndex: 39
    };
    const duplicateCoursewareElement: SlideElement = {
      ...generatedAuthorElement,
      id: `${slide.slideId}-cb-5`,
      content: "初中语文精品课件",
      contentBlockIndex: 4,
      zIndex: 40
    };
    const rawDuplicateDeck: GeneratedDeckResult = {
      ...deck,
      slides: deck.slides.map((item, index) =>
        index === 0
          ? {
              ...item,
              content: {
                ...item.content,
                pageType: "cover",
                title: "小石潭记",
                contentBlocks: [
                  {
                    blockType: "title",
                    content: "小石潭记",
                    priority: 1,
                    sourceIds: [],
                    text: "小石潭记",
                    type: "heading"
                  },
                  {
                    blockType: "body",
                    content: "作者：柳宗元（唐）",
                    priority: 2,
                    sourceIds: [],
                    text: "作者：柳宗元（唐）",
                    type: "text"
                  },
                  {
                    blockType: "note",
                    content: "柳宗元（唐）",
                    priority: 3,
                    sourceIds: [],
                    text: "柳宗元（唐）",
                    type: "source"
                  },
                  {
                    blockType: "conclusion",
                    content: "统编版八年级下册 文言文精讲课件。",
                    priority: 1,
                    sourceIds: [],
                    text: "统编版八年级下册 文言文精讲课件。",
                    type: "conclusion"
                  },
                  {
                    blockType: "note",
                    content: "初中语文精品课件",
                    priority: 5,
                    sourceIds: [],
                    text: "初中语文精品课件",
                    type: "source"
                  }
                ]
              },
              elements: [
                titleElement,
                generatedAuthorElement,
                duplicateAuthorElement,
                coursewareElement,
                duplicateCoursewareElement
              ],
              designPlan: {
                ...item.designPlan,
                readingOrder: [
                  titleElement.id,
                  generatedAuthorElement.id,
                  duplicateAuthorElement.id,
                  coursewareElement.id,
                  duplicateCoursewareElement.id
                ]
              }
            }
          : item
      )
    };
    const duplicateDeck: GeneratedDeckResult = {
      ...rawDuplicateDeck,
      slides: rawDuplicateDeck.slides.map((item, index) => {
        if (index !== 0) {
          return item;
        }

        const normalized = normalizeSlideCompositionPlan(item, {
          completeContentBlocks: true
        });

        return {
          ...item,
          ...normalized
        };
      })
    };

    renderWithProviders(<DeckPreviewPage deck={duplicateDeck} />);

    const displayContentList = screen.getByTestId("slide-display-content-list");

    expect(displayContentList.textContent?.match(/柳宗元/g) ?? []).toHaveLength(1);
    expect(displayContentList.textContent?.match(/课件/g) ?? []).toHaveLength(1);
    expect(
      screen.queryByTestId(`slide-canvas-element-${duplicateAuthorElement.id}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`slide-canvas-element-${duplicateCoursewareElement.id}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`slide-display-layer-item-${duplicateAuthorElement.id}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`slide-display-layer-item-${duplicateCoursewareElement.id}`)
    ).not.toBeInTheDocument();
  });

  it("uses the PPT visual spec palette for thumbnails and canvas elements", () => {
    window.localStorage.setItem("pptcm_palette", "matrix");
    document.documentElement.dataset.palette = "matrix";
    const deck = buildPalettePreviewDeck(request);
    const titleElement = deck.slides[0]?.elements.find(
      (element) => element.semanticType === "title"
    );

    expect(titleElement).toBeDefined();
    renderWithProviders(<DeckPreviewPage deck={deck} />);

    const visualBackgrounds = document.querySelectorAll(
      '[data-slide-visual-background="#F5F0E8"]'
    );
    expect(visualBackgrounds.length).toBeGreaterThan(1);
    expect(document.documentElement.dataset.palette).toBe("matrix");

    const titleCanvasElement = screen.getByTestId(
      `slide-canvas-element-${titleElement?.id}`
    );
    const shapeElement = screen.getByTestId("slide-canvas-element-palette-shape");
    const chartElement = screen.getByTestId("slide-canvas-element-palette-chart");
    const firstChartBar = chartElement.querySelector("span span");

    expect(titleCanvasElement).toHaveStyle({
      color: "#123456"
    });
    expect(shapeElement).toHaveStyle({
      backgroundColor: "#E8D5B7"
    });
    expect(chartElement.getAttribute("style")).not.toContain("var(--accent)");
    expect(firstChartBar).toHaveStyle({
      backgroundColor: "#AA1100"
    });
  });

  it("syncs page body points to text body and card elements without changing non-text layers", () => {
    const deck = buildGeneratedDeck(request);
    const slide = deck.slides[0];

    expect(slide).toBeDefined();
    const titleElement = slide.elements.find(
      (element) => element.semanticType === "title"
    );
    const subtitleElement = slide.elements.find(
      (element) => element.semanticType === "subtitle"
    );
    const footerElement = slide.elements.find(
      (element) => element.semanticType === "footer"
    );
    const cardShape: SlideElement = {
      bounds: {
        height: 1,
        width: 2,
        x: 6,
        y: 2
      },
      editable: true,
      hierarchyLevel: 4,
      id: "body-card-shape",
      requiresImageGeneration: false,
      role: "正文卡片背景",
      semanticType: "card",
      styleNotes: "卡片背景形状不应随正文条目同步。",
      type: "shape",
      zIndex: 9
    };
    const firstCardText: SlideElement = {
      bounds: {
        height: 0.8,
        width: 2.2,
        x: 1,
        y: 2
      },
      content: "旧卡片一",
      editable: true,
      hierarchyLevel: 2,
      id: "body-card-text-1",
      requiresImageGeneration: false,
      role: "正文卡片一",
      semanticType: "card",
      styleNotes: "正文卡片文本应按条目顺序同步。",
      textStyle: {
        align: "left",
        fontSize: 14,
        fontWeight: "medium",
        lineHeight: 1.25
      },
      type: "text",
      zIndex: 20
    };
    const secondCardText: SlideElement = {
      ...firstCardText,
      bounds: {
        ...firstCardText.bounds,
        x: 3.5
      },
      content: "旧卡片二",
      id: "body-card-text-2",
      role: "正文卡片二"
    };
    const extraCardText: SlideElement = {
      ...firstCardText,
      bounds: {
        ...firstCardText.bounds,
        x: 6
      },
      content: "保留卡片三",
      id: "body-card-text-3",
      role: "正文卡片三"
    };
    const bodyText: SlideElement = {
      ...firstCardText,
      bounds: {
        ...firstCardText.bounds,
        x: 8.5
      },
      content: "旧正文",
      id: "body-text",
      role: "正文要点",
      semanticType: "body"
    };
    const patchedDeck: GeneratedDeckResult = {
      ...deck,
      slides: deck.slides.map((item, index) =>
        index === 0
          ? {
              ...item,
              content: {
                ...item.content,
                bodyPoints: ["旧条目一", "旧条目二", "旧条目三"]
              },
              elements: [
                titleElement,
                subtitleElement,
                cardShape,
                firstCardText,
                secondCardText,
                extraCardText,
                bodyText,
                footerElement
              ].filter((element): element is SlideElement => Boolean(element))
            }
          : item
      )
    };

    renderWithProviders(<DeckPreviewPage deck={patchedDeck} />);
    const titleCanvasElement = screen.getByTestId(
      `slide-canvas-element-${titleElement?.id}`
    );
    const initialTitleText = titleCanvasElement.textContent ?? "";
    const subtitleCanvasElement = subtitleElement
      ? screen.getByTestId(`slide-canvas-element-${subtitleElement.id}`)
      : null;
    const initialSubtitleText = subtitleCanvasElement?.textContent ?? "";

    fireEvent.click(screen.getByRole("button", { name: "编辑正文条目" }));
    expect(screen.getByRole("button", { name: "完成" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("正文"), {
      target: {
        value: "新条目一\n新条目二"
      }
    });

    expect(titleCanvasElement).toHaveTextContent(initialTitleText);
    if (subtitleCanvasElement && subtitleElement) {
      expect(subtitleCanvasElement).toHaveTextContent(initialSubtitleText);
    }
    expect(screen.getByTestId("slide-canvas-element-body-card-text-1")).toHaveTextContent(
      "新条目一"
    );
    expect(screen.getByTestId("slide-canvas-element-body-card-text-2")).toHaveTextContent(
      "新条目二"
    );
    expect(screen.getByTestId("slide-canvas-element-body-card-text-3")).toHaveTextContent(
      "保留卡片三"
    );
    expect(screen.getByTestId("slide-canvas-element-body-text")).toHaveTextContent(
      "旧正文"
    );
    expect(screen.getByTestId("slide-canvas-element-body-card-shape")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "完成" }));
    const displayContentPanel = screen.getByTestId(
      "slide-display-content-panel"
    );
    expect(displayContentPanel).toHaveTextContent("heading：");
    expect(displayContentPanel).toHaveTextContent("conclusion：");
    expect(displayContentPanel).toHaveTextContent("P1");

    if (footerElement) {
      expect(
        screen.getByTestId(`slide-canvas-element-${footerElement.id}`)
      ).toHaveTextContent(footerElement.content ?? "");
    }
  });

  it("highlights the canvas area and matching content item after selecting a text element", () => {
    const deck = buildGeneratedDeck(request);
    const titleElement = deck.slides[0]?.elements.find(
      (element) => element.semanticType === "title"
    );
    const scrollIntoViewMock = vi.fn();

    expect(titleElement).toBeDefined();
    Object.defineProperty(window.Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock
    });
    Object.defineProperty(window.Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });

    renderWithProviders(<DeckPreviewPage deck={deck} />);

    const contentItem = screen.getByTestId(
      `slide-display-content-item-${titleElement?.contentBlockIndex}`
    );
    const selectedElementEditor = screen.getByTestId(
      "slide-selected-element-editor"
    );
    expect(contentItem).not.toHaveAttribute("data-selected", "true");
    expect(within(contentItem).getByLabelText("文字")).toBeInTheDocument();
    expect(contentItem).toHaveTextContent(`层级 ${titleElement?.zIndex}`);
    expect(selectedElementEditor).not.toHaveAttribute("data-selected", "true");

    const canvasElement = screen.getByTestId(
      `slide-canvas-element-${titleElement?.id}`
    );
    expect(canvasElement).not.toHaveAttribute("data-selected", "true");
    expect(canvasElement).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByTestId(`slide-canvas-element-highlight-${titleElement?.id}`)
    ).not.toBeInTheDocument();

    fireEvent.pointerDown(canvasElement, {
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });

    fireEvent.change(within(selectedElementEditor).getByLabelText("内容"), {
      target: {
        value: "选中元素新标题"
      }
    });

    expect(canvasElement).toHaveAttribute("data-selected", "true");
    expect(canvasElement).toHaveAttribute("aria-pressed", "true");
    expect(canvasElement).toHaveTextContent("选中元素新标题");
    expect(
      screen.getByTestId(`slide-canvas-element-highlight-${titleElement?.id}`)
    ).toBeInTheDocument();
    expect(contentItem).toHaveAttribute("data-selected", "true");
    expect(selectedElementEditor).toHaveAttribute("data-selected", "true");
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest"
    });

    fireEvent.click(contentItem);
    expect(canvasElement).toHaveAttribute("data-selected", "true");
  });

  it("highlights bound image content and image layer request after selecting an image element", () => {
    const deck = buildGeneratedDeck(request);
    const imageElement = deck.slides[0]?.elements.find(
      (element) => element.type === "generatedImage"
    );
    const imageBlockIndex = deck.slides[0]?.content.contentBlocks.length ?? 0;
    const imageBoundDeck: GeneratedDeckResult = {
      ...deck,
      slides: deck.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              content: {
                ...slide.content,
                contentBlocks: [
                  ...slide.content.contentBlocks,
                  {
                    blockType: "note",
                    content: "主视觉图片说明",
                    priority: 3,
                    sourceIds: [],
                    text: "主视觉图片说明",
                    type: "image"
                  }
                ]
              },
              elements: slide.elements.map((element) =>
                element.id === imageElement?.id
                  ? {
                      ...element,
                      contentBlockIndex: imageBlockIndex
                    }
                  : element
              )
            }
          : slide
      )
    };
    const scrollIntoViewMock = vi.fn();

    expect(imageElement?.imageRequestId).toBeDefined();
    Object.defineProperty(window.Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock
    });
    Object.defineProperty(window.Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });

    renderWithProviders(<DeckPreviewPage deck={imageBoundDeck} />);

    const canvasElement = screen.getByTestId(
      `slide-canvas-element-${imageElement?.id}`
    );
    const contentItem = screen.getByTestId(
      `slide-display-content-item-${imageBlockIndex}`
    );

    expect(canvasElement).toHaveAttribute("aria-pressed", "false");
    expect(within(contentItem).getByLabelText("生成图片")).toBeInTheDocument();
    expect(contentItem).toHaveTextContent(`层级 ${imageElement?.zIndex}`);
    expect(contentItem).toHaveTextContent("image：");
    expect(contentItem).toHaveTextContent("主视觉图片说明");
    expect(contentItem).toHaveTextContent("P3");
    expect(
      screen.queryByTestId(`slide-display-layer-item-${imageElement?.id}`)
    ).not.toBeInTheDocument();

    fireEvent.pointerDown(canvasElement, {
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });

    expect(canvasElement).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByTestId(`slide-canvas-element-highlight-${imageElement?.id}`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        `slide-image-layer-meta-${imageElement?.imageRequestId}`
      )
    ).toHaveAttribute("data-selected", "true");
    expect(contentItem).toHaveAttribute("data-selected", "true");
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);

    fireEvent.click(contentItem);
    expect(canvasElement).toHaveAttribute("data-selected", "true");
  });

  it("shows all unbound canvas layers in current slide content and selects them", () => {
    const deck = buildGeneratedDeck(request);
    const slide = deck.slides[0];
    const imageElement = slide.elements.find(
      (element) => element.type === "generatedImage"
    );
    const unboundShape: SlideElement = {
      bounds: {
        height: 0.72,
        width: 2.4,
        x: 0.52,
        y: 0.48
      },
      editable: true,
      hierarchyLevel: 4,
      id: "unbound-background-shape",
      requiresImageGeneration: false,
      role: "水墨背景块",
      semanticType: "background",
      styleNotes: "用于验证未绑定背景图层展示。",
      type: "shape",
      zIndex: 2
    };
    const unboundIcon: SlideElement = {
      bounds: {
        height: 0.36,
        width: 0.36,
        x: 11.8,
        y: 0.72
      },
      editable: true,
      hierarchyLevel: 4,
      id: "unbound-icon",
      requiresImageGeneration: false,
      role: "章节图标",
      semanticType: "icon",
      styleNotes: "用于验证未绑定图标展示。",
      type: "icon",
      zIndex: 18
    };
    const unboundChart: SlideElement = {
      bounds: {
        height: 1.2,
        width: 2.4,
        x: 9.2,
        y: 5.2
      },
      editable: true,
      hierarchyLevel: 3,
      id: "unbound-chart",
      requiresImageGeneration: false,
      role: "趋势图表",
      semanticType: "chart",
      styleNotes: "用于验证未绑定图表展示。",
      type: "chartPlaceholder",
      zIndex: 24
    };
    const layerDeck: GeneratedDeckResult = {
      ...deck,
      slides: deck.slides.map((item, index) =>
        index === 0
          ? {
              ...item,
              elements: [
                ...item.elements.map((element) =>
                  element.id === imageElement?.id
                    ? {
                        ...element,
                        contentBlockIndex: undefined
                      }
                    : element
                ),
                unboundShape,
                unboundIcon,
                unboundChart
              ]
            }
          : item
      )
    };
    const scrollIntoViewMock = vi.fn();

    expect(imageElement).toBeDefined();
    Object.defineProperty(window.Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(window.Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock
    });

    renderWithProviders(<DeckPreviewPage deck={layerDeck} />);

    const imageLayerItem = screen.getByTestId(
      `slide-display-layer-item-${imageElement?.id}`
    );
    const shapeLayerItem = screen.getByTestId(
      `slide-display-layer-item-${unboundShape.id}`
    );
    const iconLayerItem = screen.getByTestId(
      `slide-display-layer-item-${unboundIcon.id}`
    );
    const chartLayerItem = screen.getByTestId(
      `slide-display-layer-item-${unboundChart.id}`
    );

    expect(within(imageLayerItem).getByLabelText("生成图片")).toBeInTheDocument();
    expect(imageLayerItem).toHaveTextContent("图层：");
    expect(imageLayerItem).toHaveTextContent(imageElement?.role ?? "");
    expect(imageLayerItem).toHaveTextContent(`层级 ${imageElement?.zIndex}`);
    expect(imageLayerItem).not.toHaveTextContent("P3");
    expect(within(shapeLayerItem).getByLabelText("形状")).toBeInTheDocument();
    expect(shapeLayerItem).toHaveTextContent("水墨背景块");
    expect(shapeLayerItem).toHaveTextContent(`层级 ${unboundShape.zIndex}`);
    expect(within(iconLayerItem).getByLabelText("图标")).toBeInTheDocument();
    expect(iconLayerItem).toHaveTextContent("章节图标");
    expect(within(chartLayerItem).getByLabelText("图表占位")).toBeInTheDocument();
    expect(chartLayerItem).toHaveTextContent("趋势图表");

    fireEvent.click(shapeLayerItem);

    expect(
      screen.getByTestId(`slide-canvas-element-${unboundShape.id}`)
    ).toHaveAttribute("data-selected", "true");
    expect(shapeLayerItem).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("slide-selected-element-editor")).toHaveAttribute(
      "data-selected",
      "true"
    );
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest"
    });
  });

  it("highlights display content for legacy text elements without saved bindings", () => {
    const deck = buildGeneratedDeck(request);
    const slide = deck.slides[0];
    const titleElement = slide.elements.find(
      (element) => element.semanticType === "title"
    );
    const imageElement = slide.elements.find(
      (element) => element.type === "generatedImage"
    );
    const legacyTitleElement = titleElement
      ? {
          ...titleElement,
          contentBlockIndex: undefined
        }
      : undefined;
    const legacyDeck: GeneratedDeckResult = {
      ...deck,
      slides: deck.slides.map((item, index) =>
        index === 0
          ? {
              ...item,
              elements: [
                legacyTitleElement,
                imageElement
              ].filter((element): element is SlideElement => Boolean(element))
            }
          : item
      )
    };

    expect(titleElement).toBeDefined();
    Object.defineProperty(window.Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(window.Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn()
    });

    renderWithProviders(<DeckPreviewPage deck={legacyDeck} />);

    const contentItem = screen.getByTestId("slide-display-content-item-0");
    const titleCanvasElement = screen.getByTestId(
      `slide-canvas-element-${titleElement?.id}`
    );

    fireEvent.pointerDown(titleCanvasElement, {
      clientX: 10,
      clientY: 10,
      pointerId: 1
    });
    expect(contentItem).toHaveAttribute("data-selected", "true");

    fireEvent.click(contentItem);
    expect(titleCanvasElement).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("slide-selected-element-editor")).toHaveAttribute(
      "data-selected",
      "true"
    );
  });

  it("keeps unbound content blocks visible as not placed", () => {
    const deck = buildGeneratedDeck(request);
    const slide = deck.slides[0];
    const boundBodyElement = slide.elements.find(
      (element) =>
        element.contentBlockIndex !== undefined &&
        element.contentBlockIndex > 0 &&
        element.type === "text"
    );
    const targetBlock =
      boundBodyElement?.contentBlockIndex !== undefined
        ? slide.content.contentBlocks[boundBodyElement.contentBlockIndex]
        : undefined;
    const targetText = targetBlock?.content ?? targetBlock?.text ?? "";

    expect(boundBodyElement?.contentBlockIndex).toBeDefined();

    const unboundDeck: GeneratedDeckResult = {
      ...deck,
      slides: deck.slides.map((item, index) =>
        index === 0
          ? {
              ...item,
              elements: item.elements.filter(
                (element) =>
                  element.contentBlockIndex !== boundBodyElement?.contentBlockIndex &&
                  !(
                    element.type === "text" &&
                    element.content &&
                    targetText &&
                    element.content.includes(targetText)
                  )
              )
            }
          : item
      )
    };

    renderWithProviders(<DeckPreviewPage deck={unboundDeck} />);

    const contentItem = screen.getByTestId(
      `slide-display-content-item-${boundBodyElement?.contentBlockIndex}`
    );

    expect(contentItem).toHaveTextContent("未落版");
    expect(contentItem).toBeDisabled();
    expect(contentItem).not.toHaveTextContent(
      `层级 ${boundBodyElement?.zIndex}`
    );
    expect(within(contentItem).queryByLabelText("文字")).not.toBeInTheDocument();
  });

  it("shows file actions and bounds for selected image elements and keeps layout layer-only", () => {
    const deck = buildGeneratedDeck(request);
    const imageElement = deck.slides[0]?.elements.find(
      (element) => element.type === "generatedImage"
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        layer: {
          assetId: "uploaded-asset",
          elementId: imageElement?.id,
          height: 1,
          id: "uploaded-layer",
          mimeType: "image/png",
          prompt: "User uploaded replacement file: hero.png",
          provider: "user-upload",
          requestId: imageElement?.imageRequestId,
          transparentBackground: true,
          url: "/api/decks/deck-1/assets/uploaded-asset",
          visualNotes: "hero.png",
          width: 1
        }
      })
    }));

    expect(imageElement?.imageRequestId).toBeDefined();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(window.Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    });

    renderWithProviders(<DeckPreviewPage deck={deck} />);

    fireEvent.pointerDown(
      screen.getByTestId(`slide-canvas-element-${imageElement?.id}`),
      {
        clientX: 10,
        clientY: 10,
        pointerId: 1
      }
    );

    const selectedElementEditor = screen.getByTestId(
      "slide-selected-element-editor"
    );

    expect(
      within(selectedElementEditor).getByText("上传新文件")
    ).toBeInTheDocument();
    expect(within(selectedElementEditor).getByText("删除")).toBeInTheDocument();
    expect(
      within(selectedElementEditor).queryByLabelText("内容")
    ).not.toBeInTheDocument();
    expect(
      within(selectedElementEditor).getByDisplayValue(
        String(imageElement?.bounds.x)
      )
    ).toBeInTheDocument();
    expect(
      within(selectedElementEditor).getByDisplayValue(
        String(imageElement?.bounds.y)
      )
    ).toBeInTheDocument();
    expect(
      within(selectedElementEditor).getByDisplayValue(
        String(imageElement?.bounds.width)
      )
    ).toBeInTheDocument();
    expect(
      within(selectedElementEditor).getByDisplayValue(
        String(imageElement?.bounds.height)
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("页面元素编排")).not.toBeInTheDocument();

    fireEvent.click(within(selectedElementEditor).getByText("删除"));

    expect(
      screen.queryByTestId(
        `slide-image-layer-meta-${imageElement?.imageRequestId}`
      )
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders lightweight preview progress and keeps download disabled while generating", () => {
    const deck = buildGeneratedDeck(request);

    renderWithProviders(
      <DeckPreviewPage
        deck={{
          ...deck,
          pptxUrl: undefined,
          status: "GENERATING"
        }}
      />
    );

    expect(screen.getByText("完成后下载")).toBeDisabled();
    expect(screen.getByText("保存当前页")).toBeDisabled();
    expect(screen.getByText(/前几页可先预览/)).toBeInTheDocument();
  });

  it("deletes deck history from the preview page", async () => {
    const deck = buildGeneratedDeck(request);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true
      })
    }));

    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<DeckPreviewPage deck={deck} />);

    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "确认删除"
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/decks/deck-1",
        expect.objectContaining({
          method: "DELETE"
        })
      );
      expect(router.push).toHaveBeenCalledWith("/workbench");
    });
  });
});
