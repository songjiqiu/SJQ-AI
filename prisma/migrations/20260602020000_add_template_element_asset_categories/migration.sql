-- AlterTable
ALTER TABLE `TemplateElementAsset`
    ADD COLUMN `primaryCategory` VARCHAR(80) NULL,
    ADD COLUMN `secondaryCategory` VARCHAR(80) NULL,
    ADD COLUMN `variantKey` VARCHAR(80) NULL;

-- CreateIndex
CREATE INDEX `TemplateElementAsset_category_idx`
    ON `TemplateElementAsset`(`kind`, `primaryCategory`, `secondaryCategory`, `variantKey`);
