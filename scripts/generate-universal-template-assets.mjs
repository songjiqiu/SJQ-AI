import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const packageDir = path.join(rootDir, "assets", "templates", "universal-v1");
const importFormatVersion = "ppt-template-import-v1";
const manifestFormatVersion = "ppt-template-manifest-v1";
const canvas = {
  aspectRatio: "16:9",
  height: 7.5,
  safeMargin: 0.5,
  unit: "inch",
  width: 13.333
};

const styles = [
  {
    code: "bg",
    id: "business-general",
    label: "中国商务通用",
    file: "business-general",
    tone: "浅底蓝绿商务风，强调清晰、稳定和可复用。",
    titleColor: "#103B3F",
    bodyColor: "#355052",
    accentColor: "#0F8B8D"
  },
  {
    code: "ai",
    id: "ai-tech",
    label: "AI 科技感",
    file: "ai-tech",
    tone: "青绿琥珀科技风，使用节点、光标和数据面板表达智能感。",
    titleColor: "#E6FFFB",
    bodyColor: "#A7F3D0",
    accentColor: "#22D3EE"
  },
  {
    code: "cm",
    id: "consulting-minimal",
    label: "极简咨询风",
    file: "consulting-minimal",
    tone: "白底黑灰咨询风，强调结论先行、强栅格和克制高亮。",
    titleColor: "#111827",
    bodyColor: "#374151",
    accentColor: "#111827"
  }
];

const categories = [
  { id: "chapter", code: "ch", label: "章节页" },
  { id: "cover-title", code: "cov", label: "封面大标题" },
  { id: "title-body-points", code: "tbp", label: "标题 + 正文/要点" },
  { id: "big-image-background", code: "bib", label: "大图背景" },
  { id: "left-image-right-text", code: "lirt", label: "左图右文" },
  { id: "left-text-right-image", code: "ltri", label: "左文右图" },
  { id: "left-text-right-chart", code: "ltrc", label: "左文右图表" },
  { id: "big-chart", code: "bch", label: "大图表" },
  { id: "two-column-compare", code: "tcc", label: "双栏对比" },
  { id: "quote", code: "quo", label: "引用/金句页" },
  { id: "time-axis", code: "tax", label: "时间轴" },
  { id: "process-steps", code: "pst", label: "流程/步骤" },
  { id: "key-metrics", code: "kmt", label: "关键指标页" },
  { id: "quadrant-matrix", code: "qmx", label: "四象限/矩阵" },
  { id: "ending", code: "end", label: "结束页" }
];

const variants = {
  chapter: {
    "business-general": {
      title: "章节编号分栏",
      body: ["章节核心问题", "承接上一部分并提示下一部分"],
      intent: "用左侧章节编号和右侧标题完成演示节奏切换。",
      scene: "商务汇报"
    },
    "ai-tech": {
      title: "星图坐标章节",
      body: ["定位当前议题坐标", "进入下一组智能分析"],
      intent: "用坐标标签和点线网格强化 AI 叙事的阶段感。",
      scene: "AI 产品"
    },
    "consulting-minimal": {
      title: "大留白分割章",
      body: ["提出本章关键问题", "用留白建立阅读停顿"],
      intent: "用克制留白和细线分割建立咨询报告的章节节奏。",
      scene: "咨询报告"
    }
  },
  "cover-title": {
    "business-general": {
      title: "年度汇报封面",
      body: ["一句话定义汇报主题", "补充日期、组织和场景"],
      intent: "用强标题和抽象业务主视觉建立专业第一印象。",
      scene: "年度汇报"
    },
    "ai-tech": {
      title: "智能中枢封面",
      body: ["呈现 AI 平台核心能力", "建立智能生成的视觉识别"],
      intent: "用环形节点主视觉表达智能中枢和生成能力。",
      scene: "AI 路演"
    },
    "consulting-minimal": {
      title: "一句话封面",
      body: ["只保留最核心判断", "用署名信息完成上下文"],
      intent: "用极少元素突出一句话主题和咨询式克制感。",
      scene: "咨询提案"
    }
  },
  "title-body-points": {
    "business-general": {
      title: "三卡要点",
      body: ["要点一：当前判断", "要点二：关键证据", "要点三：行动含义"],
      intent: "用三张等宽卡片承载标准内容页的三条核心要点。",
      scene: "商务方案"
    },
    "ai-tech": {
      title: "发光节点要点",
      body: ["节点一：输入理解", "节点二：结构生成", "节点三：视觉编排"],
      intent: "用串联节点表达 AI 工作流中的三段关键能力。",
      scene: "AI 介绍"
    },
    "consulting-minimal": {
      title: "结论 + 证据条",
      body: ["先给结论", "列出支撑证据", "收束为建议"],
      intent: "用左侧结论和右侧证据条呈现咨询式推理路径。",
      scene: "研究分析"
    }
  },
  "big-image-background": {
    "business-general": {
      title: "半遮罩场景页",
      body: ["让场景图承载情绪", "前景文字保持高对比"],
      intent: "用全幅背景和半透明遮罩呈现稳重场景页。",
      scene: "品牌方案"
    },
    "ai-tech": {
      title: "数据宇宙背景",
      body: ["以低对比数据纹理铺底", "用标题聚焦核心判断"],
      intent: "用抽象数据背景建立科技氛围并保留文字安全区。",
      scene: "科技发布"
    },
    "consulting-minimal": {
      title: "黑白大图标题",
      body: ["使用克制黑白图片", "只用一条高亮线标记主题"],
      intent: "用黑白大图和极少文字形成高质感报告页。",
      scene: "行业洞察"
    }
  },
  "left-image-right-text": {
    "business-general": {
      title: "案例图左文右",
      body: ["左侧呈现场景案例", "右侧说明核心结论", "补充三条业务启示"],
      intent: "先用案例图吸引注意，再用右侧文字解释价值。",
      scene: "客户案例"
    },
    "ai-tech": {
      title: "产品视觉左文右",
      body: ["展示产品能力插画", "解释 AI 能力边界", "说明落地效果"],
      intent: "用产品视觉和能力说明组合呈现 AI 方案。",
      scene: "产品介绍"
    },
    "consulting-minimal": {
      title: "报告图左文右",
      body: ["左图作为证据", "右侧给出 takeaway", "底部保留来源脚注"],
      intent: "把图片作为证据图，右侧用结论和脚注形成报告页。",
      scene: "分析报告"
    }
  },
  "left-text-right-image": {
    "business-general": {
      title: "观点先行右图",
      body: ["左侧先给业务判断", "右侧图片强化理解", "底部收束行动建议"],
      intent: "先表达观点，再用右侧图像强化场景理解。",
      scene: "项目汇报"
    },
    "ai-tech": {
      title: "AI 流程插画右",
      body: ["描述智能处理流程", "右侧承载算法节点意象", "强调自动化收益"],
      intent: "用右侧透明插画表达 AI 流程与能力闭环。",
      scene: "AI 培训"
    },
    "consulting-minimal": {
      title: "证据图右置",
      body: ["左侧给出简短结论", "右侧呈现证据图", "底部注明来源口径"],
      intent: "用右置证据图保持页面理性和高信息密度。",
      scene: "咨询报告"
    }
  },
  "left-text-right-chart": {
    "business-general": {
      title: "结论 + 柱线图",
      body: ["左侧说明业务结论", "右侧图表验证趋势", "底部保留口径说明"],
      intent: "让图表支撑左侧业务判断，适合运营和销售汇报。",
      scene: "数据汇报"
    },
    "ai-tech": {
      title: "模型指标面板",
      body: ["解释模型指标含义", "右侧承载仪表盘图表", "标记关键异常点"],
      intent: "用指标面板呈现 AI 模型表现和关键波动。",
      scene: "模型评估"
    },
    "consulting-minimal": {
      title: "咨询图表拆分",
      body: ["左侧一句 takeaway", "右侧标准图表", "底部放数据来源"],
      intent: "用咨询式图表页强化结论和证据的对应关系。",
      scene: "研究报告"
    }
  },
  "big-chart": {
    "business-general": {
      title: "单图表结论页",
      body: ["顶部保留一句结论", "下方图表承载主要证据"],
      intent: "让趋势或对比图成为页面主体，标题只保留判断。",
      scene: "经营分析"
    },
    "ai-tech": {
      title: "数据驾驶舱",
      body: ["大图表承载核心指标", "辅助指标弱化处理"],
      intent: "用驾驶舱结构呈现 AI 或业务数据的关键状态。",
      scene: "数据看板"
    },
    "consulting-minimal": {
      title: "全宽趋势图",
      body: ["白底全宽图表", "网格线极轻并保留脚注"],
      intent: "用极简趋势图呈现报告结论和数据证据。",
      scene: "趋势研究"
    }
  },
  "two-column-compare": {
    "business-general": {
      title: "现状 / 目标",
      body: ["左侧呈现当前问题", "右侧呈现目标收益", "对称结构强化差异"],
      intent: "用左右对比说明从现状到目标的业务价值。",
      scene: "转型方案"
    },
    "ai-tech": {
      title: "人工 / 智能",
      body: ["左侧传统方式", "右侧 AI 方式", "中间强调转化路径"],
      intent: "用对比结构呈现 AI 替代或增强的价值。",
      scene: "AI 方案"
    },
    "consulting-minimal": {
      title: "方案 A / B",
      body: ["两栏严格同构", "按维度列出优劣", "给出适用条件"],
      intent: "用标准咨询对比页支撑方案选择。",
      scene: "方案评估"
    }
  },
  quote: {
    "business-general": {
      title: "领导/客户金句",
      body: ["把最重要的一句话放大", "右下角注明来源和语境"],
      intent: "用浅色背景和大字号引用强化观点记忆。",
      scene: "客户证言"
    },
    "ai-tech": {
      title: "核心洞察光标",
      body: ["用大字呈现核心洞察", "用光标或扫描线标记重点"],
      intent: "让金句像 AI 识别出的洞察片段一样被聚焦。",
      scene: "洞察页"
    },
    "consulting-minimal": {
      title: "黑白大字引用",
      body: ["超大字重承载引用", "来源信息极小并保留留白"],
      intent: "用黑白大字和充足留白呈现高质感引用页。",
      scene: "观点强调"
    }
  },
  "time-axis": {
    "business-general": {
      title: "里程碑横轴",
      body: ["2024：启动", "2025：验证", "2026：规模化"],
      intent: "展示项目沿时间顺序推进的关键节点。",
      scene: "项目计划"
    },
    "ai-tech": {
      title: "技术演进轨道",
      body: ["数据接入", "模型验证", "智能协同"],
      intent: "用轨道和发光点表达技术阶段演进。",
      scene: "技术路线"
    },
    "consulting-minimal": {
      title: "咨询路线图",
      body: ["阶段一：诊断", "阶段二：设计", "阶段三：落地"],
      intent: "用细线横轴和编号卡片呈现咨询路线图。",
      scene: "咨询项目"
    }
  },
  "process-steps": {
    "business-general": {
      title: "三步闭环",
      body: ["第一步：输入想法", "第二步：生成结构", "第三步：导出演示"],
      intent: "用三段式步骤说明方法路径和操作流程。",
      scene: "培训课程"
    },
    "ai-tech": {
      title: "智能生成流水线",
      body: ["输入", "分析", "生成", "导出"],
      intent: "用节点和流向线呈现 AI 生成流程。",
      scene: "产品流程"
    },
    "consulting-minimal": {
      title: "编号步骤",
      body: ["01 识别问题", "02 拆解结构", "03 输出建议"],
      intent: "用大编号和短说明保持流程页极简清晰。",
      scene: "方法论"
    }
  },
  "key-metrics": {
    "business-general": {
      title: "大数字 + 解释",
      body: ["86% 关键指标承载结论", "补充数字背后的业务含义"],
      intent: "用一个大数字形成强记忆点并解释行动含义。",
      scene: "经营复盘"
    },
    "ai-tech": {
      title: "指标仪表盘",
      body: ["92 分模型表现", "旁侧放置辅助指标"],
      intent: "用仪表盘结构表达关键指标和辅助信号。",
      scene: "AI 指标"
    },
    "consulting-minimal": {
      title: "KPI 结论页",
      body: ["一个 KPI", "一句结论", "两条解释"],
      intent: "用极简排版让 KPI 与结论强绑定。",
      scene: "KPI 汇报"
    }
  },
  "quadrant-matrix": {
    "business-general": {
      title: "优先级矩阵",
      body: ["高价值 / 高紧急", "高价值 / 低紧急", "低价值 / 高紧急", "低价值 / 低紧急"],
      intent: "用价值和紧急度帮助比较和决策。",
      scene: "优先级评估"
    },
    "ai-tech": {
      title: "能力/价值象限",
      body: ["高智能 / 高价值", "高智能 / 低价值", "低智能 / 高价值", "低智能 / 低价值"],
      intent: "用智能化程度和业务价值识别高潜机会区。",
      scene: "AI 机会图"
    },
    "consulting-minimal": {
      title: "咨询 2x2",
      body: ["重点象限", "机会象限", "观察象限", "搁置象限"],
      intent: "用标准 2x2 矩阵支撑咨询式判断。",
      scene: "战略分析"
    }
  },
  ending: {
    "business-general": {
      title: "行动号召",
      body: ["总结核心观点", "给出下一步行动"],
      intent: "用感谢语和行动按钮收束演示。",
      scene: "商务收尾"
    },
    "ai-tech": {
      title: "下一步智能协作",
      body: ["开始生成下一份 PPT", "进入更高效的协作流程"],
      intent: "用弱科技视觉强化继续协作和下一步行动。",
      scene: "AI 收尾"
    },
    "consulting-minimal": {
      title: "极简谢谢",
      body: ["谢谢观看", "底部保留联系信息"],
      intent: "用极简结尾页完成专业收束。",
      scene: "咨询收尾"
    }
  }
};

const pageRoles = {
  "big-chart": "data",
  "cover-title": "cover",
  chapter: "section",
  ending: "summary",
  "key-metrics": "data",
  "left-text-right-chart": "data",
  "process-steps": "process",
  "quadrant-matrix": "comparison",
  "time-axis": "process",
  "two-column-compare": "comparison"
};

const candidateLayouts = {
  "big-chart": ["big-chart", "left-text-right-chart", "key-metrics"],
  "big-image-background": ["big-image-background", "cover-title", "left-text-right-image"],
  chapter: ["chapter", "quote", "big-image-background"],
  "cover-title": ["cover-title", "big-image-background", "left-text-right-image"],
  ending: ["ending", "quote", "title-body-points"],
  "key-metrics": ["key-metrics", "big-chart", "left-text-right-chart"],
  "left-image-right-text": ["left-image-right-text", "left-text-right-image", "title-body-points"],
  "left-text-right-chart": ["left-text-right-chart", "big-chart", "key-metrics"],
  "left-text-right-image": ["left-text-right-image", "left-image-right-text", "title-body-points"],
  "process-steps": ["process-steps", "time-axis", "title-body-points"],
  "quadrant-matrix": ["quadrant-matrix", "two-column-compare", "title-body-points"],
  quote: ["quote", "title-body-points", "big-image-background"],
  "time-axis": ["time-axis", "process-steps", "title-body-points"],
  "title-body-points": ["title-body-points", "left-text-right-image", "two-column-compare"],
  "two-column-compare": ["two-column-compare", "quadrant-matrix", "title-body-points"]
};

const denseCategories = new Set([
  "process-steps",
  "quadrant-matrix",
  "title-body-points"
]);
const lowDensityCategories = new Set(["chapter", "cover-title", "ending", "quote"]);
function pageRoleFor(category) {
  return pageRoles[category] ?? "content";
}

function primaryGoalFor(category) {
  const role = pageRoleFor(category);

  if (role === "comparison") {
    return "compare";
  }

  if (role === "data" || role === "process") {
    return "explain";
  }

  if (role === "summary") {
    return "summarize";
  }

  if (role === "cover") {
    return "spark-interest";
  }

  return "inform";
}

function densityFor(category) {
  if (denseCategories.has(category)) {
    return "high";
  }

  if (lowDensityCategories.has(category)) {
    return "low";
  }

  return "medium";
}

function text(slideId, suffix, role, content, bounds, options = {}) {
  const semanticType = options.semanticType ?? "body";

  return {
    id: `${slideId}-${suffix}`,
    type: "text",
    role,
    content,
    bounds,
    editable: true,
    hierarchyLevel: options.hierarchyLevel ?? (semanticType === "title" ? 1 : 2),
    semanticType,
    zIndex: options.zIndex ?? 30,
    styleNotes: options.styleNotes ?? "通用模板文本，可按业务内容替换。",
    requiresImageGeneration: false,
    textStyle: {
      align: options.align ?? "left",
      color: options.color,
      fontSize: options.fontSize ?? 16,
      fontWeight: options.fontWeight ?? "regular",
      lineHeight: options.lineHeight ?? 1.25,
      maxLines: options.maxLines ?? 6
    }
  };
}

function shape(slideId, suffix, role, bounds, options = {}) {
  return {
    id: `${slideId}-${suffix}`,
    type: "shape",
    role,
    bounds,
    editable: true,
    hierarchyLevel: options.hierarchyLevel ?? 4,
    semanticType: options.semanticType ?? "accentShape",
    zIndex: options.zIndex ?? 10,
    styleNotes: options.styleNotes ?? "通用模板强调形状，可作为背景、分隔线或信息卡底。",
    requiresImageGeneration: false
  };
}

function chart(slideId, suffix, role, bounds, options = {}) {
  return {
    id: `${slideId}-${suffix}`,
    type: "chartPlaceholder",
    role,
    bounds,
    editable: true,
    hierarchyLevel: 2,
    semanticType: "chart",
    zIndex: options.zIndex ?? 18,
    styleNotes: options.styleNotes ?? "图表占位，导入后可替换为真实图表。",
    requiresImageGeneration: false
  };
}

function image(slideId, suffix, role, bounds, options = {}) {
  const requestId = `${slideId}-${suffix}-req`;

  return {
    element: {
      id: `${slideId}-${suffix}`,
      type: "generatedImage",
      role,
      bounds,
      editable: true,
      hierarchyLevel: 2,
      imageRequestId: requestId,
      semanticType: options.semanticType ?? "heroVisual",
      zIndex: options.zIndex ?? 20,
      styleNotes: options.styleNotes ?? "图片请求占位，后续由图片生成或人工替换。",
      requiresImageGeneration: true
    },
    request: {
      id: requestId,
      elementId: `${slideId}-${suffix}`,
      purpose: options.purpose ?? role,
      imageType: options.imageType ?? "illustration",
      keywords: options.keywords ?? ["PPT模板", role],
      prompt: options.prompt,
      negativePrompt: "不要文字、不要水印、不要复杂背景、不要低清晰度",
      avoid: "不要文字、不要水印、不要复杂背景、不要低清晰度",
      transparentBackground: options.transparentBackground ?? true,
      aspectRatio: "16:9",
      visualNotes: options.visualNotes ?? "保持专业演示风格，避免复杂文字。"
    }
  };
}

function makeImage(slideId, variant, style, kind) {
  const isBackground = kind === "background";

  return image(
    slideId,
    isBackground ? "bgimg" : "hero",
    isBackground ? "页面背景图" : "主视觉图层",
    isBackground
      ? { x: 0, y: 0, width: 13.333, height: 7.5 }
      : { x: 7.15, y: 0.9, width: 4.85, height: 4.8 },
    {
      imageType: isBackground ? "background" : "illustration",
      keywords: ["PPT模板", variant.title, style.label],
      prompt: isBackground
        ? `为 PPT 模板“${variant.title}”生成低对比 16:9 背景图。风格：${style.tone}。必须留出文字安全区域，不包含文字、水印或复杂高对比纹理。`
        : `为 PPT 模板“${variant.title}”生成透明背景主视觉插画。风格：${style.tone}。画面简洁、专业、无文字、适合演示页面分层。`,
      purpose: isBackground ? "生成页面背景图" : "生成模板主视觉",
      semanticType: isBackground ? "background" : "heroVisual",
      styleNotes: isBackground ? "背景图请求占位，文字区域需要保持低对比。" : "透明主视觉请求占位，主体不得压住标题区。",
      transparentBackground: !isBackground,
      visualNotes: style.tone,
      zIndex: isBackground ? 1 : 20
    }
  );
}

function makeStyledImage(slideId, variant, style, kind, bounds, suffix = "hero") {
  const imageLayer = makeImage(slideId, variant, style, kind);

  imageLayer.element.bounds = bounds;

  if (suffix !== "hero" && kind !== "background") {
    const requestId = `${slideId}-${suffix}-req`;
    imageLayer.element.id = `${slideId}-${suffix}`;
    imageLayer.element.imageRequestId = requestId;
    imageLayer.request.id = requestId;
    imageLayer.request.elementId = imageLayer.element.id;
  }

  return imageLayer;
}

function buildStyleSpecificElements({
  body,
  category,
  label,
  slideId,
  style,
  title,
  variant
}) {
  const styleId = style.id;
  const points = variant.body;
  const first = points[0];
  const second = points[1] ?? points[0];
  const third = points[2] ?? points[1] ?? points[0];
  const fourth = points[3] ?? points[2] ?? points[0];

  switch (category) {
    case "chapter":
      if (styleId === "business-general") {
        return {
          elements: [
            shape(slideId, "rail", "左侧章节栏", { x: 0.72, y: 0.82, width: 2.35, height: 5.86 }, { semanticType: "card", zIndex: 8 }),
            label("kicker", "章节编号", "PART 01", { x: 1.02, y: 1.18, width: 1.78, height: 0.42 }),
            title("title", "章节标题", variant.title, { x: 3.62, y: 2.08, width: 6.86, height: 0.86 }, { fontSize: 32 }),
            body("body", "章节说明", `${first}\n${second}`, { x: 3.66, y: 3.25, width: 5.85, height: 0.92 }, { maxLines: 3 }),
            shape(slideId, "progress", "底部进度线", { x: 3.66, y: 5.52, width: 4.25, height: 0.1 }, { zIndex: 12 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            shape(slideId, "grid", "星图背景网格", { x: 6.98, y: 0.78, width: 4.95, height: 5.75 }, { semanticType: "card", zIndex: 7 }),
            shape(slideId, "axis-x", "坐标横轴", { x: 7.35, y: 3.62, width: 4.1, height: 0.08 }, { zIndex: 12 }),
            shape(slideId, "axis-y", "坐标纵轴", { x: 9.36, y: 1.2, width: 0.08, height: 4.78 }, { zIndex: 12 }),
            label("coord", "坐标编号", "NODE 01", { x: 0.92, y: 0.94, width: 2.15, height: 0.42 }),
            title("title", "章节标题", variant.title, { x: 0.92, y: 2.18, width: 5.82, height: 0.82 }, { fontSize: 31 }),
            body("body", "章节说明", `${first}\n${second}`, { x: 0.96, y: 3.32, width: 5.18, height: 0.9 }, { maxLines: 3 }),
            shape(slideId, "dot1", "星图节点一", { x: 8.1, y: 2.35, width: 0.3, height: 0.3 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "dot2", "星图节点二", { x: 10.55, y: 4.55, width: 0.3, height: 0.3 }, { semanticType: "badge", zIndex: 18 })
          ],
          requests: []
        };
      }

      return {
        elements: [
          label("kicker", "章节编号", "01", { x: 0.86, y: 0.92, width: 0.72, height: 0.42 }),
          shape(slideId, "split", "章节分割线", { x: 0.86, y: 3.62, width: 11.45, height: 0.05 }, { zIndex: 10 }),
          title("title", "章节标题", variant.title, { x: 3.1, y: 2.44, width: 7.1, height: 0.82 }, { align: "center", fontSize: 30 }),
          body("question", "章节问题", `${first}\n${second}`, { x: 3.55, y: 3.98, width: 6.2, height: 0.78 }, { align: "center", maxLines: 3 }),
          body("footer", "章节脚注", "Section / Key Question", { x: 0.88, y: 6.38, width: 3.3, height: 0.3 }, { fontSize: 10, semanticType: "footer" })
        ],
        requests: []
      };

    case "cover-title":
      if (styleId === "business-general") {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 7.12, y: 0.95, width: 4.86, height: 4.86 });

        return {
          elements: [
            title("title", "封面标题", variant.title, { x: 0.88, y: 0.98, width: 6.05, height: 1.05 }, { fontSize: 34 }),
            body("subtitle", "封面副标题", `${first}\n${second}`, { x: 0.95, y: 2.28, width: 5.68, height: 0.92 }, { fontSize: 17, fontWeight: "medium", maxLines: 3, semanticType: "subtitle" }),
            shape(slideId, "accent", "封面强调线", { x: 0.96, y: 3.46, width: 1.48, height: 0.14 }, { zIndex: 12 }),
            hero.element,
            body("footer", "封面信息", "日期 / 组织 / 作者", { x: 0.96, y: 6.38, width: 4.4, height: 0.35 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: [hero.request]
        };
      }

      if (styleId === "ai-tech") {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 4.18, y: 1.0, width: 5.05, height: 4.72 });

        return {
          elements: [
            hero.element,
            shape(slideId, "orbit", "中枢环形轨道", { x: 4.85, y: 1.62, width: 3.72, height: 3.42 }, { semanticType: "badge", zIndex: 18 }),
            label("kicker", "封面标签", "AI COMMAND CENTER", { x: 0.92, y: 0.86, width: 3.3, height: 0.38 }),
            title("title", "封面标题", variant.title, { x: 1.35, y: 2.58, width: 10.6, height: 0.9 }, { align: "center", fontSize: 35 }),
            body("subtitle", "封面副标题", `${first}\n${second}`, { x: 3.48, y: 4.0, width: 6.38, height: 0.74 }, { align: "center", fontSize: 15, semanticType: "subtitle", maxLines: 3 }),
            body("footer", "封面信息", "智能演示 / 生成协作 / 版本 v1", { x: 4.25, y: 6.36, width: 4.9, height: 0.32 }, { align: "center", fontSize: 11, semanticType: "footer" })
          ],
          requests: [hero.request]
        };
      }

      {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 10.68, y: 0.82, width: 1.18, height: 1.18 }, "mark");

        return {
          elements: [
            label("kicker", "封面标签", "POINT OF VIEW", { x: 0.86, y: 0.88, width: 2.7, height: 0.34 }),
            title("title", "封面标题", variant.title, { x: 0.88, y: 2.22, width: 9.58, height: 1.08 }, { fontSize: 38, maxLines: 2 }),
            body("subtitle", "封面副标题", `${first}\n${second}`, { x: 0.92, y: 3.72, width: 6.65, height: 0.76 }, { fontSize: 15, semanticType: "subtitle", maxLines: 3 }),
            shape(slideId, "rule", "底部细线", { x: 0.9, y: 5.92, width: 10.88, height: 0.05 }, { zIndex: 10 }),
            hero.element,
            body("footer", "署名信息", "作者 / 组织 / 日期", { x: 0.92, y: 6.35, width: 4.3, height: 0.32 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: [hero.request]
        };
      }

    case "title-body-points":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "页面标题", variant.title, { x: 0.82, y: 0.62, width: 8.4, height: 0.62 }, { fontSize: 28 }),
            body("lead", "导语", first, { x: 0.9, y: 1.42, width: 7.2, height: 0.5 }, { fontWeight: "medium", semanticType: "subtitle", maxLines: 2 }),
            shape(slideId, "card1", "要点卡片一", { x: 0.9, y: 2.32, width: 3.45, height: 2.45 }, { semanticType: "card" }),
            shape(slideId, "card2", "要点卡片二", { x: 4.95, y: 2.32, width: 3.45, height: 2.45 }, { semanticType: "card" }),
            shape(slideId, "card3", "要点卡片三", { x: 9, y: 2.32, width: 3.45, height: 2.45 }, { semanticType: "card" }),
            body("p1", "要点一", first, { x: 1.22, y: 2.75, width: 2.8, height: 1.28 }, { fontWeight: "medium", semanticType: "card" }),
            body("p2", "要点二", second, { x: 5.27, y: 2.75, width: 2.8, height: 1.28 }, { fontWeight: "medium", semanticType: "card" }),
            body("p3", "要点三", third, { x: 9.32, y: 2.75, width: 2.8, height: 1.28 }, { fontWeight: "medium", semanticType: "card" })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "节点标题", variant.title, { x: 0.86, y: 0.68, width: 6.9, height: 0.62 }, { fontSize: 27 }),
            shape(slideId, "rail", "节点连接线", { x: 1.42, y: 3.52, width: 9.7, height: 0.08 }, { zIndex: 12 }),
            shape(slideId, "node1", "发光节点一", { x: 1.15, y: 3.23, width: 0.62, height: 0.62 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "node2", "发光节点二", { x: 5.65, y: 3.23, width: 0.62, height: 0.62 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "node3", "发光节点三", { x: 10.15, y: 3.23, width: 0.62, height: 0.62 }, { semanticType: "badge", zIndex: 18 }),
            body("p1", "节点一说明", first, { x: 0.9, y: 2.0, width: 2.55, height: 0.78 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("p2", "节点二说明", second, { x: 4.8, y: 4.18, width: 2.55, height: 0.78 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("p3", "节点三说明", third, { x: 9.28, y: 2.0, width: 2.55, height: 0.78 }, { align: "center", fontWeight: "medium", semanticType: "card" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          title("title", "标题结论", variant.title, { x: 0.82, y: 0.65, width: 5.5, height: 0.62 }, { fontSize: 27 }),
          body("lead", "核心表达", first, { x: 0.88, y: 1.72, width: 4.9, height: 0.82 }, { fontSize: 18, fontWeight: "semibold", semanticType: "subtitle", maxLines: 2 }),
          shape(slideId, "e1", "证据条一", { x: 6.95, y: 1.45, width: 5.1, height: 0.72 }, { semanticType: "card" }),
          shape(slideId, "e2", "证据条二", { x: 6.95, y: 2.62, width: 5.1, height: 0.72 }, { semanticType: "card" }),
          shape(slideId, "e3", "证据条三", { x: 6.95, y: 3.79, width: 5.1, height: 0.72 }, { semanticType: "card" }),
          body("p1", "证据一", first, { x: 7.25, y: 1.58, width: 4.45, height: 0.42 }, { fontWeight: "medium", semanticType: "card", maxLines: 2 }),
          body("p2", "证据二", second, { x: 7.25, y: 2.75, width: 4.45, height: 0.42 }, { fontWeight: "medium", semanticType: "card", maxLines: 2 }),
          body("p3", "证据三", third, { x: 7.25, y: 3.92, width: 4.45, height: 0.42 }, { fontWeight: "medium", semanticType: "card", maxLines: 2 }),
          shape(slideId, "line", "底部分割线", { x: 0.86, y: 6.35, width: 11.2, height: 0.08 }, { zIndex: 11 })
        ],
        requests: []
      };

    case "big-image-background":
      {
        const bg = makeStyledImage(slideId, variant, style, "background", { x: 0, y: 0, width: 13.333, height: 7.5 }, "bgimg");

        if (styleId === "business-general") {
          return {
            elements: [
              bg.element,
              shape(slideId, "overlay", "左侧文字遮罩", { x: 0.72, y: 0.78, width: 5.85, height: 5.75 }, { semanticType: "card", zIndex: 18 }),
              title("title", "背景图标题", variant.title, { x: 1.08, y: 1.48, width: 4.95, height: 0.82 }, { fontSize: 30 }),
              body("body", "背景图说明", `${first}\n${second}`, { x: 1.1, y: 2.72, width: 4.65, height: 1.2 }, { maxLines: 4 }),
              shape(slideId, "accent", "标题强调线", { x: 1.1, y: 4.38, width: 1.75, height: 0.12 }, { zIndex: 22 })
            ],
            requests: [bg.request]
          };
        }

        if (styleId === "ai-tech") {
          return {
            elements: [
              bg.element,
              shape(slideId, "band", "底部数据带", { x: 0.72, y: 4.88, width: 11.9, height: 1.12 }, { semanticType: "card", zIndex: 18 }),
              label("tag", "背景标签", "DATA FIELD", { x: 1.05, y: 1.05, width: 2.25, height: 0.36 }),
              title("title", "背景图标题", variant.title, { x: 1.05, y: 2.38, width: 10.5, height: 0.88 }, { align: "center", fontSize: 32 }),
              body("body", "背景图说明", `${first} / ${second}`, { x: 2.2, y: 5.18, width: 8.8, height: 0.45 }, { align: "center", fontSize: 14, maxLines: 2 })
            ],
            requests: [bg.request]
          };
        }

        return {
          elements: [
            bg.element,
            shape(slideId, "top-rule", "顶部细线", { x: 0.9, y: 0.88, width: 11.55, height: 0.05 }, { zIndex: 18 }),
            shape(slideId, "bottom-panel", "底部标题带", { x: 0.88, y: 5.18, width: 8.25, height: 1.02 }, { semanticType: "card", zIndex: 18 }),
            title("title", "背景图标题", variant.title, { x: 1.18, y: 5.42, width: 5.3, height: 0.54 }, { fontSize: 24 }),
            body("body", "背景图说明", `${first} / ${second}`, { x: 6.72, y: 5.47, width: 2.0, height: 0.34 }, { fontSize: 11, semanticType: "footer", maxLines: 1 })
          ],
          requests: [bg.request]
        };
      }

    case "left-image-right-text":
      if (styleId === "business-general") {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 0.82, y: 1.0, width: 5.4, height: 4.95 });

        return {
          elements: [
            hero.element,
            title("title", "右侧标题", variant.title, { x: 7.05, y: 1.08, width: 4.85, height: 0.72 }, { fontSize: 28 }),
            body("body", "右侧正文", `${first}\n${second}\n${third}`, { x: 7.08, y: 2.1, width: 4.65, height: 2.38 }, { maxLines: 6 }),
            shape(slideId, "line", "右侧强调线", { x: 7.08, y: 5.08, width: 2.4, height: 0.12 }, { zIndex: 12 }),
            body("note", "补充说明", "图片仅作主视觉占位，可在设计器中替换。", { x: 7.08, y: 5.55, width: 4.25, height: 0.38 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: [hero.request]
        };
      }

      if (styleId === "ai-tech") {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 0.95, y: 1.32, width: 4.25, height: 3.95 });

        return {
          elements: [
            shape(slideId, "node-panel", "产品视觉面板", { x: 0.72, y: 0.96, width: 5.18, height: 4.82 }, { semanticType: "card", zIndex: 8 }),
            hero.element,
            title("title", "右侧标题", variant.title, { x: 6.55, y: 0.9, width: 5.55, height: 0.72 }, { fontSize: 28 }),
            body("body", "能力说明", `${first}\n${second}\n${third}`, { x: 6.58, y: 2.0, width: 4.82, height: 1.45 }, { maxLines: 5 }),
            shape(slideId, "chip1", "能力标签一", { x: 6.6, y: 4.0, width: 1.55, height: 0.42 }, { semanticType: "badge" }),
            shape(slideId, "chip2", "能力标签二", { x: 8.45, y: 4.0, width: 1.55, height: 0.42 }, { semanticType: "badge" }),
            body("note", "适用边界", "能力 / 效果 / 边界", { x: 6.62, y: 5.2, width: 3.88, height: 0.35 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: [hero.request]
        };
      }

      {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 0.92, y: 1.38, width: 4.72, height: 3.0 });

        return {
          elements: [
            title("title", "报告标题", variant.title, { x: 6.1, y: 1.02, width: 5.6, height: 0.7 }, { fontSize: 27 }),
            hero.element,
            body("takeaway", "报告结论", `${first}\n${second}`, { x: 6.12, y: 2.12, width: 4.95, height: 1.05 }, { fontSize: 17, fontWeight: "semibold", semanticType: "subtitle", maxLines: 3 }),
            shape(slideId, "source-line", "来源分割线", { x: 0.92, y: 4.76, width: 10.95, height: 0.05 }, { zIndex: 12 }),
            body("foot", "来源脚注", "来源 / 样本 / 时间范围", { x: 0.94, y: 5.18, width: 4.85, height: 0.32 }, { fontSize: 10, semanticType: "footer" }),
            body("body", "右侧说明", third, { x: 6.14, y: 3.82, width: 4.55, height: 0.62 }, { fontSize: 13, maxLines: 2 })
          ],
          requests: [hero.request]
        };
      }

    case "left-text-right-image":
      if (styleId === "business-general") {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 7.15, y: 0.9, width: 4.85, height: 4.8 });

        return {
          elements: [
            title("title", "左侧标题", variant.title, { x: 0.9, y: 0.98, width: 5.7, height: 0.78 }, { fontSize: 28 }),
            body("body", "左侧正文", `${first}\n${second}\n${third}`, { x: 0.94, y: 2.02, width: 5.2, height: 2.62 }, { maxLines: 6 }),
            hero.element,
            shape(slideId, "line", "左侧强调线", { x: 0.95, y: 5.22, width: 2.3, height: 0.12 }, { zIndex: 12 }),
            body("foot", "来源说明", "可替换为来源 / 口径 / 时间。", { x: 0.95, y: 5.64, width: 4.6, height: 0.34 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: [hero.request]
        };
      }

      if (styleId === "ai-tech") {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 8.1, y: 1.25, width: 3.55, height: 3.55 });

        return {
          elements: [
            title("title", "流程插画标题", variant.title, { x: 0.88, y: 0.82, width: 6.5, height: 0.7 }, { fontSize: 27 }),
            body("step1", "流程一", first, { x: 0.95, y: 2.0, width: 2.1, height: 0.58 }, { fontWeight: "medium", semanticType: "card" }),
            shape(slideId, "arrow1", "流程连接一", { x: 3.22, y: 2.24, width: 1.35, height: 0.08 }, { zIndex: 16 }),
            body("step2", "流程二", second, { x: 4.8, y: 2.0, width: 2.1, height: 0.58 }, { fontWeight: "medium", semanticType: "card" }),
            shape(slideId, "arrow2", "流程连接二", { x: 6.98, y: 2.24, width: 0.82, height: 0.08 }, { zIndex: 16 }),
            hero.element,
            body("body", "流程收益", third, { x: 0.96, y: 3.82, width: 5.2, height: 0.72 }, { maxLines: 2 }),
            shape(slideId, "panel", "右侧科技面板", { x: 7.62, y: 0.94, width: 4.45, height: 4.85 }, { semanticType: "card", zIndex: 8 })
          ],
          requests: [hero.request]
        };
      }

      {
        const hero = makeStyledImage(slideId, variant, style, "hero", { x: 7.02, y: 1.42, width: 4.7, height: 3.15 });

        return {
          elements: [
            label("kicker", "结论标签", "TAKEAWAY", { x: 0.9, y: 0.9, width: 1.8, height: 0.32 }),
            title("title", "左侧结论", variant.title, { x: 0.9, y: 1.62, width: 5.1, height: 0.82 }, { fontSize: 29 }),
            body("body", "结论说明", `${first}\n${second}`, { x: 0.94, y: 2.88, width: 4.9, height: 1.08 }, { fontSize: 15, maxLines: 3 }),
            hero.element,
            shape(slideId, "source-rule", "来源线", { x: 0.9, y: 5.58, width: 10.85, height: 0.05 }, { zIndex: 12 }),
            body("source", "来源说明", "Source / Method / Notes", { x: 7.04, y: 4.9, width: 4.5, height: 0.32 }, { fontSize: 10, semanticType: "footer" })
          ],
          requests: [hero.request]
        };
      }

    case "left-text-right-chart":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "图表页标题", variant.title, { x: 0.9, y: 0.88, width: 5.55, height: 0.75 }, { fontSize: 27 }),
            body("body", "左侧结论", `${first}\n${second}\n${third}`, { x: 0.94, y: 1.9, width: 4.92, height: 2.55 }, { maxLines: 6 }),
            chart(slideId, "chart", "右侧图表", { x: 6.72, y: 1.15, width: 5.25, height: 4.35 }, { styleNotes: `${style.label}图表占位，保留清晰坐标和口径说明。` }),
            shape(slideId, "axis", "图表底线", { x: 7.1, y: 5.18, width: 4.45, height: 0.1 }, { zIndex: 22 }),
            body("caption", "图表口径", "数据口径 / 来源说明", { x: 6.72, y: 5.82, width: 4.8, height: 0.34 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "指标面板标题", variant.title, { x: 0.85, y: 0.68, width: 6.25, height: 0.65 }, { fontSize: 27 }),
            shape(slideId, "panel", "模型指标面板", { x: 5.4, y: 0.95, width: 6.55, height: 5.35 }, { semanticType: "card", zIndex: 8 }),
            body("body", "指标解释", `${first}\n${second}`, { x: 0.92, y: 1.78, width: 3.82, height: 1.38 }, { maxLines: 4 }),
            chart(slideId, "chart", "仪表盘图表", { x: 5.82, y: 1.35, width: 5.68, height: 3.15 }, { zIndex: 20 }),
            shape(slideId, "metric1", "辅助指标一", { x: 5.86, y: 4.98, width: 1.6, height: 0.56 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "metric2", "辅助指标二", { x: 7.88, y: 4.98, width: 1.6, height: 0.56 }, { semanticType: "badge", zIndex: 18 }),
            body("caption", "异常说明", "关键异常点 / 模型版本", { x: 0.94, y: 5.76, width: 4.2, height: 0.32 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          label("takeaway", "结论标签", "TAKEAWAY", { x: 0.86, y: 0.84, width: 1.7, height: 0.32 }),
          title("title", "咨询图表标题", variant.title, { x: 0.86, y: 1.48, width: 4.45, height: 0.72 }, { fontSize: 26 }),
          body("body", "一句结论", first, { x: 0.88, y: 2.62, width: 3.95, height: 0.72 }, { fontSize: 16, fontWeight: "semibold", maxLines: 2 }),
          chart(slideId, "chart", "标准图表", { x: 5.35, y: 1.12, width: 6.55, height: 4.52 }, { zIndex: 20 }),
          body("caption", "数据来源", "数据来源 / 统计口径", { x: 5.36, y: 5.96, width: 4.2, height: 0.32 }, { fontSize: 10, semanticType: "footer" })
        ],
        requests: []
      };

    case "big-chart":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "大图表标题", variant.title, { x: 0.82, y: 0.55, width: 8.8, height: 0.62 }, { fontSize: 26 }),
            chart(slideId, "chart", "大图表区域", { x: 0.9, y: 1.45, width: 11.5, height: 4.85 }, { zIndex: 20 }),
            body("caption", "图表注释", `${first} / ${second}`, { x: 0.92, y: 6.42, width: 7.1, height: 0.36 }, { fontSize: 12, semanticType: "footer", zIndex: 25 }),
            shape(slideId, "rule", "标题辅助线", { x: 9.95, y: 0.83, width: 2.35, height: 0.08 }, { zIndex: 12 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "驾驶舱标题", variant.title, { x: 0.82, y: 0.56, width: 6.8, height: 0.62 }, { fontSize: 26 }),
            chart(slideId, "chart", "核心图表", { x: 0.9, y: 1.32, width: 8.15, height: 4.75 }, { zIndex: 20 }),
            shape(slideId, "kpi1", "辅助指标一", { x: 9.55, y: 1.38, width: 2.22, height: 1.0 }, { semanticType: "card", zIndex: 10 }),
            shape(slideId, "kpi2", "辅助指标二", { x: 9.55, y: 2.72, width: 2.22, height: 1.0 }, { semanticType: "card", zIndex: 10 }),
            body("kpi-text", "辅助指标说明", `${first}\n${second}`, { x: 9.78, y: 4.28, width: 1.85, height: 0.86 }, { fontSize: 12, maxLines: 3 }),
            body("caption", "看板注释", "指标口径 / 更新时间", { x: 0.92, y: 6.38, width: 4.5, height: 0.32 }, { fontSize: 11, semanticType: "footer" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          label("kicker", "图表标签", "TREND", { x: 0.82, y: 0.72, width: 1.15, height: 0.32 }),
          title("title", "全宽趋势标题", variant.title, { x: 0.82, y: 1.15, width: 7.2, height: 0.62 }, { fontSize: 25 }),
          chart(slideId, "chart", "全宽趋势图", { x: 0.86, y: 2.08, width: 11.62, height: 3.88 }, { zIndex: 20 }),
          body("caption", "图表脚注", `${first} / 数据来源`, { x: 0.88, y: 6.3, width: 5.2, height: 0.32 }, { fontSize: 10, semanticType: "footer" })
        ],
        requests: []
      };

    case "two-column-compare":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "对比标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "left-card", "左栏背景", { x: 0.9, y: 1.55, width: 5.45, height: 4.6 }, { semanticType: "card" }),
            shape(slideId, "right-card", "右栏背景", { x: 7, y: 1.55, width: 5.45, height: 4.6 }, { semanticType: "card" }),
            body("left", "左栏内容", `${first}\n${second}`, { x: 1.3, y: 2.02, width: 4.55, height: 2.85 }, { fontWeight: "medium", semanticType: "card", maxLines: 5 }),
            body("right", "右栏内容", `${second}\n${third}`, { x: 7.4, y: 2.02, width: 4.55, height: 2.85 }, { fontWeight: "medium", semanticType: "card", maxLines: 5 }),
            shape(slideId, "divider", "中部分隔线", { x: 6.62, y: 1.9, width: 0.08, height: 3.9 }, { zIndex: 16 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "智能对比标题", variant.title, { x: 0.82, y: 0.64, width: 7.6, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "left", "人工流程区", { x: 0.92, y: 1.72, width: 4.55, height: 3.92 }, { semanticType: "card" }),
            shape(slideId, "right", "智能流程区", { x: 7.86, y: 1.72, width: 4.55, height: 3.92 }, { semanticType: "card" }),
            shape(slideId, "arrow", "智能转化箭头", { x: 5.98, y: 3.43, width: 1.35, height: 0.12 }, { zIndex: 18 }),
            body("left-text", "人工方式", first, { x: 1.28, y: 2.46, width: 3.75, height: 1.42 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("right-text", "智能方式", second, { x: 8.22, y: 2.46, width: 3.75, height: 1.42 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            label("tag", "转化标签", "AI SHIFT", { x: 5.68, y: 2.66, width: 1.85, height: 0.36 }, { align: "center" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          title("title", "方案对比标题", variant.title, { x: 0.82, y: 0.62, width: 6.8, height: 0.62 }, { fontSize: 26 }),
          shape(slideId, "top-rule", "顶部表格线", { x: 0.88, y: 1.62, width: 11.32, height: 0.05 }, { zIndex: 10 }),
          shape(slideId, "mid-rule", "中部表格线", { x: 0.88, y: 3.45, width: 11.32, height: 0.05 }, { zIndex: 10 }),
          shape(slideId, "vertical", "表格中线", { x: 6.56, y: 1.62, width: 0.05, height: 3.98 }, { zIndex: 10 }),
          body("left", "方案 A", `${first}\n${second}`, { x: 1.08, y: 2.08, width: 4.88, height: 1.08 }, { fontWeight: "medium", semanticType: "card" }),
          body("right", "方案 B", `${third}\n${fourth}`, { x: 6.92, y: 2.08, width: 4.88, height: 1.08 }, { fontWeight: "medium", semanticType: "card" }),
          body("note", "适用条件", "适用条件 / 风险 / 决策建议", { x: 1.08, y: 4.28, width: 6.4, height: 0.42 }, { fontSize: 12, semanticType: "footer" })
        ],
        requests: []
      };

    case "quote":
      if (styleId === "business-general") {
        return {
          elements: [
            shape(slideId, "mark-left", "引用符号左", { x: 1.35, y: 1.35, width: 0.55, height: 0.55 }, { zIndex: 10 }),
            title("title", "引用金句", `“${first}。”`, { x: 2.05, y: 2, width: 9.25, height: 1.18 }, { align: "center", fontSize: 31, maxLines: 2 }),
            body("source", "引用来源", "来源 / 场景说明", { x: 4.1, y: 3.58, width: 5.1, height: 0.42 }, { align: "center", fontSize: 14, semanticType: "footer" }),
            shape(slideId, "mark-right", "引用符号右", { x: 11.35, y: 4.1, width: 0.55, height: 0.55 }, { zIndex: 10 }),
            body("note", "语境说明", second, { x: 3.18, y: 4.55, width: 7, height: 0.42 }, { align: "center", fontSize: 13 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            label("cursor", "洞察光标", ">", { x: 1.0, y: 1.08, width: 0.42, height: 0.42 }, { fontSize: 20 }),
            title("title", "核心洞察", first, { x: 1.55, y: 1.7, width: 9.2, height: 1.16 }, { fontSize: 32, maxLines: 2 }),
            shape(slideId, "scan", "扫描强调线", { x: 1.58, y: 3.32, width: 8.4, height: 0.08 }, { zIndex: 12 }),
            body("source", "洞察来源", "Insight / Model Output", { x: 1.62, y: 3.86, width: 3.65, height: 0.32 }, { fontSize: 11, semanticType: "footer" }),
            body("note", "补充说明", second, { x: 7.25, y: 4.75, width: 3.6, height: 0.58 }, { fontSize: 13, maxLines: 2 })
          ],
          requests: []
        };
      }

      return {
        elements: [
          title("title", "黑白大字引用", first, { x: 0.86, y: 1.35, width: 9.9, height: 1.45 }, { fontSize: 38, maxLines: 2 }),
          shape(slideId, "rule", "引用细线", { x: 0.9, y: 3.32, width: 3.88, height: 0.05 }, { zIndex: 10 }),
          body("source", "引用来源", "SOURCE", { x: 0.9, y: 4.0, width: 1.6, height: 0.3 }, { fontSize: 10, semanticType: "footer" }),
          body("note", "引用说明", second, { x: 0.9, y: 4.48, width: 4.55, height: 0.5 }, { fontSize: 12, semanticType: "footer", maxLines: 2 })
        ],
        requests: []
      };

    case "time-axis":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "时间轴标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "line", "时间轴主线", { x: 1.25, y: 3.55, width: 10.8, height: 0.12 }, { zIndex: 10 }),
            body("node1", "节点一", first, { x: 1.15, y: 2.25, width: 2.65, height: 1.1 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            body("node2", "节点二", second, { x: 5.35, y: 3.95, width: 2.65, height: 1.1 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            body("node3", "节点三", third, { x: 9.35, y: 2.25, width: 2.65, height: 1.1 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            shape(slideId, "dot1", "节点标记一", { x: 2.35, y: 3.38, width: 0.32, height: 0.32 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "dot2", "节点标记二", { x: 6.55, y: 3.38, width: 0.32, height: 0.32 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "dot3", "节点标记三", { x: 10.55, y: 3.38, width: 0.32, height: 0.32 }, { semanticType: "badge", zIndex: 18 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "技术轨道标题", variant.title, { x: 0.82, y: 0.62, width: 7.4, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "track", "技术演进轨道", { x: 1.35, y: 5.05, width: 10.3, height: 0.12 }, { zIndex: 10 }),
            shape(slideId, "rise1", "轨道分支一", { x: 2.15, y: 3.92, width: 0.08, height: 1.1 }, { zIndex: 12 }),
            shape(slideId, "rise2", "轨道分支二", { x: 6.25, y: 2.85, width: 0.08, height: 2.18 }, { zIndex: 12 }),
            shape(slideId, "rise3", "轨道分支三", { x: 10.35, y: 3.45, width: 0.08, height: 1.58 }, { zIndex: 12 }),
            body("node1", "技术节点一", first, { x: 1.28, y: 3.1, width: 2.1, height: 0.6 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("node2", "技术节点二", second, { x: 5.32, y: 2.02, width: 2.1, height: 0.6 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("node3", "技术节点三", third, { x: 9.42, y: 2.65, width: 2.1, height: 0.6 }, { align: "center", fontWeight: "medium", semanticType: "card" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          label("kicker", "路线图标签", "ROADMAP", { x: 0.82, y: 0.82, width: 1.55, height: 0.32 }),
          title("title", "咨询路线图标题", variant.title, { x: 0.82, y: 1.28, width: 6.2, height: 0.6 }, { fontSize: 25 }),
          shape(slideId, "line", "路线图细线", { x: 1.02, y: 3.05, width: 10.6, height: 0.05 }, { zIndex: 10 }),
          body("node1", "阶段一", `01\n${first}`, { x: 1.0, y: 3.45, width: 2.5, height: 0.95 }, { fontWeight: "medium", semanticType: "card", maxLines: 3 }),
          body("node2", "阶段二", `02\n${second}`, { x: 5.0, y: 3.45, width: 2.5, height: 0.95 }, { fontWeight: "medium", semanticType: "card", maxLines: 3 }),
          body("node3", "阶段三", `03\n${third}`, { x: 9.0, y: 3.45, width: 2.5, height: 0.95 }, { fontWeight: "medium", semanticType: "card", maxLines: 3 })
        ],
        requests: []
      };

    case "process-steps":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "流程标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "step1-card", "步骤卡片一", { x: 0.9, y: 2, width: 3.05, height: 2.35 }, { semanticType: "card" }),
            shape(slideId, "step2-card", "步骤卡片二", { x: 4.05, y: 2, width: 3.05, height: 2.35 }, { semanticType: "card" }),
            shape(slideId, "step3-card", "步骤卡片三", { x: 7.2, y: 2, width: 3.05, height: 2.35 }, { semanticType: "card" }),
            body("step1", "第一步", `01\n${first}`, { x: 1.2, y: 2.45, width: 2.45, height: 1.25 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            body("step2", "第二步", `02\n${second}`, { x: 4.35, y: 2.45, width: 2.45, height: 1.25 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            body("step3", "第三步", `03\n${third}`, { x: 7.5, y: 2.45, width: 2.45, height: 1.25 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            shape(slideId, "connector1", "连接线一", { x: 4.08, y: 3.12, width: 0.62, height: 0.1 }, { zIndex: 20 }),
            shape(slideId, "connector2", "连接线二", { x: 7.22, y: 3.12, width: 0.62, height: 0.1 }, { zIndex: 20 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "流水线标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "pipe", "流水线主线", { x: 1.08, y: 3.46, width: 10.5, height: 0.12 }, { zIndex: 10 }),
            body("s1", "输入", first, { x: 0.92, y: 2.46, width: 2.0, height: 0.52 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("s2", "分析", second, { x: 3.75, y: 4.03, width: 2.0, height: 0.52 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("s3", "生成", third, { x: 6.58, y: 2.46, width: 2.0, height: 0.52 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("s4", "导出", fourth, { x: 9.42, y: 4.03, width: 2.0, height: 0.52 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            shape(slideId, "dot1", "节点一", { x: 1.62, y: 3.26, width: 0.42, height: 0.42 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "dot2", "节点二", { x: 4.48, y: 3.26, width: 0.42, height: 0.42 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "dot3", "节点三", { x: 7.32, y: 3.26, width: 0.42, height: 0.42 }, { semanticType: "badge", zIndex: 18 }),
            shape(slideId, "dot4", "节点四", { x: 10.15, y: 3.26, width: 0.42, height: 0.42 }, { semanticType: "badge", zIndex: 18 })
          ],
          requests: []
        };
      }

      return {
        elements: [
          title("title", "编号步骤标题", variant.title, { x: 0.82, y: 0.82, width: 6.8, height: 0.62 }, { fontSize: 26 }),
          label("num1", "编号一", "01", { x: 1.0, y: 2.0, width: 0.82, height: 0.56 }, { fontSize: 24 }),
          body("step1", "步骤一", first, { x: 2.05, y: 2.04, width: 7.6, height: 0.46 }, { fontWeight: "medium", semanticType: "card" }),
          shape(slideId, "line1", "分隔线一", { x: 1.0, y: 2.78, width: 10.8, height: 0.05 }, { zIndex: 10 }),
          label("num2", "编号二", "02", { x: 1.0, y: 3.25, width: 0.82, height: 0.56 }, { fontSize: 24 }),
          body("step2", "步骤二", second, { x: 2.05, y: 3.29, width: 7.6, height: 0.46 }, { fontWeight: "medium", semanticType: "card" }),
          shape(slideId, "line2", "分隔线二", { x: 1.0, y: 4.03, width: 10.8, height: 0.05 }, { zIndex: 10 }),
          label("num3", "编号三", "03", { x: 1.0, y: 4.5, width: 0.82, height: 0.56 }, { fontSize: 24 }),
          body("step3", "步骤三", third, { x: 2.05, y: 4.54, width: 7.6, height: 0.46 }, { fontWeight: "medium", semanticType: "card" })
        ],
        requests: []
      };

    case "key-metrics":
      if (styleId === "business-general") {
        return {
          elements: [
            label("metric", "关键指标", first.match(/[0-9]+%?|KPI/)?.[0] ?? "86%", { x: 0.95, y: 1.28, width: 5.15, height: 1.35 }, { fontSize: 40, fontWeight: "bold", maxLines: 1 }),
            title("title", "指标结论", variant.title, { x: 0.98, y: 3.05, width: 5.9, height: 0.62 }, { fontSize: 26 }),
            body("body", "指标解释", `${first}\n${second}`, { x: 1.02, y: 4.03, width: 5.8, height: 1.3 }, { maxLines: 5 }),
            shape(slideId, "panel", "右侧指标背景", { x: 7.5, y: 0.9, width: 4.4, height: 5.4 }, { semanticType: "card", zIndex: 8 }),
            shape(slideId, "ring", "指标装饰环", { x: 8.32, y: 1.75, width: 2.75, height: 2.75 }, { semanticType: "badge", zIndex: 14 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "仪表盘标题", variant.title, { x: 0.82, y: 0.62, width: 6.2, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "dash", "仪表盘底板", { x: 0.9, y: 1.42, width: 11.2, height: 4.75 }, { semanticType: "card", zIndex: 8 }),
            label("score", "核心分值", first.match(/[0-9]+|KPI/)?.[0] ?? "92", { x: 1.42, y: 2.05, width: 2.75, height: 1.2 }, { fontSize: 38, fontWeight: "bold" }),
            shape(slideId, "gauge", "仪表盘圆环", { x: 5.12, y: 1.86, width: 2.95, height: 2.95 }, { semanticType: "badge", zIndex: 14 }),
            body("body", "指标解释", `${first}\n${second}`, { x: 8.7, y: 2.12, width: 2.5, height: 1.18 }, { fontSize: 13, maxLines: 4 }),
            shape(slideId, "aux1", "辅助指标一", { x: 1.45, y: 4.68, width: 2.0, height: 0.55 }, { semanticType: "badge" }),
            shape(slideId, "aux2", "辅助指标二", { x: 8.72, y: 4.68, width: 2.0, height: 0.55 }, { semanticType: "badge" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          label("kpi", "KPI", "KPI", { x: 0.9, y: 0.88, width: 0.78, height: 0.32 }),
          title("title", "KPI 结论", variant.title, { x: 0.9, y: 1.75, width: 6.6, height: 0.72 }, { fontSize: 29 }),
          body("metric", "关键指标", first, { x: 0.92, y: 3.02, width: 5.4, height: 0.72 }, { fontSize: 20, fontWeight: "bold", semanticType: "subtitle", maxLines: 2 }),
          body("explain", "解释", `${second}\n${third}`, { x: 0.94, y: 4.32, width: 4.95, height: 0.82 }, { fontSize: 13, maxLines: 3 }),
          shape(slideId, "rule", "底部分割线", { x: 0.9, y: 5.82, width: 10.85, height: 0.05 }, { zIndex: 10 })
        ],
        requests: []
      };

    case "quadrant-matrix":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "矩阵标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "matrix", "矩阵底", { x: 2.35, y: 1.45, width: 8.6, height: 5 }, { semanticType: "card", zIndex: 8 }),
            shape(slideId, "vaxis", "纵轴", { x: 6.62, y: 1.62, width: 0.08, height: 4.66 }, { zIndex: 18 }),
            shape(slideId, "haxis", "横轴", { x: 2.52, y: 3.9, width: 8.26, height: 0.08 }, { zIndex: 18 }),
            body("q1", "象限一", first, { x: 3.05, y: 2.12, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            body("q2", "象限二", second, { x: 7.45, y: 2.12, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            body("q3", "象限三", third, { x: 3.05, y: 4.45, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
            body("q4", "象限四", fourth, { x: 7.45, y: 4.45, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            title("title", "能力价值标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
            shape(slideId, "matrix", "能力价值象限底", { x: 1.2, y: 1.55, width: 10.55, height: 4.92 }, { semanticType: "card", zIndex: 8 }),
            shape(slideId, "vaxis", "智能化轴", { x: 6.48, y: 1.76, width: 0.08, height: 4.48 }, { zIndex: 18 }),
            shape(slideId, "haxis", "业务价值轴", { x: 1.42, y: 3.98, width: 10.1, height: 0.08 }, { zIndex: 18 }),
            shape(slideId, "hot", "高潜机会区", { x: 6.92, y: 1.96, width: 3.95, height: 1.45 }, { semanticType: "badge", zIndex: 14 }),
            body("q1", "高潜机会", first, { x: 7.25, y: 2.32, width: 3.1, height: 0.55 }, { align: "center", fontWeight: "bold", semanticType: "card" }),
            body("q2", "观察机会", second, { x: 2.08, y: 2.32, width: 3.1, height: 0.55 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("q3", "基础能力", third, { x: 2.08, y: 4.72, width: 3.1, height: 0.55 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
            body("q4", "边缘机会", fourth, { x: 7.25, y: 4.72, width: 3.1, height: 0.55 }, { align: "center", fontWeight: "medium", semanticType: "card" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          label("kicker", "矩阵标签", "2x2", { x: 0.82, y: 0.82, width: 0.78, height: 0.32 }),
          title("title", "咨询矩阵标题", variant.title, { x: 0.82, y: 1.24, width: 5.7, height: 0.6 }, { fontSize: 25 }),
          shape(slideId, "vaxis", "纵轴", { x: 6.62, y: 2.06, width: 0.05, height: 3.85 }, { zIndex: 18 }),
          shape(slideId, "haxis", "横轴", { x: 2.72, y: 3.95, width: 7.85, height: 0.05 }, { zIndex: 18 }),
          body("q1", "重点象限", first, { x: 7.06, y: 2.56, width: 2.78, height: 0.55 }, { align: "center", fontWeight: "bold", semanticType: "card" }),
          body("q2", "机会象限", second, { x: 3.26, y: 2.56, width: 2.78, height: 0.55 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
          body("q3", "观察象限", third, { x: 3.26, y: 4.72, width: 2.78, height: 0.55 }, { align: "center", fontWeight: "medium", semanticType: "card" }),
          body("q4", "搁置象限", fourth, { x: 7.06, y: 4.72, width: 2.78, height: 0.55 }, { align: "center", fontWeight: "medium", semanticType: "card" })
        ],
        requests: []
      };

    case "ending":
      if (styleId === "business-general") {
        return {
          elements: [
            title("title", "结束语", variant.title, { x: 2.5, y: 2.05, width: 8.2, height: 0.95 }, { align: "center", fontSize: 36 }),
            body("body", "下一步", `${first}\n${second}`, { x: 3.6, y: 3.32, width: 6, height: 1.05 }, { align: "center", maxLines: 4 }),
            shape(slideId, "button", "行动按钮", { x: 5.3, y: 5.05, width: 2.8, height: 0.58 }, { semanticType: "badge", zIndex: 12 }),
            body("footer", "联系信息", "联系方式 / 下一步 / 日期", { x: 4.2, y: 6.12, width: 4.9, height: 0.34 }, { align: "center", fontSize: 11, semanticType: "footer" })
          ],
          requests: []
        };
      }

      if (styleId === "ai-tech") {
        return {
          elements: [
            shape(slideId, "panel", "智能协作面板", { x: 1.48, y: 1.32, width: 10.38, height: 4.42 }, { semanticType: "card", zIndex: 8 }),
            label("tag", "下一步标签", "NEXT", { x: 5.82, y: 1.8, width: 1.0, height: 0.32 }, { align: "center" }),
            title("title", "结束语", variant.title, { x: 2.68, y: 2.55, width: 8.0, height: 0.86 }, { align: "center", fontSize: 33 }),
            body("body", "协作说明", `${first}\n${second}`, { x: 3.38, y: 3.78, width: 6.55, height: 0.78 }, { align: "center", maxLines: 3 }),
            shape(slideId, "node1", "协作节点一", { x: 2.08, y: 4.92, width: 0.36, height: 0.36 }, { semanticType: "badge" }),
            shape(slideId, "node2", "协作节点二", { x: 10.92, y: 1.98, width: 0.36, height: 0.36 }, { semanticType: "badge" })
          ],
          requests: []
        };
      }

      return {
        elements: [
          label("kicker", "结束标签", "END", { x: 0.86, y: 0.9, width: 0.82, height: 0.32 }),
          title("title", "极简谢谢", variant.title, { x: 0.86, y: 2.35, width: 6.8, height: 0.92 }, { fontSize: 36 }),
          body("body", "结尾信息", `${first}\n${second}`, { x: 0.9, y: 3.72, width: 4.9, height: 0.75 }, { maxLines: 3 }),
          shape(slideId, "rule", "底部线", { x: 0.9, y: 5.78, width: 10.95, height: 0.05 }, { zIndex: 10 }),
          body("footer", "联系信息", "Contact / Email / Date", { x: 0.92, y: 6.28, width: 4.2, height: 0.3 }, { fontSize: 10, semanticType: "footer" })
        ],
        requests: []
      };

    default:
      return null;
  }
}

function buildElements(category, slideId, variant, style) {
  const title = (suffix, role, content, bounds, options = {}) =>
    text(slideId, suffix, role, content, bounds, {
      color: style.titleColor,
      fontSize: options.fontSize ?? 28,
      fontWeight: "bold",
      maxLines: options.maxLines ?? 2,
      semanticType: "title",
      zIndex: 40,
      ...options
    });
  const body = (suffix, role, content, bounds, options = {}) =>
    text(slideId, suffix, role, content, bounds, {
      color: style.bodyColor,
      fontSize: options.fontSize ?? 15,
      fontWeight: options.fontWeight ?? "regular",
      maxLines: options.maxLines ?? 6,
      semanticType: options.semanticType ?? "body",
      zIndex: options.zIndex ?? 35,
      ...options
    });
  const label = (suffix, role, content, bounds, options = {}) =>
    text(slideId, suffix, role, content, bounds, {
      color: style.accentColor,
      fontSize: options.fontSize ?? 14,
      fontWeight: options.fontWeight ?? "semibold",
      maxLines: options.maxLines ?? 3,
      semanticType: options.semanticType ?? "badge",
      zIndex: options.zIndex ?? 36,
      ...options
    });

  const styledElements = buildStyleSpecificElements({
    body,
    category,
    label,
    slideId,
    style,
    title,
    variant
  });

  if (styledElements) {
    return styledElements;
  }

  switch (category) {
    case "chapter":
      if (style.id === "consulting-minimal") {
        return {
          elements: [
            shape(slideId, "line", "章节分割线", { x: 0.9, y: 3.65, width: 10.9, height: 0.06 }, { zIndex: 10 }),
            label("kicker", "章节编号", "PART 01", { x: 0.95, y: 1.05, width: 2.3, height: 0.42 }),
            title("title", "章节标题", variant.title, { x: 2.85, y: 2.52, width: 7.4, height: 0.78 }, { align: "center", fontSize: 30 }),
            body("body", "章节问题", variant.body.join("\n"), { x: 3.65, y: 3.95, width: 5.8, height: 0.9 }, { align: "center", maxLines: 3 })
          ],
          requests: []
        };
      }

      return {
        elements: [
          shape(slideId, "panel", style.id === "ai-tech" ? "星图坐标区" : "章节色块", { x: 0.9, y: 0.9, width: 2.3, height: 5.6 }, { semanticType: "card", zIndex: 8 }),
          label("kicker", "章节编号", style.id === "ai-tech" ? "NODE 01" : "PART 01", { x: 1.12, y: 1.25, width: 1.8, height: 0.46 }),
          title("title", "章节标题", variant.title, { x: 3.65, y: 2.08, width: 6.7, height: 0.88 }, { fontSize: 32 }),
          body("body", "章节说明", variant.body.join("\n"), { x: 3.68, y: 3.25, width: 5.9, height: 1.05 }, { maxLines: 3 }),
          shape(slideId, "accent", "进度提示线", { x: 3.68, y: 5.45, width: 4.2, height: 0.12 }, { zIndex: 12 })
        ],
        requests: []
      };

    case "cover-title": {
      const hero = makeImage(slideId, variant, style, "hero");

      return {
        elements: [
          title("title", "封面标题", variant.title, { x: 0.88, y: 0.95, width: 6.15, height: 1.05 }, { fontSize: 34 }),
          body("subtitle", "封面副标题", variant.body.join("\n"), { x: 0.95, y: 2.25, width: 5.75, height: 0.92 }, { fontSize: 17, fontWeight: "medium", maxLines: 3, semanticType: "subtitle" }),
          shape(slideId, "accent", "封面强调线", { x: 0.96, y: 3.42, width: 1.45, height: 0.14 }, { zIndex: 12 }),
          hero.element,
          body("footer", "封面信息", "日期 / 组织 / 作者", { x: 0.96, y: 6.38, width: 4.4, height: 0.35 }, { fontSize: 11, semanticType: "footer", zIndex: 35 })
        ],
        requests: [hero.request]
      };
    }

    case "title-body-points": {
      const points = variant.body.slice(0, 3);

      if (style.id === "consulting-minimal") {
        return {
          elements: [
            title("title", "标题结论", variant.title, { x: 0.82, y: 0.65, width: 5.5, height: 0.62 }, { fontSize: 27 }),
            body("lead", "核心表达", points[0], { x: 0.88, y: 1.72, width: 4.9, height: 0.82 }, { fontSize: 18, fontWeight: "semibold", semanticType: "subtitle", maxLines: 2 }),
            shape(slideId, "e1", "证据条一", { x: 6.95, y: 1.45, width: 5.1, height: 0.72 }, { semanticType: "card" }),
            shape(slideId, "e2", "证据条二", { x: 6.95, y: 2.62, width: 5.1, height: 0.72 }, { semanticType: "card" }),
            shape(slideId, "e3", "证据条三", { x: 6.95, y: 3.79, width: 5.1, height: 0.72 }, { semanticType: "card" }),
            body("p1", "证据一", points[0], { x: 7.25, y: 1.58, width: 4.45, height: 0.42 }, { fontWeight: "medium", semanticType: "card", maxLines: 2 }),
            body("p2", "证据二", points[1], { x: 7.25, y: 2.75, width: 4.45, height: 0.42 }, { fontWeight: "medium", semanticType: "card", maxLines: 2 }),
            body("p3", "证据三", points[2], { x: 7.25, y: 3.92, width: 4.45, height: 0.42 }, { fontWeight: "medium", semanticType: "card", maxLines: 2 }),
            shape(slideId, "line", "底部分割线", { x: 0.86, y: 6.35, width: 11.2, height: 0.08 }, { zIndex: 11 })
          ],
          requests: []
        };
      }

      return {
        elements: [
          title("title", "页面标题", variant.title, { x: 0.82, y: 0.62, width: 8.4, height: 0.62 }, { fontSize: 28 }),
          body("lead", "导语", points[0], { x: 0.9, y: 1.42, width: 7.2, height: 0.5 }, { fontWeight: "medium", semanticType: "subtitle", maxLines: 2 }),
          shape(slideId, "card1", "要点卡片一", { x: 0.9, y: 2.32, width: 3.45, height: 2.45 }, { semanticType: "card" }),
          shape(slideId, "card2", "要点卡片二", { x: 4.95, y: 2.32, width: 3.45, height: 2.45 }, { semanticType: "card" }),
          shape(slideId, "card3", "要点卡片三", { x: 9, y: 2.32, width: 3.45, height: 2.45 }, { semanticType: "card" }),
          body("p1", "要点一", points[0], { x: 1.22, y: 2.75, width: 2.8, height: 1.28 }, { fontWeight: "medium", semanticType: "card" }),
          body("p2", "要点二", points[1], { x: 5.27, y: 2.75, width: 2.8, height: 1.28 }, { fontWeight: "medium", semanticType: "card" }),
          body("p3", "要点三", points[2], { x: 9.32, y: 2.75, width: 2.8, height: 1.28 }, { fontWeight: "medium", semanticType: "card" })
        ],
        requests: []
      };
    }

    case "big-image-background": {
      const bg = makeImage(slideId, variant, style, "background");

      return {
        elements: [
          bg.element,
          shape(slideId, "overlay", "文字安全遮罩", { x: 0.72, y: 0.78, width: 5.85, height: 5.75 }, { semanticType: "card", zIndex: 18 }),
          title("title", "背景图标题", variant.title, { x: 1.08, y: 1.48, width: 4.95, height: 0.82 }, { fontSize: 30 }),
          body("body", "背景图说明", variant.body.join("\n"), { x: 1.1, y: 2.72, width: 4.65, height: 1.2 }, { maxLines: 4 }),
          shape(slideId, "accent", "标题强调线", { x: 1.1, y: 4.38, width: 1.75, height: 0.12 }, { zIndex: 22 })
        ],
        requests: [bg.request]
      };
    }

    case "left-image-right-text": {
      const hero = makeImage(slideId, variant, style, "hero");
      hero.element.bounds = { x: 0.82, y: 1, width: 5.4, height: 4.95 };

      return {
        elements: [
          hero.element,
          title("title", "右侧标题", variant.title, { x: 7.05, y: 1.08, width: 4.85, height: 0.72 }, { fontSize: 28 }),
          body("body", "右侧正文", variant.body.join("\n"), { x: 7.08, y: 2.1, width: 4.65, height: 2.38 }, { maxLines: 6 }),
          shape(slideId, "line", "右侧强调线", { x: 7.08, y: 5.08, width: 2.4, height: 0.12 }, { zIndex: 12 }),
          body("note", "补充说明", "图片仅作主视觉占位，可在设计器中替换。", { x: 7.08, y: 5.55, width: 4.25, height: 0.38 }, { fontSize: 11, semanticType: "footer", zIndex: 35 })
        ],
        requests: [hero.request]
      };
    }

    case "left-text-right-image": {
      const hero = makeImage(slideId, variant, style, "hero");

      return {
        elements: [
          title("title", "左侧标题", variant.title, { x: 0.9, y: 0.98, width: 5.7, height: 0.78 }, { fontSize: 28 }),
          body("body", "左侧正文", variant.body.join("\n"), { x: 0.94, y: 2.02, width: 5.2, height: 2.62 }, { maxLines: 6 }),
          hero.element,
          shape(slideId, "line", "左侧强调线", { x: 0.95, y: 5.22, width: 2.3, height: 0.12 }, { zIndex: 12 }),
          body("foot", "来源说明", "可替换为来源 / 口径 / 时间。", { x: 0.95, y: 5.64, width: 4.6, height: 0.34 }, { fontSize: 11, semanticType: "footer", zIndex: 35 })
        ],
        requests: [hero.request]
      };
    }

    case "left-text-right-chart":
      return {
        elements: [
          title("title", "图表页标题", variant.title, { x: 0.9, y: 0.88, width: 5.55, height: 0.75 }, { fontSize: 27 }),
          body("body", "左侧结论", variant.body.join("\n"), { x: 0.94, y: 1.9, width: 4.92, height: 2.55 }, { maxLines: 6 }),
          chart(slideId, "chart", "右侧图表", { x: 6.72, y: 1.15, width: 5.25, height: 4.35 }, { styleNotes: `${style.label}图表占位，保留清晰坐标和口径说明。` }),
          shape(slideId, "axis", "图表底线", { x: 7.1, y: 5.18, width: 4.45, height: 0.1 }, { zIndex: 22 }),
          body("caption", "图表口径", "数据口径 / 来源说明", { x: 6.72, y: 5.82, width: 4.8, height: 0.34 }, { fontSize: 11, semanticType: "footer", zIndex: 35 })
        ],
        requests: []
      };

    case "big-chart":
      return {
        elements: [
          title("title", "大图表标题", variant.title, { x: 0.82, y: 0.55, width: 8.8, height: 0.62 }, { fontSize: 26 }),
          chart(slideId, "chart", "大图表区域", { x: 0.9, y: 1.45, width: 11.5, height: 4.85 }, { zIndex: 20 }),
          body("caption", "图表注释", variant.body.join(" / "), { x: 0.92, y: 6.42, width: 7.1, height: 0.36 }, { fontSize: 12, semanticType: "footer", zIndex: 25 }),
          shape(slideId, "rule", "标题辅助线", { x: 9.95, y: 0.83, width: 2.35, height: 0.08 }, { zIndex: 12 })
        ],
        requests: []
      };

    case "two-column-compare":
      return {
        elements: [
          title("title", "对比标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
          shape(slideId, "left-card", "左栏背景", { x: 0.9, y: 1.55, width: 5.45, height: 4.6 }, { semanticType: "card" }),
          shape(slideId, "right-card", "右栏背景", { x: 7, y: 1.55, width: 5.45, height: 4.6 }, { semanticType: "card" }),
          body("left", "左栏内容", variant.body.slice(0, 2).join("\n"), { x: 1.3, y: 2.02, width: 4.55, height: 2.85 }, { fontWeight: "medium", semanticType: "card", maxLines: 5 }),
          body("right", "右栏内容", variant.body.slice(1).join("\n"), { x: 7.4, y: 2.02, width: 4.55, height: 2.85 }, { fontWeight: "medium", semanticType: "card", maxLines: 5 }),
          shape(slideId, "divider", "中部分隔线", { x: 6.62, y: 1.9, width: 0.08, height: 3.9 }, { zIndex: 16 })
        ],
        requests: []
      };

    case "quote":
      return {
        elements: [
          shape(slideId, "mark-left", "引用符号左", { x: 1.35, y: 1.35, width: 0.55, height: 0.55 }, { zIndex: 10 }),
          title("quote", "引用金句", `“${variant.body[0]}。”`, { x: 2.05, y: 2, width: 9.25, height: 1.18 }, { align: "center", fontSize: 31, maxLines: 2 }),
          body("source", "引用来源", "来源 / 场景说明", { x: 4.1, y: 3.58, width: 5.1, height: 0.42 }, { align: "center", fontSize: 14, semanticType: "footer", zIndex: 35 }),
          shape(slideId, "mark-right", "引用符号右", { x: 11.35, y: 4.1, width: 0.55, height: 0.55 }, { zIndex: 10 }),
          body("note", "语境说明", variant.body[1], { x: 3.18, y: 4.55, width: 7, height: 0.42 }, { align: "center", fontSize: 13, semanticType: "body", zIndex: 35 })
        ],
        requests: []
      };

    case "time-axis": {
      const nodes = variant.body.slice(0, 3);

      return {
        elements: [
          title("title", "时间轴标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
          shape(slideId, "line", "时间轴主线", { x: 1.25, y: 3.55, width: 10.8, height: 0.12 }, { zIndex: 10 }),
          body("node1", "节点一", nodes[0], { x: 1.15, y: 2.25, width: 2.65, height: 1.1 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          body("node2", "节点二", nodes[1], { x: 5.35, y: 3.95, width: 2.65, height: 1.1 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          body("node3", "节点三", nodes[2], { x: 9.35, y: 2.25, width: 2.65, height: 1.1 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          shape(slideId, "dot1", "节点标记一", { x: 2.35, y: 3.38, width: 0.32, height: 0.32 }, { semanticType: "badge", zIndex: 18 }),
          shape(slideId, "dot2", "节点标记二", { x: 6.55, y: 3.38, width: 0.32, height: 0.32 }, { semanticType: "badge", zIndex: 18 }),
          shape(slideId, "dot3", "节点标记三", { x: 10.55, y: 3.38, width: 0.32, height: 0.32 }, { semanticType: "badge", zIndex: 18 })
        ],
        requests: []
      };
    }

    case "process-steps": {
      const steps = variant.body.slice(0, 4);

      return {
        elements: [
          title("title", "流程标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
          shape(slideId, "step1-card", "步骤卡片一", { x: 0.9, y: 2, width: 3.05, height: 2.35 }, { semanticType: "card" }),
          shape(slideId, "step2-card", "步骤卡片二", { x: 4.05, y: 2, width: 3.05, height: 2.35 }, { semanticType: "card" }),
          shape(slideId, "step3-card", "步骤卡片三", { x: 7.2, y: 2, width: 3.05, height: 2.35 }, { semanticType: "card" }),
          body("step1", "第一步", `01\n${steps[0]}`, { x: 1.2, y: 2.45, width: 2.45, height: 1.25 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          body("step2", "第二步", `02\n${steps[1]}`, { x: 4.35, y: 2.45, width: 2.45, height: 1.25 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          body("step3", "第三步", `03\n${steps[2] ?? steps[1]}`, { x: 7.5, y: 2.45, width: 2.45, height: 1.25 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          shape(slideId, "connector1", "连接线一", { x: 4.08, y: 3.12, width: 0.62, height: 0.1 }, { zIndex: 20 }),
          shape(slideId, "connector2", "连接线二", { x: 7.22, y: 3.12, width: 0.62, height: 0.1 }, { zIndex: 20 })
        ],
        requests: []
      };
    }

    case "key-metrics":
      return {
        elements: [
          label("metric", "关键指标", variant.body[0].match(/[0-9]+%?|KPI/)?.[0] ?? "86%", { x: 0.95, y: 1.28, width: 5.15, height: 1.35 }, { fontSize: 40, fontWeight: "bold", maxLines: 1 }),
          title("title", "指标结论", variant.title, { x: 0.98, y: 3.05, width: 5.9, height: 0.62 }, { fontSize: 26 }),
          body("body", "指标解释", variant.body.join("\n"), { x: 1.02, y: 4.03, width: 5.8, height: 1.3 }, { maxLines: 5 }),
          shape(slideId, "panel", "右侧指标背景", { x: 7.5, y: 0.9, width: 4.4, height: 5.4 }, { semanticType: "card", zIndex: 8 }),
          shape(slideId, "ring", "指标装饰环", { x: 8.32, y: 1.75, width: 2.75, height: 2.75 }, { semanticType: "badge", zIndex: 14 })
        ],
        requests: []
      };

    case "quadrant-matrix": {
      const q = variant.body.slice(0, 4);

      return {
        elements: [
          title("title", "矩阵标题", variant.title, { x: 0.82, y: 0.62, width: 7.8, height: 0.62 }, { fontSize: 26 }),
          shape(slideId, "matrix", "矩阵底", { x: 2.35, y: 1.45, width: 8.6, height: 5 }, { semanticType: "card", zIndex: 8 }),
          shape(slideId, "vaxis", "纵轴", { x: 6.62, y: 1.62, width: 0.08, height: 4.66 }, { zIndex: 18 }),
          shape(slideId, "haxis", "横轴", { x: 2.52, y: 3.9, width: 8.26, height: 0.08 }, { zIndex: 18 }),
          body("q1", "象限一", q[0], { x: 3.05, y: 2.12, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          body("q2", "象限二", q[1], { x: 7.45, y: 2.12, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          body("q3", "象限三", q[2], { x: 3.05, y: 4.45, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 }),
          body("q4", "象限四", q[3], { x: 7.45, y: 4.45, width: 2.55, height: 0.9 }, { align: "center", fontWeight: "bold", semanticType: "card", maxLines: 3 })
        ],
        requests: []
      };
    }

    case "ending":
      return {
        elements: [
          title("title", "结束语", variant.title, { x: 2.5, y: 2.05, width: 8.2, height: 0.95 }, { align: "center", fontSize: 36 }),
          body("body", "下一步", variant.body.join("\n"), { x: 3.6, y: 3.32, width: 6, height: 1.05 }, { align: "center", maxLines: 4 }),
          shape(slideId, "button", "行动按钮", { x: 5.3, y: 5.05, width: 2.8, height: 0.58 }, { semanticType: "badge", zIndex: 12 }),
          body("footer", "联系信息", "联系方式 / 下一步 / 日期", { x: 4.2, y: 6.12, width: 4.9, height: 0.34 }, { align: "center", fontSize: 11, semanticType: "footer", zIndex: 35 })
        ],
        requests: []
      };

    default:
      throw new Error(`Unsupported category: ${category}`);
  }
}

function buildSemanticElements(slideId, category, variant, hasImage) {
  const visualType = hasImage ? "generatedImage" : category.includes("chart") || category === "big-chart" ? "chartPlaceholder" : "shape";
  const visualSemanticType = hasImage ? "heroVisual" : category.includes("chart") || category === "big-chart" ? "chart" : "card";
  const items = [
    {
      category: "text",
      constraints: ["模板主标题，替换内容后仍保持最高层级"],
      content: variant.title,
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slideId}-sem-title`,
      priority: 1,
      role: "主标题",
      semanticType: "title"
    },
    {
      category: "text",
      constraints: ["承载模板核心结论或说明"],
      content: variant.body[0],
      elementType: "text",
      hierarchyLevel: 1,
      id: `${slideId}-sem-key`,
      priority: 2,
      role: "核心信息",
      semanticType: "subtitle"
    },
    {
      category: hasImage ? "visual" : "container",
      constraints: ["每页最多一个主视觉中心", "不得遮挡标题"],
      content: variant.intent,
      elementType: visualType,
      hierarchyLevel: 2,
      id: `${slideId}-sem-visual`,
      priority: 3,
      role: hasImage ? "模板主视觉" : "模板结构中心",
      semanticType: visualSemanticType
    },
    ...variant.body.slice(0, 5).map((point, index) => ({
      category: "text",
      constraints: ["二级内容，可替换为业务要点"],
      content: point,
      elementType: "text",
      hierarchyLevel: 2,
      id: `${slideId}-sem-p${index + 1}`,
      priority: Math.min(5, 3 + index),
      role: `要点 ${index + 1}`,
      semanticType: "body"
    }))
  ];

  return items.slice(0, 10);
}

function buildContentHierarchy(title, bodyPoints, primaryMessage, designPlan) {
  return {
    primaryMessage,
    levels: [
      {
        label: title,
        level: 1,
        summary: primaryMessage
      },
      ...bodyPoints.slice(0, 5).map((point, index) => ({
        label: `要点 ${index + 1}`,
        level: 2,
        summary: point
      }))
    ].slice(0, 8),
    tiers: [
      {
        items: [
          { content: title, role: "主标题" },
          { content: primaryMessage, role: "核心信息" }
        ],
        label: "一级信息",
        level: 1
      },
      {
        items: bodyPoints.slice(0, 5).map((point, index) => ({
          content: point,
          role: `要点 ${index + 1}`
        })),
        label: "二级信息",
        level: 2
      },
      {
        items: [
          { content: designPlan, role: "版式说明" },
          { content: "导入后可在模板设计器中替换占位内容。", role: "使用说明" }
        ],
        label: "三级信息",
        level: 3
      }
    ]
  };
}

function buildSlide(category, style, categoryIndex) {
  const categoryId = category.id;
  const variant = variants[categoryId][style.id];
  const slideId = `uv1-${category.code}-${style.code}`;
  const bodyPoints = variant.body.slice(0, 5);
  const coreMessage = ensureMinText(bodyPoints[0], variant.title);
  const { elements, requests } = buildElements(categoryId, slideId, variant, style);
  const hasImage = requests.length > 0;
  const semanticElements = buildSemanticElements(slideId, categoryId, variant, hasImage);
  const pageRole = pageRoleFor(categoryId);
  const candidates = Array.from(new Set(candidateLayouts[categoryId] ?? [categoryId, "title-body-points"])).slice(0, 3);
  const sortedCandidates = candidates.includes(categoryId)
    ? candidates
    : [categoryId, ...candidates].slice(0, 3);
  const sortOrder = 100 + categoryIndex * 10 + styles.findIndex((item) => item.id === style.id) + 1;

  return {
    sortOrder,
    slide: {
      slideId,
      index: 1,
      content: {
        slideId,
        index: 1,
        title: variant.title,
        subtitle: `${category.label} / ${style.label}`,
        bodyPoints,
        speakerGoal: `帮助管理员快速复用“${variant.title}”模板。`,
        visualIntent: variant.intent,
        coreStatement: coreMessage,
        narrativeRole: categoryId === "ending" ? "summary" : categoryId === "cover-title" || categoryId === "chapter" ? "setup" : "argument",
        contentLayers: {
          primary: [coreMessage],
          supporting: bodyPoints.slice(1).length > 0 ? bodyPoints.slice(1) : [variant.intent],
          supplementary: [`适用场景：${variant.scene}`, style.tone]
        },
        slideTransition: {
          fromPrevious: "作为通用模板页，可承接上一页信息并切换表达节奏。",
          toNext: "可继续扩展为同类型页面或相邻内容页。"
        },
        explanationDepth: "supporting",
        sourceRequirement: {
          required: categoryId.includes("chart") || categoryId === "big-chart",
          categories: categoryId.includes("chart") || categoryId === "big-chart" ? ["data"] : ["user-input"],
          note: categoryId.includes("chart") || categoryId === "big-chart" ? "图表页导入后建议补充数据口径。" : "模板示例不强制注明外部来源。"
        },
        adaptationRules: {
          splitWhen: "当模板内容超过 5 个模块时拆为多页模板。",
          splitCandidates: bodyPoints.slice(0, 3),
          mergeWhen: "当只保留一个模块时可与相邻模板合并。",
          mergeWith: "相邻模板页"
        },
        audienceFocus: {
          lens: categoryId.includes("chart") || categoryId === "big-chart" ? "research-evidence" : "business-conclusion",
          focus: "管理员关注模板是否清晰、稳定，并能快速替换为业务内容。"
        },
        viewerObjective: {
          type: categoryId === "ending" ? "act" : "understand",
          description: `看完本页后，用户应理解“${variant.title}”的适用场景和表达结构。`
        },
        contentBoundary: {
          inScope: "只展示模板结构、占位内容、视觉意图和导入后的可替换区域。",
          outOfScope: ["不展开真实业务内容", "不引入外部数据", "不使用第三方模板资产"]
        }
      },
      pageIntent: {
        audienceTakeaway: coreMessage,
        contentDensity: densityFor(categoryId),
        coreMessage,
        pageRole,
        primaryGoal: primaryGoalFor(categoryId)
      },
      contentHierarchy: buildContentHierarchy(variant.title, bodyPoints, coreMessage, variant.intent),
      layoutSelection: {
        candidates: sortedCandidates.map((layoutType, index) => ({
          fitReason: `${layoutType} 匹配当前 ${category.label} 分类和 ${style.label} 风格。`,
          layoutType,
          risk: index === 0 ? "风险较低，保持信息层级清晰。" : "需要控制正文长度和视觉遮挡。",
          score: Math.max(76, 96 - index * 8)
        })),
        selectedLayoutType: categoryId,
        selectionReason: `固定选择 ${categoryId}，与通用模板分类保持一致。`
      },
      constraints: {
        coreMessagePresent: true,
        densityLimit: densityFor(categoryId),
        maxHeroVisuals: 1,
        renderNotes: [
          "主标题必须唯一并位于安全边距内。",
          "核心表达区必须作为一级信息出现。",
          hasImage ? "图片主体避开标题区，避免遮挡正文。" : "形状和图表占位不得压住正文。"
        ],
        safeMargin: {
          appliesTo: ["主标题", "核心信息", "正文", "图表标签"],
          unit: "inch",
          value: 0.5
        },
        subjectAvoidsTitleArea: true,
        titleUnique: true
      },
      designQualityScore: {
        dimensions: {
          contentDensity: { score: 92, summary: "信息密度与模板用途匹配。" },
          expressionCompleteness: { score: 92, summary: "标题、核心信息和辅助内容完整。" },
          informationHierarchy: { score: 94, summary: "主次层级清晰。" },
          renderability: { score: 94, summary: "元素位于画布范围内。" },
          visualConsistency: { score: 92, summary: "风格说明与页面结构一致。" }
        },
        issues: [],
        repairStatus: "not-needed",
        suggestions: ["导入后按实际业务替换占位文本和图表内容。"],
        totalScore: 93
      },
      expressionIntent: variant.intent,
      designPlan: {
        expressionIntent: variant.intent,
        layoutTemplate: categoryId,
        visualStrategy: `${style.tone} ${variant.intent}`,
        readingOrder: semanticElements.map((element) => element.id).slice(0, 10)
      },
      layoutDiagnostics: {
        density: densityFor(categoryId) === "high" ? 0.7 : densityFor(categoryId) === "low" ? 0.38 : 0.55,
        hasOverflow: false,
        needsUserConfirmation: false,
        overflowFixes: [],
        warnings: []
      },
      semanticElements,
      elements,
      imageLayerRequests: requests,
      canvas
    }
  };
}

function ensureMinText(value, fallback) {
  const normalized = value.trim();

  return normalized.length >= 4 ? normalized : `${fallback}：${normalized}`;
}

function buildTemplate(category, style, categoryIndex) {
  const { sortOrder, slide } = buildSlide(category, style, categoryIndex);
  const variant = variants[category.id][style.id];

  return {
    formatVersion: importFormatVersion,
    name: `${category.label} - ${variant.title}`,
    category: category.id,
    description: `${style.label}模板，适用于${variant.scene}。${variant.intent}`,
    tags: [category.label, style.label, variant.scene],
    sortOrder,
    isEnabled: true,
    slide
  };
}

async function main() {
  const manifest = {
    formatVersion: manifestFormatVersion,
    packageId: "universal-v1",
    packageName: "通用 PPT 模板包 v1",
    templateCount: categories.length * styles.length,
    templates: []
  };

  for (const [categoryIndex, category] of categories.entries()) {
    const categoryDir = path.join(packageDir, category.id);
    await mkdir(categoryDir, { recursive: true });

    for (const style of styles) {
      const template = buildTemplate(category, style, categoryIndex);
      const fileName = `${category.id}-${style.file}.json`;
      const filePath = path.join(categoryDir, fileName);
      const manifestFile = `assets/templates/universal-v1/${category.id}/${fileName}`;

      await writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
      manifest.templates.push({
        category: category.id,
        file: manifestFile,
        id: template.slide.slideId,
        name: template.name,
        sortOrder: template.sortOrder,
        style: style.id,
        styleName: style.label
      });
    }
  }

  await writeFile(
    path.join(packageDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  console.log(`Generated ${manifest.templates.length} templates in ${packageDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
