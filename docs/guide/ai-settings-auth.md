# AI 设置与账号隔离

## 账号体系

应用已提供邮箱密码注册、登录和退出。登录后的根路径 `/{locale}` 会按角色分流：普通用户进入 `/{locale}/workbench` 创作工作台，管理员进入 `/{locale}/admin` 管理端。工作台和管理端页面都需要登录后访问，服务端使用 `pptcm_session` HttpOnly Cookie 保存会话标识，数据库只存储会话 token 的 SHA-256 哈希。

登录后可在“体验设置 > 账号”中查看账号邮箱，维护显示名称、上传头像，并通过当前密码修改登录密码。头像上传支持 PNG、JPEG 和 WebP；超过 1MB 的图片会先在浏览器端压缩，再写入 `storage/uploads/avatars`，数据库中的 `avatarUrl` 保存为 `/uploads/avatars/{file}` 形式的本地访问路径。后续接入对象存储时，可将该目录替换为 Cloudflare R2 或其他 S3-compatible 存储。

首版不包含邮箱验证、找回密码和第三方登录。注册成功后会自动创建 `ollama` 与 `deepseek` 两个 AI 供应商模板；这些模板不会预置 API Key，也不会自动创建默认 LLM、图片或向量模型。

体验设置打开时默认只加载当前账号会话。AI 供应商、LLM 模型、图片模型和向量模型会在用户进入对应页签时按需读取，并按接口独立容错：某个配置接口短暂不可用或本地数据库尚未执行对应迁移时，不会拖空已经成功读取的供应商或模型列表。向量模型当前只完成配置管理，实际知识库与检索调用会在后续能力中接入。

## 管理员权限

账号支持两级权限：`USER` 普通用户和 `ADMIN` 管理员。通过环境变量 `APP_ADMIN_EMAILS` 指定的邮箱会在注册、登录或读取会话时同步为管理员：

```bash
APP_ADMIN_EMAILS=admin@example.com,owner@example.com
```

管理员登录后默认进入 `/{locale}/admin` 管理端首页，可继续访问 `/{locale}/admin/users` 用户管理页，查看用户邮箱、角色、启用状态、会话数量、AI 供应商数量和模型数量。管理员可以把其他用户切换为管理员或普通用户，也可以启用或禁用账号。管理员需要创作 PPT 时，可从管理端点击“创作工作台”进入 `/{locale}/workbench`。

为避免锁死后台，系统禁止管理员降级或禁用自己，也禁止移除最后一个启用的管理员。禁用账号会立即删除该用户所有登录会话，后续登录和受保护 API 访问会返回 `ACCOUNT_DISABLED`。

## 数据持久化

Prisma 使用 MySQL 保存以下数据：

- `User`：邮箱、显示名称、头像本地路径、密码哈希、角色、启用状态、创建时间。
- `Session`：会话 token hash、过期时间。
- `AiProvider`：供应商名称、标识、Base URL、启用状态、加密后的 API Key。
- `AiModelConfig`：统一保存 LLM、图片和向量模型的供应商、显示名称、模型 ID、默认温度、启用状态和默认模型状态。
- `DeckProject`：PPT 生成历史、输入参数、统一视觉说明、审核结果、一致性报告、状态和 PPTX 产物索引。
- `DeckSlide`：每页文案、元素编排、图片图层请求、生成图层和 Web 动效计划。
- `DeckAsset`：Mock SVG 图片图层和 PPTX 文件的本地路径、mime、provider 与关联关系。

同一账号的供应商标识唯一，同一账号同一类型、同一供应商下的模型 ID 唯一。同一账号同一时间每种模型类型只会有一个默认模型，设置默认项时会自动取消同类型其他配置的默认状态。

## API Key 加密

供应商 API Key 使用服务端 AES-GCM 加密后写入 MySQL。LLM、图片和向量模型都复用所选供应商的 Base URL 与 API Key，不在模型配置中单独保存密钥。前端 API 响应只返回供应商的 `hasApiKey`，不会返回密钥明文。编辑供应商时，API Key 输入框留空表示不修改已保存密钥，也可勾选“清空已保存密钥”。

需要配置：

```bash
AI_CONFIG_ENCRYPTION_KEY=
```

该值应使用高强度随机字符串。服务端会基于它派生 32 字节密钥。

## 默认模型调用规则

`POST /api/decks/generate` 和调试接口 `POST /api/decks/analyze` 保持相同的输入结构，服务端会先读取当前登录用户的默认 LLM 模型：

1. 若存在启用的默认模型，且关联供应商启用，则使用该供应商 Base URL、API Key、模型 ID 和默认温度。
2. 若没有账号默认模型，则读取 `.env` 中的 OpenAI-compatible 配置。
3. 若仍无可用 API Key，则使用本地模拟 fallback。

在“体验设置 > LLM 模型 / 图片模型 / 向量模型”中新增或编辑模型时，“拉取模型”会按当前选择的供应商读取服务端保存的 Base URL 和 API Key，调用 OpenAI-compatible 的 `GET {Base URL}/models` 接口。返回结果会先按常见模型品牌前缀过滤，例如豆包供应商只展示 `doubao-*`，DeepSeek 供应商只展示 `deepseek-*`；未内置品牌过滤规则的供应商保持原始返回列表。过滤后的结果会展示为“可用模型”下拉框，选择后自动填入模型 ID；如果供应商未实现 `/models` 或鉴权失败，界面会提示检查 Base URL 与 API Key，模型 ID 仍可手动填写。

图片生成使用“体验设置 > 图片模型”中的默认配置，推荐模型 ID 为 `gpt-image-2`。`POST /api/decks/generate` 会使用该图片模型关联供应商的 Base URL 和 API Key 生成 PPT 图片图层；未配置密钥时自动使用本地 Mock SVG，真实图片生成失败时也会回退到 Mock SVG 并在图层 provider 中记录回退来源。

## 故障排查

如果“体验设置 > AI 供应商 / LLM 模型 / 图片模型 / 向量模型”出现新增失败、查询失败或列表为空，优先检查本地数据库迁移状态：

```bash
pnpm exec prisma migrate status
pnpm db:migrate
```

统一模型配置依赖 `AiModelConfig` 迁移。当前前端会保留已成功读取的配置列表；保存接口遇到缺表或缺字段时会返回 `DATABASE_MIGRATION_REQUIRED`，设置页会提示先运行 `pnpm db:migrate`。旧 `ImageModelConfig` 数据不会自动迁移，升级后需要在“图片模型”页重新新增默认图片模型。
