import prisma from '../config/db.js'

const normalizedRate = (value) => Math.round(Number(value || 0) * 10000) / 10000
let fullSyncPromise = null

async function taxForRate(rate) {
  const value = normalizedRate(rate)
  if (value <= 0) return null

  const existing = await prisma.taxes.findFirst({
    where: { rate_percent: value, is_active: true, tax_scope: { in: ['sale', 'both'] } },
    orderBy: { id: 'asc' },
  })
  if (existing?.tax_account_id) return existing

  const company = await prisma.companies.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } })
  if (!company) return null

  let taxAccount = await prisma.chart_of_accounts.findFirst({
    where: { company_id: company.id, is_active: true, name: { contains: 'Tax Payable' } },
  })
  if (!taxAccount) {
    const liabilityAccount = await prisma.chart_of_accounts.findFirst({
      where: { company_id: company.id, account_types: { internal_group: 'liability' } },
      include: { account_types: true },
      orderBy: { code: 'asc' },
    })
    if (!liabilityAccount) return null
    taxAccount = await prisma.chart_of_accounts.upsert({
      where: { company_id_code: { company_id: company.id, code: '2100' } },
      update: { name: 'VAT Payable', is_active: true },
      create: {
        company_id: company.id,
        code: '2100',
        name: 'VAT Payable',
        account_type_id: liabilityAccount.account_type_id,
        currency_id: company.currency_id,
      },
    })
  }

  if (existing) {
    return prisma.taxes.update({
      where: { id: existing.id },
      data: { tax_account_id: taxAccount.id },
    })
  }

  const name = `VAT ${value}%`
  return prisma.taxes.upsert({
    where: { name },
    update: { rate_percent: value, tax_scope: 'sale', tax_account_id: taxAccount.id, is_active: true },
    create: { name, rate_percent: value, tax_scope: 'sale', tax_account_id: taxAccount.id },
  })
}

export async function syncAccountingProduct(item) {
  const tax = await taxForRate(item.tax)
  const sku = `MENU-${item.id}`
  const data = {
    name: item.name,
    description: item.description,
    product_type: 'goods',
    can_be_sold: item.isSellable,
    can_be_purchased: item.isPurchasable,
    list_price: item.price,
    standard_cost: item.costPrice || 0,
    sale_tax_id: tax?.id || null,
    is_active: item.isSellable || item.isPurchasable,
  }
  return prisma.products.upsert({ where: { sku }, update: data, create: { sku, ...data } })
}

async function runFullMenuProductSync() {
  const [menuItems, products] = await Promise.all([
    prisma.menuitem.findMany(),
    prisma.products.findMany({ where: { sku: { startsWith: 'MENU-' } } }),
  ])
  const taxByRate = new Map()
  for (const rate of [...new Set(menuItems.map((item) => normalizedRate(item.tax)).filter((rate) => rate > 0))]) {
    taxByRate.set(rate, await taxForRate(rate))
  }

  const productBySku = new Map(products.map((product) => [product.sku, product]))
  const writes = []
  for (const item of menuItems) {
    const sku = `MENU-${item.id}`
    const taxId = taxByRate.get(normalizedRate(item.tax))?.id || null
    const existing = productBySku.get(sku)
    const data = {
      name: item.name,
      description: item.description,
      product_type: 'goods',
      can_be_sold: item.isSellable,
      can_be_purchased: item.isPurchasable,
      list_price: item.price,
      standard_cost: item.costPrice || 0,
      sale_tax_id: taxId,
      is_active: item.isSellable || item.isPurchasable,
    }
    if (!existing) writes.push(prisma.products.create({ data: { sku, ...data } }))
    else if (existing.sale_tax_id !== taxId) writes.push(prisma.products.update({ where: { id: existing.id }, data }))
  }
  if (writes.length) await prisma.$transaction(writes)
}

export function syncAllMenuAccountingProducts() {
  if (!fullSyncPromise) {
    fullSyncPromise = runFullMenuProductSync().catch((error) => {
      fullSyncPromise = null
      throw error
    })
  }
  return fullSyncPromise
}
