# AI 流水线

## 当前能力

当前版本将创作工作台拆成三步页面，并在耗时操作之间使用独立等待页：

1. `/{locale}/workbench`：用户输入创作想法、文本类文件、可选指定页数和 PPT 类型；指定页数位于上传文件行右侧，说明文字放在输入框下方；上传按钮只显示图标和“添加文件”，单文件大小限制显示在按钮后方，支持格式放在按钮下方。PPT 类型使用 4 列选项网格，保证同一桌面宽度下选项按钮等宽。输入页首屏加大标题、输入区、类型选项和右侧栏字号与纵向间距，右侧栏显示最近大纲草稿与生成历史，并可直接删除当前账号下的草稿或历史；删除前使用应用内 shadcn/ui 风格确认弹窗；重置和生成大纲草稿操作位于右侧栏下方并使用整行宽按钮，与左侧表单底部对齐。
2. `/{locale}/workbench/outline/analyze/loading`：浏览器从 `sessionStorage` 读取初始输入并调用 `POST /api/decks/outline/analyze`，第一轮生成受众、目标、核心信息、推荐页数和结构大纲；若用户指定了页数，推荐页数必须等于用户指定值。
3. `/{locale}/workbench/outline/analyze/confirm`：展示第一轮完整 JSON，允许用户编辑受众、目标、核心信息、页数、整套标题/摘要和每页结构；PPT 类型只读展示，后续只能引用，不能由模型改写。调整页数时，确认页会按页数同步增减结构页。
4. `/{locale}/workbench/outline/loading`：浏览器读取确认后的 `confirmedPlan` 并调用 `POST /api/decks/outline`，第二轮只基于已确认结构大纲生成每页详细文案 JSON 和统一全局视觉规范，不重新生成结构大纲。
5. `/{locale}/workbench/outline/{id}`：默认以只读卡片化视图展示已保存大纲，包含封面、目录、章节和内容页；底部操作栏中间展示预览/编辑状态、页数和编辑入口，用户可直接生成预览 PPT，也可点击“编辑大纲”后修改整套标题、摘要、统一视觉说明和每页文案；底部操作栏提供删除入口，生成中的关联任务存在时会阻止删除。
6. `/{locale}/workbench/generate/loading`：浏览器从 `sessionStorage` 读取 `outlineDraftId` 并调用 `POST /api/decks/generate` 创建异步生成任务，随后轮询 `GET /api/decks/{id}/status`。若同一大纲 30 分钟内已有生成中任务，服务端会复用原任务，避免重复生成历史。生成任务使用固定 3 路并发生成页面图层 JSON、预览占位图和真实图片素材；前 `min(5, 总页数)` 页优先按页序落库，完成后返回 `previewReady: true`，前端可立即进入轻量预览。
7. `/{locale}/workbench/preview/{id}`：展示固定视口三栏预览编辑器，顶部操作区居中显示内容审核与一致性评分；左侧为页面缩略图，中间为 16:9 图层画布和底部对齐的紧凑页面元素编排，元素与图片图层长列表在面板内滚动，页面元素列表只显示角色名称与层级以便快速扫描，不显示位置和尺寸；点击画布元素时会高亮画布内的选中元素区域，并同步高亮底部对应的页面元素、右侧选中元素属性卡片，图片元素还会高亮对应图片图层请求并自动滚动到可见位置；右侧可编辑文本元素的内容与位置，选中图片、图标等文件类元素时保留位置与大小编辑，并提供上传新文件或删除该元素；同时提供当前页保存、换模板、重新生成当前页、PPTX 下载和生成历史删除。若项目仍为 `GENERATING`，预览页显示后台进度并定时刷新，编辑、重新生成、删除和 PPTX 下载在最终 `READY` 前保持禁用。

大纲草稿生成采用严格两轮 LLM 流程。第一轮基于用户文本、文件摘要/片段、PPT 类型和可选指定页数，生成输入分析与结构大纲，不生成统一视觉说明或每页详细正文；第二轮基于用户确认后的完整 JSON、原始用户输入、文件摘要/片段和锁定字段，生成每页详细文案 JSON 和统一全局视觉规范。第二轮每页 `SlideContent` 除标题、副标题、正文要点、演讲目标和视觉意图外，还必须包含 `coreStatement`、`narrativeRole`、`contentLayers`、`slideTransition`、`explanationDepth`、`sourceRequirement`、`adaptationRules`、`audienceFocus`、`viewerObjective`、`contentBoundary`，用于明确本页记忆点、叙事作用、主/支撑/补充层级、页间衔接、讲解深度、来源要求、拆合规则、受众关注点、行动或认知目标和内容边界。

统一全局视觉规范在第二轮生成后写入大纲草稿，后续页面图层编排和预览 PPT 生成只能引用并遵循，不重新生成或修改。统一视觉规范保留 `themeName`、`visualStyle`、`colorPalette`、`typography`、`imageStyle`、`layoutRules`、`consistencyRules`、`forbiddenRules` 等兼容字段，并新增结构化字段：`pageSpec` 固定说明 16:9、13.333 x 7.5 inch、安全边距 `0.5` 和 12 栏栅格；`typographyRules` 记录默认字号、最小字号、最大行数、行高、字体 fallback 和封面/页标题/正文/注释/图表标签字号等级；`colorRoles` 记录背景、卡片/表面、标题、正文、强调、高亮、图表和装饰色角色，并要求正文色与背景色对比度不低于 `4.5:1`、装饰色不用于大段正文、高亮色每页最多 1-2 处；`imageRules` 要求背景图不包含高对比文字区域，图片主体不压在标题区。新增高级规范包括 `pptTypeVisualTone`、`informationDensityRules`、`spacingRules`、`chartVisualRules`、`imageIllustrationRules`、`iconStyleRules`、`emphasisRules`、`forbiddenVisualRules`，分别约束当前 PPT 类型的视觉气质、页面密度节奏、间距留白、图表、图片/插画、图标、强调和禁用视觉行为。`pptTypeVisualTone` 由 `deckType` 自动匹配，只保存 `deckType`、`deckTypeName`、`recommendedTone` 和 `visualKeywords`，前端只展示匹配后的视觉基调与关键词；历史四类对照结构会在读取时按当前 `deckType` 自动归一化为单项结果。当前映射覆盖现有 20 个可选 PPT 类型，商务办公、销售市场、教学培训、研究分析和个人展示仅作为分组原则，不新增为可选类型。`themeName` 只表达内容主题或视觉主题，不拼接、不保留“星图 / 矩阵 / 深空 / 晨雾 / Star Map”等外观配色预设名；历史草稿和模型输出会在读取时自动清理并补齐新增结构字段，旧版色彩完整定义会并入 `colorRoles`，旧版字号层级会并入 `typographyRules.scale`。工作台展示统一视觉说明时，会将 `colorPalette` 以及角色、规则文本中的 HEX 色值渲染为“色块 + 色码”，便于人工检查颜色。输入中的 `deckType` 决定 PPT 的场景结构、视觉基调与页面组织方式，默认 `business-report`（商务汇报）；deck-level `style` 已从新输入、prompt 和输出结构中移除，历史 JSON 中残留该字段时只会被读取兼容并在归一化后丢弃。

预览 PPT 生成必须复用已保存的大纲草稿，不重新拆页。单页编排采用“语义规划 -> 服务端排版 -> 图层生成 -> PPTX 合成”流程：LLM 先输出 `SemanticSlidePlan`，判断 `pageIntent`（对应用户术语 `page_role`、`primary_goal`、`core_message`、`audience_takeaway`、`content_density`）、三层 `contentHierarchy.tiers` 和无坐标的 `semanticElements`；随后从固定内置 `layoutType` 中选择 2-3 个候选写入 `layoutSelection.candidates`，比较适配理由、风险和分数，并给出 `selectedLayoutType`；同时写入 `constraints`，记录安全边距、主标题唯一、核心信息存在、图片主体避让标题区和密度限制。固定内置 `layoutType` 使用 camelCase 字段保存，取值为 `chapter`、`cover-title`、`title-body-points`、`big-image-background`、`left-image-right-text`、`left-text-right-image`、`left-text-right-chart`、`big-chart`、`two-column-compare`、`quote`、`time-axis`、`process-steps`、`key-metrics`、`quadrant-matrix`、`ending`，暂不读取管理员模板库。

服务端再把这些语义元素、`selectedLayoutType` 和统一视觉说明确定性转换为现有 `SlideElement` 坐标、`imageLayerRequests` 和 16:9 `canvas`。LLM 在语义阶段禁止输出 `bounds`、`x/y/width/height`、`zIndex`、`textStyle` 或图片请求；坐标只由服务端排版层生成。生成元素和图片请求后会通过 zod 校验字段完整性、元素类型合法性、主标题唯一性、核心信息存在性、图片请求引用完整性和版式类型合法性。随后服务端输出逐页 `designQualityScore`，五维包括 `informationHierarchy`、`visualConsistency`、`contentDensity`、`renderability`、`expressionCompleteness`；当总分低于 `78` 或任一维低于 `65` 时，会把评分问题、原始语义计划和统一视觉说明发回同一 LLM 自动修复一次。修复不得改变 `slideId`、`index` 或页数；修复失败或修复后仍低分时保留最佳版本，并在 `repairStatus` 标记 `failed` 或 `still-low`，不阻断整套生成。以上 `layoutSelection`、`constraints`、`designQualityScore` 与原有 `pageIntent`、`contentHierarchy`、`semanticElements` 一起写入 `DeckSlide.pageDesign`，历史数据缺失时读取层会补齐默认值。

数据页会优先识别指标、维度、趋势和对比关系；流程页优先识别步骤、顺序、输入输出和依赖关系；对比页优先识别比较对象、比较维度和差异结论。每页最多一个主视觉中心，高密度页面会优先使用表格、矩阵、流程、指标卡片等紧凑信息图版式，并在 `layoutDiagnostics` 标记需要关注的密度风险。后台生成使用固定 3 路并发编排页面，并先为图片图层写入默认 Mock SVG 占位图、保存页面 JSON；首批页面按页序落库并可预览后，继续并发生成剩余页面、真实图片和质量审核，最后按页序读取页面合成 PPTX 并标记 `READY`。页面坐标使用 inch，默认 16:9 画布为 `13.333 x 7.5`，安全边距 `0.5`；`pageSpec.gridColumns=12` 当前作为统一视觉说明和后续排版约束保存，本版本不对既有确定性坐标算法做 12 栏吸附。图片生成优先读取当前账号默认图片模型及其关联供应商，推荐模型 ID 为 `gpt-image-2`；单张图片生成和图片 URL 下载默认 120 秒超时，可通过 `IMAGE_REQUEST_TIMEOUT_MS` 调整；若供应商未配置 API Key、调用失败或超时，会回退到可插拔 Mock SVG 图层并在 provider 与 metadata 中标记回退来源。PPTX 使用 `pptxgenjs@4.0.1` 静态导出。

图片素材会先按账号内缓存复用。缓存 key 由当前账号、图片模型、图片类型、比例、透明背景、完整 prompt、avoid、关键词和统一视觉风格归一化后生成。若存在 `APPROVED` 且本地文件仍可读取的素材，会复制登记为当前 `DeckProject` 的 `DeckAsset`，继续沿用现有鉴权下载逻辑；未命中时才调用图片模型。生成后先做规则质量审核，包括 MIME、文件大小、尺寸、fallback 状态和禁用内容；视觉 LLM 审核是可选增强，单次审核默认 30 秒超时，默认模型不支持图片输入或审核超时时记录为 `rules-only-fallback`，不会阻断生成。

布局计算会检测越界、文字溢出、元素重叠和页面密度。标题最多 2 行，正文每页最多 5 个信息块；标题字号 22-34，副标题 16-22，正文 12-18，注释 8-11。中文换行按字符宽度估算，中文字符约 `fontSize * 0.55 / 72` inch，行高默认 `1.25`。统一视觉规范中的 `typographyRules` 会同步记录默认字号、最小字号、最大行数、行高、字体 fallback 和字号等级，供后续页面编排、人工编辑和图片提示词引用；文本元素 `textStyle.maxLines` 与统一视觉规范保持一致，允许范围为 `1-9`。溢出修复顺序为降低字号、压缩正文、调整版式、生成拆页建议、标记需要用户确认；当前版本不会自动增加页数。

首版已加入 Web 预览动效、内容审核提示和一致性评分。PPTX 暂不写入 PowerPoint 原生对象动画，但会把 `motionPlan` 写入演讲者备注和产物 metadata，便于后续接入 OOXML 动画后处理。

登录用户可在“体验设置”中配置 AI 供应商、LLM 模型、图片模型和向量模型。三类模型都复用供应商的 Base URL 与 API Key。大纲草稿和从大纲生成单页编排时都会优先读取当前账号启用的默认 LLM 模型；没有默认模型时回退到 `.env` 中的 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`AI_TEXT_MODEL`；仍无 API Key 时使用本地模拟。图片图层生成会优先读取默认图片模型关联供应商；没有可用供应商 API Key 时读取 `.env` 中的 `IMAGE_API_KEY`、`IMAGE_BASE_URL`、`AI_IMAGE_MODEL`；仍不可用时使用本地 Mock SVG。

## 环境变量

```bash
OPENAI_API_KEY=      # OpenAI-compatible API Key，留空则使用本地模拟 fallback
OPENAI_BASE_URL=     # 可选，兼容服务商 base URL
AI_TEXT_MODEL=       # 可选，默认 gpt-4.1-mini
IMAGE_API_KEY=       # 可选，OpenAI-compatible 图片生成 API Key，留空则图片图层使用本地模拟
IMAGE_BASE_URL=      # 可选，图片生成兼容服务商 base URL
AI_IMAGE_MODEL=      # 可选，默认 gpt-image-2
IMAGE_REQUEST_TIMEOUT_MS=120000 # 可选，单张图片生成/下载超时，默认 120 秒，允许范围 10000-600000
DATABASE_URL=        # MySQL 连接串，例如 mysql://root:root@localhost:3306/ai-ppt?allowPublicKeyRetrieval=true
AI_CONFIG_ENCRYPTION_KEY= # 用于加密供应商 API Key
```

## 服务端接口

`POST /api/decks/outline/analyze`

第一轮输入分析接口。请求字段：

- `idea`：创作想法，必填。
- `sourceText`：兼容旧调用的补充文本字段，当前创作输入页不再展示该入口，前端固定传空字符串。
- `textFiles`：浏览器端读取出的文本与文档内容，最多 5 个，单文件最大 10MB，支持 `.txt`、`.md`、`.markdown`、`.csv`、`.json`、`.docx`；`.docx` 会在浏览器端提取正文后提交。服务端会生成确定性的文件摘要和片段，LLM prompt 优先使用摘要/片段。
- `pageCount`：可选指定页数，范围 3-18；未填写时由模型推荐页数，填写时 `recommendedPageCount` 必须与该值一致。
- `deckType`：PPT 类型，默认 `business-report`，按使用场景分组展示。
- `palette`：配色预设。
- `locale`：`zh-CN` 或 `en-US`。

返回字段包括原始 `input`、带 `summary` / `snippets` 的 `fileSummaries`、不可变 `deckType`、`audience`、`goal`、`coreMessage`、`recommendedPageCount` 和 `structureOutline`。`structureOutline` 包含 `deckTitle`、`deckSummary` 和每页 `slideId`、`index`、`title`、`purpose`、`keyMessage`、`visualDirection`，不包含详细正文和统一视觉规范。确认页会展示原始创作想法摘要和文件摘要，文件只展示文件名、大小、字数和摘要，不展开完整正文。该接口不写数据库，前端只将结果暂存在浏览器会话中等待用户确认。

`POST /api/decks/outline`

确认后的大纲草稿生成接口。除第一轮输入字段外，还必须传入 `confirmedPlan`：

- `confirmedPlan.input`：第一轮原始输入快照；其中 `deckType`、`palette`、`locale` 必须与本次请求一致。
- `confirmedPlan.fileSummaries`：第一轮文件摘要和片段。
- `confirmedPlan.deckType`：必须与原始 `deckType` 完全一致。
- `confirmedPlan.audience`、`confirmedPlan.goal`、`confirmedPlan.coreMessage`：确认后的目标受众、表达目标和核心信息。
- `confirmedPlan.recommendedPageCount`：确认后的最终页数，范围 3-18；必须等于 `structureOutline.slides.length`。
- `confirmedPlan.structureOutline`：用户确认或修改后的结构大纲。第二轮 LLM 只能基于它扩展详细文案，不能重写 PPT 类型或页序。

内置 PPT 类型包括：

- 商务办公：`business-report`、`fundraising-pitch`、`proposal`、`project-plan`、`retrospective-summary`。
- 销售市场：`product-launch`、`sales-proposal`、`brand-marketing`、`event-promotion`、`operation-plan`、`growth-experiment`。
- 教学培训：`training-course`、`knowledge-sharing`、`teaching-deck`。
- 研究分析：`research-report`、`data-analysis`、`industry-insight`。
- 个人展示：`portfolio`、`personal-review`、`community-sharing`。

历史数据中的 deck-level `style` 字段会被 schema 读取兼容并在归一化后丢弃；新输入页不再展示该字段，LLM prompt 不再要求输出或锁定该字段。

返回字段：

- `id`：大纲草稿 ID。
- `mode`：`ai-json` 或 `mock`。
- `deckTitle`、`deckSummary`：整套 PPT 标题与摘要。
- `input`、`fileSummaries`、`intentAnalysis`：合并后传入 LLM 的输入、文件摘要和用户确认后的第一轮完整 JSON。
- `unifiedVisualSpec`：第二轮生成的统一全局视觉规范，后续生成只能引用并遵循。
- `slides`：每页标题、副标题、正文要点、演讲目标、视觉意图，以及结构化的核心表达句、叙事作用、内容层级、页间衔接、讲解深度、来源要求、拆合规则、受众关注点、行动或认知目标和内容边界。
- `createdAt`、`updatedAt`：草稿创建与更新时间。

草稿接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/decks/outline` | 当前账号最近 20 条大纲草稿；作为工作台侧栏快捷入口，读取时会跳过不符合当前结构约束的历史草稿，本地未执行大纲草稿表迁移时返回空列表 |
| `GET` | `/api/decks/outline/{id}` | 当前账号某个大纲草稿 |
| `PATCH` | `/api/decks/outline/{id}` | 保存编辑后的大纲 JSON |
| `DELETE` | `/api/decks/outline/{id}` | 删除当前账号的大纲草稿；若草稿正在被 `GENERATING` 任务引用，返回 `ACTIVE_GENERATION_EXISTS` |

预览 PPT 生成必须复用已保存的大纲 JSON，不能重新拆页。大纲确认页默认只读展示已保存内容；只有用户进入编辑模式并保存后，`PATCH` 才会更新草稿。

`POST /api/decks/generate`

请求字段：

- `outlineDraftId`：当前账号下已保存的大纲草稿 ID。

接口要求用户已登录。服务端会读取当前用户的大纲草稿并创建异步生成任务，立即返回生成历史 ID 与 `GENERATING` 状态。若同一账号、同一大纲草稿在 30 分钟内已有 `GENERATING` 任务，则直接返回该任务并不重复启动后台 runner；超过 30 分钟仍未完成的旧任务会标记为 `FAILED`，用户可重新生成。当前版本使用数据库状态和 Next.js 进程内后台 runner，不引入 Redis/BullMQ。

返回字段：

- `id`、`status`、`progress`：生成历史 ID、状态与进度。
- `previewReady`：前 `min(5, 总页数)` 页已可预览时为 `true`。

`GET /api/decks/{id}/status`

查询异步生成状态。返回字段包括 `id`、`status`、`progress`、`previewReady`、`previewUrl`、`error` 和 `details`。当状态为 `READY` 或 `previewReady=true` 时，前端进入 `/{locale}/workbench/preview/{id}`；当状态为 `FAILED` 时，后台会把页面图层 LLM、图片生成、质量审核、PPTX 合成等任意阶段的异常写入 `DeckProject.generationError` 与 `generationProgress.message`，接口优先返回 `generationError`，为空时回退到 `progress.message`。等待页只有明确收到 `FAILED` 才显示“预览 PPT 生成失败”；长时间仍为 `GENERATING` 时显示“生成仍在后台继续”，并继续低频轮询，任务完成后仍会自动进入预览。若状态异常但项目已具备 PPTX 产物和完整页面，状态接口会修正为 `READY` 并返回预览地址，避免已完成产物被失败兜底降级。

`PATCH /api/decks/{id}/slides/{slideId}`

保存当前页内容和元素位置。服务端会重新计算布局诊断、更新页面 JSON，并立即重新合成 PPTX，使下载文件反映最新编辑。

`POST /api/decks/{id}/slides/{slideId}/elements/{elementId}/file`

为图片、图标等文件类元素上传替换图片。服务端会保存为当前 PPT 的图片图层资产并返回图层记录，前端把它写入当前页后，随“保存当前页”一起重新合成 PPTX。

`POST /api/decks/{id}/slides/{slideId}/regenerate`

重新生成当前页。服务端会调用当前账号默认 LLM 对本页文案重新生成页面图层 JSON，新增或变化的图片请求继续走账号内缓存和图片模型。
- `mode`：`ai-json` 或 `mock`。
- `deckTitle`、`deckSummary`：整套 PPT 标题与摘要。
- `input`、`unifiedVisualSpec`：用户输入与统一视觉说明。
- `contentReview`：内容审核分数、风险等级、提示和建议。
- `consistencyReport`：跨页一致性评分、检查项和建议。
- `slides`：每页文案、元素编排、图片图层请求、生成后的图片图层、Web 动效计划。
- `pptxUrl`：静态 PPTX 下载地址。

历史与产物接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/decks` | 当前账号最近 20 条已完成且具备 PPTX 产物的 PPT 生成历史 |
| `GET` | `/api/decks/{id}` | 当前账号某个 PPT 的完整结果 |
| `DELETE` | `/api/decks/{id}` | 删除当前账号的生成历史，并清理 `storage/decks/{id}` 下的 PPTX 与图片图层产物；生成中项目返回 `ACTIVE_GENERATION_EXISTS` |
| `GET` | `/api/decks/{id}/pptx` | 下载该 PPT 的 PPTX 文件 |
| `GET` | `/api/decks/{id}/assets/{assetId}` | 读取该 PPT 的图片图层 |

图片模型配置接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ai/image-models` | 当前账号图片模型配置列表 |
| `POST` | `/api/ai/image-models` | 新增图片模型配置，请求体与 LLM 模型一致，默认模型 ID 可填 `gpt-image-2` |
| `PATCH` | `/api/ai/image-models/{id}` | 更新图片模型供应商、显示名称、模型 ID、默认温度、启用状态或默认状态 |
| `DELETE` | `/api/ai/image-models/{id}` | 删除图片模型配置 |
| `POST` | `/api/ai/image-models/{id}/default` | 设置默认图片模型 |

向量模型配置接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/ai/embedding-models` | 当前账号向量模型配置列表 |
| `POST` | `/api/ai/embedding-models` | 新增向量模型配置，请求体与 LLM 模型一致 |
| `PATCH` | `/api/ai/embedding-models/{id}` | 更新向量模型供应商、显示名称、模型 ID、默认温度、启用状态或默认状态 |
| `DELETE` | `/api/ai/embedding-models/{id}` | 删除向量模型配置 |
| `POST` | `/api/ai/embedding-models/{id}/default` | 设置默认向量模型 |

旧的 `POST /api/decks/analyze` 仍保留为拆页与单页编排调试接口，前端工作台预览生成默认使用 `/api/decks/generate` 并只传入 `outlineDraftId`。

管理端模板接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/templates` | 管理员读取全局 PPT 模板列表，可按固定分类过滤 |
| `POST` | `/api/admin/templates` | 在指定分类下创建模板；未传 `slide` 时复制该分类默认样板 |
| `GET` | `/api/admin/templates/{id}` | 读取某个模板详情 |
| `PATCH` | `/api/admin/templates/{id}` | 更新模板元数据、启用状态、排序或完整页面 JSON |
| `DELETE` | `/api/admin/templates/{id}` | 删除模板 |

模板库当前只作为后台管理能力，不参与创作工作台自动生成和预览页“换模板”逻辑。保存模板时，`slide` 必须通过 `SlideCompositionPlan` schema 校验；图片元素仍需通过 `imageRequestId` 关联 `imageLayerRequests`。

## 结构约定

页面坐标使用 inch，画布固定为 `13.333 x 7.5` 的 16:9。旧历史数据如果仍使用 0-100 百分比，会在读取时转换为 inch。`SlideElement` 支持 `text`、`generatedImage`、`shape`、`icon`、`chartPlaceholder`，并带有 `semanticType`、`hierarchyLevel`、`textStyle` 和 `editable`。当元素类型为 `generatedImage` 时，必须通过 `imageRequestId` 关联 `imageLayerRequests`，生成完成后再关联 `generatedImageLayers`。`DeckSlide.pageDesign` 会保存内部语义元数据，包括 `pageIntent`、增强后的 `contentHierarchy`、`designPlan`、`layoutDiagnostics` 和 `semanticElements`；旧历史数据缺少这些字段时，读取层会按现有文案补齐兼容默认值，不需要数据库迁移。

所有 AI 输出都必须通过 zod 校验。模型不能返回 Markdown、代码围栏或 JSON 前后的解释文本；严格结构化输出、纯 JSON 解析或 zod 校验失败时，会使用同一个模型退回 JSON mode 修复一次，并在重试提示中附带目标 JSON Schema。为兼容 DeepSeek 等 OpenAI-compatible 服务暂不支持 `response_format: {"type":"json_schema"}` 的情况，若接口明确返回 `response_format` 不可用或不支持，服务端会再发起一次不携带 `response_format` 的纯 JSON 提示兜底。大纲生成链路会在最终 zod 校验前做窄口径规范化：只有页数匹配且 `slides` 存在时，才会补齐缺失的大纲标题、摘要、`slideId`、`index`，把字符串或常见错形的 `unifiedVisualSpec` 转换为严格对象，补齐新增的每页结构化大纲字段和高级视觉规范字段，并移除 `locale`、`palette`、`pageCount` 等多余顶层字段。若模型把原始换行、制表符等控制字符直接写进 JSON 字符串，解析前会先转义为合法 JSON 字符。以上修复后仍无法通过 zod 校验时，API 返回 `AI_JSON_GENERATION_FAILED` 并中断流程，不自动降级成本地 mock 草稿。

`AI_JSON_GENERATION_FAILED` 会在响应 `details` 中返回结构化诊断，字段包括 `message`、`schemaName`、`model` 和 `attempts`。每个 attempt 记录 `mode`、`stage`、`error`，并在可用时附带 `zodIssues` 与截断后的 `responseSnippet`。前端等待页会展示中文摘要和“失败详情 / Failure details”折叠区，便于定位是模型不支持 `response_format`、JSON 语法错误、Markdown 包裹、字段类型错误、页数不匹配，还是其他 schema 校验失败。普通未知错误会统一返回 `INTERNAL_ERROR`，并在脱敏后的 `details.message` 中保留失败原因；诊断不包含 API Key、Authorization header、密码或完整请求 prompt。

## 数据与文件

Prisma 使用 `DeckOutlineDraft` 保存账号维度的大纲草稿；`DeckProject`、`DeckSlide`、`DeckAsset` 继续保存生成历史、页面 JSON、图片图层索引和 PPTX 索引。`PptTemplate` 保存管理员维护的全局模板库，包含固定分类、自定义分类预留字段、名称、说明、标签、排序、启用状态和完整 `SlideCompositionPlan` JSON。删除大纲草稿只删除草稿记录，不影响已完成生成历史；删除生成历史会依赖数据库级联删除页面和资产记录，并清理对应本地项目目录。`ReusableImageAsset` 保存账号内可复用图片素材元数据，数据库只保存元数据，本地文件仍写入 `storage/`，不会因删除某个生成历史而清理账号级复用缓存。运行时文件写入：

```text
storage/decks/
storage/assets/
```

这些目录只保留 `.gitkeep`，实际生成的 SVG、图片缓存和 PPTX 文件不提交。`storage/decks/{projectId}` 保存单个 PPT 项目的图片图层与 PPTX 产物，`storage/assets/{userId}` 保存账号级可复用图片素材缓存。后续接入 Cloudflare R2 或其他 S3-compatible 对象存储时，可替换当前本地存储实现并保持 API URL 语义稳定。

## 后续方向

- 扩展更多图片生成 provider 的返回格式兼容，并沿用当前 `ImageLayerGenerator` 接口。
- 后续可将当前进程内后台 runner 替换为 BullMQ/Redis 队列，继续复用 `DeckProject.status`。
- 增强内容审核为可配置策略，支持严格拦截模式。
- 将 Web 动效计划映射到可编辑时间线，并探索 PowerPoint 动画兼容写入。
