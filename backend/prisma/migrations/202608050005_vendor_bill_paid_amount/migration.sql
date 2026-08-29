ALTER TABLE `vendor_bills`
  ADD COLUMN `amount_paid` DECIMAL(15, 2) NOT NULL DEFAULT 0.00 AFTER `amount_total`;

UPDATE `vendor_bills`
SET `amount_paid` = GREATEST(0.00, `amount_total` - `amount_due`);
