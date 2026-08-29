UPDATE `payment_methods` AS pm
JOIN `chart_of_accounts` AS coa
  ON coa.`code` = CASE pm.`code`
    WHEN 'CASH' THEN '1001'
    WHEN 'BANK' THEN '1002'
    WHEN 'EVC' THEN '1003'
    WHEN 'EDAHAB' THEN '1004'
    WHEN 'MERCHANT' THEN '1005'
    WHEN 'IBS' THEN '1006'
  END
JOIN `companies` AS company ON company.`id` = coa.`company_id`
SET pm.`gl_account_id` = coa.`id`
WHERE pm.`code` IN ('CASH', 'BANK', 'EVC', 'EDAHAB', 'MERCHANT', 'IBS')
  AND company.`name` = 'Bloom Cafe';

UPDATE `journals` AS journal
JOIN `companies` AS company ON company.`id` = journal.`company_id`
JOIN `chart_of_accounts` AS coa
  ON coa.`company_id` = company.`id`
  AND coa.`code` = CASE journal.`code` WHEN 'CASH' THEN '1001' WHEN 'BANK' THEN '1002' END
SET journal.`name` = CASE journal.`code` WHEN 'CASH' THEN 'Cash' ELSE 'Bank' END,
    journal.`journal_type` = CASE journal.`code` WHEN 'CASH' THEN 'cash' ELSE 'bank' END,
    journal.`default_credit_account_id` = coa.`id`,
    journal.`is_active` = TRUE
WHERE journal.`code` IN ('CASH', 'BANK')
  AND company.`name` = 'Bloom Cafe';

INSERT INTO `journals`
  (`company_id`, `name`, `code`, `journal_type`, `default_credit_account_id`, `currency_id`, `sequence_prefix`, `next_sequence`, `is_active`)
SELECT company.`id`, 'Mobile Wallet', 'WALLET', 'bank', coa.`id`, company.`currency_id`, 'WALLET', 1, TRUE
FROM `companies` AS company
JOIN `chart_of_accounts` AS coa ON coa.`company_id` = company.`id` AND coa.`code` = '1003'
WHERE company.`name` = 'Bloom Cafe'
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `journal_type` = VALUES(`journal_type`),
  `default_credit_account_id` = VALUES(`default_credit_account_id`),
  `is_active` = TRUE;
