ALTER TABLE `payment_methods`
  ADD COLUMN `gl_account_id` INTEGER UNSIGNED NULL AFTER `payment_type`,
  ADD INDEX `fk_pm_gl` (`gl_account_id`),
  ADD CONSTRAINT `fk_pm_gl` FOREIGN KEY (`gl_account_id`) REFERENCES `chart_of_accounts` (`id`);

UPDATE `payment_methods` pm
JOIN `bank_accounts` ba
  ON ba.`gl_account_id` IS NOT NULL
  AND (
    LOWER(CONCAT_WS(' ', ba.`account_name`, ba.`account_number`)) LIKE CONCAT('%', LOWER(pm.`name`), '%')
    OR LOWER(CONCAT_WS(' ', ba.`account_name`, ba.`account_number`)) LIKE CONCAT('%', LOWER(REPLACE(pm.`code`, '_', ' ')), '%')
    OR LOWER(pm.`name`) LIKE CONCAT('%', LOWER(ba.`account_name`), '%')
  )
SET pm.`gl_account_id` = ba.`gl_account_id`
WHERE pm.`gl_account_id` IS NULL;

UPDATE `payment_methods` pm
JOIN `chart_of_accounts` coa
  ON coa.`is_active` = 1
  AND coa.`allow_manual_entry` = 1
  AND (
    LOWER(coa.`name`) = LOWER(pm.`name`)
    OR LOWER(coa.`name`) LIKE CONCAT('%', LOWER(pm.`name`), '%')
    OR LOWER(coa.`name`) LIKE CONCAT('%', LOWER(REPLACE(pm.`code`, '_', ' ')), '%')
  )
SET pm.`gl_account_id` = coa.`id`
WHERE pm.`gl_account_id` IS NULL;

UPDATE `payment_methods` pm
JOIN `chart_of_accounts` coa
  ON coa.`is_active` = 1
  AND coa.`allow_manual_entry` = 1
  AND (
    (LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%cash%' AND LOWER(coa.`name`) LIKE '%cash%')
    OR (LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%evc%' AND LOWER(coa.`name`) LIKE '%evc%')
    OR (LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%dahab%' AND LOWER(coa.`name`) LIKE '%dahab%')
    OR (LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%merchant%' AND LOWER(coa.`name`) LIKE '%merchant%')
    OR (LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%ibs%' AND LOWER(coa.`name`) LIKE '%ibs%')
    OR (LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%bank%' AND LOWER(coa.`name`) LIKE '%main bank%')
    OR (LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%transfer%' AND LOWER(coa.`name`) LIKE '%main bank%')
  )
SET pm.`gl_account_id` = coa.`id`
WHERE pm.`gl_account_id` IS NULL;
