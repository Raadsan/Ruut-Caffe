-- One-time, data-preserving migration from the legacy Restaurant `customer`
-- table into the existing Accounting `customers` table.
-- Back up the database and run this before deploying the matching Prisma schema.

SET @default_company_id := (SELECT MIN(id) FROM companies);

CREATE TEMPORARY TABLE customer_id_map (
  old_id INT NOT NULL PRIMARY KEY,
  new_id INT UNSIGNED NOT NULL
);

-- Reuse an existing accounting customer when the phone already identifies it.
INSERT INTO customer_id_map (old_id, new_id)
SELECT legacy.id, MIN(shared.id)
FROM customer legacy
JOIN customers shared ON shared.phone = legacy.phone
GROUP BY legacy.id;

-- Move every remaining Restaurant customer into the existing shared table.
INSERT INTO customers (company_id, name, phone, is_active, created_at, updated_at)
SELECT @default_company_id, legacy.fullName, legacy.phone, TRUE,
       legacy.createdAt, COALESCE(legacy.updatedAt, legacy.createdAt)
FROM customer legacy
LEFT JOIN customer_id_map mapped ON mapped.old_id = legacy.id
WHERE mapped.old_id IS NULL;

INSERT INTO customer_id_map (old_id, new_id)
SELECT legacy.id, MIN(shared.id)
FROM customer legacy
JOIN customers shared ON shared.phone = legacy.phone
LEFT JOIN customer_id_map mapped ON mapped.old_id = legacy.id
WHERE mapped.old_id IS NULL
GROUP BY legacy.id;

ALTER TABLE `order` DROP FOREIGN KEY order_customerId_fkey;
ALTER TABLE address DROP FOREIGN KEY address_customerId_fkey;

UPDATE `order` orders
JOIN customer_id_map mapped ON mapped.old_id = orders.customerId
SET orders.customerId = mapped.new_id;

UPDATE address addresses
JOIN customer_id_map mapped ON mapped.old_id = addresses.customerId
SET addresses.customerId = mapped.new_id;

ALTER TABLE `order` MODIFY customerId INT UNSIGNED NULL;
ALTER TABLE address MODIFY customerId INT UNSIGNED NOT NULL;
DROP TABLE customer;

ALTER TABLE `order`
  ADD CONSTRAINT order_customerId_fkey
  FOREIGN KEY (customerId) REFERENCES customers(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE address
  ADD CONSTRAINT address_customerId_fkey
  FOREIGN KEY (customerId) REFERENCES customers(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
