# PPT创造大师

PPT创造大师是由 SJQ（木米禾）发起的 AI 驱动智能演示创作平台。当前版本聚焦“创作工作台”：用户输入想法和素材，选择 PPT 类型与叙事风格后，生成统一视觉说明和可预览、可下载、可追溯的 PPT。

## 当前状态

- 已手写初始化 Next.js App Router、React、TypeScript、Tailwind CSS v4、next-intl、本地主题 Provider、Prisma、MySQL、pptxgenjs、Vitest、React Testing Library 和 VitePress；数据库模型维护中文 Prisma 文档注释与 MySQL 表/字段注释。
- 默认语言为 `zh-CN`，可切换 `en-US`；用户可见文案放在 `messages/`。
- 已新增邮箱密码登录/注册/退出，登录后的根路径会按角色分流：普通用户进入创作工作台，管理员进入管理端。
- 已新增管理员权限、管理端首页与用户管理页，管理员可查看用户、切换普通用户/管理员角色、启用或禁用账号，并可从管理端进入创作工作台。
- 管理端已新增“PPT模板库管理”，提供 PPT 模板库管理和语义元素资源库。管理员可按章节页、封面大标题、标题 + 正文/要点、大图背景、左右图文、图表、对比、引用/金句页、时间轴、流程/步骤、关键指标页、四象限/矩阵和结束页等固定分类维护多套模板；模板保存完整 `SlideCompositionPlan` 页面 JSON，并可在可视化设计器中编辑图层、元素坐标、文字样式和图片请求。语义元素资源库覆盖图标、图形、线条、文本样式、容器组件和导航组件六类资产，采用 `TemplateAsset` 公共主表加六类详情表保存；AI 生成资产默认进入待审核池，正式检索只返回启用且已入库的资源。通用模板包位于 `assets/templates/universal-v1/`，可在模板库顶部一键导入 45 个模板，导入时会替换 15 个固定分类下的旧模板。语义资产库按空库重建，旧 792 条通用资产包不再恢复，仅保留 `assets/template-assets/common-fallback-v1/` 的 18 条基础兜底资产。
- “体验设置”的“通用”页提供语言切换和退出登录入口，“账号”页提供邮箱、名称、头像上传和密码修改；头像超过 1MB 时会在上传前压缩，并保存到 `storage/uploads/avatars`。“外观”页提供浅色、深色、跟随系统和全应用配色预设切换。AI 供应商、LLM 模型和图片模型按账号隔离管理，并在进入对应设置页签时按需加载，API Key 加密后存入 MySQL，界面不回显明文。
- 创作工作台采用三步页面流程：输入想法和素材、确认整体结构、只读确认大纲草稿并可按需编辑、基于已保存大纲异步生成预览 PPT 和下载；第一轮输入分析仍保存受众、目标、核心信息作为隐藏上下文，但前端主要展示并允许确认/调整页数、PPT 类型、模型生成的叙事风格、全局主题、章节结构和页面清单；页数全链路范围为 6-40，默认 6；同一大纲的生成中任务会被复用，长时间任务不再误报失败，生成历史只展示已完成且可打开的 PPT；素材上传会先调用 `POST /api/decks/outline/files` 在服务端解析，不落库、不生成 PPT，支持文本、Markdown、CSV、JSON、`.docx`、`.pptx`、`.xlsx`、PDF 和图片文件，单文件最大 10MB。旧版 `.doc`、`.ppt`、`.xls` 会返回明确不支持提示。
- “生成大纲草稿”采用严格分阶段 LLM：第一轮基于 `GenerationInput` 只生成隐藏意图上下文、推荐页数和 `lightweightOutline` 轻量大纲，字段包括 `deckTitle`、`deckType`、`narrativeStyle`、`pageCount`、`globalTheme`、`chapters` 和 `pages`；每页只包含 `pageNumber`、`pageType`、`layoutType`、`title`、`purpose`、`keyMessage`、`sourceIds`、`chapterId`、`narrativeRole`，不生成 `contentBlocks`、正文段落、图表数据、图片关键词、坐标、元素层级或具体视觉样式。用户确认或修改后，第二轮只生成统一视觉说明结构化 JSON；第三轮只生成每页详细大纲，决定每页讲什么；第四轮只生成每页可展示内容 JSON，包括标题、副标题、正文要点和 `contentBlocks`。服务端解析文件时稳定生成 `sourceId`，格式如 `src_f001_c001`；模型只能引用已有来源，输出中的 `sourceIds` 会做存在性校验和过滤。`contentBlocks` canonical 结构为 `{ type, content, priority, sourceIds }`，类型只允许 `heading`、`text`、`list`、`image`、`table`、`chart`、`quote`、`callout`、`metric`、`comparison`、`timeline`、`steps`、`summary`、`conclusion`、`source`，每页最多 12 条；旧 `{ blockType, text, priority }` 仍可读取兼容并归一化。统一视觉说明不新增 Markdown 全文字段，`themeName` 作为主体名称，并保存 `visualStyle`、`designIntent`、`usageConvenience`、分组 `colorPalette`、颜色角色、透明度规则、页面规格、字体层级、图片规则、组件规则和高级规则。第四步会严格校验页数、`deckType`、`locale`、`slideId/index`、轻量大纲/详细大纲/展示 JSON 一致性，以及第三轮不得改写统一视觉说明；失败直接返回错误且不保存草稿，不自动修复或保存部分结果。PPT 类型在全流程中只作为不可变引用值。
- 大纲确认页默认展示卡片化只读预览，包含整体目录、统一视觉说明、每页详细大纲和可展示内容 JSON；统一视觉说明中的图片生成/使用规则、规则清单和高级规则使用与“版式与字体”一致的两列信息卡展示，减少长规则堆叠；用户可直接生成预览 PPT，或点击“编辑大纲”后修改标题、摘要、详细大纲、`contentBlocks` 和结构化统一视觉说明字段。
- “生成预览PPT”会严格复用已保存的大纲草稿，并优先使用当前账号启用的默认 LLM 模型；未配置默认模型时继续读取 `.env`，仍无可用模型时自动使用本地模拟 fallback。生成任务会先创建历史记录再后台生成页面图层 JSON，并把每页 `contentBlocks` 作为最终可展示内容源：语义元素、模板套用和确定性补齐层会确保每个内容块都有对应画布元素；前端等待页轮询状态，若后台失败，会展示真实失败原因和“失败详情”，方便定位 AI JSON 校验、图片生成或 PPTX 合成问题。
- 预览页已升级为三栏编辑器：左侧页面缩略图，中间 16:9 inch 画布，右侧“每页可展示内容”面板展示 `contentBlocks` 与全部画布图层的统一列表；已绑定 `contentBlockIndex` 的内容块显示类型、优先级、内容、元素图标和图层层级，未绑定内容块标记“未落版”，未绑定图片、形状、图标、图表、背景和装饰等图层也会显示并可点击选中。语义元素还会携带 `styleRole`，用于绑定统一视觉规范角色；点击“编辑正文条目”后只修改 `bodyPoints` 并同步到画布正文/卡片文本元素；标题、副标题和其他文本通过点击画布文本后在“选中元素”面板编辑，纯形状、图片、图标、图表、页脚不受正文条目同步影响；顶部提供“统一视觉说明”按钮并以大弹窗只读展示完整视觉规范；页面缩略图、主画布和 PPTX 导出均使用当前 PPT 的统一视觉说明色板，全应用外观配色只影响工作台外壳；保存当前页后会重新合成 PPTX。
- 图片素材按账号内缓存复用，命中已审核可用素材时复制登记为当前 PPT 资产；未命中时调用默认图片模型，生成后做规则质量审核。单张图片生成默认 120 秒超时，超时或供应商异常会自动回退到本地 Mock SVG，避免后台停在“精修图片素材”。
- AI JSON 生成兼容部分 OpenAI-compatible 服务不支持 `response_format` 的情况，会从结构化输出退回 JSON mode，再按需退回纯 JSON 提示；重试提示会附带目标 JSON Schema。大纲草稿的统一视觉、详细大纲和可展示内容阶段不做 schema 失败后的模型改写重试，只保留窄口径格式兼容和严格 zod 校验；第四阶段会在校验前把已有 `contentBlocks` 的字段别名、旧类型、非法类型、空字段、近重复内容和超界优先级归一化为 canonical 字段、合法枚举与 `1-5`，并按优先级保留最多 12 条。单页语义编排仍会在严格校验前补齐 `contentHierarchy.tiers` 三层中的空 `items`，保留有效模型输出并用页面副标题、来源要求或讲解备注补足缺口。模型输出中 JSON 字符串里的原始换行、制表符等控制字符会在解析前自动转义。校验失败时流程会中断，不自动降级成本地草稿，并在页面和 API `details` 中展示模型、schema、失败阶段和响应片段等调试信息。
- 生成链路已由 Next.js API 承载：文件解析和切块、`GenerationInput` 校验、输入分析、结构目录、统一视觉说明、每页详细大纲、可展示内容 JSON、确认后语义化页面设计方案、模板选择、可展示内容落版补齐、语义元素资产增强、Mock 图片图层、内容审核、一致性评分、Web 动效元数据、PPTX 合成和账号历史保存。解析后的来源、文件摘要和输入快照复用现有 JSON 字段保存，不新增数据库表。语义元素资产增强会在模板或内置排版产出页面 JSON 后检索已启用且审核通过的六类资产，把匹配资源写入元素的 `assetBinding` 与 `assetStyle`；检索失败或未命中时只记录诊断，不阻断生成。旧预览不会在读取时自动改写，缺失落版的历史页面可通过“重新生成当前页”修复。
- 图片图层第一版使用可插拔 Mock SVG 生成器，PPTX 使用 `pptxgenjs@4.0.1` 静态导出并写入 Web 动效备注/metadata；生成产物写入 `storage/decks`，并通过鉴权 API 读取。
- 当前目录已初始化 Git 仓库，并已配置 GitHub 远端 `https://github.com/songjiqiu/SJQ-AI.git`。

## 环境要求

- Node.js：`>=20.9.0`，当前开发机确认为 `v24.15.0`
- pnpm：`>=9.7.1`，`packageManager` 记录为 `pnpm@9.7.1`

## 常用命令

```bash
pnpm install      # 安装依赖
pnpm dev          # 启动本地开发服务，由用户自行执行
pnpm test         # 运行 Vitest/RTL 测试，不包含打包测试
pnpm lint         # 运行 ESLint
pnpm typecheck    # 运行 TypeScript no-emit 类型检查
pnpm db:generate  # 生成 Prisma Client
pnpm db:migrate   # 执行 Prisma 本地迁移
pnpm build        # 生产构建，仅在明确需要时运行
pnpm docs:dev     # 启动 VitePress 文档站点
pnpm docs:build   # 构建 VitePress 文档
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需填写：

```bash
OPENAI_API_KEY=      # OpenAI-compatible API Key，留空则使用本地模拟
OPENAI_BASE_URL=     # 可选，兼容服务商 base URL
AI_TEXT_MODEL=       # 可选，默认 gpt-4.1-mini
IMAGE_API_KEY=       # 可选，OpenAI-compatible 图片生成 API Key，留空则使用本地图片模拟
IMAGE_BASE_URL=      # 可选，图片生成兼容服务商 base URL
AI_IMAGE_MODEL=      # 可选，默认 gpt-image-2
IMAGE_REQUEST_TIMEOUT_MS=120000 # 可选，单张图片生成/下载超时，默认 120 秒
DATABASE_URL=mysql://root:root@localhost:3306/ai-ppt?allowPublicKeyRetrieval=true
AI_CONFIG_ENCRYPTION_KEY= # 用于加密供应商 API Key
APP_ADMIN_EMAILS=admin@example.com # 逗号分隔的初始管理员邮箱
NEXT_ALLOWED_DEV_ORIGINS=192.168.0.117 # 允许访问 Next.js dev 资源的局域网来源
```

`AI_CONFIG_ENCRYPTION_KEY` 可以填写一段高强度随机字符串；服务端会派生 32 字节 AES-GCM 密钥。数据库 `ai-ppt` 需要在执行迁移前由用户准备好。本地 MySQL 8 使用默认 `caching_sha2_password` 且未启用 TLS 时，连接串需要保留 `allowPublicKeyRetrieval=true`，否则 MariaDB 驱动无法在认证阶段获取 RSA 公钥，页面可能显示 Prisma 连接池超时。

`APP_ADMIN_EMAILS` 支持填写一个或多个邮箱，注册、登录或读取会话时会把匹配邮箱同步为管理员。`/{locale}` 是登录后的角色分流入口：普通用户进入 `/{locale}/workbench`，管理员进入 `/{locale}/admin`。管理员可访问 `/{locale}/admin/users` 管理用户，也可访问 `/{locale}/admin/templates` 管理 PPT 模板库；禁用账号会立即清理该用户所有登录会话。

`NEXT_ALLOWED_DEV_ORIGINS` 仅影响本地开发服务，用于允许局域网设备访问 `/_next/*` 等开发资源。若本机局域网 IP 变化，可用逗号分隔填写新的来源。

## 目录结构

```text
src/        # Next.js 应用源码、组件、i18n、业务逻辑
tests/      # Vitest 与 React Testing Library 测试
messages/   # zh-CN 与 en-US 文案资源
docs/       # VitePress 中文文档
assets/     # 图片、字体、静态资源与通用 PPT 模板 JSON 包
storage/    # 本地运行时文件，保存头像、图片图层和 PPTX 产物
scripts/    # 本地开发或维护脚本（待需要时添加）
```

## 文档

详细说明见 `docs/`：

- `docs/guide/tech-stack.md`：已落地技术栈与暂缓引入项
- `docs/guide/commands.md`：开发、测试、文档命令
- `docs/guide/i18n.md`：国际化与文案约定
- `docs/guide/ai-settings-auth.md`：账号隔离、AI 供应商与 LLM 模型配置
- `docs/guide/ai-pipeline.md`：输入分析、分阶段大纲生成、统一视觉说明、语义化页面设计方案和图层编排 JSON
- `docs/guide/admin-templates.md`：管理端 PPT 模板库、固定分类和设计器行为
- `docs/guide/universal-ppt-template-spec.md`：45 套通用 PPT 模板设计规范
- `docs/guide/theme-typography.md`：主题、配色与排版约定

通用 PPT 模板 JSON 包位于 `assets/templates/universal-v1/`，包含 45 个模板和 `manifest.json` 清单。管理员可通过模板库顶部“导入通用模板”批量写入模板库，也可使用“新建模板 > 从JSON导入”按单文件导入。
