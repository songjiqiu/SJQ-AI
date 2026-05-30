CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Session` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AiProvider` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `slug` VARCHAR(64) NOT NULL,
  `baseUrl` VARCHAR(2048) NOT NULL,
  `encryptedApiKey` TEXT NULL,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LlmModel` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(120) NOT NULL,
  `modelId` VARCHAR(160) NOT NULL,
  `temperature` DOUBLE NOT NULL DEFAULT 0.7,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);
CREATE UNIQUE INDEX `Session_tokenHash_key` ON `Session`(`tokenHash`);
CREATE INDEX `Session_userId_idx` ON `Session`(`userId`);
CREATE INDEX `Session_expiresAt_idx` ON `Session`(`expiresAt`);
CREATE UNIQUE INDEX `AiProvider_userId_slug_key` ON `AiProvider`(`userId`, `slug`);
CREATE INDEX `AiProvider_userId_idx` ON `AiProvider`(`userId`);
CREATE UNIQUE INDEX `LlmModel_userId_providerId_modelId_key` ON `LlmModel`(`userId`, `providerId`, `modelId`);
CREATE INDEX `LlmModel_userId_idx` ON `LlmModel`(`userId`);
CREATE INDEX `LlmModel_providerId_idx` ON `LlmModel`(`providerId`);
CREATE INDEX `LlmModel_userId_isDefault_idx` ON `LlmModel`(`userId`, `isDefault`);

ALTER TABLE `Session`
  ADD CONSTRAINT `Session_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AiProvider`
  ADD CONSTRAINT `AiProvider_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LlmModel`
  ADD CONSTRAINT `LlmModel_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LlmModel`
  ADD CONSTRAINT `LlmModel_providerId_fkey`
  FOREIGN KEY (`providerId`) REFERENCES `AiProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
