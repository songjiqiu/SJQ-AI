# 管理端 PPT 模板库

管理端首页提供“PPT模板库管理”入口，模板管理路径为 `/{locale}/admin/templates`。该页面只允许管理员访问，普通用户访问管理端路由会回到创作工作台。

模板工作区顶部提供七个入口：模板管理、图标管理、图形管理、线条管理、文本样式管理、容器组件管理和导航组件管理。`/{locale}/admin/templates` 继续保留原 PPT 模板管理能力，不迁移旧路由；语义元素资源分别位于 `/{locale}/admin/templates/icons`、`/{locale}/admin/templates/shapes`、`/{locale}/admin/templates/lines`、`/{locale}/admin/templates/text-styles`、`/{locale}/admin/templates/containers` 和 `/{locale}/admin/templates/navigation`。

## 固定分类

首版模板库使用固定分类：章节页、封面大标题、标题 + 正文/要点、大图背景、左图右文、左文右图、左文右图表、大图表、双栏对比、引用/金句页、时间轴、流程/步骤、关键指标页、四象限/矩阵、结束页。数据库仍保留 `customCategoryKey` 与 `customCategoryName`，用于后续扩展自定义分类。

旧分类会在读取和保存时平滑归一到新分类：`cover` 归入 `cover-title`，`title` 与 `body` 归入 `title-body-points`，`big-number-conclusion` 归入 `key-metrics`，`timeline` 归入 `time-axis`。

通用模板库 v1 的设计规范见 [通用 PPT 模板设计规范](./universal-ppt-template-spec.md)。该规范基于当前 15 个固定分类规划 45 套通用模板方案，每类覆盖“中国商务通用”“AI 科技感”“极简咨询风”三种风格。静态 JSON 包位于 `assets/templates/universal-v1/`，既可通过现有“新建模板 > 导入 JSON”入口按单个文件导入，也可在模板库顶部点击“导入通用模板”一键批量导入。

## 数据模型

模板数据保存在 Prisma `PptTemplate` 表中。核心字段包括分类、模板名称、说明、标签、排序、启用状态和完整 `SlideCompositionPlan` 页面 JSON。创建模板时如果没有传入 `slide`，服务端会复制对应分类的默认样板。

保存模板会使用现有 `slideCompositionPlanSchema` 校验。页面坐标继续使用 inch，画布固定为 `13.333 x 7.5` 的 16:9；图片元素必须通过 `imageRequestId` 关联 `imageLayerRequests`。

读取模板库时会兼容历史旧数据：如果数据库中已有模板的 `slide` JSON 与当前 `SlideCompositionPlan` schema 不兼容，列表页不会崩溃，而是临时使用所属分类的默认样板加载，并在模板库顶部和对应模板卡片显示兼容提示。管理员应重新保存该模板，或通过“导入通用模板”重置固定分类模板，避免旧 JSON 长期留存。

PPT--To--Slot 使用独立的 `PptSlotTemplate` 表保存 Slot 模板草稿和审核结果。该表保存的是上传 PPTX 提取出的 `template.json` 结构，包括 canvas、safeArea、alignmentLines、slots、styleTokens、rules、usage、来源文件和来源页码；它不保存 `SlideCompositionPlan`，也不会在审核通过时自动写入 `PptTemplate`。两套模板库边界独立：`PptTemplate` 继续服务当前 PPT 生成主链路，`PptSlotTemplate` 用于沉淀可被后续 Slot 生成项目消费的版式抽象。

语义元素资产采用“公共主表 + 六类详情表”保存。Prisma `TemplateAsset` 是公共主表，保存 `kind`、套装、名称、说明、三级分类、标签、语义标签、关键词、同义词、适用页面类型、使用场景、风格标签、颜色标签、背景适配、预览、AI 修改权限、排序、启用状态、来源和审核状态。`TemplateIconAsset`、`TemplateShapeAsset`、`TemplateLineAsset`、`TemplateTextStyleAsset`、`TemplateContainerAsset`、`TemplateNavigationAsset` 分别保存图标、图形、线条、文本样式、容器组件和导航组件的强类型详情字段。资产是平台级管理员配置，不按普通用户隔离；正式 AI 检索只读取 `isEnabled=true` 且 `reviewStatus=APPROVED` 的资产。

三级分类字段为 `primaryCategory`、`secondaryCategory` 和 `variantKey`。旧数据可以为空，后台会显示为“未分类”。六类资产后台均提供主类目、二级语义和资源变体筛选：

- 图标按语义用途管理，例如导航方向、基础操作、状态反馈、时间进度、数据指标、业务财务、组织人员、沟通协作、文档内容、展示演示、设计编辑、图表分析、流程结构、目标战略、产品功能、技术系统、安全合规、行业场景、情绪评价和通用符号。
- 图形按页面结构与表达组件管理，例如基础几何、内容容器、信息卡片、强调图形、流程节点、结构关系、时间进度、数据展示、图表辅助、页面版式、导航指示、装饰图形、品牌视觉、场景组件、状态组件、业务组件、教育培训和技术系统。
- 线条按连接与指示用途管理，例如基础线条、分割线、连接线、箭头线、流程线、时间线、关系线、指示线、坐标与图表线、路径线、边框线、装饰线、强调线和系统架构线。
- 文本样式按文本层级管理，例如封面主标题、封面副标题、章节标题、页标题、小标题、正文、要点、注释、引用、标签、页眉、页脚和数字强调。
- 容器组件按内容承载能力管理，例如正文区域、引用框、结论框、图片区域、图表区域、占位符、图文卡片、指标卡片、分栏容器、列表容器和强调框。
- 导航组件按整套 PPT 连续性管理，例如目录、章节标识、当前位置、页码、进度条和步骤编号。

后台表单选择三级分类后，会自动补齐资产名称建议、说明、语义标签、使用场景和默认 `style` / `preview` JSON。语义资产列表顶部采用极简筛选栏：搜索、资产统计、清空筛选和新增资产位于同一操作行，常显筛选只保留主类目、二级语义、资源变体、套装类型和审核状态；页面类型、风格标签和背景适配不再作为独立常显条件，可直接通过搜索框输入页面类型 key、本地化页面类型名称、风格标签、`light` / `dark` / `transparent` 或对应背景文案检索。列表卡片采用精简扫读模式，只显示预览、名称、分类路径、启用状态、审核状态、短说明、少量去重后的语义标签和操作入口；套装、页面类型、背景适配、资源包版本等低频信息不在列表重复展示，可在编辑弹窗中查看和维护。语义资产新增和编辑弹窗采用分组编辑：基础信息与检索标签默认展开，`style` / `resource` / `preview` JSON 配置和 AI 修改权限默认收起；桌面端右侧固定显示预览、分类路径、套装、审核状态和来源摘要，滚动编辑表单时仍可对照当前预览。管理员仍可手动编辑套装、审核状态、关键词、同义词、页面类型、风格标签、颜色标签、背景适配、资源参数和 AI 修改权限。顶部“批量导入”支持选择 JSON 文件，文件内容可以是资产数组，也可以是包含 `assets` 数组的对象；前端会逐条调用创建接口并沿用服务端校验。AI 生成资源应保存为 `source=AI_GENERATED` 且默认 `reviewStatus=PENDING_REVIEW`，审核通过后再进入正式检索。

语义资产库按空库从零重建，不迁移旧通用包数据，也不恢复旧 792 条通用语义资产包。当前只保留小型 `COMMON/common` 兜底包 `assets/template-assets/common-fallback-v1/`，包含图标、图形、线条、文本样式、容器和导航各 3 条基础资产，`setName` 固定为“通用语义兜底资产 v1”，默认 `source=MANUAL`、`reviewStatus=APPROVED`、`isEnabled=true`。运行 `pnpm db:seed:template-assets -- --dry-run` 只校验兜底包；运行 `pnpm db:seed:template-assets` 会删除同一 `setName` 的旧兜底资产，再写入 18 条基础资产。

管理接口如下：

- 图标：`/api/admin/template-icons`
- 图形：`/api/admin/template-shapes`
- 线条：`/api/admin/template-lines`
- 文本样式：`/api/admin/template-text-styles`
- 容器组件：`/api/admin/template-containers`
- 导航组件：`/api/admin/template-navigation`

每组接口都支持 `GET` 列表、`POST` 新建、`GET /{id}` 详情、`PATCH /{id}` 更新、`DELETE /{id}` 删除和 `POST /ai-search` 检索。列表可通过 `query` 搜索名称、说明、套装、标签、语义标签、关键词、同义词、页面类型、使用场景、风格、颜色和背景适配，也可通过 `primaryCategory`、`secondaryCategory`、`variantKey`、`setKind`、`setKey`、`pageType`、`styleTag`、`backgroundMode`、`reviewStatus` 过滤。旧 `/api/admin/template-assets`、`/api/admin/template-assets/{id}` 和 `/api/admin/template-assets/ai-search` 已废弃，返回 `410`。

六类资产的详情字段已经拆入专用详情表。后台仍兼容显示 `style`、`resource` 与 `preview` JSON：`style` 和 `resource` 由详情字段序列化生成，`preview` 继续留在公共主表用于管理端预览。图标保存图标名、线性/填充风格、描边色和圆角；图形保存 shape 类型、填充、描边、圆角、透明度和阴影；线条保存连接类型、方向、虚线、起止箭头、线宽和端点；文本样式保存字体、字号、字重、颜色、行高、最大行数和文本角色；容器保存支持内容类型、推荐宽高、内边距、间距和边框；导航保存导航角色、展示模式、固定位置、当前/未激活颜色和封面/封底显示规则。当前版本已把六类资源接入生成主链路：模板或内置排版产出页面 JSON 后，服务端会分别检索六类启用且审核通过的资产，并把命中资源写入元素的 `assetBinding` 与 `assetStyle`。画布预览和 PPTX 导出只消费已写入页面 JSON 的 `assetStyle`，避免历史 PPT 受资产库后续修改影响。

语义资产增长策略分三层：

- 第一来源：从已审核模板 JSON 和 PPT--To--Slot 结果提取真实元素，写入模板专属资产。
- 第二来源：维护小型 `COMMON/common` 兜底资产库，覆盖生成必需的基础资产。
- 第三来源：AI 生成时发现缺口，只创建 `PENDING_REVIEW` 候选资产，管理员审核通过后才参与正式检索。

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

模板库已自动接入创作生成流程：单页 LLM 仍只输出无坐标的语义计划和 `layoutSelection` 候选，服务端会按候选分类读取已启用模板，结合模板标签、PPT 类型视觉基调、页面角色、内容密度和 `sortOrder` 选择具体模板，并把当前页标题、核心表达、正文要点、来源/页码和图片提示词写入模板坐标。模板库未导入、分类没有启用模板或模板套用后未通过 `SlideCompositionPlan` schema 校验时，会回退内置排版并在页面诊断中记录原因。模板或内置排版完成后，语义元素资产增强层会按 `kind`、页面类型、页面语义、语义标签、风格标签和背景适配检索已启用且已入库资源，把图标、图形、线条、文本样式、容器和导航结果写入元素的 `assetBinding` 与 `assetStyle`；检索失败、缺表、无命中或资源不适配时保留原页面并记录诊断，不阻断生成。预览页“换模板”功能仍是独立编辑入口，后续可复用同一套模板选择与套用逻辑。
