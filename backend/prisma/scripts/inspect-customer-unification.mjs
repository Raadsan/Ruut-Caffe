import prisma from "../../src/config/db.js";

const tableNames = ["customer", "customers", "order", "address"];

try {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${tableNames.map(() => "?").join(", ")})
    ORDER BY TABLE_NAME
  `, ...tableNames);

  const foreignKeys = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME,
           REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME = 'customerId'
      AND TABLE_NAME IN ('order', 'address')
      AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `);

  const counts = {};
  for (const tableName of tableNames) {
    if (tables.some((row) => row.TABLE_NAME === tableName)) {
      const [row] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS count FROM \`${tableName}\``,
      );
      counts[tableName] = Number(row.count);
    }
  }

  const orphanCounts = {};
  if (counts.order !== undefined && counts.customers !== undefined) {
    const [row] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS count
      FROM \`order\` o
      LEFT JOIN customers c ON c.id = o.customerId
      WHERE o.customerId IS NOT NULL AND c.id IS NULL
    `);
    orphanCounts.order = Number(row.count);
  }
  if (counts.address !== undefined && counts.customers !== undefined) {
    const [row] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS count
      FROM address a
      LEFT JOIN customers c ON c.id = a.customerId
      WHERE a.customerId IS NOT NULL AND c.id IS NULL
    `);
    orphanCounts.address = Number(row.count);
  }

  const orphanIds =
    counts.order !== undefined && counts.customers !== undefined
      ? await prisma.$queryRawUnsafe(`
          SELECT DISTINCT o.customerId
          FROM \`order\` o
          LEFT JOIN customers c ON c.id = o.customerId
          WHERE o.customerId IS NOT NULL AND c.id IS NULL
          ORDER BY o.customerId
          LIMIT 25
        `)
      : [];

  const recoverableCustomers =
    counts.order !== undefined && counts.customers !== undefined
      ? await prisma.$queryRawUnsafe(`
          SELECT o.customerId,
                 MAX(NULLIF(TRIM(o.customerName), '')) AS customerName,
                 MAX(NULLIF(TRIM(o.customerPhone), '')) AS customerPhone,
                 COUNT(*) AS orderCount,
                 MIN(o.createdAt) AS firstOrderAt,
                 MAX(o.updatedAt) AS lastOrderAt
          FROM \`order\` o
          LEFT JOIN customers c ON c.id = o.customerId
          WHERE o.customerId IS NOT NULL AND c.id IS NULL
          GROUP BY o.customerId
          ORDER BY o.customerId
        `)
      : [];

  console.log(
    JSON.stringify(
      { tables, counts, foreignKeys, orphanCounts, orphanIds, recoverableCustomers },
      (_, value) => (typeof value === "bigint" ? Number(value) : value),
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
