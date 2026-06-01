import { describe, expect, it } from "vitest";

import { createDeckOutlineDraftSchema } from "@/lib/deck-outline/schema";

const validInput = {
  idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
  sourceText: "补充材料：团队已完成三个试点项目。",
  textFiles: [
    {
      name: "notes.md",
      size: 128,
      type: "text/markdown",
      content: "## 试点数据\n转化率提升 20%。"
    }
  ],
  palette: "star-map",
  locale: "zh-CN",
  confirmedPlan: {
    input: {
      idea: "为新能源初创公司准备融资路演，重点说明市场机会和合作路径。",
      sourceText: "补充材料：团队已完成三个试点项目。",
      textFiles: [
        {
          name: "notes.md",
          size: 128,
          type: "text/markdown",
          content: "## 试点数据\n转化率提升 20%。"
        }
      ],
      deckType: "business-report",
      palette: "star-map",
      locale: "zh-CN"
    },
    fileSummaries: [
      {
        characterCount: 15,
        name: "notes.md",
        size: 128,
        summary: "试点数据：转化率提升 20%。",
        snippets: ["试点数据：转化率提升 20%。"]
      }
    ],
    deckType: "business-report",
    audience: "投资人",
    goal: "获得试点合作意向",
    coreMessage: "用市场机会与试点成果证明合作价值。",
    recommendedPageCount: 4,
    structureOutline: {
      deckTitle: "新能源融资路演",
      deckSummary: "这是一份用于确认结构的大纲草稿。",
      slides: [1, 2, 3, 4].map((index) => ({
        slideId: `slide-${index}`,
        index,
        title: `第 ${index} 页`,
        purpose: `说明第 ${index} 页的表达目的。`,
        keyMessage: `第 ${index} 页核心观点。`,
        visualDirection: "使用清晰主视觉配合文字信息。"
      }))
    }
  }
};

describe("createDeckOutlineDraftSchema", () => {
  it("accepts idea, supplemental text, and text file content", () => {
    const parsed = createDeckOutlineDraftSchema.parse(validInput);

    expect(parsed.textFiles).toHaveLength(1);
    expect(parsed.sourceText).toContain("补充材料");
    expect(parsed.deckType).toBe("business-report");
  });

  it("accepts expanded deck type values", () => {
    const parsed = createDeckOutlineDraftSchema.parse({
      ...validInput,
      deckType: "research-report",
      confirmedPlan: {
        ...validInput.confirmedPlan,
        input: {
          ...validInput.confirmedPlan.input,
          deckType: "research-report"
        },
        deckType: "research-report"
      }
    });

    expect(parsed.deckType).toBe("research-report");
  });

  it("defaults legacy inputs to the business report type", () => {
    const parsed = createDeckOutlineDraftSchema.parse(validInput);

    expect(parsed.deckType).toBe("business-report");
  });

  it("requires confirmed plan to keep the original deck type", () => {
    expect(
      createDeckOutlineDraftSchema.safeParse({
        ...validInput,
        deckType: "research-report"
      }).success
    ).toBe(false);
  });

  it("ignores legacy narrative style fields in historical payloads", () => {
    const parsed = createDeckOutlineDraftSchema.parse({
      ...validInput,
      style: "strategic",
      confirmedPlan: {
        ...validInput.confirmedPlan,
        input: {
          ...validInput.confirmedPlan.input,
          style: "strategic"
        },
        style: "strategic"
      }
    });

    expect(parsed).not.toHaveProperty("style");
    expect(parsed.confirmedPlan).not.toHaveProperty("style");
    expect(parsed.confirmedPlan.input).not.toHaveProperty("style");
  });

  it("limits text files to five and 10MB each", () => {
    expect(
      createDeckOutlineDraftSchema.safeParse({
        ...validInput,
        textFiles: Array.from({ length: 6 }, (_, index) => ({
          name: `file-${index}.txt`,
          size: 10,
          content: "content"
        }))
      }).success
    ).toBe(false);
    expect(
      createDeckOutlineDraftSchema.safeParse({
        ...validInput,
        textFiles: [
          {
            name: "large.txt",
            size: 10 * 1024 * 1024 + 1,
            content: "content"
          }
        ]
      }).success
    ).toBe(false);
  });
});
