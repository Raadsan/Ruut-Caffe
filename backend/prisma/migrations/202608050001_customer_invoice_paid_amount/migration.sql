ALTER TABLE `customer_invoices`
ADD COLUMN `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00 AFTER `amount_total`;

UPDATE `customer_invoices`
SET `paid_amount` = GREATEST(0.00, `amount_total` - `amount_due`);
