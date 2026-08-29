UPDATE `chart_of_accounts` target
LEFT JOIN `chart_of_accounts` conflict
  ON conflict.`company_id` = target.`company_id`
  AND conflict.`code` = '1003'
SET target.`code` = '1003'
WHERE target.`code` = 'WLT-EVC'
  AND conflict.`id` IS NULL;

UPDATE `chart_of_accounts` target
LEFT JOIN `chart_of_accounts` conflict
  ON conflict.`company_id` = target.`company_id`
  AND conflict.`code` = '1004'
SET target.`code` = '1004'
WHERE target.`code` = 'WLT-EDAHAB'
  AND conflict.`id` IS NULL;

UPDATE `chart_of_accounts` target
LEFT JOIN `chart_of_accounts` conflict
  ON conflict.`company_id` = target.`company_id`
  AND conflict.`code` = '1005'
SET target.`code` = '1005'
WHERE target.`code` = 'WLT-MERCH'
  AND conflict.`id` IS NULL;

UPDATE `chart_of_accounts` target
LEFT JOIN `chart_of_accounts` conflict
  ON conflict.`company_id` = target.`company_id`
  AND conflict.`code` = '1400'
SET target.`code` = '1400'
WHERE target.`code` = 'VA1400'
  AND conflict.`id` IS NULL;

INSERT INTO `chart_of_accounts` (
  `company_id`, `code`, `name`, `account_type_id`, `currency_id`,
  `is_reconcilable`, `allow_manual_entry`, `is_active`, `notes`
)
SELECT
  c.`id`, '1006', 'Mobile Wallet - IBS',
  (SELECT at.`id` FROM `account_types` at WHERE at.`internal_group` = 'asset' AND at.`normal_balance` = 'debit' ORDER BY at.`id` ASC LIMIT 1),
  c.`currency_id`,
  1, 1, 1, 'Mobile wallet settlement account for POS payments.'
FROM `companies` c
WHERE c.`is_active` = 1
  AND NOT EXISTS (
    SELECT 1 FROM `chart_of_accounts` coa
    WHERE coa.`company_id` = c.`id`
      AND (coa.`code` = '1006' OR coa.`name` = 'Mobile Wallet - IBS')
  );

UPDATE `payment_methods` pm
JOIN `chart_of_accounts` coa
  ON LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%evc%'
  AND coa.`name` = 'Mobile Wallet - EVC Plus'
SET pm.`gl_account_id` = coa.`id`
WHERE pm.`gl_account_id` IS NULL
   OR pm.`gl_account_id` <> coa.`id`;

UPDATE `payment_methods` pm
JOIN `chart_of_accounts` coa
  ON LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%dahab%'
  AND coa.`name` = 'Mobile Wallet - eDahab'
SET pm.`gl_account_id` = coa.`id`
WHERE pm.`gl_account_id` IS NULL
   OR pm.`gl_account_id` <> coa.`id`;

UPDATE `payment_methods` pm
JOIN `chart_of_accounts` coa
  ON (
    LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%merchant%'
    OR LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%marchant%'
  )
  AND coa.`name` = 'Mobile Wallet - Merchant'
SET pm.`gl_account_id` = coa.`id`,
    pm.`code` = 'MERCHANT',
    pm.`name` = 'Merchant'
WHERE pm.`gl_account_id` IS NULL
   OR pm.`gl_account_id` <> coa.`id`
   OR pm.`code` <> 'MERCHANT'
   OR pm.`name` <> 'Merchant';

UPDATE `payment_methods` pm
JOIN `chart_of_accounts` coa
  ON (
    LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%ibs%'
    OR LOWER(CONCAT_WS(' ', pm.`code`, pm.`name`)) LIKE '%paysii%'
  )
  AND coa.`name` = 'Mobile Wallet - IBS'
SET pm.`gl_account_id` = coa.`id`,
    pm.`code` = 'IBS',
    pm.`name` = 'IBS'
WHERE pm.`gl_account_id` IS NULL
   OR pm.`gl_account_id` <> coa.`id`
   OR pm.`code` <> 'IBS'
   OR pm.`name` <> 'IBS';
