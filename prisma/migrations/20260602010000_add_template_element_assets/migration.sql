-- CreateTable
CREATE TABLE `TemplateElementAsset` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('ICON', 'SHAPE', 'LINE') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `tags` JSON NOT NULL,
    `semanticTags` JSON NOT NULL,
    `usageScenarios` JSON NOT NULL,
    `style` JSON NOT NULL,
    `preview` JSON NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TemplateElementAsset_kind_name_key`(`kind`, `name`),
    INDEX `TemplateElementAsset_kind_sortOrder_idx`(`kind`, `sortOrder`),
    INDEX `TemplateElementAsset_kind_isEnabled_idx`(`kind`, `isEnabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
