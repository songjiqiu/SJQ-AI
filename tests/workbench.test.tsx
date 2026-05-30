import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaletteProvider } from "@/components/theme/palette-provider";
import {
  CreationWorkbench,
  generatePayloadStorageKey,
  outlinePayloadStorageKey
} from "@/components/workbench/creation-workbench";
import { DeckPreviewPage } from "@/components/workbench/deck-preview-page";
import { GenerateLoadingPage } from "@/components/workbench/generate-loading-page";
import { OutlineLoadingPage } from "@/components/workbench/outline-loading-page";
import { OutlineReviewPage } from "@/components/workbench/outline-review-page";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import {
  buildContentReview,
  buildConsistencyReport,
  buildSlideMotionPlan
} from "@/lib/ai-deck/postprocess";
import type {
  AnalyzeDeckRequest,
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
    unifiedVisualSpec: analyzed.unifiedVisualSpec,
    slides: analyzed.slides.map((slide) => slide.content),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

const request: AnalyzeDeckRequest = {
  sourceText:
    "为新能源初创公司准备融资路演，重点说明市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  pageCount: 3,
  deckType: "business-report",
  style: "strategic",
  palette: "star-map",
  locale: "zh-CN"
};

describe("workbench stepped flow", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-palette");
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("stores form payload and navigates to the outline loading route", async () => {
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

    fireEvent.change(screen.getByLabelText("原始文本/创作想法"), {
      target: { value: request.sourceText }
    });
    fireEvent.change(screen.getByLabelText("目标受众"), {
      target: { value: request.audience }
    });
    fireEvent.change(screen.getByLabelText("表达目标"), {
      target: { value: request.goal }
    });
    fireEvent.click(screen.getByLabelText("融资路演"));
    fireEvent.click(screen.getByLabelText("数据论证"));

    fireEvent.click(screen.getByRole("button", { name: /生成大纲草稿/ }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/workbench/outline/loading");
    });
    expect(
      JSON.parse(window.sessionStorage.getItem(outlinePayloadStorageKey) ?? "{}")
    ).toMatchObject({
      audience: "投资人",
      deckType: "fundraising-pitch",
      sourceText: "",
      style: "data",
      locale: "zh-CN"
    });
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

    fireEvent.click(await screen.findByRole("button", { name: /最近大纲草稿/ }));
    expect(router.push).toHaveBeenCalledWith("/workbench/outline/draft-recent");

    fireEvent.click(await screen.findByRole("button", { name: /最近生成PPT/ }));
    expect(router.push).toHaveBeenCalledWith("/workbench/preview/deck-recent");
  });

  it("places the reset and outline actions below the right history panel", async () => {
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
    const resetButton = screen.getByRole("button", { name: "重置" });
    const generateButton = screen.getByRole("button", {
      name: /生成大纲草稿/
    });

    expect(form).not.toContainElement(resetButton);
    expect(form).not.toContainElement(generateButton);
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

    window.sessionStorage.setItem(
      outlinePayloadStorageKey,
      JSON.stringify({
        idea: request.sourceText,
        sourceText: "",
        textFiles: [],
        audience: request.audience,
        goal: request.goal,
        pageCount: request.pageCount,
        deckType: request.deckType,
        style: request.style,
        palette: request.palette,
        locale: request.locale
      })
    );
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

  it("saves edited outline and starts full PPT generation", async () => {
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

    const titleInput = await screen.findByDisplayValue(draft.deckTitle);
    fireEvent.change(titleInput, {
      target: { value: "更新后的大纲标题" }
    });
    fireEvent.click(screen.getByRole("button", { name: /生成完整PPT/ }));

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

  it("generate loading sends outlineDraftId and opens final preview", async () => {
    const deck = buildGeneratedDeck(request);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => deck
    }));

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
  });

  it("renders final deck preview with motion and download controls", () => {
    const deck = buildGeneratedDeck(request);

    renderWithProviders(<DeckPreviewPage deck={deck} />);

    expect(screen.getByText("内容审核")).toBeInTheDocument();
    expect(screen.getByText("一致性")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /下载PPTX/
      })
    ).toHaveAttribute("href", deck.pptxUrl);
  });
});
