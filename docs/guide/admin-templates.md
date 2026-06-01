# 管理端 PPT 模板库

管理端提供“模板工作区”，路径为 `/{locale}/admin/templates`。该页面只允许管理员访问，普通用户访问管理端路由会回到创作工作台。

## 固定分类

首版模板库使用固定分类：章节页、封面大标题、标题 + 正文/要点、大图背景、左图右文、左文右图、左文右图表、大图表、双栏对比、引用/金句页、时间轴、流程/步骤、关键指标页、四象限/矩阵、结束页。数据库仍保留 `customCategoryKey` 与 `customCategoryName`，用于后续扩展自定义分类。

旧分类会在读取和保存时平滑归一到新分类：`cover` 归入 `cover-title`，`title` 与 `body` 归入 `title-body-points`，`big-number-conclusion` 归入 `key-metrics`，`timeline` 归入 `time-axis`。

## 数据模型

模板数据保存在 Prisma `PptTemplate` 表中。核心字段包括分类、模板名称、说明、标签、排序、启用状态和完整 `SlideCompositionPlan` 页面 JSON。创建模板时如果没有传入 `slide`，服务端会复制对应分类的默认样板。

保存模板会使用现有 `slideCompositionPlanSchema` 校验。页面坐标继续使用 inch，画布固定为 `13.333 x 7.5` 的 16:9；图片元素必须通过 `imageRequestId` 关联 `imageLayerRequests`。

## JSON 导入与格式下载

模板库顶部操作区按钮顺序为“刷新”“下载JSON模板格式”“新建模板”。下载按钮会按当前选中的分类生成 `ppt-template-format-{category}.json`，其中包含完整导入格式和该分类默认 `SlideCompositionPlan` 示例。

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

前端只负责识别完整导入包和原始页面 JSON，并拦截明显无效的 JSON 文件。最终字段、分类、标签数量、排序范围和 `slide` 结构仍由服务端 `pptTemplateCreateSchema` 与 `slideCompositionPlanSchema` 校验。

## 设计器

模板详情页 `/{locale}/admin/templates/{id}` 提供可视化设计器。首版能力包括：

- 画布选择、拖拽移动和 Alt 拖拽缩放。
- 新增、复制、删除元素。
- 编辑元素类型、语义、角色、内容、位置、层级、文字样式和图片请求。
- 图层列表、置顶、置底、水平居中、垂直居中。
- 撤销、重做和保存。

模板列表缩略图直接通过 CSS 渲染模板 JSON，不生成图片文件。

## 当前边界

模板库当前只完成后台管理能力，尚未接入创作生成流程和预览页“换模板”功能。后续接入时可按分类读取已启用模板，并把模板 JSON 作为单页编排参考或替换目标。
