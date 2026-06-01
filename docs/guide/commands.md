# 命令

## 安装

```bash
pnpm install
```

## 开发服务

```bash
pnpm dev
```

项目由用户自行运行开发服务。AI 默认不自动启动项目、开发服务或生产服务。

需要从局域网 IP 访问本机开发服务时，可配置 `NEXT_ALLOWED_DEV_ORIGINS` 允许访问 Next.js 开发资源：

```bash
NEXT_ALLOWED_DEV_ORIGINS=192.168.0.117
```

多个来源用逗号分隔。未配置时，项目默认允许当前开发机记录的 `192.168.0.117`。

## 测试

```bash
pnpm test
```

当前测试使用 Vitest 和 React Testing Library，覆盖中英文资源 key、角色入口分流、认证跳转、管理端入口、用户管理、PPT 模板库管理、创作表单 schema、异步预览 PPT 生成管线、Next.js deck API、图片素材缓存和工作台基础交互。默认测试不包含生产打包。

## 静态检查

```bash
pnpm lint
pnpm typecheck
```

## 数据库

```bash
pnpm db:generate
pnpm db:migrate
```

数据库连接由 `DATABASE_URL` 提供，例如 `mysql://root:root@localhost:3306/ai-ppt?allowPublicKeyRetrieval=true`。Prisma 7 的连接串在 `prisma.config.ts` 中读取，运行迁移前需要确保 MySQL 服务可用且数据库已创建。

本地 MySQL 8 使用默认 `caching_sha2_password` 且未启用 TLS 时，需要保留 `allowPublicKeyRetrieval=true`。缺少该参数时，MariaDB 驱动无法在认证阶段获取 RSA 公钥，Prisma 页面请求可能被包装成 `DriverAdapterError: pool timeout`。

本地出现 AI 供应商、LLM 模型、图片模型、向量模型新增失败或查询失败时，先检查迁移是否完整：

```bash
pnpm exec prisma migrate status
pnpm db:migrate
```

这些配置接口依赖 Prisma 迁移创建的 `AiProvider` 和 `AiModelConfig` 表；模板库依赖 `PptTemplate` 表。数据库 schema 落后于代码时，界面会尽量保留已成功读取的配置，但仍需要补齐迁移后才能完整新增和查询。保存接口遇到缺表或缺字段时会返回 `DATABASE_MIGRATION_REQUIRED`，设置页会提示先运行 `pnpm db:migrate`。旧 `ImageModelConfig` 数据不会自动迁移，升级后需要重新新增图片模型配置。

## 文档

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

## 构建

```bash
pnpm build
```

仅在明确需要验证生产构建时运行。
