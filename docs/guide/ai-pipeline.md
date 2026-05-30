# AI 流水线

## 当前能力

当前版本将创作工作台拆成三步页面，并在两次耗时操作之间使用独立等待页：

1. `/{locale}/workbench`：用户输入创作想法、文本类文件、PPT 类型和叙事风格；PPT 类型与叙事风格采用紧凑分组单选布局，保证内置选项直接可见。桌面端会在右侧栏显示最近大纲草稿与生成历史，并把重置和生成大纲草稿操作放在生成历史下方；移动端则随右侧栏内容显示在表单下方，便于继续编辑或打开已有 PPT。
2. `/{locale}/workbench/outline/loading`：浏览器从 `sessionStorage` 读取输入并调用 `POST /api/decks/outline`。
3. `/{locale}/workbench/outline/{id}`：展示并允许编辑整套标题、摘要、统一视觉说明和每页文案。
4. `/{locale}/workbench/generate/loading`：浏览器从 `sessionStorage` 读取 `outlineDraftId` 并调用 `POST /api/decks/generate`。
5. `/{locale}/workbench/preview/{id}`：展示完整 PPT 页面缩略图、主画布预览、图片图层、Web 动效、内容审核、一致性评分和 PPTX 下载。

第一步只负责拆分 PPT 页面文案大纲和统一视觉说明。输入中的 `deckType` 决定 PPT 的场景结构与页面组织方式，默认 `business-report`（商务汇报）；`style` 决定叙事与表达方式，默认 `strategic`（战略叙事）。第二步完整生成必须复用已保存的大纲草稿，不重新拆页。程序会根据每页文案判断哪些内容使用文字、哪些内容生成图片，并返回元素位置、大小、层级等结构化 JSON；之后根据图片图层请求与统一视觉说明生成图片图层。图片生成优先读取当前账号默认图片模型及其关联供应商，推荐模型 ID 为 `gpt-image-2`；若供应商未配置 API Key 或调用失败，会回退到可插拔 Mock SVG 图层并在 provider 中标记回退来源。PPTX 使用 `pptxgenjs@4.0.1` 静态导出。

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
DATABASE_URL=        # MySQL 连接串，例如 mysql://root:root@localhost:3306/ai-ppt
AI_CONFIG_ENCRYPTION_KEY= # 用于加密供应商 API Key
```

## 服务端接口

`POST /api/decks/outline`

第一步大纲草稿生成接口。请求字段：

- `idea`：创作想法，必填。
- `sourceText`：兼容旧调用的补充文本字段，当前创作输入页不再展示该入口，前端固定传空字符串。
- `textFiles`：浏览器端读取出的文本与文档内容，最多 5 个，单文件最大 10MB，支持 `.txt`、`.md`、`.markdown`、`.csv`、`.json`、`.docx`；`.docx` 会在浏览器端提取正文后提交。
- `audience`：目标受众。
- `goal`：表达目标。
- `pageCount`：页数，范围 3-12。
- `deckType`：PPT 类型，默认 `business-report`，按使用场景分组展示。
- `style`：叙事风格，默认 `strategic`。
- `palette`：配色预设。
- `locale`：`zh-CN` 或 `en-US`。

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
- `input`、`fileSummaries`：合并后传入 LLM 的输入与文件摘要。
- `unifiedVisualSpec`：统一视觉说明。
- `slides`：每页标题、副标题、正文要点、演讲目标和视觉意图。
- `createdAt`、`updatedAt`：草稿创建与更新时间。

草稿接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/decks/outline` | 当前账号最近 20 条大纲草稿；作为工作台侧栏快捷入口，读取时会跳过不符合当前结构约束的历史草稿，本地未执行大纲草稿表迁移时返回空列表 |
| `GET` | `/api/decks/outline/{id}` | 当前账号某个大纲草稿 |
| `PATCH` | `/api/decks/outline/{id}` | 保存编辑后的大纲 JSON |

完整 PPT 生成必须复用已保存并编辑后的大纲 JSON，不能重新拆页。

`POST /api/decks/generate`

请求字段：

- `outlineDraftId`：当前账号下已保存的大纲草稿 ID。

接口要求用户已登录。服务端会读取当前用户的大纲草稿，使用草稿内的 `input`、`slides` 和 `unifiedVisualSpec` 继续生成单页元素编排、图片图层请求、图片图层文件和 PPTX。若当前账号存在启用的默认 LLM 模型，则服务端使用该模型关联的供应商 Base URL、API Key 和默认温度发起 OpenAI-compatible 调用。

返回字段：

- `id`、`status`：生成历史 ID 与状态。
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
| `GET` | `/api/decks` | 当前账号最近 20 条 PPT 生成历史 |
| `GET` | `/api/decks/{id}` | 当前账号某个 PPT 的完整结果 |
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

旧的 `POST /api/decks/analyze` 仍保留为拆页与单页编排调试接口，前端工作台完整生成默认使用 `/api/decks/generate` 并只传入 `outlineDraftId`。

## 结构约定

页面坐标使用 0-100 百分比，画布固定为 16:9。`SlideElement` 支持 `text`、`generatedImage`、`shape`、`icon`、`chartPlaceholder`。当元素类型为 `generatedImage` 时，必须通过 `imageRequestId` 关联 `imageLayerRequests`，生成完成后再关联 `generatedImageLayers`。

所有 AI 输出都必须通过 zod 校验。严格结构化输出失败时，会退回 JSON mode 再重试一次；仍失败则返回错误。

## 数据与文件

Prisma 使用 `DeckOutlineDraft` 保存账号维度的大纲草稿；`DeckProject`、`DeckSlide`、`DeckAsset` 继续保存完整生成历史、页面 JSON、图片图层索引和 PPTX 索引。运行时文件写入：

```text
storage/decks/
```

该目录只保留 `.gitkeep`，实际生成的 SVG/PPTX 文件不提交。后续接入 Cloudflare R2 或其他 S3-compatible 对象存储时，可替换当前本地存储实现并保持 API URL 语义稳定。

## 后续方向

- 扩展更多图片生成 provider 的返回格式兼容，并沿用当前 `ImageLayerGenerator` 接口。
- 将同步生成迁移到 BullMQ/Redis 异步任务，复用 `DeckProject.status`。
- 增强内容审核为可配置策略，支持严格拦截模式。
- 将 Web 动效计划映射到可编辑时间线，并探索 PowerPoint 动画兼容写入。
