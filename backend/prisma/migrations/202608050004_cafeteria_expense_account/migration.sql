UPDATE `chart_of_accounts`
SET `name` = 'Cafeteria Expense',
    `is_active` = TRUE,
    `allow_manual_entry` = TRUE,
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `code` = '5005';
