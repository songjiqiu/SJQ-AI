# AI 流水线

## 当前能力

当前版本将创作工作台拆成三步页面，并在耗时操作之间使用独立等待页：

1. `/{locale}/workbench`：用户输入创作想法、文本类文件、PPT 类型和叙事风格；PPT 类型和叙事风格使用一致的 4 列选项网格，保证同一桌面宽度下选项按钮等宽，叙事风格保持两行展示。输入页首屏使用收窄标题区、较窄左侧内容区和较窄右侧栏，右侧栏显示最近大纲草稿与生成历史，并可直接删除当前账号下的草稿或历史；重置和生成大纲草稿操作位于右侧栏下方并使用整行宽按钮，与左侧表单底部对齐。
2. `/{locale}/workbench/outline/analyze/loading`：浏览器从 `sessionStorage` 读取初始输入并调用 `POST /api/decks/outline/analyze`，仅生成受众、目标、核心信息和推荐页数。
3. `/{locale}/workbench/outline/analyze/confirm`：展示第一轮输入分析，允许用户编辑受众、目标、核心信息和推荐页数；PPT 类型和叙事风格只读展示，后续只能引用，不能由模型改写。
4. `/{locale}/workbench/outline/loading`：浏览器读取确认后的输入并调用 `POST /api/decks/outline`，先生成结构大纲和统一视觉说明，再一次性生成每页详细文案 JSON。
5. `/{locale}/workbench/outline/{id}`：默认以只读卡片化视图展示已保存大纲，包含封面、目录、章节和内容页；底部操作栏中间展示预览/编辑状态、页数和编辑入口，用户可直接生成预览 PPT，也可点击“编辑大纲”后修改整套标题、摘要、统一视觉说明和每页文案；底部操作栏提供删除入口，生成中的关联任务存在时会阻止删除。
6. `/{locale}/workbench/generate/loading`：浏览器从 `sessionStorage` 读取 `outlineDraftId` 并调用 `POST /api/decks/generate` 创建异步生成任务，随后轮询 `GET /api/decks/{id}/status`。若同一大纲 30 分钟内已有生成中任务，服务端会复用原任务，避免重复生成历史。
7. `/{locale}/workbench/preview/{id}`：展示三栏预览编辑器，左侧为页面缩略图，中间为 16:9 图层画布，右侧编辑本页内容、选中元素位置和主题说明，并提供当前页保存、换模板、重新生成当前页、PPTX 下载和生成历史删除。

大纲草稿生成采用三段式 LLM 流程。第一轮只分析输入意图；第二轮基于确认后的受众、目标、核心信息和页数生成结构大纲与统一视觉说明；第三轮基于结构大纲生成每页详细文案 JSON。输入中的 `deckType` 决定 PPT 的场景结构与页面组织方式，默认 `business-report`（商务汇报）；`style` 决定叙事与表达方式，默认 `strategic`（战略叙事）。这两个字段在每轮 LLM 返回中都使用动态 zod literal 校验，必须等于用户原始选择，模型只能引用，不能改写、翻译或替换。预览 PPT 生成必须复用已保存的大纲草稿，不重新拆页。程序会根据每页文案判断表达意图、内容层级、页面设计方案、语义化元素和图片素材需求，返回页面图层 JSON，而不是整页图片。页面坐标使用 inch，默认 16:9 画布为 `13.333 x 7.5`，安全边距 `0.5`。图片生成优先读取当前账号默认图片模型及其关联供应商，推荐模型 ID 为 `gpt-image-2`；若供应商未配置 API Key 或调用失败，会回退到可插拔 Mock SVG 图层并在 provider 中标记回退来源。PPTX 使用 `pptxgenjs@4.0.1` 静态导出。

图片素材会先按账号内缓存复用。缓存 key 由当前账号、图片模型、图片类型、比例、透明背景、完整 prompt、avoid、关键词和统一视觉风格归一化后生成。若存在 `APPROVED` 且本地文件仍可读取的素材，会复制登记为当前 `DeckProject` 的 `DeckAsset`，继续沿用现有鉴权下载逻辑；未命中时才调用图片模型。生成后先做规则质量审核，包括 MIME、文件大小、尺寸、fallback 状态和禁用内容；视觉 LLM 审核是可选增强，默认模型不支持图片输入时记录为 `rules-only-fallback`，不会阻断生成。

布局计算会检测越界、文字溢出、元素重叠和页面密度。标题最多 2 行，正文每页最多 5 个信息块；标题字号 22-34，副标题 16-22，正文 12-18，注释 8-11。中文换行按字符宽度估算，中文字符约 `fontSize * 0.55 / 72` inch，行高默认 `1.25`。溢出修复顺序为降低字号、压缩正文、调整版式、生成拆页建议、标记需要用户确认；当前版本不会自动增加页数。

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
DATABASE_URL=        # MySQL 连接串，例如 mysql://root:root@localhost:3306/ai-ppt?allowPublicKeyRetrieval=true
AI_CONFIG_ENCRYPTION_KEY= # 用于加密供应商 API Key
```

## 服务端接口

`POST /api/decks/outline/analyze`

第一轮输入分析接口。请求字段：

- `idea`：创作想法，必填。
- `sourceText`：兼容旧调用的补充文本字段，当前创作输入页不再展示该入口，前端固定传空字符串。
- `textFiles`：浏览器端读取出的文本与文档内容，最多 5 个，单文件最大 10MB，支持 `.txt`、`.md`、`.markdown`、`.csv`、`.json`、`.docx`；`.docx` 会在浏览器端提取正文后提交。
- `deckType`：PPT 类型，默认 `business-report`，按使用场景分组展示。
- `style`：叙事风格，默认 `strategic`。
- `palette`：配色预设。
- `locale`：`zh-CN` 或 `en-US`。

返回字段包括原始 `input`、`fileSummaries`、不可变 `deckType` / `style`、`audience`、`goal`、`coreMessage` 和 `recommendedPageCount`。该接口不写数据库，前端只将结果暂存在浏览器会话中等待用户确认。

`POST /api/decks/outline`

确认后的大纲草稿生成接口。除第一轮输入字段外，还必须传入 `confirmedIntent`：

- `confirmedIntent.deckType`、`confirmedIntent.style`：必须与原始 `deckType`、`style` 完全一致。
- `confirmedIntent.audience`：确认后的目标受众。
- `confirmedIntent.goal`：确认后的表达目标。
- `confirmedIntent.coreMessage`：确认后的核心信息。
- `confirmedIntent.recommendedPageCount`：确认后的最终页数，范围 3-18。

内置 PPT 类型包括：

- 商务办公：`business-report`、`fundraising-pitch`、`proposal`、`project-plan`、`retrospective-summary`。
- 销售市场：`product-launch`、`sales-proposal`、`brand-marketing`、`event-promotion`。
- 教学培训：`training-course`、`knowledge-sharing`、`teaching-deck`。
- 研究分析：`research-report`、`data-analysis`、`industry-insight`。
- 运营活动：`operation-plan`、`growth-experiment`。
- 个人展示：`portfolio`、`personal-review`、`community-sharing`。

内置叙事风格包括 `strategic`、`data`、`story`、`problem-solution`、`minimal`、`teaching`、`visual-proposal`、`retrospective`。旧数据中的 `product` 风格仍可被 schema 解析，用于兼容历史草稿和历史生成记录；新输入页不再展示该旧风格。

返回字段：

- `id`：大纲草稿 ID。
- `mode`：`ai-json` 或 `mock`。
- `deckTitle`、`deckSummary`：整套 PPT 标题与摘要。
- `input`、`fileSummaries`、`intentAnalysis`：合并后传入 LLM 的输入、文件摘要和用户确认后的输入分析。
- `unifiedVisualSpec`：统一视觉说明。
- `slides`：每页标题、副标题、正文要点、演讲目标和视觉意图。
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

`GET /api/decks/{id}/status`

查询异步生成状态。返回字段包括 `id`、`status`、`progress`、`previewUrl`、`error` 和 `details`。当状态为 `READY` 时，前端进入 `/{locale}/workbench/preview/{id}`；当状态为 `FAILED` 时，后台会把页面图层 LLM、图片生成、质量审核、PPTX 合成等任意阶段的异常写入 `DeckProject.generationError` 与 `generationProgress.message`，接口优先返回 `generationError`，为空时回退到 `progress.message`。等待页只有明确收到 `FAILED` 才显示“预览 PPT 生成失败”；长时间仍为 `GENERATING` 时显示“生成仍在后台继续”，并继续低频轮询，任务完成后仍会自动进入预览。若状态异常但项目已具备 PPTX 产物和完整页面，状态接口会修正为 `READY` 并返回预览地址，避免已完成产物被失败兜底降级。

`PATCH /api/decks/{id}/slides/{slideId}`

保存当前页内容和元素位置。服务端会重新计算布局诊断、更新页面 JSON，并立即重新合成 PPTX，使下载文件反映最新编辑。

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

## 结构约定

页面坐标使用 inch，画布固定为 `13.333 x 7.5` 的 16:9。旧历史数据如果仍使用 0-100 百分比，会在读取时转换为 inch。`SlideElement` 支持 `text`、`generatedImage`、`shape`、`icon`、`chartPlaceholder`，并带有 `semanticType`、`hierarchyLevel`、`textStyle` 和 `editable`。当元素类型为 `generatedImage` 时，必须通过 `imageRequestId` 关联 `imageLayerRequests`，生成完成后再关联 `generatedImageLayers`。

所有 AI 输出都必须通过 zod 校验。模型不能返回 Markdown、代码围栏或 JSON 前后的解释文本；严格结构化输出、纯 JSON 解析或 zod 校验失败时，会使用同一个模型退回 JSON mode 修复一次，并在重试提示中附带目标 JSON Schema。为兼容 DeepSeek 等 OpenAI-compatible 服务暂不支持 `response_format: {"type":"json_schema"}` 的情况，若接口明确返回 `response_format` 不可用或不支持，服务端会再发起一次不携带 `response_format` 的纯 JSON 提示兜底。大纲生成链路会在最终 zod 校验前做窄口径规范化：只有页数匹配且 `slides` 存在时，才会补齐缺失的大纲标题、摘要、`slideId`、`index`，把字符串或常见错形的 `unifiedVisualSpec` 转换为严格对象，并移除 `locale`、`palette`、`pageCount` 等多余顶层字段。若模型把原始换行、制表符等控制字符直接写进 JSON 字符串，解析前会先转义为合法 JSON 字符。以上修复后仍无法通过 zod 校验时，API 返回 `AI_JSON_GENERATION_FAILED` 并中断流程，不自动降级成本地 mock 草稿。

`AI_JSON_GENERATION_FAILED` 会在响应 `details` 中返回结构化诊断，字段包括 `message`、`schemaName`、`model` 和 `attempts`。每个 attempt 记录 `mode`、`stage`、`error`，并在可用时附带 `zodIssues` 与截断后的 `responseSnippet`。前端等待页会展示中文摘要和“失败详情 / Failure details”折叠区，便于定位是模型不支持 `response_format`、JSON 语法错误、Markdown 包裹、字段类型错误、页数不匹配，还是其他 schema 校验失败。普通未知错误会统一返回 `INTERNAL_ERROR`，并在脱敏后的 `details.message` 中保留失败原因；诊断不包含 API Key、Authorization header、密码或完整请求 prompt。

## 数据与文件

Prisma 使用 `DeckOutlineDraft` 保存账号维度的大纲草稿；`DeckProject`、`DeckSlide`、`DeckAsset` 继续保存生成历史、页面 JSON、图片图层索引和 PPTX 索引。删除大纲草稿只删除草稿记录，不影响已完成生成历史；删除生成历史会依赖数据库级联删除页面和资产记录，并清理对应本地项目目录。`ReusableImageAsset` 保存账号内可复用图片素材元数据，数据库只保存元数据，本地文件仍写入 `storage/`，不会因删除某个生成历史而清理账号级复用缓存。运行时文件写入：

```text
storage/decks/
```

该目录只保留 `.gitkeep`，实际生成的 SVG/PPTX 文件不提交。后续接入 Cloudflare R2 或其他 S3-compatible 对象存储时，可替换当前本地存储实现并保持 API URL 语义稳定。

## 后续方向

- 扩展更多图片生成 provider 的返回格式兼容，并沿用当前 `ImageLayerGenerator` 接口。
- 后续可将当前进程内后台 runner 替换为 BullMQ/Redis 队列，继续复用 `DeckProject.status`。
- 增强内容审核为可配置策略，支持严格拦截模式。
- 将 Web 动效计划映射到可编辑时间线，并探索 PowerPoint 动画兼容写入。
