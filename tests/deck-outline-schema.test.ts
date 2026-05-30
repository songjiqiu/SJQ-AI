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
  audience: "投资人",
  goal: "获得试点合作意向",
  pageCount: 4,
  style: "strategic",
  palette: "star-map",
  locale: "zh-CN"
};

describe("createDeckOutlineDraftSchema", () => {
  it("accepts idea, supplemental text, and text file content", () => {
    const parsed = createDeckOutlineDraftSchema.parse(validInput);

    expect(parsed.textFiles).toHaveLength(1);
    expect(parsed.sourceText).toContain("补充材料");
    expect(parsed.deckType).toBe("business-report");
  });

  it("accepts expanded deck type and style values", () => {
    const parsed = createDeckOutlineDraftSchema.parse({
      ...validInput,
      deckType: "research-report",
      style: "data"
    });

    expect(parsed.deckType).toBe("research-report");
    expect(parsed.style).toBe("data");
  });

  it("defaults legacy inputs to the business report type", () => {
    const parsed = createDeckOutlineDraftSchema.parse(validInput);

    expect(parsed.deckType).toBe("business-report");
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
