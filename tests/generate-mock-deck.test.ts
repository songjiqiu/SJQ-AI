import { describe, expect, it } from "vitest";

import {
  generateMockDeckDraft,
  type MockDeckCopy
} from "@/lib/create-deck/mock-generator";
import type { CreateDeckForm } from "@/lib/create-deck/schema";

const copy: MockDeckCopy = {
  titlePattern: "{idea}｜{deckType}",
  summaryPattern: "{audience}｜{goal}｜{count}｜{deckType}｜{palette}",
  slideTemplates: [
    {
      title: "首页 {index}",
      body: "{idea}"
    },
    {
      title: "问题 {index}",
      body: "{audience}"
    },
    {
      title: "行动 {index}",
      body: "{goal}"
    }
  ],
  deckTypeNames: {
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
    "product-launch": "产品发布",
    "project-plan": "项目计划",
    proposal: "方案提案",
    "research-report": "研究报告",
    "retrospective-summary": "复盘总结",
    "sales-proposal": "销售提案",
    "teaching-deck": "教学课件",
    "training-course": "课程培训"
  },
  paletteNames: {
    "star-map": "星图",
    matrix: "矩阵",
    "deep-space": "深空",
    "morning-mist": "晨雾"
  }
};

const form: CreateDeckForm = {
  idea: "新能源融资路演",
  audience: "投资人",
  goal: "获得合作意向",
  pageCount: 4,
  deckType: "fundraising-pitch",
  palette: "star-map"
};

describe("generateMockDeckDraft", () => {
  it("returns a stable mock deck with the requested slide count", () => {
    const draft = generateMockDeckDraft(form, copy);
    const secondDraft = generateMockDeckDraft(form, copy);

    expect(draft).toEqual(secondDraft);
    expect(draft.mode).toBe("mock");
    expect(draft.title).toBe("新能源融资路演｜融资路演");
    expect(draft.slides).toHaveLength(4);
    expect(draft.slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3",
      "slide-4"
    ]);
    expect(draft.slides[3]).toMatchObject({
      index: 4,
      title: "行动 4",
      body: "获得合作意向"
    });
  });
});
