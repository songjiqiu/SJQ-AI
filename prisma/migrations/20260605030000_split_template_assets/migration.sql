-- Split the old mixed TemplateElementAsset table into a public TemplateAsset
-- table plus six strongly typed detail tables. The semantic asset library is
-- intentionally rebuilt from an empty state, so legacy rows are not migrated.

CREATE TABLE `TemplateAsset` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('CONTAINER', 'ICON', 'SHAPE', 'LINE', 'NAVIGATION', 'TEXT_STYLE') NOT NULL,
    `setKind` ENUM('COMMON', 'TEMPLATE') NOT NULL DEFAULT 'COMMON',
    `setKey` VARCHAR(80) NOT NULL DEFAULT 'common',
    `setName` VARCHAR(120) NOT NULL DEFAULT '通用套装',
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `primaryCategory` VARCHAR(80) NULL,
    `secondaryCategory` VARCHAR(80) NULL,
    `variantKey` VARCHAR(80) NULL,
    `tags` JSON NOT NULL,
    `semanticTags` JSON NOT NULL,
    `keywords` JSON NOT NULL,
    `synonyms` JSON NOT NULL,
    `pageTypes` JSON NOT NULL,
    `usageScenarios` JSON NOT NULL,
    `styleTags` JSON NOT NULL,
    `colorTags` JSON NOT NULL,
    `backgroundModes` JSON NOT NULL,
    `preview` JSON NOT NULL,
    `aiModifyPermissions` JSON NOT NULL,
    `reviewStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    `source` ENUM('MANUAL', 'AI_GENERATED') NOT NULL DEFAULT 'MANUAL',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TemplateAsset_setKind_setKey_kind_name_key`(`setKind`, `setKey`, `kind`, `name`),
    INDEX `TemplateAsset_setKind_setKey_kind_sortOrder_idx`(`setKind`, `setKey`, `kind`, `sortOrder`),
    INDEX `TemplateAsset_kind_reviewStatus_isEnabled_idx`(`kind`, `reviewStatus`, `isEnabled`),
    INDEX `TemplateAsset_kind_sortOrder_idx`(`kind`, `sortOrder`),
    INDEX `TemplateAsset_kind_isEnabled_idx`(`kind`, `isEnabled`),
    INDEX `TemplateAsset_category_idx`(`kind`, `primaryCategory`, `secondaryCategory`, `variantKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TemplateIconAsset` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `iconName` VARCHAR(100) NOT NULL,
    `iconStyle` VARCHAR(40) NOT NULL DEFAULT 'line',
    `strokeColor` VARCHAR(40) NULL,
    `strokeWidth` DOUBLE NULL,
    `fillMode` VARCHAR(40) NULL,
    `cornerRadius` DOUBLE NULL,

    UNIQUE INDEX `TemplateIconAsset_assetId_key`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TemplateShapeAsset` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `shapeType` VARCHAR(80) NOT NULL,
    `fillColor` VARCHAR(40) NULL,
    `strokeColor` VARCHAR(40) NULL,
    `strokeWidth` DOUBLE NULL,
    `cornerRadius` DOUBLE NULL,
    `opacity` DOUBLE NULL,
    `shadow` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `TemplateShapeAsset_assetId_key`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TemplateLineAsset` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `connectorType` VARCHAR(80) NOT NULL DEFAULT 'straight',
    `direction` VARCHAR(80) NOT NULL DEFAULT 'horizontal',
    `dash` VARCHAR(40) NOT NULL DEFAULT 'solid',
    `startArrowType` VARCHAR(80) NOT NULL DEFAULT 'none',
    `endArrowType` VARCHAR(80) NOT NULL DEFAULT 'none',
    `strokeColor` VARCHAR(40) NULL,
    `strokeWidth` DOUBLE NULL,
    `cap` VARCHAR(40) NOT NULL DEFAULT 'round',

    UNIQUE INDEX `TemplateLineAsset_assetId_key`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TemplateTextStyleAsset` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `textRole` VARCHAR(100) NOT NULL,
    `fontFamily` VARCHAR(160) NULL,
    `fontSize` DOUBLE NULL,
    `fontWeight` INTEGER NULL,
    `lineHeight` DOUBLE NULL,
    `maxLines` INTEGER NULL,
    `color` VARCHAR(40) NULL,
    `letterSpacing` DOUBLE NULL,

    UNIQUE INDEX `TemplateTextStyleAsset_assetId_key`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TemplateContainerAsset` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `containerRole` VARCHAR(100) NOT NULL,
    `allowedContentTypes` JSON NOT NULL,
    `autoLayout` BOOLEAN NOT NULL DEFAULT false,
    `padding` DOUBLE NULL,
    `gap` DOUBLE NULL,
    `recommendedWidth` DOUBLE NULL,
    `recommendedHeight` DOUBLE NULL,
    `fillColor` VARCHAR(40) NULL,
    `strokeColor` VARCHAR(40) NULL,
    `strokeWidth` DOUBLE NULL,

    UNIQUE INDEX `TemplateContainerAsset_assetId_key`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TemplateNavigationAsset` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `navigationRole` VARCHAR(100) NOT NULL,
    `displayMode` VARCHAR(80) NOT NULL,
    `fixedPosition` VARCHAR(40) NOT NULL DEFAULT 'bottom',
    `activeColor` VARCHAR(40) NULL,
    `inactiveColor` VARCHAR(40) NULL,
    `showOnCover` BOOLEAN NOT NULL DEFAULT false,
    `showOnEnding` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `TemplateNavigationAsset_assetId_key`(`assetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TemplateIconAsset`
    ADD CONSTRAINT `TemplateIconAsset_assetId_fkey`
    FOREIGN KEY (`assetId`) REFERENCES `TemplateAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TemplateShapeAsset`
    ADD CONSTRAINT `TemplateShapeAsset_assetId_fkey`
    FOREIGN KEY (`assetId`) REFERENCES `TemplateAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TemplateLineAsset`
    ADD CONSTRAINT `TemplateLineAsset_assetId_fkey`
    FOREIGN KEY (`assetId`) REFERENCES `TemplateAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TemplateTextStyleAsset`
    ADD CONSTRAINT `TemplateTextStyleAsset_assetId_fkey`
    FOREIGN KEY (`assetId`) REFERENCES `TemplateAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TemplateContainerAsset`
    ADD CONSTRAINT `TemplateContainerAsset_assetId_fkey`
    FOREIGN KEY (`assetId`) REFERENCES `TemplateAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TemplateNavigationAsset`
    ADD CONSTRAINT `TemplateNavigationAsset_assetId_fkey`
    FOREIGN KEY (`assetId`) REFERENCES `TemplateAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TemplateAsset` COMMENT = '模板语义资产公共主表，保存六类资产共享的治理、检索和预览字段';
ALTER TABLE `TemplateAsset`
    MODIFY `id` VARCHAR(191) NOT NULL COMMENT '语义资产主键，使用 cuid 生成',
    MODIFY `kind` ENUM('CONTAINER', 'ICON', 'SHAPE', 'LINE', 'NAVIGATION', 'TEXT_STYLE') NOT NULL COMMENT '资产类型，用于公共检索和渲染绑定诊断',
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
    MODIFY `preview` JSON NOT NULL COMMENT '管理端预览配置 JSON',
    MODIFY `aiModifyPermissions` JSON NOT NULL COMMENT 'AI 修改权限 JSON',
    MODIFY `reviewStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED' COMMENT '资产审核状态',
    MODIFY `source` ENUM('MANUAL', 'AI_GENERATED') NOT NULL DEFAULT 'MANUAL' COMMENT '资产来源',
    MODIFY `sortOrder` INTEGER NOT NULL DEFAULT 0 COMMENT '资产排序值，数值越小越靠前',
    MODIFY `isEnabled` BOOLEAN NOT NULL DEFAULT true COMMENT '是否启用该资产',
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '资产创建时间',
    MODIFY `updatedAt` DATETIME(3) NOT NULL COMMENT '资产最后更新时间';

ALTER TABLE `TemplateIconAsset` COMMENT = '图标资产详情表';
ALTER TABLE `TemplateIconAsset`
    MODIFY `id` VARCHAR(191) NOT NULL COMMENT '图标资产详情主键，使用 cuid 生成',
    MODIFY `assetId` VARCHAR(191) NOT NULL COMMENT '所属 TemplateAsset 主表 ID',
    MODIFY `iconName` VARCHAR(100) NOT NULL COMMENT '图标名称或语义图标标识',
    MODIFY `iconStyle` VARCHAR(40) NOT NULL DEFAULT 'line' COMMENT '图标风格，例如 line 或 filled',
    MODIFY `strokeColor` VARCHAR(40) NULL COMMENT '图标描边颜色',
    MODIFY `strokeWidth` DOUBLE NULL COMMENT '图标描边宽度',
    MODIFY `fillMode` VARCHAR(40) NULL COMMENT '图标填充模式',
    MODIFY `cornerRadius` DOUBLE NULL COMMENT '图标外框推荐圆角';

ALTER TABLE `TemplateShapeAsset` COMMENT = '图形资产详情表';
ALTER TABLE `TemplateShapeAsset`
    MODIFY `id` VARCHAR(191) NOT NULL COMMENT '图形资产详情主键，使用 cuid 生成',
    MODIFY `assetId` VARCHAR(191) NOT NULL COMMENT '所属 TemplateAsset 主表 ID',
    MODIFY `shapeType` VARCHAR(80) NOT NULL COMMENT 'PPT 原生图形或平台图形类型',
    MODIFY `fillColor` VARCHAR(40) NULL COMMENT '图形填充颜色',
    MODIFY `strokeColor` VARCHAR(40) NULL COMMENT '图形描边颜色',
    MODIFY `strokeWidth` DOUBLE NULL COMMENT '图形描边宽度',
    MODIFY `cornerRadius` DOUBLE NULL COMMENT '图形圆角',
    MODIFY `opacity` DOUBLE NULL COMMENT '图形透明度',
    MODIFY `shadow` BOOLEAN NOT NULL DEFAULT false COMMENT '是否启用阴影';

ALTER TABLE `TemplateLineAsset` COMMENT = '线条资产详情表';
ALTER TABLE `TemplateLineAsset`
    MODIFY `id` VARCHAR(191) NOT NULL COMMENT '线条资产详情主键，使用 cuid 生成',
    MODIFY `assetId` VARCHAR(191) NOT NULL COMMENT '所属 TemplateAsset 主表 ID',
    MODIFY `connectorType` VARCHAR(80) NOT NULL DEFAULT 'straight' COMMENT '连接线类型',
    MODIFY `direction` VARCHAR(80) NOT NULL DEFAULT 'horizontal' COMMENT '线条方向',
    MODIFY `dash` VARCHAR(40) NOT NULL DEFAULT 'solid' COMMENT '虚线样式',
    MODIFY `startArrowType` VARCHAR(80) NOT NULL DEFAULT 'none' COMMENT '起点箭头类型',
    MODIFY `endArrowType` VARCHAR(80) NOT NULL DEFAULT 'none' COMMENT '终点箭头类型',
    MODIFY `strokeColor` VARCHAR(40) NULL COMMENT '线条颜色',
    MODIFY `strokeWidth` DOUBLE NULL COMMENT '线条宽度',
    MODIFY `cap` VARCHAR(40) NOT NULL DEFAULT 'round' COMMENT '线条端点样式';

ALTER TABLE `TemplateTextStyleAsset` COMMENT = '文本样式资产详情表';
ALTER TABLE `TemplateTextStyleAsset`
    MODIFY `id` VARCHAR(191) NOT NULL COMMENT '文本样式资产详情主键，使用 cuid 生成',
    MODIFY `assetId` VARCHAR(191) NOT NULL COMMENT '所属 TemplateAsset 主表 ID',
    MODIFY `textRole` VARCHAR(100) NOT NULL COMMENT '文本角色，例如 cover-title、body 或 number-emphasis',
    MODIFY `fontFamily` VARCHAR(160) NULL COMMENT '字体族',
    MODIFY `fontSize` DOUBLE NULL COMMENT '字号',
    MODIFY `fontWeight` INTEGER NULL COMMENT '字重',
    MODIFY `lineHeight` DOUBLE NULL COMMENT '行高',
    MODIFY `maxLines` INTEGER NULL COMMENT '推荐最大行数',
    MODIFY `color` VARCHAR(40) NULL COMMENT '文字颜色',
    MODIFY `letterSpacing` DOUBLE NULL COMMENT '字间距';

ALTER TABLE `TemplateContainerAsset` COMMENT = '容器组件资产详情表';
ALTER TABLE `TemplateContainerAsset`
    MODIFY `id` VARCHAR(191) NOT NULL COMMENT '容器组件资产详情主键，使用 cuid 生成',
    MODIFY `assetId` VARCHAR(191) NOT NULL COMMENT '所属 TemplateAsset 主表 ID',
    MODIFY `containerRole` VARCHAR(100) NOT NULL COMMENT '容器角色',
    MODIFY `allowedContentTypes` JSON NOT NULL COMMENT '容器允许承载的内容类型 JSON',
    MODIFY `autoLayout` BOOLEAN NOT NULL DEFAULT false COMMENT '是否建议自动布局',
    MODIFY `padding` DOUBLE NULL COMMENT '推荐内边距',
    MODIFY `gap` DOUBLE NULL COMMENT '推荐子元素间距',
    MODIFY `recommendedWidth` DOUBLE NULL COMMENT '推荐宽度',
    MODIFY `recommendedHeight` DOUBLE NULL COMMENT '推荐高度',
    MODIFY `fillColor` VARCHAR(40) NULL COMMENT '容器填充颜色',
    MODIFY `strokeColor` VARCHAR(40) NULL COMMENT '容器描边颜色',
    MODIFY `strokeWidth` DOUBLE NULL COMMENT '容器描边宽度';

ALTER TABLE `TemplateNavigationAsset` COMMENT = '导航组件资产详情表';
ALTER TABLE `TemplateNavigationAsset`
    MODIFY `id` VARCHAR(191) NOT NULL COMMENT '导航组件资产详情主键，使用 cuid 生成',
    MODIFY `assetId` VARCHAR(191) NOT NULL COMMENT '所属 TemplateAsset 主表 ID',
    MODIFY `navigationRole` VARCHAR(100) NOT NULL COMMENT '导航角色',
    MODIFY `displayMode` VARCHAR(80) NOT NULL COMMENT '导航展示模式',
    MODIFY `fixedPosition` VARCHAR(40) NOT NULL DEFAULT 'bottom' COMMENT '导航固定位置',
    MODIFY `activeColor` VARCHAR(40) NULL COMMENT '当前状态颜色',
    MODIFY `inactiveColor` VARCHAR(40) NULL COMMENT '非当前状态颜色',
    MODIFY `showOnCover` BOOLEAN NOT NULL DEFAULT false COMMENT '是否在封面显示',
    MODIFY `showOnEnding` BOOLEAN NOT NULL DEFAULT false COMMENT '是否在结束页显示';

DROP TABLE IF EXISTS `TemplateElementAsset`;
