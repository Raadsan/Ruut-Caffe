ALTER TABLE `purchaseline`
  ADD COLUMN `description` VARCHAR(255) NULL,
  ADD COLUMN `unit` VARCHAR(32) NULL;

UPDATE `purchaseline` AS `line`
LEFT JOIN `ingredient` AS `item` ON `item`.`id` = `line`.`ingredientId`
SET
  `line`.`description` = COALESCE(NULLIF(TRIM(`item`.`name`), ''), CONCAT('Purchase item ', `line`.`id`)),
  `line`.`unit` = COALESCE(NULLIF(TRIM(`item`.`unit`), ''), 'Piece');

ALTER TABLE `purchaseline`
  MODIFY COLUMN `description` VARCHAR(255) NOT NULL,
  MODIFY COLUMN `unit` VARCHAR(32) NOT NULL,
  MODIFY COLUMN `ingredientId` INTEGER NULL;

ALTER TABLE `purchaseline`
  DROP FOREIGN KEY `purchaseline_ingredientId_fkey`,
  ADD CONSTRAINT `purchaseline_ingredientId_fkey`
    FOREIGN KEY (`ingredientId`) REFERENCES `ingredient`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
