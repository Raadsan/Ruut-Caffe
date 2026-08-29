ALTER TABLE `bank_accounts`
  ADD COLUMN `institution_name` VARCHAR(128) NOT NULL DEFAULT '' AFTER `bank_id`,
  MODIFY COLUMN `account_number` VARCHAR(64) NULL;

UPDATE `bank_accounts` ba
JOIN `banks` b ON b.`id` = ba.`bank_id`
SET ba.`institution_name` = b.`name`
WHERE ba.`institution_name` = '';

UPDATE `bank_accounts`
SET `account_number` = NULL
WHERE `account_number` = '';

UPDATE `submenu` sm
JOIN `menu` m ON m.`id` = sm.`menuId`
SET sm.`isActive` = 0
WHERE m.`moduleKey` = 'ACCOUNTING'
  AND sm.`url` = '/banks';
