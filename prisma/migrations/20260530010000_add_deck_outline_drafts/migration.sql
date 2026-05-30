CREATE TABLE `DeckOutlineDraft` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `mode` VARCHAR(24) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `summary` VARCHAR(500) NOT NULL,
  `input` JSON NOT NULL,
  `fileSummaries` JSON NOT NULL,
  `unifiedVisualSpec` JSON NOT NULL,
  `slides` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DeckOutlineDraft_userId_updatedAt_idx` ON `DeckOutlineDraft`(`userId`, `updatedAt`);
CREATE INDEX `DeckOutlineDraft_userId_createdAt_idx` ON `DeckOutlineDraft`(`userId`, `createdAt`);

ALTER TABLE `DeckOutlineDraft`
  ADD CONSTRAINT `DeckOutlineDraft_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
