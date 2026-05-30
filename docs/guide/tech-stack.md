# 技术栈

## 已落地

| 类别 | 技术 | 版本或范围 | 用途 |
| --- | --- | --- | --- |
| 运行时 | Node.js | `>=20.9.0`，本机 `v24.15.0` | 本地开发与构建运行时 |
| 包管理 | pnpm | `>=9.7.1`，记录 `pnpm@9.7.1` | 安装依赖、运行脚本 |
| 应用框架 | Next.js App Router | `16.2.6` | 页面路由、服务端渲染、应用组织 |
| UI 开发 | React | `19.2.6` | 组件开发 |
| 类型系统 | TypeScript | `6.0.3` | 静态类型约束 |
| 样式 | Tailwind CSS、shadcn/ui 约定 | `4.3.0` | 原子化样式、设计 token、基础组件组织 |
| 国际化 | next-intl | `4.12.0` | `zh-CN` / `en-US` 语言切换 |
| 主题 | 本地主题 Provider | 项目内实现 | 浅色、深色、跟随系统，避免运行时内联脚本 |
| 表单 | react-hook-form | `7.76.0` | 前端表单状态 |
| 校验 | zod | `4.4.3` | 表单 schema 校验 |
| 头像处理 | Browser Canvas API | 浏览器内置 | 上传头像超过 1MB 时在前端压缩 |
| 文档解析 | jszip | `3.10.1` | 在浏览器端读取 `.docx` 并提取正文作为 PPT 参考内容 |
| 通知 | sonner | `2.0.7` | Toast 提示 |
| 图标 | lucide-react | `1.16.0` | 工具栏与按钮图标 |
| AI 接入 | openai SDK | `6.38.0` | OpenAI-compatible 文本模型与图片模型调用 |
| PPTX 合成 | pptxgenjs | `4.0.1` | 将页面 JSON、文字、形状和图片图层合成为静态 PPTX |
| 数据库 ORM | Prisma、@prisma/client | `7.8.0` | MySQL 数据建模、迁移与查询 |
| MySQL Adapter | @prisma/adapter-mariadb | `7.8.0` | Prisma 7 连接 MySQL/MariaDB 兼容数据库 |
| 本地文件存储 | Node.js fs/promises | 内置 | 保存头像、Mock 图片图层和 PPTX 产物 |
| 测试 | Vitest、Vite、React Testing Library | `4.1.7`、`8.0.13`、`16.3.2` | 前端单元测试与组件测试 |
| 文档 | VitePress | `1.6.4` | 中文为主的项目文档 |

## 暂缓引入

当前已接入 OpenAI-compatible 文本模型，用于拆页文案、统一视觉说明和页面元素编排 JSON；也已接入统一模型配置表，用于按账号维护 LLM、图片和向量模型，三类模型都复用 AI 供应商的 Base URL 与 API Key。图片生成可通过 `gpt-image-2` 等图片模型生成 PPT 图片图层，未配置或失败时回退 Mock SVG。Prisma + MySQL 已用于邮箱密码账号、会话、管理员权限、用户启用状态、AI 供应商、统一模型配置、PPT 生成历史、页面 JSON 和产物索引。Next.js API 是当前唯一后端入口；`storage/uploads/avatars` 保存头像，`storage/decks` 保存图片图层和 PPTX 产物。Next.js 16 使用 `src/proxy.ts` 承载 next-intl 路由代理逻辑，不再使用已弃用的 `middleware.ts` 文件约定。仍暂缓接入异步队列、对象存储、观测、向量库、图库或 Docker Compose。后续引入 Redis、BullMQ、Qdrant、Neo4j、Cloudflare R2、Langfuse、LangGraph 等能力时，需要同步补充用途、版本范围、环境变量和常用命令。
