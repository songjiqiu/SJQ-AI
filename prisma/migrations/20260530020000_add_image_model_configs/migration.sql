CREATE TABLE `ImageModelConfig` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `baseUrl` VARCHAR(2048) NOT NULL,
  `encryptedApiKey` TEXT NULL,
  `modelId` VARCHAR(160) NOT NULL DEFAULT 'gpt-image-2',
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ImageModelConfig_userId_name_key` ON `ImageModelConfig`(`userId`, `name`);
CREATE INDEX `ImageModelConfig_userId_idx` ON `ImageModelConfig`(`userId`);
CREATE INDEX `ImageModelConfig_userId_isDefault_idx` ON `ImageModelConfig`(`userId`, `isDefault`);

ALTER TABLE `ImageModelConfig`
  ADD CONSTRAINT `ImageModelConfig_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
