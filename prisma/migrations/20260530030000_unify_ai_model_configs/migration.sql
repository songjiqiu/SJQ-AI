CREATE TABLE `AiModelConfig` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NOT NULL,
  `kind` ENUM('LLM', 'IMAGE', 'EMBEDDING') NOT NULL,
  `displayName` VARCHAR(120) NOT NULL,
  `modelId` VARCHAR(160) NOT NULL,
  `temperature` DOUBLE NOT NULL DEFAULT 0.7,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AiModelConfig` (
  `id`,
  `userId`,
  `providerId`,
  `kind`,
  `displayName`,
  `modelId`,
  `temperature`,
  `isEnabled`,
  `isDefault`,
  `createdAt`,
  `updatedAt`
)
SELECT
  `id`,
  `userId`,
  `providerId`,
  'LLM',
  `displayName`,
  `modelId`,
  `temperature`,
  `isEnabled`,
  `isDefault`,
  `createdAt`,
  `updatedAt`
FROM `LlmModel`;

CREATE UNIQUE INDEX `AiModelConfig_userId_kind_providerId_modelId_key`
  ON `AiModelConfig`(`userId`, `kind`, `providerId`, `modelId`);
CREATE INDEX `AiModelConfig_userId_idx` ON `AiModelConfig`(`userId`);
CREATE INDEX `AiModelConfig_providerId_idx` ON `AiModelConfig`(`providerId`);
CREATE INDEX `AiModelConfig_userId_kind_isDefault_idx`
  ON `AiModelConfig`(`userId`, `kind`, `isDefault`);

ALTER TABLE `AiModelConfig`
  ADD CONSTRAINT `AiModelConfig_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AiModelConfig`
  ADD CONSTRAINT `AiModelConfig_providerId_fkey`
  FOREIGN KEY (`providerId`) REFERENCES `AiProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS `ImageModelConfig`;
DROP TABLE `LlmModel`;
