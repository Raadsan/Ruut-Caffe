UPDATE `chart_of_accounts`
SET `code` = CONCAT('TMP-BANK-', `id`)
WHERE `code` = '1001' AND `name` = 'Bank Account';

UPDATE `chart_of_accounts`
SET `code` = '1001'
WHERE `code` = '1000' AND `name` = 'Cash on Hand';

UPDATE `chart_of_accounts`
SET `code` = '1002'
WHERE `code` LIKE 'TMP-BANK-%' AND `name` = 'Bank Account';

INSERT INTO `chart_of_accounts`
  (`company_id`, `code`, `name`, `account_type_id`, `parent_id`, `currency_id`, `is_reconcilable`, `allow_manual_entry`, `is_active`, `notes`)
SELECT
  cash.`company_id`, '1000', 'Current Assets', cash.`account_type_id`, NULL, cash.`currency_id`, FALSE, FALSE, TRUE,
  'Parent account for cash, bank, wallets, receivables, and vendor advances.'
FROM `chart_of_accounts` cash
WHERE cash.`code` = '1001' AND cash.`name` = 'Cash on Hand'
  AND NOT EXISTS (
    SELECT 1 FROM `chart_of_accounts` parent
    WHERE parent.`company_id` = cash.`company_id` AND parent.`code` = '1000'
  );

UPDATE `chart_of_accounts` child
JOIN `chart_of_accounts` parent
  ON parent.`company_id` = child.`company_id`
  AND parent.`code` = '1000'
  AND parent.`name` = 'Current Assets'
SET child.`parent_id` = parent.`id`
WHERE child.`id` <> parent.`id`
  AND (
    child.`code` IN ('1001', '1002', '1100', '1400')
    OR (child.`code` BETWEEN '1003' AND '1099' AND child.`name` LIKE 'Mobile Wallet%')
  );
