ALTER TABLE `menuitem`
  ADD COLUMN `isSellable` BOOLEAN NOT NULL DEFAULT TRUE AFTER `isAvailable`,
  ADD COLUMN `isPurchasable` BOOLEAN NOT NULL DEFAULT FALSE AFTER `isSellable`;

ALTER TABLE `products`
  ALTER COLUMN `can_be_sold` SET DEFAULT TRUE,
  ALTER COLUMN `can_be_purchased` SET DEFAULT FALSE;

ALTER TABLE `purchaseline`
  ADD COLUMN `menuItemId` INTEGER NULL AFTER `ingredientId`,
  ADD INDEX `purchaseline_menuItemId_idx` (`menuItemId`),
  ADD CONSTRAINT `purchaseline_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `menuitem` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `products` (`sku`, `name`, `description`, `product_type`, `uom`, `can_be_sold`, `can_be_purchased`, `list_price`, `standard_cost`, `is_active`)
SELECT CONCAT('MENU-', mi.`id`), mi.`name`, mi.`description`, 'goods', 'unit', mi.`isSellable`, mi.`isPurchasable`, mi.`price`, COALESCE(mi.`costPrice`, 0), (mi.`isSellable` OR mi.`isPurchasable`)
FROM `menuitem` mi
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`), `description` = VALUES(`description`), `can_be_sold` = VALUES(`can_be_sold`),
  `can_be_purchased` = VALUES(`can_be_purchased`), `list_price` = VALUES(`list_price`),
  `standard_cost` = VALUES(`standard_cost`), `is_active` = VALUES(`is_active`);
