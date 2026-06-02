export type TemplateElementAssetKindKey =
  | "CONTAINER"
  | "ICON"
  | "LINE"
  | "NAVIGATION"
  | "SHAPE"
  | "TEXT_STYLE";

export type LocalizedAssetText = {
  enUS: string;
  zhCN: string;
};

export type TemplateAssetVariantCategory = {
  key: string;
  label: LocalizedAssetText;
};

export type TemplateAssetSecondaryCategory = {
  key: string;
  label: LocalizedAssetText;
  variants: TemplateAssetVariantCategory[];
};

export type TemplateAssetPrimaryCategory = {
  key: string;
  label: LocalizedAssetText;
  secondaries: TemplateAssetSecondaryCategory[];
};

type VariantDefinition = readonly [key: string, zhCN: string, enUS: string];

type SecondaryDefinition = {
  enUS: string;
  key: string;
  variants: VariantDefinition[];
  zhCN: string;
};

type PrimaryDefinition = {
  enUS: string;
  key: string;
  secondaries: SecondaryDefinition[];
  zhCN: string;
};

export type TemplateAssetCategorySelection = {
  primaryCategory: string | null;
  secondaryCategory: string | null;
  variantKey: string | null;
};

export type TemplateAssetCategoryPreset = TemplateAssetCategorySelection & {
  description: string;
  name: string;
  preview: Record<string, unknown>;
  resource: Record<string, unknown>;
  semanticTags: string[];
  style: Record<string, unknown>;
  tags: string[];
  usageScenarios: string[];
};

export const templateElementAssetCategories: Record<
  TemplateElementAssetKindKey,
  TemplateAssetPrimaryCategory[]
> = {
  CONTAINER: buildCategories([
    primary("content-carrier", "内容承载", "Content Carrier", [
      secondary("text-container", "文本容器", "Text Containers", [
        ["body-text-area", "正文区域", "Body Text Area"],
        ["quote-box", "引用框", "Quote Box"],
        ["conclusion-box", "结论框", "Conclusion Box"]
      ]),
      secondary("media-container", "媒体容器", "Media Containers", [
        ["image-area", "图片区域", "Image Area"],
        ["chart-area", "图表区域", "Chart Area"],
        ["placeholder", "占位符", "Placeholder"]
      ]),
      secondary("hybrid-container", "组合容器", "Hybrid Containers", [
        ["image-text-card", "图文卡片", "Image Text Card"],
        ["metric-card", "指标卡片", "Metric Card"],
        ["summary-card", "摘要卡片", "Summary Card"]
      ])
    ]),
    primary("layout-container", "版式组织", "Layout Containers", [
      secondary("columns", "分栏容器", "Column Containers", [
        ["two-column", "双栏容器", "Two Column"],
        ["three-column", "三栏容器", "Three Column"],
        ["comparison-columns", "对比栏", "Comparison Columns"]
      ]),
      secondary("list-container", "列表容器", "List Containers", [
        ["bullet-list", "要点列表", "Bullet List"],
        ["numbered-list", "编号列表", "Numbered List"],
        ["check-list", "清单列表", "Checklist"]
      ]),
      secondary("emphasis-container", "强调容器", "Emphasis Containers", [
        ["highlight-box", "强调框", "Highlight Box"],
        ["warning-box", "警示框", "Warning Box"],
        ["insight-box", "洞察框", "Insight Box"]
      ])
    ])
  ]),
  ICON: buildCategories([
    primary("navigation-direction", "导航方向", "Navigation & Direction", [
      secondary("page-navigation", "页面导航", "Page Navigation", [
        ["home", "首页", "Home"],
        ["previous-page", "上一页", "Previous Page"],
        ["next-page", "下一页", "Next Page"],
        ["back", "返回", "Back"],
        ["forward", "前进", "Forward"],
        ["top", "回到顶部", "Back to Top"]
      ]),
      secondary("spatial-direction", "空间方向", "Spatial Direction", [
        ["up", "向上", "Up"],
        ["down", "向下", "Down"],
        ["left", "向左", "Left"],
        ["right", "向右", "Right"],
        ["upper-right", "右上", "Upper Right"],
        ["lower-left", "左下", "Lower Left"]
      ]),
      secondary("navigation-control", "导航控制", "Navigation Controls", [
        ["expand", "展开", "Expand"],
        ["collapse", "收起", "Collapse"],
        ["menu", "菜单", "Menu"],
        ["more", "更多", "More"],
        ["close", "关闭", "Close"],
        ["location", "定位", "Location"]
      ])
    ]),
    primary("basic-operation", "基础操作", "Basic Operations", [
      secondary("edit-actions", "编辑操作", "Edit Actions", [
        ["add", "新增", "Add"],
        ["delete", "删除", "Delete"],
        ["edit", "编辑", "Edit"],
        ["copy", "复制", "Copy"],
        ["paste", "粘贴", "Paste"],
        ["save", "保存", "Save"]
      ]),
      secondary("file-transfer", "文件传输", "File Transfer", [
        ["download", "下载", "Download"],
        ["upload", "上传", "Upload"],
        ["import", "导入", "Import"],
        ["export", "导出", "Export"],
        ["print", "打印", "Print"],
        ["share", "分享", "Share"]
      ]),
      secondary("utility-actions", "工具操作", "Utility Actions", [
        ["search", "搜索", "Search"],
        ["filter", "筛选", "Filter"],
        ["sort", "排序", "Sort"],
        ["refresh", "刷新", "Refresh"],
        ["undo", "撤销", "Undo"],
        ["redo", "重做", "Redo"]
      ])
    ]),
    primary("status-feedback", "状态反馈", "Status Feedback", [
      secondary("result-status", "结果状态", "Result Status", [
        ["success", "成功", "Success"],
        ["failure", "失败", "Failure"],
        ["error", "错误", "Error"],
        ["warning", "警告", "Warning"],
        ["info", "信息", "Info"],
        ["question", "疑问", "Question"]
      ]),
      secondary("progress-status", "处理状态", "Progress Status", [
        ["loading", "加载", "Loading"],
        ["processing", "处理中", "Processing"],
        ["completed", "已完成", "Completed"],
        ["incomplete", "未完成", "Incomplete"],
        ["ongoing", "进行中", "Ongoing"],
        ["paused", "暂停", "Paused"]
      ]),
      secondary("risk-status", "可用与风险", "Availability & Risk", [
        ["enabled", "启用", "Enabled"],
        ["disabled", "禁用", "Disabled"],
        ["abnormal", "异常", "Abnormal"],
        ["risk", "风险", "Risk"],
        ["safe", "安全", "Safe"],
        ["unavailable", "不可用", "Unavailable"]
      ])
    ]),
    primary("time-progress", "时间进度", "Time & Progress", [
      secondary("time-object", "时间对象", "Time Objects", [
        ["time", "时间", "Time"],
        ["date", "日期", "Date"],
        ["calendar", "日历", "Calendar"],
        ["clock", "时钟", "Clock"],
        ["countdown", "倒计时", "Countdown"],
        ["cycle", "周期", "Cycle"]
      ]),
      secondary("timeline-progress", "进度表达", "Timeline Progress", [
        ["history", "历史", "History"],
        ["future", "未来", "Future"],
        ["progress", "进度", "Progress"],
        ["stage", "阶段", "Stage"],
        ["milestone", "里程碑", "Milestone"],
        ["timeline", "时间轴", "Timeline"]
      ]),
      secondary("schedule-action", "计划动作", "Schedule Actions", [
        ["deadline", "截止", "Deadline"],
        ["delay", "延期", "Delay"],
        ["reminder", "提醒", "Reminder"],
        ["plan", "计划", "Plan"],
        ["schedule", "排期", "Schedule"],
        ["wait", "等待", "Wait"]
      ])
    ]),
    primary("data-metrics", "数据指标", "Data & Metrics", [
      secondary("data-carrier", "数据载体", "Data Carriers", [
        ["data", "数据", "Data"],
        ["report", "报表", "Report"],
        ["chart", "图表", "Chart"],
        ["database", "数据库", "Database"],
        ["table", "表格", "Table"],
        ["dashboard", "看板", "Dashboard"]
      ]),
      secondary("metric-meaning", "指标含义", "Metric Meaning", [
        ["trend", "趋势", "Trend"],
        ["growth", "增长", "Growth"],
        ["decline", "下降", "Decline"],
        ["ratio", "占比", "Ratio"],
        ["ranking", "排名", "Ranking"],
        ["kpi", "KPI", "KPI"]
      ]),
      secondary("analysis-method", "分析方式", "Analysis Methods", [
        ["comparison", "对比", "Comparison"],
        ["statistics", "统计", "Statistics"],
        ["analysis", "分析", "Analysis"],
        ["insight", "洞察", "Insight"],
        ["indicator", "指标", "Indicator"],
        ["ranking-list", "排行", "Ranking List"]
      ])
    ]),
    primary("business-finance", "业务财务", "Business & Finance", [
      secondary("finance-result", "财务结果", "Financial Results", [
        ["money", "金钱", "Money"],
        ["revenue", "收入", "Revenue"],
        ["cost", "成本", "Cost"],
        ["profit", "利润", "Profit"],
        ["budget", "预算", "Budget"],
        ["cash-flow", "现金流", "Cash Flow"]
      ]),
      secondary("transaction-doc", "交易单据", "Transaction Documents", [
        ["order", "订单", "Order"],
        ["contract", "合同", "Contract"],
        ["invoice", "发票", "Invoice"],
        ["quote", "报价", "Quote"],
        ["payment", "支付", "Payment"],
        ["refund", "退款", "Refund"]
      ]),
      secondary("business-growth", "业务增长", "Business Growth", [
        ["account", "账户", "Account"],
        ["investment", "投资", "Investment"],
        ["asset", "资产", "Asset"],
        ["sales", "销售", "Sales"],
        ["conversion", "转化", "Conversion"],
        ["settlement", "结算", "Settlement"]
      ])
    ]),
    primary("organization-people", "组织人员", "Organization & People", [
      secondary("people-role", "人员角色", "People & Roles", [
        ["user", "用户", "User"],
        ["customer", "客户", "Customer"],
        ["team", "团队", "Team"],
        ["member", "成员", "Member"],
        ["admin", "管理员", "Admin"],
        ["role", "角色", "Role"]
      ]),
      secondary("organization-structure", "组织结构", "Organization Structure", [
        ["permission", "权限", "Permission"],
        ["org-chart", "组织架构", "Org Chart"],
        ["leader", "领导", "Leader"],
        ["employee", "员工", "Employee"],
        ["partner", "合作伙伴", "Partner"],
        ["group", "群组", "Group"]
      ]),
      secondary("people-work", "人员协作", "People Collaboration", [
        ["meeting", "会议", "Meeting"],
        ["collaboration", "协作", "Collaboration"],
        ["assignment", "分工", "Assignment"],
        ["recruiting", "招聘", "Recruiting"],
        ["training", "培训", "Training"],
        ["responsibility", "职责", "Responsibility"]
      ])
    ]),
    primary("communication-collaboration", "沟通协作", "Communication & Collaboration", [
      secondary("message-channel", "消息渠道", "Message Channels", [
        ["message", "消息", "Message"],
        ["email", "邮件", "Email"],
        ["notification", "通知", "Notification"],
        ["announcement", "公告", "Announcement"],
        ["phone", "电话", "Phone"],
        ["support", "客服", "Support"]
      ]),
      secondary("discussion-feedback", "讨论反馈", "Discussion & Feedback", [
        ["dialogue", "对话", "Dialogue"],
        ["comment", "评论", "Comment"],
        ["feedback", "反馈", "Feedback"],
        ["qa", "问答", "Q&A"],
        ["discussion", "讨论", "Discussion"],
        ["approval", "审批", "Approval"]
      ]),
      secondary("media-communication", "音视频沟通", "Media Communication", [
        ["microphone", "麦克风", "Microphone"],
        ["video", "视频", "Video"],
        ["live", "直播", "Live"],
        ["voice", "语音", "Voice"],
        ["workflow", "流转", "Workflow"],
        ["meeting-room", "会议室", "Meeting Room"]
      ])
    ]),
    primary("document-content", "文档内容", "Documents & Content", [
      secondary("file-type", "文件类型", "File Types", [
        ["document", "文档", "Document"],
        ["file", "文件", "File"],
        ["folder", "文件夹", "Folder"],
        ["attachment", "附件", "Attachment"],
        ["ppt", "PPT", "PPT"],
        ["pdf", "PDF", "PDF"]
      ]),
      secondary("content-structure", "内容结构", "Content Structure", [
        ["note", "笔记", "Note"],
        ["checklist", "清单", "Checklist"],
        ["catalog", "目录", "Catalog"],
        ["bookmark", "书签", "Bookmark"],
        ["title", "标题", "Title"],
        ["paragraph", "段落", "Paragraph"]
      ]),
      secondary("content-asset", "内容资产", "Content Assets", [
        ["reference", "引用", "Reference"],
        ["template", "模板", "Template"],
        ["material", "素材", "Material"],
        ["version", "版本", "Version"],
        ["archive", "归档", "Archive"],
        ["draft", "草稿", "Draft"]
      ])
    ]),
    primary("presentation-demo", "展示演示", "Presentation & Demo", [
      secondary("presentation-device", "演示设备", "Presentation Devices", [
        ["projector", "投影", "Projector"],
        ["screen", "屏幕", "Screen"],
        ["canvas", "画布", "Canvas"],
        ["slide", "幻灯片", "Slide"],
        ["stage", "舞台", "Stage"],
        ["spotlight", "聚焦", "Spotlight"]
      ]),
      secondary("playback-control", "播放控制", "Playback Controls", [
        ["play", "播放", "Play"],
        ["pause", "暂停", "Pause"],
        ["stop", "停止", "Stop"],
        ["record", "录制", "Record"],
        ["preview", "预览", "Preview"],
        ["fullscreen", "全屏", "Fullscreen"]
      ]),
      secondary("presentation-emphasis", "演示强调", "Presentation Emphasis", [
        ["speech", "演讲", "Speech"],
        ["highlight", "高亮", "Highlight"],
        ["annotation", "标注", "Annotation"],
        ["zoom-in", "放大", "Zoom In"],
        ["zoom-out", "缩小", "Zoom Out"],
        ["explain", "讲解", "Explain"]
      ])
    ]),
    primary("design-editing", "设计编辑", "Design & Editing", [
      secondary("visual-style", "视觉样式", "Visual Style", [
        ["color", "颜色", "Color"],
        ["palette", "调色板", "Palette"],
        ["font", "字体", "Font"],
        ["typography", "排版", "Typography"],
        ["image", "图片", "Image"],
        ["style", "样式", "Style"]
      ]),
      secondary("transform-layout", "变换布局", "Transform & Layout", [
        ["crop", "裁剪", "Crop"],
        ["rotate", "旋转", "Rotate"],
        ["align", "对齐", "Align"],
        ["distribute", "分布", "Distribute"],
        ["layer", "图层", "Layer"],
        ["layout", "布局", "Layout"]
      ]),
      secondary("design-tool", "设计工具", "Design Tools", [
        ["component", "组件", "Component"],
        ["brush", "画笔", "Brush"],
        ["eyedropper", "吸管", "Eyedropper"],
        ["grid", "网格", "Grid"],
        ["ruler", "标尺", "Ruler"],
        ["opacity", "透明度", "Opacity"]
      ])
    ]),
    primary("chart-analysis", "图表分析", "Chart Analysis", [
      secondary("chart-type", "图表类型", "Chart Types", [
        ["bar-chart", "柱状图", "Bar Chart"],
        ["line-chart", "折线图", "Line Chart"],
        ["pie-chart", "饼图", "Pie Chart"],
        ["area-chart", "面积图", "Area Chart"],
        ["scatter-chart", "散点图", "Scatter Chart"],
        ["radar-chart", "雷达图", "Radar Chart"]
      ]),
      secondary("advanced-chart", "高级图表", "Advanced Charts", [
        ["funnel-chart", "漏斗图", "Funnel Chart"],
        ["gantt-chart", "甘特图", "Gantt Chart"],
        ["heatmap", "热力图", "Heatmap"],
        ["relation-chart", "关系图", "Relation Chart"],
        ["distribution-chart", "分布图", "Distribution Chart"],
        ["matrix-chart", "矩阵图", "Matrix Chart"]
      ]),
      secondary("analysis-purpose", "分析目的", "Analysis Purpose", [
        ["trend-analysis", "趋势分析", "Trend Analysis"],
        ["structure-analysis", "结构分析", "Structure Analysis"],
        ["distribution-analysis", "分布分析", "Distribution Analysis"],
        ["comparison-analysis", "对比分析", "Comparison Analysis"],
        ["correlation-analysis", "关联分析", "Correlation Analysis"],
        ["ranking-analysis", "排名分析", "Ranking Analysis"]
      ])
    ]),
    primary("process-structure", "流程结构", "Process & Structure", [
      secondary("process-node", "流程节点", "Process Nodes", [
        ["start", "开始", "Start"],
        ["end", "结束", "End"],
        ["step", "步骤", "Step"],
        ["branch", "分支", "Branch"],
        ["decision", "判断", "Decision"],
        ["loop", "循环", "Loop"]
      ]),
      secondary("flow-io", "输入输出", "Input & Output", [
        ["connection", "连接", "Connection"],
        ["input", "输入", "Input"],
        ["output", "输出", "Output"],
        ["node", "节点", "Node"],
        ["path", "路径", "Path"],
        ["automation", "自动化", "Automation"]
      ]),
      secondary("process-result", "流程结果", "Process Results", [
        ["approval-flow", "审批", "Approval"],
        ["task", "任务", "Task"],
        ["funnel", "漏斗", "Funnel"],
        ["closed-loop", "闭环", "Closed Loop"],
        ["iteration", "迭代", "Iteration"],
        ["exception-flow", "异常流程", "Exception Flow"]
      ])
    ]),
    primary("goal-strategy", "目标战略", "Goals & Strategy", [
      secondary("strategy-direction", "战略方向", "Strategic Direction", [
        ["goal", "目标", "Goal"],
        ["vision", "愿景", "Vision"],
        ["strategy", "战略", "Strategy"],
        ["direction", "方向", "Direction"],
        ["flag", "旗帜", "Flag"],
        ["target", "靶心", "Target"]
      ]),
      secondary("strategy-plan", "战略计划", "Strategic Plan", [
        ["roadmap", "路线图", "Roadmap"],
        ["opportunity", "机会", "Opportunity"],
        ["challenge", "挑战", "Challenge"],
        ["priority", "优先级", "Priority"],
        ["execution", "执行", "Execution"],
        ["review", "复盘", "Review"]
      ]),
      secondary("strategy-result", "战略结果", "Strategic Results", [
        ["competition", "竞争", "Competition"],
        ["advantage", "优势", "Advantage"],
        ["breakthrough", "突破", "Breakthrough"],
        ["growth-result", "增长", "Growth"],
        ["achievement", "成果", "Achievement"],
        ["win", "胜利", "Win"]
      ])
    ]),
    primary("product-feature", "产品功能", "Products & Features", [
      secondary("product-structure", "产品结构", "Product Structure", [
        ["product", "产品", "Product"],
        ["feature", "功能", "Feature"],
        ["module", "模块", "Module"],
        ["component-feature", "组件", "Component"],
        ["version-feature", "版本", "Version"],
        ["release", "发布", "Release"]
      ]),
      secondary("product-delivery", "产品交付", "Product Delivery", [
        ["iteration-feature", "迭代", "Iteration"],
        ["upgrade", "升级", "Upgrade"],
        ["bug", "Bug", "Bug"],
        ["fix", "修复", "Fix"],
        ["test", "测试", "Test"],
        ["acceptance", "验收", "Acceptance"]
      ]),
      secondary("product-input", "产品输入", "Product Input", [
        ["requirement", "需求", "Requirement"],
        ["prototype", "原型", "Prototype"],
        ["experience", "体验", "Experience"],
        ["api", "API", "API"],
        ["plugin", "插件", "Plugin"],
        ["integration", "集成", "Integration"]
      ])
    ]),
    primary("technical-system", "技术系统", "Technical Systems", [
      secondary("development-tech", "开发技术", "Development Tech", [
        ["code", "代码", "Code"],
        ["development", "开发", "Development"],
        ["server", "服务器", "Server"],
        ["cloud", "云", "Cloud"],
        ["ai", "AI", "AI"],
        ["algorithm", "算法", "Algorithm"]
      ]),
      secondary("system-component", "系统组件", "System Components", [
        ["model", "模型", "Model"],
        ["chip", "芯片", "Chip"],
        ["network", "网络", "Network"],
        ["interface", "接口", "Interface"],
        ["terminal", "终端", "Terminal"],
        ["storage", "存储", "Storage"]
      ]),
      secondary("system-operation", "系统运行", "System Operations", [
        ["system-database", "数据库", "Database"],
        ["tech-security", "安全", "Security"],
        ["encryption", "加密", "Encryption"],
        ["tech-automation", "自动化", "Automation"],
        ["ops", "运维", "Ops"],
        ["monitoring", "监控", "Monitoring"]
      ])
    ]),
    primary("security-compliance", "安全合规", "Security & Compliance", [
      secondary("security-protection", "安全保护", "Security Protection", [
        ["shield", "盾牌", "Shield"],
        ["security", "安全", "Security"],
        ["privacy", "隐私", "Privacy"],
        ["protection", "保护", "Protection"],
        ["authentication", "认证", "Authentication"],
        ["authorization", "授权", "Authorization"]
      ]),
      secondary("risk-compliance", "风险合规", "Risk & Compliance", [
        ["audit", "审计", "Audit"],
        ["risk-alert", "风险", "Risk"],
        ["alert", "告警", "Alert"],
        ["vulnerability", "漏洞", "Vulnerability"],
        ["compliance", "合规", "Compliance"],
        ["legal", "法务", "Legal"]
      ]),
      secondary("rule-recovery", "规则恢复", "Rules & Recovery", [
        ["rule", "规则", "Rule"],
        ["standard", "标准", "Standard"],
        ["certificate", "证书", "Certificate"],
        ["backup", "备份", "Backup"],
        ["recovery", "恢复", "Recovery"],
        ["access-control", "访问控制", "Access Control"]
      ])
    ]),
    primary("industry-scenario", "行业场景", "Industry Scenarios", [
      secondary("core-industry", "核心行业", "Core Industries", [
        ["medical", "医疗", "Medical"],
        ["finance", "金融", "Finance"],
        ["education", "教育", "Education"],
        ["manufacturing", "制造", "Manufacturing"],
        ["retail", "零售", "Retail"],
        ["ecommerce", "电商", "Ecommerce"]
      ]),
      secondary("public-industry", "公共与产业", "Public & Industrial", [
        ["logistics", "物流", "Logistics"],
        ["real-estate", "地产", "Real Estate"],
        ["government", "政务", "Government"],
        ["energy", "能源", "Energy"],
        ["agriculture", "农业", "Agriculture"],
        ["tourism", "文旅", "Tourism"]
      ]),
      secondary("service-industry", "服务行业", "Service Industries", [
        ["catering", "餐饮", "Catering"],
        ["automotive", "汽车", "Automotive"],
        ["media", "传媒", "Media"],
        ["game", "游戏", "Game"],
        ["consulting", "咨询", "Consulting"],
        ["legal-service", "法律", "Legal"]
      ])
    ]),
    primary("emotion-review", "情绪评价", "Emotion & Review", [
      secondary("preference", "偏好反馈", "Preference Feedback", [
        ["satisfied", "满意", "Satisfied"],
        ["unsatisfied", "不满", "Unsatisfied"],
        ["like", "喜欢", "Like"],
        ["favorite", "收藏", "Favorite"],
        ["thumb-up", "赞", "Thumb Up"],
        ["thumb-down", "踩", "Thumb Down"]
      ]),
      secondary("rating-emotion", "评分情绪", "Rating & Emotion", [
        ["rating", "评分", "Rating"],
        ["star", "星级", "Star"],
        ["happy", "开心", "Happy"],
        ["confused", "疑惑", "Confused"],
        ["nervous", "紧张", "Nervous"],
        ["angry", "愤怒", "Angry"]
      ]),
      secondary("review-result", "评价结果", "Review Results", [
        ["motivation", "激励", "Motivation"],
        ["recognition", "认可", "Recognition"],
        ["praise", "表扬", "Praise"],
        ["complaint", "投诉", "Complaint"],
        ["reputation", "口碑", "Reputation"],
        ["review", "评价", "Review"]
      ])
    ]),
    primary("general-symbol", "通用符号", "General Symbols", [
      secondary("math-symbol", "数学符号", "Math Symbols", [
        ["plus", "加", "Plus"],
        ["minus", "减", "Minus"],
        ["multiply", "乘", "Multiply"],
        ["divide", "除", "Divide"],
        ["equal", "等于", "Equal"],
        ["check", "勾", "Check"]
      ]),
      secondary("mark-symbol", "标记符号", "Mark Symbols", [
        ["cross", "叉", "Cross"],
        ["exclamation", "感叹号", "Exclamation"],
        ["question-mark", "问号", "Question Mark"],
        ["asterisk", "星号", "Asterisk"],
        ["dot", "圆点", "Dot"],
        ["label", "标签", "Label"]
      ]),
      secondary("annotation-symbol", "注释符号", "Annotation Symbols", [
        ["flag-mark", "旗标", "Flag"],
        ["number", "编号", "Number"],
        ["sequence", "序号", "Sequence"],
        ["quote-symbol", "引用", "Quote"],
        ["placeholder", "占位", "Placeholder"],
        ["unknown", "未知", "Unknown"]
      ])
    ])
  ]),
  SHAPE: buildCategories([
    primary("basic-geometry", "基础几何", "Basic Geometry", [
      secondary("rect-geometry", "矩形几何", "Rectangular Geometry", [
        ["rect", "矩形", "Rectangle"],
        ["rounded-rect", "圆角矩形", "Rounded Rectangle"],
        ["square", "正方形", "Square"],
        ["parallelogram", "平行四边形", "Parallelogram"]
      ]),
      secondary("round-geometry", "圆形几何", "Round Geometry", [
        ["circle", "圆形", "Circle"],
        ["ellipse", "椭圆", "Ellipse"],
        ["sector", "扇形", "Sector"],
        ["arc", "弧形", "Arc"]
      ]),
      secondary("polygon-geometry", "多边形几何", "Polygon Geometry", [
        ["triangle", "三角形", "Triangle"],
        ["diamond", "菱形", "Diamond"],
        ["trapezoid", "梯形", "Trapezoid"],
        ["hexagon", "六边形", "Hexagon"]
      ])
    ]),
    primary("content-container", "内容容器", "Content Containers", [
      secondary("text-container", "文本容器", "Text Containers", [
        ["title-container", "标题容器", "Title Container"],
        ["body-container", "正文容器", "Body Container"],
        ["quote-container", "引用容器", "Quote Container"],
        ["note-container", "备注容器", "Note Container"]
      ]),
      secondary("media-container", "媒体容器", "Media Containers", [
        ["image-container", "图片容器", "Image Container"],
        ["text-image-container", "图文容器", "Text Image Container"],
        ["data-container", "数据容器", "Data Container"],
        ["table-container", "表格容器", "Table Container"]
      ]),
      secondary("page-container", "页面容器", "Page Containers", [
        ["header-container", "页眉容器", "Header Container"],
        ["footer-container", "页脚容器", "Footer Container"],
        ["placeholder-container", "占位容器", "Placeholder Container"],
        ["list-container", "列表容器", "List Container"]
      ])
    ]),
    primary("info-card", "信息卡片", "Information Cards", [
      secondary("entity-card", "实体卡片", "Entity Cards", [
        ["person-card", "人物卡片", "Person Card"],
        ["product-card", "产品卡片", "Product Card"],
        ["case-card", "案例卡片", "Case Card"],
        ["customer-card", "客户卡片", "Customer Card"]
      ]),
      secondary("metric-card", "指标卡片", "Metric Cards", [
        ["data-card", "数据卡片", "Data Card"],
        ["metric-card", "指标卡片", "Metric Card"],
        ["advantage-card", "优势卡片", "Advantage Card"],
        ["risk-card", "风险卡片", "Risk Card"]
      ]),
      secondary("content-card", "内容卡片", "Content Cards", [
        ["feature-card", "功能卡片", "Feature Card"],
        ["solution-card", "方案卡片", "Solution Card"],
        ["problem-card", "问题卡片", "Problem Card"],
        ["summary-card", "摘要卡片", "Summary Card"]
      ])
    ]),
    primary("emphasis-shape", "强调图形", "Emphasis Shapes", [
      secondary("highlight-block", "高亮强调", "Highlight Blocks", [
        ["highlight-block", "高亮块", "Highlight Block"],
        ["focus-frame", "重点框", "Focus Frame"],
        ["tip-block", "提示块", "Tip Block"],
        ["warning-block", "警告块", "Warning Block"]
      ]),
      secondary("marker-block", "标记装饰", "Marker Blocks", [
        ["label-block", "标签块", "Label Block"],
        ["corner-label", "角标", "Corner Label"],
        ["badge", "徽章", "Badge"],
        ["ribbon", "飘带", "Ribbon"]
      ]),
      secondary("emphasis-frame", "圈选强调", "Emphasis Frames", [
        ["stamp", "印章", "Stamp"],
        ["selection-frame", "圈选框", "Selection Frame"],
        ["underline-block", "下划强调块", "Underline Block"],
        ["background-emphasis", "背景强调块", "Background Emphasis"]
      ])
    ]),
    primary("process-node", "流程节点", "Process Nodes", [
      secondary("terminal-node", "起止节点", "Terminal Nodes", [
        ["start-node", "开始节点", "Start Node"],
        ["end-node", "结束节点", "End Node"],
        ["input-node", "输入节点", "Input Node"],
        ["output-node", "输出节点", "Output Node"]
      ]),
      secondary("action-node", "动作节点", "Action Nodes", [
        ["step-node", "步骤节点", "Step Node"],
        ["process-node", "处理节点", "Process Node"],
        ["approval-node", "审批节点", "Approval Node"],
        ["task-node", "任务节点", "Task Node"]
      ]),
      secondary("logic-node", "逻辑节点", "Logic Nodes", [
        ["decision-node", "判断节点", "Decision Node"],
        ["branch-node", "分支节点", "Branch Node"],
        ["merge-node", "汇合节点", "Merge Node"],
        ["exception-node", "异常节点", "Exception Node"]
      ])
    ]),
    primary("structure-relationship", "结构关系", "Structure Relationships", [
      secondary("hierarchy-structure", "层级结构", "Hierarchy Structure", [
        ["hierarchy-box", "层级框", "Hierarchy Box"],
        ["org-structure-box", "组织结构框", "Org Structure Box"],
        ["pyramid-box", "金字塔结构框", "Pyramid Box"],
        ["nested-box", "包含结构框", "Nested Box"]
      ]),
      secondary("logic-structure", "逻辑结构", "Logic Structure", [
        ["parallel-box", "并列结构框", "Parallel Box"],
        ["summary-detail-box", "总分结构框", "Summary Detail Box"],
        ["cause-effect-box", "因果结构框", "Cause Effect Box"],
        ["progressive-box", "递进结构框", "Progressive Box"]
      ]),
      secondary("comparison-structure", "对比结构", "Comparison Structure", [
        ["compare-box", "对比结构框", "Compare Box"],
        ["matrix-box", "矩阵结构框", "Matrix Box"],
        ["quadrant-box", "四象限结构框", "Quadrant Box"],
        ["relationship-box", "关系结构框", "Relationship Box"]
      ])
    ]),
    primary("time-progress", "时间进度", "Time & Progress", [
      secondary("time-node", "时间节点", "Time Nodes", [
        ["time-node", "时间节点", "Time Node"],
        ["milestone-node", "里程碑节点", "Milestone Node"],
        ["timeline-node", "时间轴节点", "Timeline Node"],
        ["roadmap-node", "路线图节点", "Roadmap Node"]
      ]),
      secondary("time-block", "时间块", "Time Blocks", [
        ["stage-block", "阶段块", "Stage Block"],
        ["progress-block", "进度块", "Progress Block"],
        ["cycle-block", "周期块", "Cycle Block"],
        ["countdown-block", "倒计时块", "Countdown Block"]
      ]),
      secondary("plan-block", "计划块", "Plan Blocks", [
        ["plan-block", "计划块", "Plan Block"],
        ["version-node", "版本节点", "Version Node"],
        ["schedule-block", "排期块", "Schedule Block"],
        ["future-block", "未来块", "Future Block"]
      ])
    ]),
    primary("data-display", "数据展示", "Data Display", [
      secondary("metric-block", "指标块", "Metric Blocks", [
        ["metric-block", "指标块", "Metric Block"],
        ["number-block", "数字块", "Number Block"],
        ["ratio-block", "占比块", "Ratio Block"],
        ["ranking-block", "排名块", "Ranking Block"]
      ]),
      secondary("analysis-block", "分析块", "Analysis Blocks", [
        ["trend-block", "趋势块", "Trend Block"],
        ["compare-block", "对比块", "Compare Block"],
        ["statistics-block", "统计块", "Statistics Block"],
        ["kpi-block", "KPI 块", "KPI Block"]
      ]),
      secondary("progress-widget", "进度组件", "Progress Widgets", [
        ["dashboard-widget", "仪表盘组件", "Dashboard Widget"],
        ["progress-ring", "进度环", "Progress Ring"],
        ["progress-bar", "进度条", "Progress Bar"],
        ["rating-block", "评分块", "Rating Block"]
      ])
    ]),
    primary("chart-helper", "图表辅助", "Chart Helpers", [
      secondary("chart-label", "图表标签", "Chart Labels", [
        ["legend-block", "图例块", "Legend Block"],
        ["axis-label-block", "坐标轴标签块", "Axis Label Block"],
        ["data-label-block", "数据标注块", "Data Label Block"],
        ["range-label", "区间标注", "Range Label"]
      ]),
      secondary("chart-marker", "图表标注", "Chart Markers", [
        ["peak-marker", "峰值标注", "Peak Marker"],
        ["average-marker", "均值标注", "Average Marker"],
        ["growth-marker", "增长标注", "Growth Marker"],
        ["decline-marker", "下降标注", "Decline Marker"]
      ]),
      secondary("chart-exception", "异常标注", "Exception Markers", [
        ["exception-marker", "异常标注", "Exception Marker"],
        ["baseline-marker", "基准标注", "Baseline Marker"],
        ["target-marker", "目标标注", "Target Marker"],
        ["comparison-marker", "对比标注", "Comparison Marker"]
      ])
    ]),
    primary("page-layout", "页面版式", "Page Layout", [
      secondary("title-layout", "标题区域", "Title Areas", [
        ["cover-title-area", "封面标题区", "Cover Title Area"],
        ["chapter-title-area", "章节标题区", "Chapter Title Area"],
        ["content-column-area", "内容分栏区", "Content Column Area"],
        ["blank-area", "留白占位区", "Blank Area"]
      ]),
      secondary("layout-block", "布局块", "Layout Blocks", [
        ["left-right-layout", "左右布局块", "Left Right Layout"],
        ["top-bottom-layout", "上下布局块", "Top Bottom Layout"],
        ["grid-layout", "宫格布局块", "Grid Layout"],
        ["matrix-layout", "矩阵布局块", "Matrix Layout"]
      ]),
      secondary("page-layer", "页面层", "Page Layers", [
        ["background-layer", "背景层", "Background Layer"],
        ["mask-layer", "蒙版层", "Mask Layer"],
        ["decorative-layer", "装饰层", "Decorative Layer"],
        ["content-layer", "内容层", "Content Layer"]
      ])
    ]),
    primary("navigation-indicator", "导航指示", "Navigation Indicators", [
      secondary("page-position", "页面位置", "Page Position", [
        ["page-number-block", "页码块", "Page Number Block"],
        ["catalog-item", "目录项", "Catalog Item"],
        ["breadcrumb-block", "面包屑块", "Breadcrumb Block"],
        ["current-position", "当前位置标识", "Current Position"]
      ]),
      secondary("progress-navigation", "进度导航", "Progress Navigation", [
        ["progress-navigation", "进度导航", "Progress Navigation"],
        ["chapter-navigation", "章节导航", "Chapter Navigation"],
        ["step-navigation", "步骤导航", "Step Navigation"],
        ["section-tab", "章节标签", "Section Tab"]
      ]),
      secondary("navigation-entry", "导航入口", "Navigation Entries", [
        ["previous-step-block", "上一步块", "Previous Step Block"],
        ["next-step-block", "下一步块", "Next Step Block"],
        ["return-entry-block", "返回入口块", "Return Entry Block"],
        ["jump-entry-block", "跳转入口块", "Jump Entry Block"]
      ])
    ]),
    primary("decorative-shape", "装饰图形", "Decorative Shapes", [
      secondary("color-decoration", "色彩装饰", "Color Decoration", [
        ["color-block", "色块", "Color Block"],
        ["gradient-block", "渐变块", "Gradient Block"],
        ["texture-block", "纹理块", "Texture Block"],
        ["light-effect-block", "光效块", "Light Effect Block"]
      ]),
      secondary("pattern-decoration", "纹样装饰", "Pattern Decoration", [
        ["wave-block", "波浪块", "Wave Block"],
        ["diagonal-block", "斜切块", "Diagonal Block"],
        ["dot-block", "圆点块", "Dot Block"],
        ["grid-block", "网格块", "Grid Block"]
      ]),
      secondary("geometry-decoration", "几何装饰", "Geometry Decoration", [
        ["geometry-decoration", "几何装饰", "Geometry Decoration"],
        ["background-decoration", "背景装饰", "Background Decoration"],
        ["corner-decoration", "边角装饰", "Corner Decoration"],
        ["frame-decoration", "框线装饰", "Frame Decoration"]
      ])
    ]),
    primary("brand-visual", "品牌视觉", "Brand Visuals", [
      secondary("brand-identity", "品牌标识", "Brand Identity", [
        ["logo-placeholder", "Logo 占位", "Logo Placeholder"],
        ["brand-color-block", "品牌色块", "Brand Color Block"],
        ["brand-label", "品牌标签", "Brand Label"],
        ["brand-mark-base", "品牌标识底板", "Brand Mark Base"]
      ]),
      secondary("brand-message", "品牌信息", "Brand Message", [
        ["slogan-block", "Slogan 区块", "Slogan Block"],
        ["brand-title-block", "品牌标题块", "Brand Title Block"],
        ["brand-statement-block", "品牌宣言块", "Brand Statement Block"],
        ["brand-footer-block", "品牌页脚块", "Brand Footer Block"]
      ]),
      secondary("brand-graphic", "品牌图形", "Brand Graphics", [
        ["visual-main-shape", "视觉主形", "Visual Main Shape"],
        ["brand-helper-shape", "品牌辅助图形", "Brand Helper Shape"],
        ["cover-visual-block", "封面主视觉块", "Cover Visual Block"],
        ["brand-pattern-block", "品牌纹样块", "Brand Pattern Block"]
      ])
    ]),
    primary("scene-component", "场景组件", "Scene Components", [
      secondary("device-frame", "设备框", "Device Frames", [
        ["phone-frame", "手机框", "Phone Frame"],
        ["computer-frame", "电脑框", "Computer Frame"],
        ["browser-frame", "浏览器框", "Browser Frame"],
        ["screen-frame", "屏幕框", "Screen Frame"]
      ]),
      secondary("work-scene", "工作场景", "Work Scenes", [
        ["map-block", "地图块", "Map Block"],
        ["dashboard-block", "仪表盘块", "Dashboard Block"],
        ["kanban-block", "看板块", "Kanban Block"],
        ["chat-box", "聊天框", "Chat Box"]
      ]),
      secondary("document-scene", "文档场景", "Document Scenes", [
        ["file-card", "文件卡", "File Card"],
        ["sticky-note", "便签", "Sticky Note"],
        ["whiteboard", "白板", "Whiteboard"],
        ["bulletin-board", "公告栏", "Bulletin Board"]
      ])
    ]),
    primary("status-component", "状态组件", "Status Components", [
      secondary("result-component", "结果组件", "Result Components", [
        ["success-block", "成功状态块", "Success Block"],
        ["failure-block", "失败状态块", "Failure Block"],
        ["warning-status-block", "警告状态块", "Warning Status Block"],
        ["empty-state-block", "空状态块", "Empty State Block"]
      ]),
      secondary("runtime-component", "运行组件", "Runtime Components", [
        ["loading-state-block", "加载状态块", "Loading State Block"],
        ["disabled-state-block", "禁用状态块", "Disabled State Block"],
        ["ongoing-state-block", "进行中", "Ongoing State"],
        ["paused-state-block", "暂停", "Paused State"]
      ]),
      secondary("completion-component", "完成组件", "Completion Components", [
        ["completed-state-block", "已完成", "Completed State"],
        ["incomplete-state-block", "未完成", "Incomplete State"],
        ["abnormal-state-block", "异常", "Abnormal State"],
        ["risk-state-block", "风险状态块", "Risk State Block"]
      ])
    ]),
    primary("business-component", "业务组件", "Business Components", [
      secondary("transaction-component", "交易组件", "Transaction Components", [
        ["order-block", "订单块", "Order Block"],
        ["contract-block", "合同块", "Contract Block"],
        ["invoice-block", "发票块", "Invoice Block"],
        ["budget-block", "预算块", "Budget Block"]
      ]),
      secondary("finance-component", "财务组件", "Finance Components", [
        ["sales-block", "销售块", "Sales Block"],
        ["profit-block", "利润块", "Profit Block"],
        ["cost-block", "成本块", "Cost Block"],
        ["customer-block", "客户块", "Customer Block"]
      ]),
      secondary("delivery-component", "交付组件", "Delivery Components", [
        ["project-block", "项目块", "Project Block"],
        ["task-block", "任务块", "Task Block"],
        ["approval-block", "审批块", "Approval Block"],
        ["delivery-block", "交付块", "Delivery Block"]
      ])
    ]),
    primary("education-training", "教育培训", "Education & Training", [
      secondary("learning-content", "学习内容", "Learning Content", [
        ["knowledge-block", "知识点块", "Knowledge Block"],
        ["course-block", "课程块", "Course Block"],
        ["note-block", "笔记块", "Note Block"],
        ["key-point-block", "重点块", "Key Point Block"]
      ]),
      secondary("learning-activity", "学习活动", "Learning Activities", [
        ["practice-block", "练习块", "Practice Block"],
        ["exam-block", "考试块", "Exam Block"],
        ["homework-box", "作业框", "Homework Box"],
        ["qa-box", "问答框", "Q&A Box"]
      ]),
      secondary("learning-result", "学习成果", "Learning Results", [
        ["certificate-block", "证书块", "Certificate Block"],
        ["classroom-block", "课堂块", "Classroom Block"],
        ["explain-box", "讲解框", "Explain Box"],
        ["score-block", "成绩块", "Score Block"]
      ])
    ]),
    primary("technical-system", "技术系统", "Technical Systems", [
      secondary("system-module", "系统模块", "System Modules", [
        ["module-block", "模块块", "Module Block"],
        ["service-block", "服务块", "Service Block"],
        ["interface-block", "接口块", "Interface Block"],
        ["database-block", "数据库块", "Database Block"]
      ]),
      secondary("system-platform", "系统平台", "System Platforms", [
        ["cloud-service-block", "云服务块", "Cloud Service Block"],
        ["terminal-block", "终端块", "Terminal Block"],
        ["algorithm-block", "算法块", "Algorithm Block"],
        ["model-block", "模型块", "Model Block"]
      ]),
      secondary("system-operation", "系统运行", "System Operations", [
        ["security-block", "安全块", "Security Block"],
        ["monitoring-block", "监控块", "Monitoring Block"],
        ["log-block", "日志块", "Log Block"],
        ["deployment-block", "部署块", "Deployment Block"]
      ])
    ])
  ]),
  LINE: buildCategories([
    primary("basic-line", "基础线条", "Basic Lines", [
      secondary("straight-line", "直线方向", "Straight Lines", [
        ["straight-line", "直线", "Straight Line"],
        ["horizontal-line", "横线", "Horizontal Line"],
        ["vertical-line", "竖线", "Vertical Line"],
        ["diagonal-line", "斜线", "Diagonal Line"]
      ]),
      secondary("curve-line", "曲折线", "Curved Lines", [
        ["polyline", "折线", "Polyline"],
        ["curve-line", "曲线", "Curve Line"],
        ["arc-line", "弧线", "Arc Line"],
        ["wave-line", "波浪线", "Wave Line"]
      ]),
      secondary("line-style", "线型样式", "Line Styles", [
        ["dashed-line", "虚线", "Dashed Line"],
        ["dotted-line", "点线", "Dotted Line"],
        ["double-line", "双线", "Double Line"],
        ["bold-line", "粗线", "Bold Line"]
      ])
    ]),
    primary("divider-line", "分割线", "Divider Lines", [
      secondary("text-divider", "文本分割", "Text Dividers", [
        ["title-divider", "标题分割线", "Title Divider"],
        ["paragraph-divider", "段落分割线", "Paragraph Divider"],
        ["content-divider", "内容分割线", "Content Divider"],
        ["module-divider", "模块分割线", "Module Divider"]
      ]),
      secondary("layout-divider", "布局分割", "Layout Dividers", [
        ["left-right-divider", "左右分割线", "Left Right Divider"],
        ["top-bottom-divider", "上下分割线", "Top Bottom Divider"],
        ["header-divider", "页眉分割线", "Header Divider"],
        ["footer-divider", "页脚分割线", "Footer Divider"]
      ]),
      secondary("data-divider", "数据分割", "Data Dividers", [
        ["table-divider", "表格分割线", "Table Divider"],
        ["card-divider", "卡片分割线", "Card Divider"],
        ["axis-divider", "坐标分割线", "Axis Divider"],
        ["section-divider", "章节分割线", "Section Divider"]
      ])
    ]),
    primary("connector-line", "连接线", "Connector Lines", [
      secondary("element-connector", "元素连接", "Element Connectors", [
        ["element-connector", "元素连接线", "Element Connector"],
        ["node-connector", "节点连接线", "Node Connector"],
        ["card-connector", "卡片连接线", "Card Connector"],
        ["image-text-connector", "图文连接线", "Image Text Connector"]
      ]),
      secondary("data-connector", "数据连接", "Data Connectors", [
        ["data-connector", "数据连接线", "Data Connector"],
        ["hierarchy-connector", "层级连接线", "Hierarchy Connector"],
        ["remote-connector", "远程连接线", "Remote Connector"],
        ["local-connector", "局部连接线", "Local Connector"]
      ]),
      secondary("page-connector", "跨域连接", "Cross Area Connectors", [
        ["cross-page-connector", "跨页连接线", "Cross Page Connector"],
        ["section-connector", "区域连接线", "Section Connector"],
        ["logic-connector", "逻辑连接线", "Logic Connector"],
        ["dependency-connector", "依赖连接线", "Dependency Connector"]
      ])
    ]),
    primary("arrow-line", "箭头线", "Arrow Lines", [
      secondary("arrow-direction", "箭头方向", "Arrow Direction", [
        ["one-way-arrow", "单向箭头", "One Way Arrow"],
        ["two-way-arrow", "双向箭头", "Two Way Arrow"],
        ["no-arrow-line", "无箭头", "No Arrow"],
        ["right-arrow", "右箭头", "Right Arrow"]
      ]),
      secondary("spatial-arrow", "空间箭头", "Spatial Arrows", [
        ["left-arrow", "左箭头", "Left Arrow"],
        ["up-arrow", "上箭头", "Up Arrow"],
        ["down-arrow", "下箭头", "Down Arrow"],
        ["turn-arrow", "转向箭头", "Turn Arrow"]
      ]),
      secondary("motion-arrow", "运动箭头", "Motion Arrows", [
        ["return-arrow", "回流箭头", "Return Arrow"],
        ["loop-arrow", "循环箭头", "Loop Arrow"],
        ["jump-arrow", "跳转箭头", "Jump Arrow"],
        ["flow-arrow", "流向箭头", "Flow Arrow"]
      ])
    ]),
    primary("process-line", "流程线", "Process Lines", [
      secondary("business-process", "业务流程", "Business Process", [
        ["step-flow-line", "步骤流程线", "Step Flow Line"],
        ["approval-flow-line", "审批流程线", "Approval Flow Line"],
        ["business-flow-line", "业务流程线", "Business Flow Line"],
        ["automation-flow-line", "自动化流程线", "Automation Flow Line"]
      ]),
      secondary("production-process", "生产流程", "Production Process", [
        ["data-flow-line", "数据流程线", "Data Flow Line"],
        ["production-flow-line", "生产流程线", "Production Flow Line"],
        ["main-flow-line", "主流程线", "Main Flow Line"],
        ["branch-flow-line", "分支流程线", "Branch Flow Line"]
      ]),
      secondary("exception-process", "异常流程", "Exception Process", [
        ["exception-flow-line", "异常流程线", "Exception Flow Line"],
        ["closed-loop-line", "闭环流程线", "Closed Loop Line"],
        ["rollback-flow-line", "回退流程线", "Rollback Flow Line"],
        ["iteration-flow-line", "迭代流程线", "Iteration Flow Line"]
      ])
    ]),
    primary("timeline-line", "时间线", "Timeline Lines", [
      secondary("timeline-direction", "时间线方向", "Timeline Direction", [
        ["horizontal-timeline", "横向时间线", "Horizontal Timeline"],
        ["vertical-timeline", "纵向时间线", "Vertical Timeline"],
        ["stage-timeline", "阶段时间线", "Stage Timeline"],
        ["milestone-line", "里程碑线", "Milestone Line"]
      ]),
      secondary("evolution-line", "演进线", "Evolution Lines", [
        ["version-evolution-line", "版本演进线", "Version Evolution Line"],
        ["plan-line", "计划线", "Plan Line"],
        ["history-line", "历史线", "History Line"],
        ["future-line", "未来线", "Future Line"]
      ]),
      secondary("cycle-line", "周期线", "Cycle Lines", [
        ["cycle-line", "周期线", "Cycle Line"],
        ["countdown-line", "倒计时线", "Countdown Line"],
        ["schedule-line", "排期线", "Schedule Line"],
        ["release-line", "发布线", "Release Line"]
      ])
    ]),
    primary("relationship-line", "关系线", "Relationship Lines", [
      secondary("structure-relation", "结构关系", "Structure Relations", [
        ["hierarchy-relation-line", "层级关系线", "Hierarchy Relation Line"],
        ["parallel-relation-line", "并列关系线", "Parallel Relation Line"],
        ["include-relation-line", "包含关系线", "Include Relation Line"],
        ["dependency-relation-line", "依赖关系线", "Dependency Relation Line"]
      ]),
      secondary("logic-relation", "逻辑关系", "Logic Relations", [
        ["cause-effect-line", "因果关系线", "Cause Effect Line"],
        ["comparison-relation-line", "对比关系线", "Comparison Relation Line"],
        ["impact-relation-line", "影响关系线", "Impact Relation Line"],
        ["mapping-relation-line", "映射关系线", "Mapping Relation Line"]
      ]),
      secondary("association-relation", "关联关系", "Association Relations", [
        ["association-line", "关联关系线", "Association Line"],
        ["reference-line", "引用关系线", "Reference Line"],
        ["sync-relation-line", "同步关系线", "Sync Relation Line"],
        ["ownership-line", "归属关系线", "Ownership Line"]
      ])
    ]),
    primary("indicator-line", "指示线", "Indicator Lines", [
      secondary("annotation-indicator", "标注指示", "Annotation Indicators", [
        ["annotation-line", "标注指示线", "Annotation Line"],
        ["focus-indicator-line", "重点指示线", "Focus Indicator Line"],
        ["explain-indicator-line", "说明指示线", "Explain Indicator Line"],
        ["note-leader-line", "说明牵引线", "Note Leader Line"]
      ]),
      secondary("data-indicator", "数据指示", "Data Indicators", [
        ["data-indicator-line", "数据指示线", "Data Indicator Line"],
        ["image-indicator-line", "图片指示线", "Image Indicator Line"],
        ["zoom-indicator-line", "局部放大指示线", "Zoom Indicator Line"],
        ["reference-indicator-line", "引用指示线", "Reference Indicator Line"]
      ]),
      secondary("comment-indicator", "注释指示", "Comment Indicators", [
        ["comment-indicator-line", "注释指示线", "Comment Indicator Line"],
        ["label-leader-line", "标签牵引线", "Label Leader Line"],
        ["callout-line", "引出线", "Callout Line"],
        ["pin-line", "定位指示线", "Pin Line"]
      ])
    ]),
    primary("chart-axis-line", "坐标与图表线", "Chart & Axis Lines", [
      secondary("axis-grid", "坐标网格", "Axis & Grid", [
        ["axis-line", "坐标轴线", "Axis Line"],
        ["grid-line", "网格线", "Grid Line"],
        ["baseline", "基准线", "Baseline"],
        ["average-line", "均值线", "Average Line"]
      ]),
      secondary("trend-chart-line", "趋势线", "Trend Lines", [
        ["trend-line", "趋势线", "Trend Line"],
        ["growth-line", "增长线", "Growth Line"],
        ["decline-line", "下降线", "Decline Line"],
        ["peak-line", "峰值线", "Peak Line"]
      ]),
      secondary("range-chart-line", "区间线", "Range Lines", [
        ["range-line", "区间线", "Range Line"],
        ["error-line", "误差线", "Error Line"],
        ["boundary-line", "边界线", "Boundary Line"],
        ["reference-line", "参考线", "Reference Line"]
      ])
    ]),
    primary("path-line", "路径线", "Path Lines", [
      secondary("geo-path", "地图路径", "Map Paths", [
        ["route-line", "路线线", "Route Line"],
        ["map-path-line", "地图路径线", "Map Path Line"],
        ["navigation-path-line", "导航路径线", "Navigation Path Line"],
        ["logistics-path-line", "物流路径线", "Logistics Path Line"]
      ]),
      secondary("journey-path", "旅程路径", "Journey Paths", [
        ["user-journey-line", "用户旅程线", "User Journey Line"],
        ["conversion-path-line", "转化路径线", "Conversion Path Line"],
        ["learning-path-line", "学习路径线", "Learning Path Line"],
        ["service-path-line", "服务路径线", "Service Path Line"]
      ]),
      secondary("strategy-path", "战略路径", "Strategy Paths", [
        ["strategy-route-line", "战略路线线", "Strategy Route Line"],
        ["product-route-line", "产品路线线", "Product Route Line"],
        ["roadmap-path-line", "路线图路径线", "Roadmap Path Line"],
        ["delivery-path-line", "交付路径线", "Delivery Path Line"]
      ])
    ]),
    primary("border-line", "边框线", "Border Lines", [
      secondary("content-border", "内容边框", "Content Borders", [
        ["card-border", "卡片边框", "Card Border"],
        ["image-border", "图片边框", "Image Border"],
        ["table-border", "表格边框", "Table Border"],
        ["container-border", "容器边框", "Container Border"]
      ]),
      secondary("emphasis-border", "强调边框", "Emphasis Borders", [
        ["title-border", "标题边框", "Title Border"],
        ["emphasis-border", "强调边框", "Emphasis Border"],
        ["dashed-border", "虚线边框", "Dashed Border"],
        ["rounded-border", "圆角边框", "Rounded Border"]
      ]),
      secondary("focus-border", "重点框线", "Focus Borders", [
        ["focus-border", "重点框线", "Focus Border"],
        ["warning-border", "警示边框", "Warning Border"],
        ["selection-border", "选中边框", "Selection Border"],
        ["brand-border", "品牌边框", "Brand Border"]
      ])
    ]),
    primary("decorative-line", "装饰线", "Decorative Lines", [
      secondary("corner-decoration-line", "边角装饰", "Corner Decoration", [
        ["corner-line", "角线", "Corner Line"],
        ["edge-corner-line", "边角线", "Edge Corner Line"],
        ["pattern-line", "花纹线", "Pattern Line"],
        ["wave-decoration-line", "波浪装饰线", "Wave Decoration Line"]
      ]),
      secondary("tech-decoration-line", "科技装饰", "Tech Decoration", [
        ["tech-line", "科技线", "Tech Line"],
        ["light-effect-line", "光效线", "Light Effect Line"],
        ["speed-line", "速度线", "Speed Line"],
        ["background-texture-line", "背景纹理线", "Background Texture Line"]
      ]),
      secondary("art-decoration-line", "艺术装饰", "Art Decoration", [
        ["hand-drawn-line", "手绘线", "Hand Drawn Line"],
        ["draft-line", "草稿线", "Draft Line"],
        ["art-line", "艺术线", "Art Line"],
        ["brand-helper-line", "品牌辅助线", "Brand Helper Line"]
      ])
    ]),
    primary("emphasis-line", "强调线", "Emphasis Lines", [
      secondary("text-emphasis-line", "文本强调", "Text Emphasis", [
        ["underline", "下划线", "Underline"],
        ["highlight-line", "高亮线", "Highlight Line"],
        ["strike-through", "删除线", "Strike Through"],
        ["comment-line", "批注线", "Comment Line"]
      ]),
      secondary("focus-emphasis-line", "聚焦强调", "Focus Emphasis", [
        ["selection-line", "圈选线", "Selection Line"],
        ["focus-line", "聚焦线", "Focus Line"],
        ["warning-line", "警示线", "Warning Line"],
        ["key-line", "重点线", "Key Line"]
      ]),
      secondary("result-emphasis-line", "结果强调", "Result Emphasis", [
        ["title-emphasis-line", "标题强调线", "Title Emphasis Line"],
        ["number-emphasis-line", "数字强调线", "Number Emphasis Line"],
        ["conclusion-emphasis-line", "结论强调线", "Conclusion Emphasis Line"],
        ["quote-emphasis-line", "引用强调线", "Quote Emphasis Line"]
      ])
    ]),
    primary("system-architecture-line", "系统架构线", "System Architecture Lines", [
      secondary("data-call-line", "数据调用", "Data & Calls", [
        ["architecture-data-flow", "数据流线", "Architecture Data Flow"],
        ["call-line", "调用线", "Call Line"],
        ["sync-line", "同步线", "Sync Line"],
        ["async-line", "异步线", "Async Line"]
      ]),
      secondary("network-service-line", "网络服务", "Network & Services", [
        ["network-connection-line", "网络连接线", "Network Connection Line"],
        ["service-dependency-line", "服务依赖线", "Service Dependency Line"],
        ["interface-connection-line", "接口连接线", "Interface Connection Line"],
        ["deployment-connection-line", "部署连接线", "Deployment Connection Line"]
      ]),
      secondary("security-operation-line", "安全运维", "Security & Operations", [
        ["security-boundary-line", "安全边界线", "Security Boundary Line"],
        ["monitoring-chain-line", "监控链路线", "Monitoring Chain Line"],
        ["backup-link-line", "备份链路线", "Backup Link Line"],
        ["gateway-line", "网关边界线", "Gateway Boundary Line"]
      ])
    ])
  ]),
  NAVIGATION: buildCategories([
    primary("deck-navigation", "整套导航", "Deck Navigation", [
      secondary("table-of-contents", "目录", "Table of Contents", [
        ["toc-list", "目录列表", "TOC List"],
        ["toc-grid", "目录网格", "TOC Grid"],
        ["toc-sidebar", "侧边目录", "TOC Sidebar"]
      ]),
      secondary("section-marker", "章节标识", "Section Markers", [
        ["chapter-title", "章节标题", "Chapter Title"],
        ["section-divider", "分节页标识", "Section Divider"],
        ["current-section", "当前位置", "Current Section"]
      ]),
      secondary("page-index", "页码", "Page Index", [
        ["page-number", "页码", "Page Number"],
        ["page-total", "页码/总页数", "Page Total"],
        ["footer-index", "页脚页码", "Footer Index"]
      ])
    ]),
    primary("progress-navigation", "进度导航", "Progress Navigation", [
      secondary("progress-bar", "进度条", "Progress Bars", [
        ["linear-progress", "线性进度条", "Linear Progress"],
        ["chapter-progress", "章节进度条", "Chapter Progress"],
        ["dot-progress", "圆点进度", "Dot Progress"]
      ]),
      secondary("step-indicator", "步骤编号", "Step Indicators", [
        ["step-number", "步骤编号", "Step Number"],
        ["current-step", "当前步骤", "Current Step"],
        ["completed-step", "已完成步骤", "Completed Step"]
      ])
    ])
  ]),
  TEXT_STYLE: buildCategories([
    primary("title-hierarchy", "标题层级", "Title Hierarchy", [
      secondary("deck-title", "整套标题", "Deck Titles", [
        ["cover-title", "封面主标题", "Cover Title"],
        ["cover-subtitle", "封面副标题", "Cover Subtitle"],
        ["chapter-title", "章节标题", "Chapter Title"]
      ]),
      secondary("page-heading", "页面标题", "Page Headings", [
        ["page-title", "页标题", "Page Title"],
        ["section-heading", "小标题", "Section Heading"],
        ["label-heading", "标签标题", "Label Heading"]
      ])
    ]),
    primary("body-hierarchy", "正文层级", "Body Hierarchy", [
      secondary("body-text", "正文", "Body Text", [
        ["paragraph", "正文段落", "Paragraph"],
        ["bullet-point", "要点", "Bullet Point"],
        ["annotation", "注释/来源", "Annotation"]
      ]),
      secondary("special-text", "特殊文本", "Special Text", [
        ["quote", "引用", "Quote"],
        ["tag", "标签", "Tag"],
        ["number-emphasis", "数字强调", "Number Emphasis"]
      ]),
      secondary("header-footer", "页眉页脚", "Header & Footer", [
        ["header", "页眉", "Header"],
        ["footer", "页脚", "Footer"],
        ["source-note", "来源说明", "Source Note"]
      ])
    ])
  ])
};

export function getTemplateAssetCategories(kind: TemplateElementAssetKindKey) {
  return templateElementAssetCategories[kind] ?? [];
}

export function getLocalizedAssetText(
  text: LocalizedAssetText,
  locale?: string
) {
  return locale === "en-US" ? text.enUS : text.zhCN;
}

export function findTemplateAssetCategoryPath(
  kind: TemplateElementAssetKindKey,
  selection: TemplateAssetCategorySelection
) {
  const primary = getTemplateAssetCategories(kind).find(
    (item) => item.key === selection.primaryCategory
  );
  const secondary = primary?.secondaries.find(
    (item) => item.key === selection.secondaryCategory
  );
  const variant = secondary?.variants.find(
    (item) => item.key === selection.variantKey
  );

  return {
    primary,
    secondary,
    variant
  };
}

export function getDefaultTemplateAssetCategorySelection(
  kind: TemplateElementAssetKindKey
): TemplateAssetCategorySelection {
  const primary = getTemplateAssetCategories(kind)[0] ?? null;
  const secondary = primary?.secondaries[0] ?? null;
  const variant = secondary?.variants[0] ?? null;

  return {
    primaryCategory: primary?.key ?? null,
    secondaryCategory: secondary?.key ?? null,
    variantKey: variant?.key ?? null
  };
}

export function buildTemplateAssetCategoryPreset(
  kind: TemplateElementAssetKindKey,
  selection: TemplateAssetCategorySelection,
  locale?: string
): TemplateAssetCategoryPreset | null {
  const path = findTemplateAssetCategoryPath(kind, selection);

  if (!path.primary || !path.secondary || !path.variant) {
    return null;
  }

  const kindLabel = getKindLabel(kind, locale);
  const primaryLabel = getLocalizedAssetText(path.primary.label, locale);
  const secondaryLabel = getLocalizedAssetText(path.secondary.label, locale);
  const variantLabel = getLocalizedAssetText(path.variant.label, locale);
  const englishVariantLabel = path.variant.label.enUS;
  const variantKey = selection.variantKey ?? "";
  const secondaryKey = selection.secondaryCategory ?? "";
  const style = buildDefaultStyle(kind, variantKey, secondaryKey);
  const preview = buildDefaultPreview(kind, variantKey, secondaryKey);
  const resource = buildDefaultResource(kind, variantKey, secondaryKey);

  return {
    description:
      locale === "en-US"
        ? `${englishVariantLabel} asset for ${secondaryLabel} in ${primaryLabel}.`
        : `用于${primaryLabel}中的${secondaryLabel}表达，适合${variantLabel}场景。`,
    name:
      locale === "en-US"
        ? `${englishVariantLabel} ${kindLabel}`
        : `${variantLabel}${kindLabel}`,
    preview,
    primaryCategory: selection.primaryCategory,
    resource,
    secondaryCategory: selection.secondaryCategory,
    semanticTags: uniqueStrings([
      variantLabel,
      secondaryLabel,
      primaryLabel,
      path.variant.key,
      path.secondary.key
    ]),
    style,
    tags: uniqueStrings([
      kindLabel,
      primaryLabel,
      secondaryLabel,
      locale === "en-US" ? "Universal Set" : "通用套装",
      locale === "en-US" ? "Minimal" : "极简",
      locale === "en-US" ? "Light background" : "浅色背景可用"
    ]),
    usageScenarios: uniqueStrings([
      primaryLabel,
      secondaryLabel,
      locale === "en-US" ? "Template workspace" : "模板工作区",
      locale === "en-US" ? "AI generation reference" : "AI 生成检索"
    ]),
    variantKey: selection.variantKey
  };
}

function buildCategories(
  definitions: PrimaryDefinition[]
): TemplateAssetPrimaryCategory[] {
  return definitions.map((item) => ({
    key: item.key,
    label: {
      enUS: item.enUS,
      zhCN: item.zhCN
    },
    secondaries: item.secondaries.map((secondaryItem) => ({
      key: secondaryItem.key,
      label: {
        enUS: secondaryItem.enUS,
        zhCN: secondaryItem.zhCN
      },
      variants: secondaryItem.variants.map(([key, zhCN, enUS]) => ({
        key,
        label: {
          enUS,
          zhCN
        }
      }))
    }))
  }));
}

function primary(
  key: string,
  zhCN: string,
  enUS: string,
  secondaries: SecondaryDefinition[]
): PrimaryDefinition {
  return {
    enUS,
    key,
    secondaries,
    zhCN
  };
}

function secondary(
  key: string,
  zhCN: string,
  enUS: string,
  variants: VariantDefinition[]
): SecondaryDefinition {
  return {
    enUS,
    key,
    variants,
    zhCN
  };
}

function getKindLabel(kind: TemplateElementAssetKindKey, locale?: string) {
  if (kind === "CONTAINER") {
    return locale === "en-US" ? "Container" : "容器";
  }

  if (kind === "ICON") {
    return locale === "en-US" ? "Icon" : "图标";
  }

  if (kind === "LINE") {
    return locale === "en-US" ? "Line" : "线条";
  }

  if (kind === "NAVIGATION") {
    return locale === "en-US" ? "Navigation" : "导航";
  }

  if (kind === "SHAPE") {
    return locale === "en-US" ? "Shape" : "图形";
  }

  return locale === "en-US" ? "Text Style" : "文本样式";
}

function buildDefaultStyle(
  kind: TemplateElementAssetKindKey,
  variantKey: string,
  secondaryKey = ""
): Record<string, unknown> {
  if (kind === "ICON") {
    return {
      cornerRadius: 12,
      fillMode: variantKey.includes("filled") ? "solid" : "none",
      strokeColor: "#2563eb",
      strokeWidth: 2
    };
  }

  if (kind === "SHAPE") {
    return {
      cornerRadius: pickShapeCornerRadius(variantKey),
      fillColor: "#dbeafe",
      strokeColor: "#2563eb",
      strokeWidth: 1
    };
  }

  if (kind === "TEXT_STYLE") {
    return {
      color: "#111827",
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: variantKey.includes("title") ? 32 : 18,
      fontWeight: variantKey.includes("title") ? 700 : 400,
      lineHeight: 1.25,
      maxLines: variantKey.includes("title") ? 2 : 5,
      textRole: variantKey
    };
  }

  if (kind === "CONTAINER") {
    return {
      allowedContentTypes: ["text"],
      autoLayout: variantKey.includes("column") || variantKey.includes("list"),
      containerRole: variantKey,
      fillColor: "#f8fafc",
      padding: 18,
      recommendedHeight: 160,
      recommendedWidth: 320,
      strokeColor: "#cbd5e1",
      strokeWidth: 1
    };
  }

  if (kind === "NAVIGATION") {
    return {
      activeColor: "#2563eb",
      displayMode: pickNavigationDisplayMode(variantKey, secondaryKey),
      fixedPosition: variantKey.includes("footer") ? "bottom" : "top",
      inactiveColor: "#94a3b8",
      navigationRole: variantKey,
      showOnCover: false,
      showOnEnding: false
    };
  }

  return {
    cap: "round",
    connectorType: pickLineConnectorType(variantKey, secondaryKey),
    dash: pickLineDash(variantKey, secondaryKey),
    direction: pickLineDirection(variantKey, secondaryKey),
    endArrowType: pickLineEndArrow(variantKey),
    startArrowType: pickLineStartArrow(variantKey),
    strokeColor: "#2563eb",
    strokeWidth: variantKey.includes("bold") ? 4 : 2
  };
}

function buildDefaultPreview(
  kind: TemplateElementAssetKindKey,
  variantKey: string,
  secondaryKey = ""
): Record<string, unknown> {
  if (kind === "ICON") {
    return {
      iconName: variantKey,
      shape: "lineIcon"
    };
  }

  if (kind === "SHAPE") {
    return {
      shape: pickShapePreviewType(variantKey)
    };
  }

  if (kind === "TEXT_STYLE") {
    return {
      sampleText: pickTextStyleSample(variantKey),
      shape: "textStyle",
      textRole: variantKey
    };
  }

  if (kind === "CONTAINER") {
    return {
      containerRole: variantKey,
      shape: pickContainerPreviewType(variantKey)
    };
  }

  if (kind === "NAVIGATION") {
    return {
      displayMode: pickNavigationDisplayMode(variantKey, secondaryKey),
      navigationRole: variantKey,
      shape: pickNavigationPreviewType(variantKey)
    };
  }

  return {
    direction: pickLineDirection(variantKey, secondaryKey),
    lineType: pickLinePreviewType(variantKey, secondaryKey)
  };
}

function buildDefaultResource(
  kind: TemplateElementAssetKindKey,
  variantKey: string,
  secondaryKey = ""
): Record<string, unknown> {
  if (kind === "TEXT_STYLE") {
    return {
      textRole: variantKey,
      type: "typography-token"
    };
  }

  if (kind === "CONTAINER") {
    return {
      containerRole: variantKey,
      type: "layout-container"
    };
  }

  if (kind === "NAVIGATION") {
    return {
      navigationRole: variantKey,
      type: "deck-navigation"
    };
  }

  if (kind !== "LINE") {
    return {};
  }

  return {
    connectorType: pickLineConnectorType(variantKey, secondaryKey),
    direction: pickLineDirection(variantKey, secondaryKey),
    endArrowType: pickLineEndArrow(variantKey),
    startArrowType: pickLineStartArrow(variantKey),
    type: "ppt-line"
  };
}

function pickShapeCornerRadius(variantKey: string) {
  if (
    variantKey.includes("circle") ||
    variantKey.includes("ellipse") ||
    variantKey.includes("pill")
  ) {
    return 999;
  }

  if (variantKey.includes("rounded") || variantKey.includes("card")) {
    return 14;
  }

  return 8;
}

function pickShapePreviewType(variantKey: string) {
  if (variantKey === "rect") {
    return "rect";
  }

  if (variantKey.includes("parallelogram")) {
    return "parallelogram";
  }

  if (variantKey.includes("trapezoid")) {
    return "trapezoid";
  }

  if (variantKey.includes("hexagon")) {
    return "hexagon";
  }

  if (variantKey.includes("square")) {
    return "square";
  }

  if (variantKey.includes("sector")) {
    return "sector";
  }

  if (variantKey.includes("arc")) {
    return "arc";
  }

  if (variantKey.includes("circle")) {
    return "circle";
  }

  if (variantKey.includes("ellipse")) {
    return "ellipse";
  }

  if (variantKey.includes("pill")) {
    return "pill";
  }

  if (variantKey.includes("triangle")) {
    return "triangle";
  }

  if (variantKey.includes("diamond")) {
    return "diamond";
  }

  if (variantKey.includes("card") || variantKey.includes("block")) {
    return "card";
  }

  return "roundedRect";
}

function pickLinePreviewType(variantKey: string, secondaryKey = "") {
  if (variantKey.includes("wave")) {
    return "wave";
  }

  if (variantKey.includes("vertical")) {
    return "vertical";
  }

  if (variantKey.includes("diagonal")) {
    return "diagonal";
  }

  if (variantKey.includes("polyline")) {
    return "polyline";
  }

  if (variantKey.includes("curve") || variantKey.includes("loop")) {
    return "curve";
  }

  if (variantKey.includes("arc")) {
    return "arc";
  }

  if (variantKey.includes("double")) {
    return "double";
  }

  if (variantKey.includes("arrow") && !variantKey.includes("no-arrow")) {
    return "arrow";
  }

  if (variantKey.includes("divider")) {
    return "divider";
  }

  if (
    variantKey.includes("turn") ||
    variantKey.includes("elbow") ||
    variantKey.includes("connector") ||
    variantKey.includes("leader") ||
    secondaryKey.includes("relation")
  ) {
    return "elbow";
  }

  if (variantKey.includes("dashed") || variantKey.includes("dotted")) {
    return "straight";
  }

  return "straight";
}

function pickLineConnectorType(variantKey: string, secondaryKey = "") {
  const lineType = pickLinePreviewType(variantKey, secondaryKey);

  if (lineType === "curve" || lineType === "arc" || lineType === "wave") {
    return "curved";
  }

  if (lineType === "elbow" || lineType === "polyline") {
    return "elbow";
  }

  return "straight";
}

function pickLineDash(variantKey: string, secondaryKey = "") {
  if (variantKey.includes("dot")) {
    return "dot";
  }

  if (
    variantKey.includes("dash") ||
    variantKey.includes("draft") ||
    secondaryKey.includes("decorative")
  ) {
    return "dash";
  }

  return "solid";
}

function pickLineDirection(variantKey: string, secondaryKey = "") {
  if (variantKey.includes("left-arrow") || variantKey.includes("return")) {
    return "left";
  }

  if (variantKey.includes("up-arrow")) {
    return "up";
  }

  if (variantKey.includes("down-arrow")) {
    return "down";
  }

  if (variantKey.includes("vertical") || variantKey.includes("top-bottom")) {
    return "vertical";
  }

  if (variantKey.includes("diagonal") || variantKey.includes("decline")) {
    return "diagonal";
  }

  if (
    variantKey.includes("polyline") ||
    variantKey.includes("turn") ||
    variantKey.includes("elbow") ||
    variantKey.includes("connector") ||
    variantKey.includes("leader") ||
    secondaryKey.includes("relation")
  ) {
    return "polyline";
  }

  if (variantKey.includes("curve") || variantKey.includes("loop")) {
    return "curve";
  }

  if (variantKey.includes("arc")) {
    return "arc";
  }

  if (variantKey.includes("wave")) {
    return "wave";
  }

  return "horizontal";
}

function pickLineEndArrow(variantKey: string) {
  if (variantKey.includes("no-arrow")) {
    return "none";
  }

  if (
    variantKey.includes("arrow") ||
    variantKey.includes("flow") ||
    variantKey.includes("route") ||
    variantKey.includes("dependency")
  ) {
    return "triangle";
  }

  return "none";
}

function pickLineStartArrow(variantKey: string) {
  if (variantKey.includes("no-arrow")) {
    return "none";
  }

  if (
    variantKey.includes("two-way") ||
    variantKey.includes("cycle") ||
    variantKey.includes("loop")
  ) {
    return "triangle";
  }

  return "none";
}

function pickContainerPreviewType(variantKey: string) {
  if (variantKey.includes("column")) {
    return "columns";
  }

  if (variantKey.includes("metric")) {
    return "metric";
  }

  if (variantKey.includes("image")) {
    return "image";
  }

  if (variantKey.includes("chart")) {
    return "chart";
  }

  if (variantKey.includes("list") || variantKey.includes("check")) {
    return "list";
  }

  if (variantKey.includes("quote")) {
    return "quote";
  }

  return "container";
}

function pickTextStyleSample(variantKey: string) {
  if (variantKey.includes("number")) {
    return "86%";
  }

  if (variantKey.includes("tag")) {
    return "标签";
  }

  if (variantKey.includes("quote")) {
    return "核心洞察";
  }

  if (variantKey.includes("footer") || variantKey.includes("source")) {
    return "来源说明";
  }

  if (variantKey.includes("annotation")) {
    return "注释说明";
  }

  if (variantKey.includes("bullet")) {
    return "关键要点";
  }

  if (variantKey.includes("subtitle")) {
    return "战略简报副标题";
  }

  if (variantKey.includes("title") || variantKey.includes("heading")) {
    return "标题层级";
  }

  return "正文样式";
}

function pickNavigationDisplayMode(variantKey: string, secondaryKey = "") {
  if (variantKey.includes("grid")) {
    return "grid";
  }

  if (variantKey.includes("toc")) {
    return "list";
  }

  if (secondaryKey.includes("progress") || variantKey.includes("progress")) {
    return "progress";
  }

  if (secondaryKey.includes("step") || variantKey.includes("step")) {
    return "step";
  }

  return "label";
}

function pickNavigationPreviewType(variantKey: string) {
  if (variantKey.includes("grid")) {
    return "grid-navigation";
  }

  if (variantKey.includes("toc")) {
    return "toc-navigation";
  }

  if (variantKey.includes("progress")) {
    return "progress";
  }

  if (variantKey.includes("step")) {
    return "step-navigation";
  }

  if (variantKey.includes("page") || variantKey.includes("footer")) {
    return "page-navigation";
  }

  return "navigation";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 16);
}
