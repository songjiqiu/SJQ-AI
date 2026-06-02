# 管理端 PPT 模板库

管理端提供“模板工作区”，模板管理路径为 `/{locale}/admin/templates`。该页面只允许管理员访问，普通用户访问管理端路由会回到创作工作台。

模板工作区顶部提供七个入口：模板管理、图标管理、图形管理、线条管理、文本样式管理、容器组件管理和导航组件管理。`/{locale}/admin/templates` 继续保留原 PPT 模板管理能力，不迁移旧路由；语义元素资源分别位于 `/{locale}/admin/templates/icons`、`/{locale}/admin/templates/shapes`、`/{locale}/admin/templates/lines`、`/{locale}/admin/templates/text-styles`、`/{locale}/admin/templates/containers` 和 `/{locale}/admin/templates/navigation`。

## 固定分类

首版模板库使用固定分类：章节页、封面大标题、标题 + 正文/要点、大图背景、左图右文、左文右图、左文右图表、大图表、双栏对比、引用/金句页、时间轴、流程/步骤、关键指标页、四象限/矩阵、结束页。数据库仍保留 `customCategoryKey` 与 `customCategoryName`，用于后续扩展自定义分类。

旧分类会在读取和保存时平滑归一到新分类：`cover` 归入 `cover-title`，`title` 与 `body` 归入 `title-body-points`，`big-number-conclusion` 归入 `key-metrics`，`timeline` 归入 `time-axis`。

通用模板库 v1 的设计规范见 [通用 PPT 模板设计规范](./universal-ppt-template-spec.md)。该规范基于当前 15 个固定分类规划 45 套通用模板方案，每类覆盖“中国商务通用”“AI 科技感”“极简咨询风”三种风格。静态 JSON 包位于 `assets/templates/universal-v1/`，既可通过现有“新建模板 > 导入 JSON”入口按单个文件导入，也可在模板库顶部点击“导入通用模板”一键批量导入。

## 数据模型

模板数据保存在 Prisma `PptTemplate` 表中。核心字段包括分类、模板名称、说明、标签、排序、启用状态和完整 `SlideCompositionPlan` 页面 JSON。创建模板时如果没有传入 `slide`，服务端会复制对应分类的默认样板。

保存模板会使用现有 `slideCompositionPlanSchema` 校验。页面坐标继续使用 inch，画布固定为 `13.333 x 7.5` 的 16:9；图片元素必须通过 `imageRequestId` 关联 `imageLayerRequests`。

语义元素资产保存在 Prisma `TemplateElementAsset` 表中，`kind` 使用 `ICON`、`SHAPE`、`LINE`、`TEXT_STYLE`、`CONTAINER`、`NAVIGATION` 六种固定类型。每条资产归属于通用套装或模板套装，核心字段包括名称、说明、三级分类、关键词、同义词、普通标签、语义标签、适用页面类型、使用场景、风格标签、颜色标签、背景适配、样式 JSON、资源文件/参数 JSON、预览 JSON、AI 修改权限、排序、启用状态、来源和审核状态。资产是平台级管理员配置，不按普通用户隔离；正式 AI 检索只读取 `isEnabled=true` 且 `reviewStatus=APPROVED` 的资产。

三级分类字段为 `primaryCategory`、`secondaryCategory` 和 `variantKey`。旧数据可以为空，后台会显示为“未分类”。六类资产后台均提供主类目、二级语义和资源变体筛选：

- 图标按语义用途管理，例如导航方向、基础操作、状态反馈、时间进度、数据指标、业务财务、组织人员、沟通协作、文档内容、展示演示、设计编辑、图表分析、流程结构、目标战略、产品功能、技术系统、安全合规、行业场景、情绪评价和通用符号。
- 图形按页面结构与表达组件管理，例如基础几何、内容容器、信息卡片、强调图形、流程节点、结构关系、时间进度、数据展示、图表辅助、页面版式、导航指示、装饰图形、品牌视觉、场景组件、状态组件、业务组件、教育培训和技术系统。
- 线条按连接与指示用途管理，例如基础线条、分割线、连接线、箭头线、流程线、时间线、关系线、指示线、坐标与图表线、路径线、边框线、装饰线、强调线和系统架构线。
- 文本样式按文本层级管理，例如封面主标题、封面副标题、章节标题、页标题、小标题、正文、要点、注释、引用、标签、页眉、页脚和数字强调。
- 容器组件按内容承载能力管理，例如正文区域、引用框、结论框、图片区域、图表区域、占位符、图文卡片、指标卡片、分栏容器、列表容器和强调框。
- 导航组件按整套 PPT 连续性管理，例如目录、章节标识、当前位置、页码、进度条和步骤编号。

后台表单选择三级分类后，会自动补齐资产名称建议、说明、语义标签、使用场景和默认 `style` / `preview` JSON。语义资产列表顶部采用极简筛选栏：搜索、资产统计、清空筛选和新增资产位于同一操作行，常显筛选只保留主类目、二级语义、资源变体、套装类型和审核状态；页面类型、风格标签和背景适配不再作为独立常显条件，可直接通过搜索框输入页面类型 key、本地化页面类型名称、风格标签、`light` / `dark` / `transparent` 或对应背景文案检索。列表卡片采用精简扫读模式，只显示预览、名称、分类路径、启用状态、审核状态、短说明、少量去重后的语义标签和操作入口；套装、页面类型、背景适配、资源包版本等低频信息不在列表重复展示，可在编辑弹窗中查看和维护。语义资产新增和编辑弹窗采用分组编辑：基础信息与检索标签默认展开，`style` / `resource` / `preview` JSON 配置和 AI 修改权限默认收起；桌面端右侧固定显示预览、分类路径、套装、审核状态和来源摘要，滚动编辑表单时仍可对照当前预览。管理员仍可手动编辑套装、审核状态、关键词、同义词、页面类型、风格标签、颜色标签、背景适配、资源参数和 AI 修改权限。顶部“批量导入”支持选择 JSON 文件，文件内容可以是资产数组，也可以是包含 `assets` 数组的对象；前端会逐条调用创建接口并沿用服务端校验。AI 生成资源应保存为 `source=AI_GENERATED` 且默认 `reviewStatus=PENDING_REVIEW`，审核通过后再进入正式检索。

通用语义资产包 v1 位于 `assets/template-assets/universal-v1/`，包含 `manifest.json` 和 `assets.json`。该包按当前六类资产分类树做到“一资源变体一资产”，共 792 条：图标 360 条、图形 216 条、线条 168 条、容器 18 条、文本样式 15 条、导航 15 条。资产统一写入 `COMMON/common` 通用套装，`setName` 固定为“通用语义资产包 v1”，默认 `source=MANUAL`、`reviewStatus=APPROVED`、`isEnabled=true`，供 AI 检索兜底使用。运行 `pnpm db:seed:template-assets -- --dry-run` 只校验资产包；运行 `pnpm db:seed:template-assets` 会先检查同名冲突，再删除同一 `setName` 的旧包资产并重新创建 792 条，不会清空管理员手工维护的其他通用资产。

管理接口如下：

- `GET /api/admin/template-assets?kind=ICON|SHAPE|LINE|TEXT_STYLE|CONTAINER|NAVIGATION`：按类型读取资产，可通过 `query` 搜索名称、说明、套装、标签、语义标签、关键词、同义词、页面类型、使用场景、风格、颜色和背景适配，也可通过 `primaryCategory`、`secondaryCategory`、`variantKey`、`setKind`、`setKey`、`pageType`、`styleTag`、`backgroundMode`、`reviewStatus` 过滤。
- `POST /api/admin/template-assets`：创建资产。
- `GET /api/admin/template-assets/{id}`：读取单条资产。
- `PATCH /api/admin/template-assets/{id}`：更新资产或启停状态。
- `DELETE /api/admin/template-assets/{id}`：删除资产。
- `POST /api/admin/template-assets/ai-search`：按套装、页面类型、页面语义、资源类型、语义标签、风格标签和背景适配检索 AI 可用资源。检索时优先当前模板套装；若模板套装没有命中，则回退 `COMMON/common` 通用套装，并返回匹配分和使用建议。

六类资产的 `style`、`resource` 与 `preview` 均要求为 JSON 对象。图标推荐保存 SVG 或图标参数；图形推荐保存 PPT 原生 Shape 参数或 SVG；线条推荐保存 PPT 原生 Line / Connector 参数；文本样式保存字体、字号、字重、颜色、行高、最大行数和推荐字数范围；容器保存支持内容类型、推荐宽高、内边距和承载量；导航保存固定位置、显示规则、封面/封底显示规则和当前状态样式。编辑弹窗中的 JSON 配置区会同时校验这三项，任一项不是对象都会阻止保存；列表与编辑弹窗预览会优先读取 `preview`，并兜底读取 `resource`、`style` 和 `variantKey`：图标按语义 key 映射图形；图形按 `shapeType` 显示矩形、圆角矩形、正方形、平行四边形、圆形、椭圆、扇形、弧形、三角形、菱形、梯形、六边形等形态，旧基础几何资产即使 `preview/resource/style` 仍保存为泛化的 `roundedRect`，后台也会优先根据 `variantKey` 推断真实预览形态；容器按 `containerRole` 区分正文区、引用框、结论框、图片区、图表区、占位符、图文卡片、指标卡片、分栏、列表、强调框、警示框和洞察框，旧资产即使只保存 `shape: "container"` 也会按 `variantKey` 推断；导航按 `navigationRole` 与 `displayMode` 区分目录列表、目录网格、侧边目录、章节标识、页码、线性进度、圆点进度和步骤状态，旧资产缺少 `displayMode` 时会按变体和分类推断；文本样式按 `textRole` 区分封面主标题、副标题、章节标题、页标题、小标题、正文、要点、注释、引用、标签、页眉、页脚、来源说明和数字强调，旧资产缺少 `textRole` 时会按 `variantKey` 推断；线条按 `lineType`、`direction`、`connectorType`、`dash`、`startArrowType` 和 `endArrowType` 显示直线、竖线、折线、曲线、波浪线、虚线、点线、双线、单向箭头和双向箭头。通用语义资产包 v1 的资产已按这些约定生成结构化 `style`、`resource` 和 `preview`，可通过后台继续人工微调。当前版本已提供后台管理、预览和 AI 资源检索接口，但生成流程尚未自动把六类资源接入单页编排。

## JSON 导入与格式下载

模板库顶部操作区按钮顺序为“刷新”“导入通用模板”“下载JSON模板格式”。新建模板入口位于模板列表搜索栏右侧，并按当前选中的分类显示为“新建{分类名称}”。下载按钮会按当前选中的分类生成 `ppt-template-format-{category}.json`，其中包含完整导入格式和该分类默认 `SlideCompositionPlan` 示例。

推荐导入格式如下：

```json
{
  "formatVersion": "ppt-template-import-v1",
  "name": "封面大标题模板",
  "category": "cover-title",
  "description": "模板说明",
  "tags": ["封面大标题"],
  "sortOrder": 1,
  "isEnabled": true,
  "slide": {}
}
```

导入也兼容只包含原始 `SlideCompositionPlan` 的 JSON 文件。缺少元数据时，前端会使用当前选中分类、文件名、默认名称、默认说明和分类标签补齐，然后继续调用 `POST /api/admin/templates` 创建新模板，不会覆盖已有模板。

通用模板包中的每个 JSON 文件都已包含完整导入元数据和 `SlideCompositionPlan`，例如 `assets/templates/universal-v1/cover-title/cover-title-ai-tech.json`。`assets/templates/universal-v1/manifest.json` 只用于查看清单，不作为单个模板导入文件。

“导入通用模板”会调用管理员接口 `POST /api/admin/templates/universal-v1/import`。接口会读取 `manifest.json` 与 45 个模板文件，校验文件数量、分类、名称、排序和 `slideId` 后，在事务中先删除 15 个固定分类下的全部旧模板，再创建新的 45 个通用模板。该操作会替换固定分类模板库，适合初始化或重置通用模板。

前端只负责识别完整导入包和原始页面 JSON，并拦截明显无效的 JSON 文件。最终字段、分类、标签数量、排序范围和 `slide` 结构仍由服务端 `pptTemplateCreateSchema` 与 `slideCompositionPlanSchema` 校验。

## 设计器

模板详情页 `/{locale}/admin/templates/{id}` 提供可视化设计器。首版能力包括：

- 画布选择、拖拽移动和 Alt 拖拽缩放。
- 新增、复制、删除元素。
- 编辑元素类型、语义、角色、内容、位置、层级、文字样式和图片请求。
- 图层列表、置顶、置底、水平居中、垂直居中。
- 撤销、重做和保存。

设计器布局分为左侧图层、中间画布和右侧元素属性。模板分类、说明、标签、排序和启用状态等模板信息固定展示在中间画布下方，右侧属性栏专注编辑当前选中元素。

模板列表缩略图直接通过 CSS 渲染模板 JSON，不生成图片文件。

## 当前边界

模板库和语义元素资源库当前完成后台管理、资源预览和 AI 检索接口，尚未接入创作生成流程和预览页“换模板”功能。后续接入时可按分类读取已启用模板，并通过 `POST /api/admin/template-assets/ai-search` 或服务层检索函数按 `kind`、套装、页面类型、语义标签、风格标签和背景适配读取已启用且已入库资源，把模板 JSON 和资源 JSON 作为单页编排参考或替换目标。
