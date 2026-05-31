# PPT创造大师

PPT创造大师是由 SJQ（木米禾）发起的 AI 驱动智能演示创作平台。当前版本聚焦“创作工作台”：用户输入想法和素材，选择 PPT 类型与叙事风格后，结合全局配色预设生成可预览、可下载、可追溯的 PPT。

## 当前状态

- 已手写初始化 Next.js App Router、React、TypeScript、Tailwind CSS v4、next-intl、本地主题 Provider、Prisma、MySQL、pptxgenjs、Vitest、React Testing Library 和 VitePress。
- 默认语言为 `zh-CN`，可切换 `en-US`；用户可见文案放在 `messages/`。
- 已新增邮箱密码登录/注册/退出，登录后的根路径会按角色分流：普通用户进入创作工作台，管理员进入管理端。
- 已新增管理员权限、管理端首页与用户管理页，管理员可查看用户、切换普通用户/管理员角色、启用或禁用账号，并可从管理端进入创作工作台。
- “体验设置”的“通用”页提供语言切换和退出登录入口，“账号”页提供邮箱、名称、头像上传和密码修改；头像超过 1MB 时会在上传前压缩，并保存到 `storage/uploads/avatars`。“外观”页提供浅色、深色、跟随系统和全应用配色预设切换。AI 供应商、LLM 模型和图片模型按账号隔离管理，并在进入对应设置页签时按需加载，API Key 加密后存入 MySQL，界面不回显明文。
- 创作工作台采用三步页面流程：输入想法和素材、确认 AI 输入分析、只读确认大纲草稿并可按需编辑、基于已保存大纲异步生成预览 PPT 和下载；同一大纲的生成中任务会被复用，长时间任务不再误报失败，生成历史只展示已完成且可打开的 PPT；素材上传支持文本、Markdown、CSV、JSON 和 `.docx` 文档，单文件最大 10MB。
- “生成大纲草稿”会先分析受众、目标、核心信息和推荐页数，用户确认后再生成结构大纲、统一视觉说明和每页详细文案 JSON；PPT 类型和叙事风格在全流程中只作为不可变引用值。
- 大纲确认页默认展示卡片化只读预览，包含封面、目录、章节和内容页；用户可直接生成预览 PPT，或点击“编辑大纲”后修改标题、摘要、页面文案和统一视觉说明。
- “生成预览PPT”会严格复用已保存的大纲草稿，并优先使用当前账号启用的默认 LLM 模型；未配置默认模型时继续读取 `.env`，仍无可用模型时自动使用本地模拟 fallback。生成任务会先创建历史记录再后台生成页面图层 JSON，前端等待页轮询状态；若后台失败，会展示真实失败原因和“失败详情”，方便定位 AI JSON 校验、图片生成或 PPTX 合成问题。
- 预览页已升级为三栏编辑器：左侧页面缩略图，中间 16:9 inch 画布，右侧编辑本页内容、选中元素位置和主题说明；保存当前页后会重新合成 PPTX。
- 图片素材按账号内缓存复用，命中已审核可用素材时复制登记为当前 PPT 资产；未命中时调用默认图片模型，生成后做规则质量审核。
- AI JSON 生成兼容部分 OpenAI-compatible 服务不支持 `response_format` 的情况，会从结构化输出退回 JSON mode，再按需退回纯 JSON 提示；重试提示会附带目标 JSON Schema。大纲生成会对 DeepSeek 等兼容模型返回的近似 JSON 做窄口径规范化，例如补齐大纲标题、页码、页面 ID 和统一视觉对象，再交给 zod 严格校验。模型输出中 JSON 字符串里的原始换行、制表符等控制字符会在解析前自动转义。多次修复后仍不符合 schema 时流程会中断，不自动降级成本地草稿，并在页面和 API `details` 中展示模型、schema、失败阶段和响应片段等调试信息。
- 生成链路已由 Next.js API 承载：输入分析、AI 拆页、统一视觉说明、单页元素编排、Mock 图片图层、内容审核、一致性评分、Web 动效元数据、PPTX 合成和账号历史保存。
- 图片图层第一版使用可插拔 Mock SVG 生成器，PPTX 使用 `pptxgenjs@4.0.1` 静态导出并写入 Web 动效备注/metadata；生成产物写入 `storage/decks`，并通过鉴权 API 读取。
- 当前目录暂未初始化 Git，也未配置远端同步。

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
DATABASE_URL=mysql://root:root@localhost:3306/ai-ppt?allowPublicKeyRetrieval=true
AI_CONFIG_ENCRYPTION_KEY= # 用于加密供应商 API Key
APP_ADMIN_EMAILS=admin@example.com # 逗号分隔的初始管理员邮箱
NEXT_ALLOWED_DEV_ORIGINS=192.168.0.117 # 允许访问 Next.js dev 资源的局域网来源
```

`AI_CONFIG_ENCRYPTION_KEY` 可以填写一段高强度随机字符串；服务端会派生 32 字节 AES-GCM 密钥。数据库 `ai-ppt` 需要在执行迁移前由用户准备好。本地 MySQL 8 使用默认 `caching_sha2_password` 且未启用 TLS 时，连接串需要保留 `allowPublicKeyRetrieval=true`，否则 MariaDB 驱动无法在认证阶段获取 RSA 公钥，页面可能显示 Prisma 连接池超时。

`APP_ADMIN_EMAILS` 支持填写一个或多个邮箱，注册、登录或读取会话时会把匹配邮箱同步为管理员。`/{locale}` 是登录后的角色分流入口：普通用户进入 `/{locale}/workbench`，管理员进入 `/{locale}/admin`。管理员可访问 `/{locale}/admin/users` 管理用户；禁用账号会立即清理该用户所有登录会话。

`NEXT_ALLOWED_DEV_ORIGINS` 仅影响本地开发服务，用于允许局域网设备访问 `/_next/*` 等开发资源。若本机局域网 IP 变化，可用逗号分隔填写新的来源。

## 目录结构

```text
src/        # Next.js 应用源码、组件、i18n、业务逻辑
tests/      # Vitest 与 React Testing Library 测试
messages/   # zh-CN 与 en-US 文案资源
docs/       # VitePress 中文文档
assets/     # 图片、字体、静态资源（待需要时添加）
storage/    # 本地运行时文件，保存头像、图片图层和 PPTX 产物
scripts/    # 本地开发或维护脚本（待需要时添加）
```

## 文档

详细说明见 `docs/`：

- `docs/guide/tech-stack.md`：已落地技术栈与暂缓引入项
- `docs/guide/commands.md`：开发、测试、文档命令
- `docs/guide/i18n.md`：国际化与文案约定
- `docs/guide/ai-settings-auth.md`：账号隔离、AI 供应商与 LLM 模型配置
- `docs/guide/ai-pipeline.md`：输入分析、AI 拆页、统一视觉说明和图层编排 JSON
- `docs/guide/theme-typography.md`：主题、配色与排版约定
