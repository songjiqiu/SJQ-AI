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
import { GenerateLoadingPage } from "@/components/workbench/generate-loading-page";
import { IntentConfirmPage } from "@/components/workbench/intent-confirm-page";
import {
  IntentAnalysisLoadingPage,
  OutlineLoadingPage
} from "@/components/workbench/outline-loading-page";
import { OutlineReviewPage } from "@/components/workbench/outline-review-page";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import {
  buildContentReview,
  buildConsistencyReport,
  buildSlideMotionPlan
} from "@/lib/ai-deck/postprocess";
import type {
  AnalyzeDeckRequest,
  DeckIntentAnalysisResult,
  GeneratedDeckResult
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

function buildOutlineDraft(input: AnalyzeDeckRequest): DeckOutlineDraft {
  const analyzed = buildMockAnalyzedDeck(input);

  return {
    id: "draft-1",
    mode: analyzed.mode,
    deckTitle: analyzed.deckTitle,
    deckSummary: analyzed.deckSummary,
    input,
    fileSummaries: [],
    intentAnalysis: {
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
    },
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
  pageCount: 3,
  deckType: "business-report",
  palette: "star-map",
  locale: "zh-CN"
};

const intentAnalysis: DeckIntentAnalysisResult = {
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
  recommendedPageCount: 5,
  structureOutline: {
    deckTitle: "新能源融资路演",
    deckSummary: "这是一份用于确认结构的大纲草稿。",
    slides: [1, 2, 3, 4, 5].map((index) => ({
      slideId: `slide-${index}`,
      index,
      title: `第 ${index} 页`,
      purpose: `说明第 ${index} 页的表达目的。`,
      keyMessage: `第 ${index} 页核心观点。`,
      visualDirection: "使用清晰主视觉配合文字信息。"
    }))
  }
};

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

    expect(screen.queryByLabelText("目标受众")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("表达目标")).not.toBeInTheDocument();
    expect(screen.getByLabelText("指定页数（可选）")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("原始文本/创作想法"), {
      target: { value: request.sourceText }
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
      sourceText: "",
      locale: "zh-CN"
    });
    expect(
      JSON.parse(window.sessionStorage.getItem(intentPayloadStorageKey) ?? "{}")
    ).not.toHaveProperty("style");
  });

  it("intent analysis loading stores analysis and opens confirmation", async () => {
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

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        "/workbench/outline/analyze/confirm"
      );
    });
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
      recommendedPageCount: 5
    });
  });

  it("lets users edit confirmed intent before generating the outline", async () => {
    window.sessionStorage.setItem(
      intentAnalysisStorageKey,
      JSON.stringify(intentAnalysis)
    );

    renderWithProviders(<IntentConfirmPage />);

    expect(await screen.findByText("确认输入分析")).toBeInTheDocument();
    expect(screen.getByText("融资路演")).toBeInTheDocument();
    expect(screen.queryByText("叙事风格")).not.toBeInTheDocument();
    expect(screen.queryByText("数据论证")).not.toBeInTheDocument();
    expect(screen.getByText("原始输入摘要")).toBeInTheDocument();
    expect(screen.getByText(request.sourceText)).toBeInTheDocument();
    expect(screen.getByText("已添加文件")).toBeInTheDocument();
    expect(screen.getByText("brief.md")).toBeInTheDocument();
    expect(screen.getByText("18 字符 · 128 B")).toBeInTheDocument();
    expect(screen.getByText("结构大纲")).toBeInTheDocument();
    expect(screen.getByDisplayValue("新能源融资路演")).toBeInTheDocument();
    expect(screen.queryByText("文件正文不应在确认页完整展示。")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("核心信息"), {
      target: { value: "更新后的核心信息" }
    });
    fireEvent.change(screen.getByLabelText("推荐页数"), {
      target: { value: "18" }
    });
    fireEvent.click(screen.getByRole("button", { name: /确认并生成大纲/ }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/workbench/outline/loading");
    });
    expect(
      JSON.parse(window.sessionStorage.getItem(outlinePayloadStorageKey) ?? "{}")
    ).toMatchObject({
      deckType: "fundraising-pitch",
      pageCount: 18,
      confirmedPlan: {
        deckType: "fundraising-pitch",
        coreMessage: "更新后的核心信息",
        recommendedPageCount: 18,
        structureOutline: {
          slides: expect.arrayContaining([
            expect.objectContaining({
              index: 18
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
      "支持 txt / md / csv / json / docx 文件"
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
    expect(form.parentElement?.parentElement).toHaveClass("max-w-6xl");
    expect(heading).toHaveClass("sm:text-5xl");
    expect(form).not.toContainElement(resetButton);
    expect(form).not.toContainElement(generateButton);
    expect(sidebar).toHaveClass("lg:self-stretch");
    expect(actionPanel).toContainElement(resetButton);
    expect(actionPanel).toContainElement(generateButton);
    expect(actionPanel?.firstElementChild).toHaveClass("grid");
    expect(actionPanel?.firstElementChild).not.toHaveClass("xl:grid-cols-2");
    expect(deckTypeGrid).toHaveClass("sm:grid-cols-4");
    expect(deckTypeGrid).not.toHaveClass("xl:grid-cols-5");
    expect(screen.queryByText("叙事风格")).not.toBeInTheDocument();
    expect(fileLimit).toHaveClass("text-sm");
    expect(fileFormats).toHaveClass("text-sm");
    expect(pageCountLabel).toHaveClass("text-sm");
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
    expect(footer).toHaveTextContent("3 页");
    expect(headerSection).not.toContainElement(editButton);
    expect(headerSection).not.toHaveTextContent("预览模式");
    fireEvent.click(screen.getByText("统一视觉说明"));
    const visualSpecRegion = screen
      .getByText("统一视觉说明")
      .closest("details");

    expect(visualSpecRegion).not.toBeNull();
    expect(within(visualSpecRegion!).getByText("基础信息")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("色彩系统")).toBeInTheDocument();
    expect(within(visualSpecRegion!).getByText("版式与字体")).toBeInTheDocument();
    expect(
      within(visualSpecRegion!).getByText("图片生成/使用规则")
    ).toBeInTheDocument();
    expect(within(visualSpecRegion!).queryByText(/星图/)).not.toBeInTheDocument();
    expect(visualSpecRegion!.querySelector('[data-color-token="#246BFE"]')).toBeTruthy();
    expect(visualSpecRegion!.querySelector('[data-color-token="#17202A"]')).toBeTruthy();
    expect(screen.getAllByText(/12 栏栅格/).length).toBeGreaterThan(0);
    expect(screen.getByText("字体 fallback（每行一个）")).toBeInTheDocument();
    expect(screen.getByText("对比度要求")).toBeInTheDocument();
    expect(screen.getByText(/背景图避开高对比文字区域/)).toBeInTheDocument();
    expect(screen.getAllByText("本页核心表达句").length).toBeGreaterThan(0);
    expect(screen.getAllByText("叙事作用").length).toBeGreaterThan(0);
    expect(screen.getAllByText("主信息（每行一条）").length).toBeGreaterThan(0);
    expect(screen.getByText("视觉基调与 PPT 类型映射")).toBeInTheDocument();
    expect(screen.getByText("推荐视觉基调")).toBeInTheDocument();
    expect(screen.getByText("视觉关键词（每行一条）")).toBeInTheDocument();
    expect(screen.getByText("商务汇报")).toBeInTheDocument();
    expect(screen.getByText("克制、可信、有层级")).toBeInTheDocument();
    expect(screen.getByText("数据图表")).toBeInTheDocument();
    expect(screen.queryByText("课程培训")).not.toBeInTheDocument();
    expect(screen.queryByText("品牌营销")).not.toBeInTheDocument();
    expect(screen.queryByText("研究报告")).not.toBeInTheDocument();
    expect(screen.getByText("封面标题")).toBeInTheDocument();
    expect(screen.getByText("卡片/表面色角色")).toBeInTheDocument();
    expect(screen.queryByText("字号层级")).not.toBeInTheDocument();
    expect(screen.queryByText("色彩角色完整定义")).not.toBeInTheDocument();
    expect(screen.getByText("图表视觉规范")).toBeInTheDocument();
    expect(screen.queryByDisplayValue(draft.deckTitle)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /保存大纲/ })
    ).not.toBeInTheDocument();
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
    expect(footer).toHaveTextContent("3 页");
    expect(footer).toContainElement(
      screen.getByRole("button", { name: /保存大纲/ })
    );

    const titleInput = await screen.findByDisplayValue(draft.deckTitle);
    fireEvent.change(titleInput, {
      target: { value: "更新后的大纲标题" }
    });
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
      pptTypeVisualTone: expect.any(Object),
      typographyRules: expect.objectContaining({
        scale: expect.any(Object)
      }),
      forbiddenVisualRules: expect.any(Array)
    });
    expect(patchBody.unifiedVisualSpec).not.toHaveProperty("typographyScale");
    expect(patchBody.unifiedVisualSpec).not.toHaveProperty("colorRoleDefinitions");
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

  it("renders final deck preview editor with motion and download controls", () => {
    const deck = buildGeneratedDeck(request);

    renderWithProviders(<DeckPreviewPage deck={deck} />);

    expect(screen.getByText("本页内容")).toBeInTheDocument();
    expect(screen.getByText("内容审核")).toBeInTheDocument();
    expect(screen.getByText("一致性")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /下载PPTX/
      })
    ).toHaveAttribute("href", deck.pptxUrl);
  });

  it("highlights the canvas area and matching layout item after selecting a text element", () => {
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

    const metaItem = screen.getByTestId(
      `slide-element-meta-${titleElement?.id}`
    );
    const selectedElementEditor = screen.getByTestId(
      "slide-selected-element-editor"
    );
    expect(metaItem).not.toHaveAttribute("data-selected", "true");
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

    expect(canvasElement).toHaveAttribute("data-selected", "true");
    expect(canvasElement).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByTestId(`slide-canvas-element-highlight-${titleElement?.id}`)
    ).toBeInTheDocument();
    expect(metaItem).toHaveAttribute("data-selected", "true");
    expect(selectedElementEditor).toHaveAttribute("data-selected", "true");
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest"
    });
  });

  it("highlights the layout item and image layer request after selecting an image element", () => {
    const deck = buildGeneratedDeck(request);
    const imageElement = deck.slides[0]?.elements.find(
      (element) => element.type === "generatedImage"
    );
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

    renderWithProviders(<DeckPreviewPage deck={deck} />);

    const canvasElement = screen.getByTestId(
      `slide-canvas-element-${imageElement?.id}`
    );
    expect(canvasElement).toHaveAttribute("aria-pressed", "false");

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
      screen.getByTestId(`slide-element-meta-${imageElement?.id}`)
    ).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByTestId(
        `slide-image-layer-meta-${imageElement?.imageRequestId}`
      )
    ).toHaveAttribute("data-selected", "true");
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
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
    const metaItem = screen.getByTestId(
      `slide-element-meta-${imageElement?.id}`
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
    expect(metaItem).toHaveTextContent(imageElement?.role ?? "");
    expect(metaItem).toHaveTextContent(`层级 ${imageElement?.zIndex}`);
    expect(metaItem).not.toHaveTextContent(/位置 x:/);
    expect(metaItem).not.toHaveTextContent(/尺寸/);

    fireEvent.click(within(selectedElementEditor).getByText("删除"));

    expect(
      screen.queryByTestId(`slide-element-meta-${imageElement?.id}`)
    ).not.toBeInTheDocument();
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
