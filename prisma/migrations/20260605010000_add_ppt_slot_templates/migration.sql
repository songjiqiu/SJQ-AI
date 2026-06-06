-- CreateTable
CREATE TABLE `PptSlotTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `sourceFile` VARCHAR(255) NOT NULL,
    `sourceSlideIndex` INTEGER NOT NULL,
    `pageTypes` JSON NOT NULL,
    `layoutPattern` VARCHAR(120) NOT NULL,
    `reviewStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `canvas` JSON NOT NULL,
    `safeArea` JSON NOT NULL,
    `alignmentLines` JSON NOT NULL,
    `slots` JSON NOT NULL,
    `styleTokens` JSON NOT NULL,
    `rules` JSON NOT NULL,
    `usage` JSON NOT NULL,
    `reviewNotes` VARCHAR(1000) NULL,
    `overlayPath` VARCHAR(500) NULL,
    `artifactPaths` JSON NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PptSlotTemplate_reviewStatus_isEnabled_idx`(`reviewStatus`, `isEnabled`),
    INDEX `PptSlotTemplate_sourceFile_sourceSlideIndex_idx`(`sourceFile`, `sourceSlideIndex`),
    INDEX `PptSlotTemplate_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
