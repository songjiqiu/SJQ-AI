# PPT--To--Slot

PPT--To--Slot 是管理端的 Slot 模板提取入口，路径为 `/{locale}/admin/ppt-to-slot`。它从管理员上传的 `.pptx` 文件中读取页面元素的真实坐标、尺寸、层级、样式和区域结构，生成可人工确认的 Slot 模板，而不是复制原始 PPT 页面内容。

## 流程

1. 管理员上传 10MB 以内的 `.pptx` 文件。
2. 服务端校验文件扩展名、zip 可读性和是否包含幻灯片。
3. OpenXML 解析 `ppt/presentation.xml` 和 `ppt/slides/slide*.xml`，坐标统一转换为 inch。
4. 规则层识别标题区、左右结构、三列/四列卡片、图表区、图片区、表格区、安全区和对齐线。
5. 可选 LLM 只补充页面类型、Slot 命名、角色和适用场景；LLM 不允许修改坐标、尺寸、层级或最终校验。
6. 每页生成 `template.json`、`raw_layers.json`、`layout_candidates.json`、`overlay.png` 和 `review_report.md`。
7. 管理员查看 overlay 和 JSON，提交通过、要求修改或拒绝。

`overlay.png` 使用 `@napi-rs/canvas` 生成。列表页和已生成模板读取不会在页面加载时强制载入该原生依赖；只有上传 PPTX 并生成 overlay 时才动态载入。如果本机缺少 canvas native binding，上传接口会返回 `VALIDATION_FAILED`，提示运行 `pnpm install` 后重启开发服务。

## 产物

产物保存在 `storage/ppt-to-slot/{jobId}/`，数据库只保存相对路径。每页会生成一条 `PptSlotTemplate` 记录，主要字段包括：

- `sourceFile`、`sourceSlideIndex`：来源文件和页码。
- `pageTypes`、`layoutPattern`：页面语义和版式模式。
- `canvas`、`safeArea`、`alignmentLines`：由程序计算的画布、内容安全区和对齐线。
- `slots`、`styleTokens`、`rules`、`usage`：可复用 Slot 模板结构。
- `reviewStatus`、`reviewNotes`、`isEnabled`：人工审核状态和启用状态。
- `artifactPaths`、`overlayPath`：JSON、图片和报告的存储路径。

## API

- `GET /api/admin/ppt-to-slot/templates`：查询 Slot 模板列表。
- `POST /api/admin/ppt-to-slot/jobs`：上传 `.pptx` 并同步生成每页模板草稿，multipart 字段名为 `file`。
- `GET /api/admin/ppt-to-slot/templates/{id}`：读取单个模板。
- `PATCH /api/admin/ppt-to-slot/templates/{id}`：更新名称、审核状态、备注、启用状态和可编辑 JSON 字段。
- `GET /api/admin/ppt-to-slot/templates/{id}/artifacts/{kind}`：读取产物，`kind` 可为 `template`、`rawLayers`、`layoutCandidates`、`overlay` 或 `reviewReport`。

所有接口都要求管理员权限。未登录返回 `UNAUTHORIZED`，非管理员返回 `FORBIDDEN`。

## 当前边界

第一版只覆盖稳定 MVP：读取 PPTX、解析每页元素坐标、识别常见区域结构、生成 Slot JSON、生成 overlay 标注图并人工确认。复杂动画解析、完整母版继承、任意页面完美分类、无人审核自动入库、历史任务队列和高级拖拽修正暂不处理。

Slot 模板库独立于现有 `PptTemplate`。审核通过只启用 `PptSlotTemplate`，不会自动转换为 `SlideCompositionPlan`，也不会直接参与当前 PPT 生成主链路。
