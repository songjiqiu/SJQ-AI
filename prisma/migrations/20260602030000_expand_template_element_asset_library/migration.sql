-- AlterEnum
ALTER TABLE `TemplateElementAsset`
    MODIFY `kind` ENUM('CONTAINER', 'ICON', 'SHAPE', 'LINE', 'NAVIGATION', 'TEXT_STYLE') NOT NULL;

-- AlterTable
ALTER TABLE `TemplateElementAsset`
    ADD COLUMN `setKind` ENUM('COMMON', 'TEMPLATE') NOT NULL DEFAULT 'COMMON',
    ADD COLUMN `setKey` VARCHAR(80) NOT NULL DEFAULT 'common',
    ADD COLUMN `setName` VARCHAR(120) NOT NULL DEFAULT '通用套装',
    ADD COLUMN `keywords` JSON NULL,
    ADD COLUMN `synonyms` JSON NULL,
    ADD COLUMN `pageTypes` JSON NULL,
    ADD COLUMN `styleTags` JSON NULL,
    ADD COLUMN `colorTags` JSON NULL,
    ADD COLUMN `backgroundModes` JSON NULL,
    ADD COLUMN `resource` JSON NULL,
    ADD COLUMN `aiModifyPermissions` JSON NULL,
    ADD COLUMN `reviewStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN `source` ENUM('MANUAL', 'AI_GENERATED') NOT NULL DEFAULT 'MANUAL';

-- Backfill required JSON fields for existing assets.
UPDATE `TemplateElementAsset`
SET
    `keywords` = JSON_ARRAY(),
    `synonyms` = JSON_ARRAY(),
    `pageTypes` = JSON_ARRAY(),
    `styleTags` = JSON_ARRAY(),
    `colorTags` = JSON_ARRAY(),
    `backgroundModes` = JSON_ARRAY('light', 'dark'),
    `resource` = JSON_OBJECT(),
    `aiModifyPermissions` = JSON_OBJECT(
        'allowRecolor', true,
        'allowResize', true,
        'allowMove', true,
        'allowStretch', false,
        'allowAutoLayout', false,
        'allowTextShrink', false
    );

-- Tighten JSON fields after backfill.
ALTER TABLE `TemplateElementAsset`
    MODIFY `keywords` JSON NOT NULL,
    MODIFY `synonyms` JSON NOT NULL,
    MODIFY `pageTypes` JSON NOT NULL,
    MODIFY `styleTags` JSON NOT NULL,
    MODIFY `colorTags` JSON NOT NULL,
    MODIFY `backgroundModes` JSON NOT NULL,
    MODIFY `resource` JSON NOT NULL,
    MODIFY `aiModifyPermissions` JSON NOT NULL;

-- DropIndex
DROP INDEX `TemplateElementAsset_kind_name_key` ON `TemplateElementAsset`;

-- CreateIndex
CREATE UNIQUE INDEX `TemplateElementAsset_setKind_setKey_kind_name_key`
    ON `TemplateElementAsset`(`setKind`, `setKey`, `kind`, `name`);

-- CreateIndex
CREATE INDEX `TemplateElementAsset_setKind_setKey_kind_sortOrder_idx`
    ON `TemplateElementAsset`(`setKind`, `setKey`, `kind`, `sortOrder`);

-- CreateIndex
CREATE INDEX `TemplateElementAsset_kind_reviewStatus_isEnabled_idx`
    ON `TemplateElementAsset`(`kind`, `reviewStatus`, `isEnabled`);
