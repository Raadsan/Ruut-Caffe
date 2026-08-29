import prisma from "../../src/config/db.js";

try {
  const invoices = await prisma.customer_invoices.findMany({
    where: { document_type: "invoice" },
    select: {
      id: true,
      invoice_number: true,
      state: true,
      payment_state: true,
      amount_total: true,
      amount_due: true,
      customer_id: true,
      customers: { select: { name: true } },
    },
    orderBy: { id: "desc" },
  });
  console.log(
    JSON.stringify(
      invoices,
      (_, value) => (typeof value === "bigint" ? Number(value) : value),
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
