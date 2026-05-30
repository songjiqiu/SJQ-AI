ALTER TABLE `User`
  ADD COLUMN `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX `User_role_isActive_idx` ON `User`(`role`, `isActive`);
