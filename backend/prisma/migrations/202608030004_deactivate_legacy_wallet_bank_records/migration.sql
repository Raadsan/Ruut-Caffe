UPDATE `bank_accounts`
SET `payment_method_id` = NULL,
    `is_active` = 0
WHERE LOWER(CONCAT_WS(' ', `account_name`, `account_number`)) LIKE '%wallet%'
   OR LOWER(CONCAT_WS(' ', `account_name`, `account_number`)) LIKE '%evc%'
   OR LOWER(CONCAT_WS(' ', `account_name`, `account_number`)) LIKE '%merchant%'
   OR LOWER(CONCAT_WS(' ', `account_name`, `account_number`)) LIKE '%ibs%'
   OR LOWER(CONCAT_WS(' ', `account_name`, `account_number`)) LIKE '%paysii%'
   OR LOWER(CONCAT_WS(' ', `account_name`, `account_number`)) LIKE '%dahab%';

UPDATE `banks`
SET `is_active` = 0
WHERE LOWER(`name`) IN ('evc plus', 'merchant', 'marchant', 'ibs', 'e-dahab', 'edahab', 'e dahab')
   OR LOWER(`name`) LIKE '%wallet%';
