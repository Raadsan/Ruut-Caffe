ALTER TABLE `payment_methods`
  ADD COLUMN `allow_multiple_accounts` BOOLEAN NOT NULL DEFAULT 0 AFTER `gl_account_id`;

ALTER TABLE `bank_accounts`
  ADD COLUMN `payment_method_id` INTEGER UNSIGNED NULL AFTER `gl_account_id`,
  ADD INDEX `fk_ba_payment_method` (`payment_method_id`),
  ADD CONSTRAINT `fk_ba_payment_method` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`);

UPDATE `payment_methods`
SET `allow_multiple_accounts` = 1
WHERE LOWER(CONCAT_WS(' ', `code`, `name`)) LIKE '%bank%'
   OR LOWER(CONCAT_WS(' ', `code`, `name`)) LIKE '%transfer%';

UPDATE `bank_accounts` ba
JOIN `payment_methods` pm
  ON pm.`allow_multiple_accounts` = 1
  AND (
    LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%bank%'
    OR LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%transfer%'
  )
SET ba.`payment_method_id` = pm.`id`
WHERE ba.`payment_method_id` IS NULL;
