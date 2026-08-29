import prisma from "../../src/config/db.js";

try {
  const result = await prisma.$transaction(async (tx) => {
    const [company] = await tx.$queryRawUnsafe(
      "SELECT id FROM companies ORDER BY is_active DESC, id ASC LIMIT 1",
    );
    if (!company) {
      throw new Error("Cannot restore customers because no company record exists.");
    }

    const missing = await tx.$queryRawUnsafe(`
      SELECT o.customerId,
             MAX(NULLIF(TRIM(o.customerName), '')) AS customerName,
             MAX(NULLIF(TRIM(o.customerPhone), '')) AS customerPhone,
             MIN(o.createdAt) AS firstOrderAt,
             MAX(o.updatedAt) AS lastOrderAt
      FROM \`order\` o
      LEFT JOIN customers c ON c.id = o.customerId
      WHERE o.customerId IS NOT NULL AND c.id IS NULL
      GROUP BY o.customerId
      ORDER BY o.customerId
    `);

    let restored = 0;
    let remapped = 0;

    for (const row of missing) {
      const oldId = Number(row.customerId);
      const name = row.customerName || `Customer ${oldId}`;
      const phone = row.customerPhone || null;

      const existing = phone
        ? await tx.$queryRawUnsafe(
            "SELECT id FROM customers WHERE phone = ? ORDER BY id LIMIT 1",
            phone,
          )
        : [];

      if (existing.length) {
        const newId = Number(existing[0].id);
        const changed = await tx.$executeRawUnsafe(
          "UPDATE `order` SET customerId = ? WHERE customerId = ?",
          newId,
          oldId,
        );
        remapped += Number(changed);
        continue;
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO customers
          (id, company_id, name, phone, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        oldId,
        Number(company.id),
        name,
        phone,
        row.firstOrderAt || new Date(),
        row.lastOrderAt || new Date(),
      );
      restored += 1;
    }

    const [remaining] = await tx.$queryRawUnsafe(`
      SELECT COUNT(*) AS count
      FROM \`order\` o
      LEFT JOIN customers c ON c.id = o.customerId
      WHERE o.customerId IS NOT NULL AND c.id IS NULL
    `);
    if (Number(remaining.count) !== 0) {
      throw new Error(
        `Repair aborted: ${Number(remaining.count)} order customer references remain unresolved.`,
      );
    }

    return { restored, remapped, unresolved: Number(remaining.count) };
  });

  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
