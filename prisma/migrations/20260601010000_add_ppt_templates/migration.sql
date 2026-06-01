CREATE TABLE `PptTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `customCategoryKey` VARCHAR(80) NULL,
  `customCategoryName` VARCHAR(120) NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL,
  `tags` JSON NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `slide` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `PptTemplate_category_sortOrder_idx` ON `PptTemplate`(`category`, `sortOrder`);
CREATE INDEX `PptTemplate_isEnabled_idx` ON `PptTemplate`(`isEnabled`);
