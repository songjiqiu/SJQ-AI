ALTER TABLE `DeckProject`
  ADD COLUMN `generationProgress` JSON NULL,
  ADD COLUMN `sourceOutlineDraftId` VARCHAR(191) NULL;

ALTER TABLE `DeckSlide`
  ADD COLUMN `pageDesign` JSON NULL;

CREATE TABLE `ReusableImageAsset` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `cacheKey` VARCHAR(64) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `provider` VARCHAR(80) NOT NULL,
  `modelId` VARCHAR(160) NOT NULL,
  `imageType` VARCHAR(40) NOT NULL,
  `aspectRatio` VARCHAR(16) NOT NULL,
  `transparentBackground` BOOLEAN NOT NULL DEFAULT false,
  `prompt` TEXT NOT NULL,
  `avoid` TEXT NOT NULL,
  `keywords` JSON NOT NULL,
  `visualStyle` VARCHAR(500) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `relativePath` VARCHAR(500) NOT NULL,
  `sizeBytes` INTEGER NOT NULL,
  `width` INTEGER NOT NULL,
  `height` INTEGER NOT NULL,
  `qualityReview` JSON NOT NULL,
  `metadata` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DeckAsset`
  ADD COLUMN `sourceReusableAssetId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `ReusableImageAsset_userId_cacheKey_key` ON `ReusableImageAsset`(`userId`, `cacheKey`);
CREATE INDEX `ReusableImageAsset_userId_status_idx` ON `ReusableImageAsset`(`userId`, `status`);
CREATE INDEX `DeckAsset_sourceReusableAssetId_idx` ON `DeckAsset`(`sourceReusableAssetId`);

ALTER TABLE `ReusableImageAsset`
  ADD CONSTRAINT `ReusableImageAsset_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DeckAsset`
  ADD CONSTRAINT `DeckAsset_sourceReusableAssetId_fkey`
  FOREIGN KEY (`sourceReusableAssetId`) REFERENCES `ReusableImageAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
