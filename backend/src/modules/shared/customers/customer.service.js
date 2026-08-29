import prisma from '../../../config/db.js'

let posCache = { data: null, at: 0 }
const POS_TTL = 5 * 60 * 1000

export const clearCustomerCache = () => { posCache = { data: null, at: 0 } }

const defaultCompanyId = async () => {
  const company = await prisma.companies.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
  if (!company) {
    const error = new Error('A company must exist before creating customers')
    error.status = 400
    throw error
  }
  return company.id
}

const present = (record) => record && ({
  ...record,
  fullName: record.name,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

export const listCustomers = async ({ lightweight = false } = {}) => {
  if (lightweight && posCache.data && Date.now() - posCache.at < POS_TTL) return posCache.data
  const records = await prisma.customers.findMany({
    ...(lightweight ? {
      select: { id: true, name: true, phone: true, email: true, created_at: true, updated_at: true },
      take: 1000,
    } : {
      include: { _count: { select: { order: true } }, order: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
    }),
    orderBy: lightweight ? { name: 'asc' } : { created_at: 'desc' },
  })
  const result = records.map((record) => present({
    ...record,
    ...(record._count ? { totalOrders: record._count.order, lastOrderDate: record.order[0]?.createdAt || null } : {}),
  }))
  if (lightweight) posCache = { data: result, at: Date.now() }
  return result
}

export const findCustomer = async (id) => present(await prisma.customers.findUnique({
  where: { id },
  include: { order: { orderBy: { createdAt: 'desc' } } },
}))

export const findCustomerByPhone = async (phone) => present(await prisma.customers.findFirst({ where: { phone } }))

export const createCustomerRecord = async (data) => {
  const company_id = data.company_id || await defaultCompanyId()
  if (data.phone && await prisma.customers.findFirst({ where: { phone: data.phone } })) {
    const error = new Error('Customer with this phone number already exists')
    error.status = 409
    throw error
  }
  const record = await prisma.customers.create({ data: { ...data, company_id } })
  clearCustomerCache()
  return present(record)
}

export const upsertCustomerByPhone = async ({ name, phone }) => {
  const existing = await prisma.customers.findFirst({ where: { phone } })
  if (existing) return present(await prisma.customers.update({
    where: { id: existing.id },
    data: { name, updated_at: new Date() },
  }))
  return createCustomerRecord({ name, phone })
}

export const updateCustomerRecord = async (id, data) => {
  if (data.phone) {
    const duplicate = await prisma.customers.findFirst({ where: { phone: data.phone, NOT: { id } } })
    if (duplicate) {
      const error = new Error('Another customer with this phone number already exists')
      error.status = 409
      throw error
    }
  }
  const record = await prisma.customers.update({ where: { id }, data: { ...data, updated_at: new Date() } })
  clearCustomerCache()
  return present(record)
}

export const deleteCustomerRecord = async (id) => {
  const record = await prisma.customers.findUnique({
    where: { id },
    include: { order: { select: { id: true }, take: 1 }, customer_invoices: { select: { id: true }, take: 1 }, customer_receipts: { select: { id: true }, take: 1 } },
  })
  if (!record) return false
  if (record.order.length || record.customer_invoices.length || record.customer_receipts.length) {
    const error = new Error('Cannot delete a customer with existing orders or accounting transactions')
    error.status = 400
    throw error
  }
  await prisma.customers.delete({ where: { id } })
  clearCustomerCache()
  return record
}
