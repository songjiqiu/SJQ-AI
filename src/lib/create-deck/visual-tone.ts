import { deckTypeIds, type DeckTypeId } from "./options";

export type PptTypeVisualTone = {
  deckType: DeckTypeId;
  deckTypeName: string;
  recommendedTone: string;
  visualKeywords: string[];
};

type Locale = "zh-CN" | "en-US";

export const pptTypeVisualToneMap = {
  "zh-CN": {
    "business-report": {
      deckType: "business-report",
      deckTypeName: "商务汇报",
      recommendedTone: "克制、可信、有层级",
      visualKeywords: ["蓝灰/黑白", "数据图表", "结论先行"]
    },
    "fundraising-pitch": {
      deckType: "fundraising-pitch",
      deckTypeName: "融资路演",
      recommendedTone: "高级、增长感、说服力强",
      visualKeywords: ["深色/科技色", "强对比", "大数字", "故事线"]
    },
    proposal: {
      deckType: "proposal",
      deckTypeName: "方案提案",
      recommendedTone: "咨询感、结构化、专业可信",
      visualKeywords: ["模块化版式", "流程图", "对比页", "框架感"]
    },
    "project-plan": {
      deckType: "project-plan",
      deckTypeName: "项目计划",
      recommendedTone: "稳定、理性、执行感",
      visualKeywords: ["甘特图", "时间轴", "任务矩阵", "清晰分区"]
    },
    "retrospective-summary": {
      deckType: "retrospective-summary",
      deckTypeName: "复盘总结",
      recommendedTone: "反思、结果导向、数据化",
      visualKeywords: ["Before/After", "指标看板", "问题归因图"]
    },
    "product-launch": {
      deckType: "product-launch",
      deckTypeName: "产品发布",
      recommendedTone: "科技感、品牌感、发布会感",
      visualKeywords: ["大图", "深色背景", "产品特写", "动效感"]
    },
    "sales-proposal": {
      deckType: "sales-proposal",
      deckTypeName: "销售提案",
      recommendedTone: "说服、信任、转化导向",
      visualKeywords: ["客户痛点", "解决方案", "案例", "报价对比"]
    },
    "brand-marketing": {
      deckType: "brand-marketing",
      deckTypeName: "品牌营销",
      recommendedTone: "鲜明、情绪化、记忆点强",
      visualKeywords: ["品牌色", "海报感", "视觉符号", "传播口号"]
    },
    "event-promotion": {
      deckType: "event-promotion",
      deckTypeName: "活动宣发",
      recommendedTone: "热闹、吸睛、氛围感",
      visualKeywords: ["高饱和色", "活动主视觉", "节奏感排版"]
    },
    "training-course": {
      deckType: "training-course",
      deckTypeName: "课程培训",
      recommendedTone: "系统、稳定、可学习",
      visualKeywords: ["章节导航", "知识框架", "练习页", "总结页"]
    },
    "knowledge-sharing": {
      deckType: "knowledge-sharing",
      deckTypeName: "知识科普",
      recommendedTone: "轻松、解释性、可视化",
      visualKeywords: ["插画", "类比图", "信息图", "少文字"]
    },
    "teaching-deck": {
      deckType: "teaching-deck",
      deckTypeName: "教学课件",
      recommendedTone: "规范、清晰、课堂友好",
      visualKeywords: ["大字号", "重点标注", "例题/互动页"]
    },
    "research-report": {
      deckType: "research-report",
      deckTypeName: "研究报告",
      recommendedTone: "专业、厚重、报告感",
      visualKeywords: ["目录体系", "章节页", "数据页", "结论页"]
    },
    "data-analysis": {
      deckType: "data-analysis",
      deckTypeName: "数据分析",
      recommendedTone: "精准、简洁、看板化",
      visualKeywords: ["图表优先", "指标卡", "趋势线", "异常标注"]
    },
    "industry-insight": {
      deckType: "industry-insight",
      deckTypeName: "行业洞察",
      recommendedTone: "高级、宏观、趋势感",
      visualKeywords: ["大图+数据", "趋势箭头", "象限图", "关键判断"]
    },
    "operation-plan": {
      deckType: "operation-plan",
      deckTypeName: "运营方案",
      recommendedTone: "清晰、策略感、落地感",
      visualKeywords: ["路径图", "漏斗", "分层策略", "运营节奏"]
    },
    "growth-experiment": {
      deckType: "growth-experiment",
      deckTypeName: "增长实验",
      recommendedTone: "数据驱动、敏捷、实验感",
      visualKeywords: ["实验卡片", "A/B 对比", "漏斗", "指标面板"]
    },
    portfolio: {
      deckType: "portfolio",
      deckTypeName: "作品集",
      recommendedTone: "视觉优先、审美感、案例感",
      visualKeywords: ["大图展示", "项目卡片", "过程页", "成果页"]
    },
    "personal-review": {
      deckType: "personal-review",
      deckTypeName: "个人述职",
      recommendedTone: "稳重、成果导向、成长感",
      visualKeywords: ["目标-动作-结果", "数据成果", "复盘计划"]
    },
    "community-sharing": {
      deckType: "community-sharing",
      deckTypeName: "社群分享",
      recommendedTone: "轻松、有温度、交流感",
      visualKeywords: ["活泼配色", "口语化标题", "案例截图", "互动页"]
    }
  },
  "en-US": {
    "business-report": {
      deckType: "business-report",
      deckTypeName: "Business Report",
      recommendedTone: "Restrained, credible, and clearly layered",
      visualKeywords: ["blue-gray/black-white", "data charts", "conclusion first"]
    },
    "fundraising-pitch": {
      deckType: "fundraising-pitch",
      deckTypeName: "Fundraising Pitch",
      recommendedTone: "Premium, growth-oriented, and highly persuasive",
      visualKeywords: ["dark/tech palette", "strong contrast", "large numbers", "storyline"]
    },
    proposal: {
      deckType: "proposal",
      deckTypeName: "Proposal",
      recommendedTone: "Consulting-like, structured, and professionally credible",
      visualKeywords: ["modular layout", "flowcharts", "comparison slides", "framework feel"]
    },
    "project-plan": {
      deckType: "project-plan",
      deckTypeName: "Project Plan",
      recommendedTone: "Stable, rational, and execution-oriented",
      visualKeywords: ["Gantt chart", "timeline", "task matrix", "clear sections"]
    },
    "retrospective-summary": {
      deckType: "retrospective-summary",
      deckTypeName: "Retrospective Summary",
      recommendedTone: "Reflective, outcome-driven, and data-informed",
      visualKeywords: ["before/after", "metric dashboard", "root-cause diagram"]
    },
    "product-launch": {
      deckType: "product-launch",
      deckTypeName: "Product Launch",
      recommendedTone: "Tech-forward, branded, and launch-event ready",
      visualKeywords: ["large imagery", "dark background", "product close-up", "motion feel"]
    },
    "sales-proposal": {
      deckType: "sales-proposal",
      deckTypeName: "Sales Proposal",
      recommendedTone: "Persuasive, trustworthy, and conversion-oriented",
      visualKeywords: ["customer pain points", "solution", "case studies", "pricing comparison"]
    },
    "brand-marketing": {
      deckType: "brand-marketing",
      deckTypeName: "Brand Marketing",
      recommendedTone: "Distinctive, emotional, and memorable",
      visualKeywords: ["brand colors", "poster feel", "visual symbols", "campaign slogan"]
    },
    "event-promotion": {
      deckType: "event-promotion",
      deckTypeName: "Event Promotion",
      recommendedTone: "Lively, eye-catching, and atmospheric",
      visualKeywords: ["high saturation", "event key visual", "rhythmic layout"]
    },
    "training-course": {
      deckType: "training-course",
      deckTypeName: "Training Course",
      recommendedTone: "Systematic, stable, and easy to learn from",
      visualKeywords: ["chapter navigation", "knowledge framework", "practice slides", "summary slides"]
    },
    "knowledge-sharing": {
      deckType: "knowledge-sharing",
      deckTypeName: "Knowledge Sharing",
      recommendedTone: "Light, explanatory, and visualized",
      visualKeywords: ["illustrations", "analogy diagrams", "infographics", "minimal text"]
    },
    "teaching-deck": {
      deckType: "teaching-deck",
      deckTypeName: "Teaching Deck",
      recommendedTone: "Standardized, clear, and classroom-friendly",
      visualKeywords: ["large type", "key highlights", "examples/interaction slides"]
    },
    "research-report": {
      deckType: "research-report",
      deckTypeName: "Research Report",
      recommendedTone: "Professional, substantial, and report-like",
      visualKeywords: ["table of contents", "section slides", "data slides", "conclusion slides"]
    },
    "data-analysis": {
      deckType: "data-analysis",
      deckTypeName: "Data Analysis",
      recommendedTone: "Precise, concise, and dashboard-like",
      visualKeywords: ["charts first", "metric cards", "trend lines", "anomaly callouts"]
    },
    "industry-insight": {
      deckType: "industry-insight",
      deckTypeName: "Industry Insight",
      recommendedTone: "Premium, macro, and trend-oriented",
      visualKeywords: ["image + data", "trend arrows", "quadrant charts", "key judgments"]
    },
    "operation-plan": {
      deckType: "operation-plan",
      deckTypeName: "Operation Plan",
      recommendedTone: "Clear, strategic, and practical",
      visualKeywords: ["path map", "funnel", "layered strategy", "operation rhythm"]
    },
    "growth-experiment": {
      deckType: "growth-experiment",
      deckTypeName: "Growth Experiment",
      recommendedTone: "Data-driven, agile, and experimental",
      visualKeywords: ["experiment cards", "A/B comparison", "funnel", "metric panel"]
    },
    portfolio: {
      deckType: "portfolio",
      deckTypeName: "Portfolio",
      recommendedTone: "Visual-first, polished, and case-driven",
      visualKeywords: ["large imagery", "project cards", "process slides", "outcome slides"]
    },
    "personal-review": {
      deckType: "personal-review",
      deckTypeName: "Personal Review",
      recommendedTone: "Steady, achievement-oriented, and growth-focused",
      visualKeywords: ["goal-action-result", "performance data", "review plan"]
    },
    "community-sharing": {
      deckType: "community-sharing",
      deckTypeName: "Community Sharing",
      recommendedTone: "Relaxed, warm, and conversational",
      visualKeywords: ["lively colors", "conversational titles", "case screenshots", "interactive slides"]
    }
  }
} as const satisfies Record<Locale, Record<DeckTypeId, PptTypeVisualTone>>;

export function getPptTypeVisualTone(
  deckType: DeckTypeId,
  locale: Locale
): PptTypeVisualTone {
  return pptTypeVisualToneMap[locale][deckType];
}

export function getPptTypeVisualToneList(locale: Locale): PptTypeVisualTone[] {
  return deckTypeIds.map((deckType) => getPptTypeVisualTone(deckType, locale));
}
