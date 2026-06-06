-- Add table and column comments for the current MySQL schema.

ALTER TABLE `User` COMMENT = '用户账号表，保存登录凭据、资料、角色和账号状态';
ALTER TABLE `User`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '用户主键，使用 cuid 生成',
  MODIFY `email` VARCHAR(191) NOT NULL COMMENT '登录邮箱，同一邮箱只能注册一个账号',
  MODIFY `displayName` VARCHAR(80) NULL COMMENT '用户显示名称，可由用户在账号设置中维护',
  MODIFY `avatarUrl` VARCHAR(2048) NULL COMMENT '用户头像访问路径，当前指向本地上传资源',
  MODIFY `passwordHash` VARCHAR(255) NOT NULL COMMENT '登录密码哈希，不保存明文密码',
  MODIFY `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER' COMMENT '用户角色，用于控制管理端访问权限',
  MODIFY `isActive` BOOLEAN NOT NULL DEFAULT true COMMENT '账号启用状态，禁用后不可继续登录或访问',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '账号创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '账号最后更新时间';

ALTER TABLE `Session` COMMENT = '登录会话表，保存 HttpOnly Cookie 对应的服务端会话哈希';
ALTER TABLE `Session`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '会话主键，使用 cuid 生成',
  MODIFY `userId` VARCHAR(191) NOT NULL COMMENT '所属用户 ID',
  MODIFY `tokenHash` VARCHAR(64) NOT NULL COMMENT '会话 token 的 SHA-256 哈希值',
  MODIFY `expiresAt` DATETIME(3) NOT NULL COMMENT '会话过期时间',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '会话创建时间';

ALTER TABLE `AiProvider` COMMENT = 'AI 供应商配置表，按用户保存 OpenAI-compatible 服务地址和密钥';
ALTER TABLE `AiProvider`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '供应商配置主键，使用 cuid 生成',
  MODIFY `userId` VARCHAR(191) NOT NULL COMMENT '所属用户 ID',
  MODIFY `name` VARCHAR(80) NOT NULL COMMENT '供应商显示名称',
  MODIFY `slug` VARCHAR(64) NOT NULL COMMENT '用户内唯一的供应商标识',
  MODIFY `baseUrl` VARCHAR(2048) NOT NULL COMMENT 'OpenAI-compatible API Base URL',
  MODIFY `encryptedApiKey` TEXT NULL COMMENT '加密后的 API Key，空值表示未配置密钥',
  MODIFY `isEnabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用该供应商',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '供应商配置创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '供应商配置最后更新时间';

ALTER TABLE `AiModelConfig` COMMENT = 'AI 模型配置表，统一保存 LLM、图片和向量模型';
ALTER TABLE `AiModelConfig`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '模型配置主键，使用 cuid 生成',
  MODIFY `userId` VARCHAR(191) NOT NULL COMMENT '所属用户 ID',
  MODIFY `providerId` VARCHAR(191) NOT NULL COMMENT '所属 AI 供应商 ID',
  MODIFY `kind` ENUM('LLM', 'IMAGE', 'EMBEDDING') NOT NULL COMMENT '模型用途类型',
  MODIFY `displayName` VARCHAR(120) NOT NULL COMMENT '模型显示名称',
  MODIFY `modelId` VARCHAR(160) NOT NULL COMMENT '供应商侧模型 ID',
  MODIFY `temperature` DOUBLE NOT NULL DEFAULT 0.7 COMMENT '默认采样温度，主要用于文本模型',
  MODIFY `isEnabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用该模型配置',
  MODIFY `isDefault` BOOLEAN NOT NULL DEFAULT false COMMENT '是否为该用户同类型默认模型',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '模型配置创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '模型配置最后更新时间';

ALTER TABLE `DeckProject` COMMENT = 'PPT 生成项目表，保存一次从大纲到预览和 PPTX 的生成历史';
ALTER TABLE `DeckProject`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '生成项目主键，使用 cuid 生成',
  MODIFY `userId` VARCHAR(191) NOT NULL COMMENT '所属用户 ID',
  MODIFY `mode` VARCHAR(24) NOT NULL COMMENT '创作模式标识，例如从想法生成或从文件生成',
  MODIFY `status` ENUM('GENERATING', 'READY', 'FAILED') NOT NULL DEFAULT 'GENERATING' COMMENT '项目生成状态',
  MODIFY `title` VARCHAR(120) NOT NULL COMMENT 'PPT 标题',
  MODIFY `summary` VARCHAR(500) NOT NULL COMMENT 'PPT 摘要',
  MODIFY `input` JSON NOT NULL COMMENT '原始生成输入快照',
  MODIFY `unifiedVisualSpec` JSON NOT NULL COMMENT '统一视觉规范 JSON',
  MODIFY `contentReview` JSON NOT NULL COMMENT '内容审核结果 JSON',
  MODIFY `consistencyReport` JSON NOT NULL COMMENT '一致性检查报告 JSON',
  MODIFY `generationProgress` JSON NULL COMMENT '异步生成进度 JSON',
  MODIFY `pptxAssetId` VARCHAR(191) NULL COMMENT '最终 PPTX 产物对应的资产 ID',
  MODIFY `sourceOutlineDraftId` VARCHAR(191) NULL COMMENT '来源大纲草稿 ID',
  MODIFY `generationError` VARCHAR(1000) NULL COMMENT '生成失败时的错误摘要',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '项目创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '项目最后更新时间';

ALTER TABLE `DeckOutlineDraft` COMMENT = 'PPT 大纲草稿表，保存用户确认生成前的结构化大纲和视觉规范';
ALTER TABLE `DeckOutlineDraft`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '大纲草稿主键，使用 cuid 生成',
  MODIFY `userId` VARCHAR(191) NOT NULL COMMENT '所属用户 ID',
  MODIFY `mode` VARCHAR(24) NOT NULL COMMENT '创作模式标识',
  MODIFY `title` VARCHAR(120) NOT NULL COMMENT '草稿标题',
  MODIFY `summary` VARCHAR(500) NOT NULL COMMENT '草稿摘要',
  MODIFY `input` JSON NOT NULL COMMENT '原始生成输入快照',
  MODIFY `fileSummaries` JSON NOT NULL COMMENT '上传或解析文件的摘要 JSON',
  MODIFY `intentAnalysis` JSON NULL COMMENT '输入意图分析 JSON',
  MODIFY `unifiedVisualSpec` JSON NOT NULL COMMENT '统一视觉规范 JSON',
  MODIFY `slides` JSON NOT NULL COMMENT '页面大纲与可展示内容 JSON',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '草稿创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '草稿最后更新时间';

ALTER TABLE `DeckSlide` COMMENT = 'PPT 页面表，保存单页内容、落版结果、图片请求和动效元数据';
ALTER TABLE `DeckSlide`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '页面主键，使用 cuid 生成',
  MODIFY `projectId` VARCHAR(191) NOT NULL COMMENT '所属 PPT 生成项目 ID',
  MODIFY `slideId` VARCHAR(80) NOT NULL COMMENT '页面业务 ID，用于前端和生成链路引用',
  MODIFY `index` INTEGER NOT NULL COMMENT '页面在项目中的顺序，从 0 开始',
  MODIFY `content` JSON NOT NULL COMMENT '页面内容 JSON',
  MODIFY `pageDesign` JSON NULL COMMENT '语义化页面设计方案 JSON',
  MODIFY `elements` JSON NOT NULL COMMENT '最终页面元素 JSON',
  MODIFY `imageLayerRequests` JSON NOT NULL COMMENT '图片图层生成请求 JSON',
  MODIFY `generatedImageLayers` JSON NOT NULL COMMENT '已生成图片图层 JSON',
  MODIFY `motionPlan` JSON NOT NULL COMMENT 'Web 动效计划 JSON',
  MODIFY `canvas` JSON NOT NULL COMMENT '画布规格 JSON',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '页面记录创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '页面记录最后更新时间';

ALTER TABLE `DeckAsset` COMMENT = 'PPT 产物资产表，保存图片图层和 PPTX 文件的索引信息';
ALTER TABLE `DeckAsset`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '资产主键，使用 cuid 生成',
  MODIFY `projectId` VARCHAR(191) NOT NULL COMMENT '所属 PPT 生成项目 ID',
  MODIFY `slideId` VARCHAR(191) NULL COMMENT '所属页面 ID，项目级产物可为空',
  MODIFY `elementId` VARCHAR(80) NULL COMMENT '关联页面元素 ID',
  MODIFY `requestId` VARCHAR(100) NULL COMMENT '关联图片生成请求 ID',
  MODIFY `sourceReusableAssetId` VARCHAR(191) NULL COMMENT '来源可复用图片素材 ID',
  MODIFY `kind` ENUM('IMAGE_LAYER', 'PPTX') NOT NULL COMMENT '资产类型',
  MODIFY `provider` VARCHAR(80) NOT NULL COMMENT '生成或保存该资产的供应商标识',
  MODIFY `mimeType` VARCHAR(120) NOT NULL COMMENT '资产 MIME 类型',
  MODIFY `filename` VARCHAR(255) NOT NULL COMMENT '资产文件名',
  MODIFY `relativePath` VARCHAR(500) NOT NULL COMMENT '资产相对存储路径',
  MODIFY `publicUrl` VARCHAR(2048) NOT NULL COMMENT '资产鉴权访问 URL',
  MODIFY `sizeBytes` INTEGER NOT NULL COMMENT '资产文件大小，单位字节',
  MODIFY `metadata` JSON NOT NULL COMMENT '资产扩展元数据 JSON',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '资产创建时间';

ALTER TABLE `ReusableImageAsset` COMMENT = '账号级可复用图片素材表，保存可复用图片缓存的元数据和质量信息';
ALTER TABLE `ReusableImageAsset`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '可复用图片素材主键，使用 cuid 生成',
  MODIFY `userId` VARCHAR(191) NOT NULL COMMENT '所属用户 ID',
  MODIFY `cacheKey` VARCHAR(64) NOT NULL COMMENT '图片复用缓存键',
  MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING' COMMENT '图片素材审核状态',
  MODIFY `provider` VARCHAR(80) NOT NULL COMMENT '图片生成供应商标识',
  MODIFY `modelId` VARCHAR(160) NOT NULL COMMENT '图片生成模型 ID',
  MODIFY `imageType` VARCHAR(40) NOT NULL COMMENT '图片类型标识',
  MODIFY `aspectRatio` VARCHAR(16) NOT NULL COMMENT '图片宽高比',
  MODIFY `transparentBackground` BOOLEAN NOT NULL DEFAULT false COMMENT '是否要求透明背景',
  MODIFY `prompt` TEXT NOT NULL COMMENT '图片生成正向提示词',
  MODIFY `avoid` TEXT NOT NULL COMMENT '图片生成规避内容提示词',
  MODIFY `keywords` JSON NOT NULL COMMENT '图片关键词 JSON',
  MODIFY `visualStyle` VARCHAR(500) NOT NULL COMMENT '图片视觉风格说明',
  MODIFY `mimeType` VARCHAR(120) NOT NULL COMMENT '图片 MIME 类型',
  MODIFY `filename` VARCHAR(255) NOT NULL COMMENT '图片文件名',
  MODIFY `relativePath` VARCHAR(500) NOT NULL COMMENT '图片相对存储路径',
  MODIFY `sizeBytes` INTEGER NOT NULL COMMENT '图片文件大小，单位字节',
  MODIFY `width` INTEGER NOT NULL COMMENT '图片宽度，单位像素',
  MODIFY `height` INTEGER NOT NULL COMMENT '图片高度，单位像素',
  MODIFY `qualityReview` JSON NOT NULL COMMENT '图片质量审核结果 JSON',
  MODIFY `metadata` JSON NOT NULL COMMENT '图片扩展元数据 JSON',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '图片素材创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '图片素材最后更新时间';

ALTER TABLE `PptTemplate` COMMENT = 'PPT 模板表，保存管理员维护的全局页面模板';
ALTER TABLE `PptTemplate`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '模板主键，使用 cuid 生成',
  MODIFY `category` VARCHAR(80) NOT NULL COMMENT '模板固定分类',
  MODIFY `customCategoryKey` VARCHAR(80) NULL COMMENT '自定义分类标识预留字段',
  MODIFY `customCategoryName` VARCHAR(120) NULL COMMENT '自定义分类名称预留字段',
  MODIFY `name` VARCHAR(120) NOT NULL COMMENT '模板名称',
  MODIFY `description` VARCHAR(500) NULL COMMENT '模板说明',
  MODIFY `tags` JSON NOT NULL COMMENT '模板标签 JSON',
  MODIFY `sortOrder` INTEGER NOT NULL DEFAULT 0 COMMENT '模板排序值，数值越小越靠前',
  MODIFY `isEnabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用该模板',
  MODIFY `slide` JSON NOT NULL COMMENT '完整页面模板 JSON',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '模板创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '模板最后更新时间';

ALTER TABLE `PptSlotTemplate` COMMENT = 'PPT 槽位模板表，保存从 PPTX 页面提取出的可复用槽位模板';
ALTER TABLE `PptSlotTemplate`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '槽位模板主键，使用 cuid 生成',
  MODIFY `name` VARCHAR(120) NOT NULL COMMENT '槽位模板名称',
  MODIFY `description` VARCHAR(500) NULL COMMENT '槽位模板说明',
  MODIFY `sourceFile` VARCHAR(255) NOT NULL COMMENT '来源 PPTX 文件名',
  MODIFY `sourceSlideIndex` INTEGER NOT NULL COMMENT '来源 PPTX 页码索引',
  MODIFY `pageTypes` JSON NOT NULL COMMENT '适用页面类型 JSON',
  MODIFY `layoutPattern` VARCHAR(120) NOT NULL COMMENT '页面布局模式标识',
  MODIFY `reviewStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW' COMMENT '槽位模板审核状态',
  MODIFY `canvas` JSON NOT NULL COMMENT '画布规格 JSON',
  MODIFY `safeArea` JSON NOT NULL COMMENT '安全区域 JSON',
  MODIFY `alignmentLines` JSON NOT NULL COMMENT '对齐参考线 JSON',
  MODIFY `slots` JSON NOT NULL COMMENT '页面槽位定义 JSON',
  MODIFY `styleTokens` JSON NOT NULL COMMENT '样式令牌 JSON',
  MODIFY `rules` JSON NOT NULL COMMENT '模板使用规则 JSON',
  MODIFY `usage` JSON NOT NULL COMMENT '模板使用统计 JSON',
  MODIFY `reviewNotes` VARCHAR(1000) NULL COMMENT '审核备注',
  MODIFY `overlayPath` VARCHAR(500) NULL COMMENT '模板叠加预览图相对路径',
  MODIFY `artifactPaths` JSON NOT NULL COMMENT '提取产物路径 JSON',
  MODIFY `isEnabled` BOOLEAN NOT NULL DEFAULT false COMMENT '是否启用该槽位模板',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '槽位模板创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '槽位模板最后更新时间';

ALTER TABLE `TemplateElementAsset` COMMENT = '模板语义元素资产表，保存可被生成链路检索和套用的视觉元素资源';
ALTER TABLE `TemplateElementAsset`
  MODIFY `id` VARCHAR(191) NOT NULL COMMENT '语义元素资产主键，使用 cuid 生成',
  MODIFY `kind` ENUM('CONTAINER', 'ICON', 'SHAPE', 'LINE', 'NAVIGATION', 'TEXT_STYLE') NOT NULL COMMENT '资产类型',
  MODIFY `setKind` ENUM('COMMON', 'TEMPLATE') NOT NULL DEFAULT 'COMMON' COMMENT '资产套装范围',
  MODIFY `setKey` VARCHAR(80) NOT NULL DEFAULT 'common' COMMENT '资产套装标识',
  MODIFY `setName` VARCHAR(120) NOT NULL DEFAULT '通用套装' COMMENT '资产套装名称',
  MODIFY `name` VARCHAR(120) NOT NULL COMMENT '资产名称',
  MODIFY `description` VARCHAR(500) NULL COMMENT '资产说明',
  MODIFY `primaryCategory` VARCHAR(80) NULL COMMENT '一级分类',
  MODIFY `secondaryCategory` VARCHAR(80) NULL COMMENT '二级分类',
  MODIFY `variantKey` VARCHAR(80) NULL COMMENT '变体标识',
  MODIFY `tags` JSON NOT NULL COMMENT '普通标签 JSON',
  MODIFY `semanticTags` JSON NOT NULL COMMENT '语义标签 JSON',
  MODIFY `keywords` JSON NOT NULL COMMENT '检索关键词 JSON',
  MODIFY `synonyms` JSON NOT NULL COMMENT '同义词 JSON',
  MODIFY `pageTypes` JSON NOT NULL COMMENT '适用页面类型 JSON',
  MODIFY `usageScenarios` JSON NOT NULL COMMENT '使用场景 JSON',
  MODIFY `styleTags` JSON NOT NULL COMMENT '风格标签 JSON',
  MODIFY `colorTags` JSON NOT NULL COMMENT '色彩标签 JSON',
  MODIFY `backgroundModes` JSON NOT NULL COMMENT '背景适配模式 JSON',
  MODIFY `style` JSON NOT NULL COMMENT '资产样式 JSON',
  MODIFY `preview` JSON NOT NULL COMMENT '资产预览 JSON',
  MODIFY `resource` JSON NOT NULL COMMENT '资产资源内容 JSON',
  MODIFY `aiModifyPermissions` JSON NOT NULL COMMENT 'AI 修改权限 JSON',
  MODIFY `reviewStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' COMMENT '资产审核状态',
  MODIFY `source` ENUM('MANUAL', 'AI_GENERATED') NOT NULL DEFAULT 'MANUAL' COMMENT '资产来源',
  MODIFY `sortOrder` INTEGER NOT NULL DEFAULT 0 COMMENT '资产排序值，数值越小越靠前',
  MODIFY `isEnabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用该资产',
  MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '资产创建时间',
  MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '资产最后更新时间';
