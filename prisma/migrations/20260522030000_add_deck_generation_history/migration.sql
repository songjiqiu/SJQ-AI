CREATE TABLE `DeckProject` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `mode` VARCHAR(24) NOT NULL,
  `status` ENUM('GENERATING', 'READY', 'FAILED') NOT NULL DEFAULT 'GENERATING',
  `title` VARCHAR(120) NOT NULL,
  `summary` VARCHAR(500) NOT NULL,
  `input` JSON NOT NULL,
  `unifiedVisualSpec` JSON NOT NULL,
  `contentReview` JSON NOT NULL,
  `consistencyReport` JSON NOT NULL,
  `pptxAssetId` VARCHAR(191) NULL,
  `generationError` VARCHAR(1000) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DeckSlide` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `slideId` VARCHAR(80) NOT NULL,
  `index` INTEGER NOT NULL,
  `content` JSON NOT NULL,
  `elements` JSON NOT NULL,
  `imageLayerRequests` JSON NOT NULL,
  `generatedImageLayers` JSON NOT NULL,
  `motionPlan` JSON NOT NULL,
  `canvas` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DeckAsset` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `slideId` VARCHAR(191) NULL,
  `elementId` VARCHAR(80) NULL,
  `requestId` VARCHAR(100) NULL,
  `kind` ENUM('IMAGE_LAYER', 'PPTX') NOT NULL,
  `provider` VARCHAR(80) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `relativePath` VARCHAR(500) NOT NULL,
  `publicUrl` VARCHAR(2048) NOT NULL,
  `sizeBytes` INTEGER NOT NULL,
  `metadata` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DeckProject_userId_createdAt_idx` ON `DeckProject`(`userId`, `createdAt`);
CREATE INDEX `DeckProject_status_idx` ON `DeckProject`(`status`);
CREATE UNIQUE INDEX `DeckSlide_projectId_index_key` ON `DeckSlide`(`projectId`, `index`);
CREATE INDEX `DeckSlide_projectId_idx` ON `DeckSlide`(`projectId`);
CREATE INDEX `DeckAsset_projectId_kind_idx` ON `DeckAsset`(`projectId`, `kind`);
CREATE INDEX `DeckAsset_slideId_idx` ON `DeckAsset`(`slideId`);

ALTER TABLE `DeckProject`
  ADD CONSTRAINT `DeckProject_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DeckSlide`
  ADD CONSTRAINT `DeckSlide_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `DeckProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DeckAsset`
  ADD CONSTRAINT `DeckAsset_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `DeckProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DeckAsset`
  ADD CONSTRAINT `DeckAsset_slideId_fkey`
  FOREIGN KEY (`slideId`) REFERENCES `DeckSlide`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
