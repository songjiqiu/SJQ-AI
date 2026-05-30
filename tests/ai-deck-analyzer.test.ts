import { describe, expect, it, vi } from "vitest";

import {
  analyzeDeck,
  composeDeckFromOutline,
  createDeckOutline
} from "@/lib/ai-deck/analyzer";
import { buildMockAnalyzedDeck } from "@/lib/ai-deck/fallback";
import type { JsonChatClient } from "@/lib/ai-deck/openai-json";
import type { AnalyzeDeckRequest } from "@/lib/ai-deck/schema";

const input: AnalyzeDeckRequest = {
  sourceText: "这是一段用于测试 AI 拆页编排的长文本，包含市场机会、产品优势、合作路径和执行计划。",
  audience: "投资人",
  goal: "获得试点合作意向",
  pageCount: 3,
  deckType: "business-report",
  style: "strategic",
  palette: "star-map",
  locale: "zh-CN"
};

function createFakeClient(queue: Array<unknown | Error>) {
  const calls: Array<Record<string, unknown>> = [];
  const create = vi.fn(async (payload: Record<string, unknown>) => {
    calls.push(payload);
    const next = queue.shift();

    if (next instanceof Error) {
      throw next;
    }

    return {
      choices: [
        {
          message: {
            content: JSON.stringify(next)
          }
        }
      ]
    };
  });

  return {
    calls,
    client: {
      chat: {
        completions: {
          create
        }
      }
    } satisfies JsonChatClient
  };
}

describe("analyzeDeck", () => {
  it("uses local mock fallback when no API key is configured", async () => {
    const result = await analyzeDeck(input, {
      env: {
        OPENAI_API_KEY: ""
      }
    });

    expect(result.mode).toBe("mock");
    expect(result.slides).toHaveLength(3);
  });

  it("creates an outline-only result without slide composition", async () => {
    const result = await createDeckOutline(input, {
      env: {
        OPENAI_API_KEY: ""
      }
    });

    expect(result.mode).toBe("mock");
    expect(result.slides).toHaveLength(3);
    expect(result.slides[0]).not.toHaveProperty("elements");
    expect(result.unifiedVisualSpec.themeName).toBeTruthy();
  });

  it("runs deck analysis then per-slide composition with JSON mode retry", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const deckAnalysis = {
      deckTitle: mock.deckTitle,
      deckSummary: mock.deckSummary,
      unifiedVisualSpec: mock.unifiedVisualSpec,
      slides: mock.slides.map((slide) => slide.content)
    };
    const fake = createFakeClient([
      new Error("json_schema unsupported"),
      deckAnalysis,
      ...mock.slides
    ]);

    const result = await analyzeDeck(input, {
      client: fake.client,
      env: {
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-model"
      }
    });

    expect(result.mode).toBe("ai-json");
    expect(result.slides).toHaveLength(3);
    expect(fake.calls).toHaveLength(5);
    expect(fake.calls[0].response_format).toMatchObject({
      type: "json_schema"
    });
    expect(fake.calls[1].response_format).toMatchObject({
      type: "json_object"
    });
  });

  it("composes slide plans from an edited outline without rebuilding the outline", async () => {
    const mock = buildMockAnalyzedDeck(input);
    const editedSlides = mock.slides.map((slide, index) => ({
      ...slide.content,
      title: index === 0 ? "编辑后的开场标题" : slide.content.title
    }));

    const result = await composeDeckFromOutline(
      input,
      editedSlides,
      mock.unifiedVisualSpec,
      {
        env: {
          OPENAI_API_KEY: ""
        }
      }
    );

    expect(result).toHaveLength(3);
    expect(result[0].content.title).toBe("编辑后的开场标题");
    expect(result[0].elements.some((element) => element.type === "text")).toBe(
      true
    );
  });
});
