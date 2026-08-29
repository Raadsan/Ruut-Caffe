import prisma from '../../../config/db.js'

const defaultCompanyId = async () => {
  const company = await prisma.companies.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
  if (!company) {
    const error = new Error('A company must exist before creating vendors')
    error.status = 400
    throw error
  }
  return company.id
}
const withBalances = (vendor) => {
  if (!vendor) return vendor
  const advanceBalance = (vendor.vendor_advances || []).reduce((sum, row) => sum + Number(row.remaining_amount), 0)
  const payableBalance = (vendor.vendor_bills || []).reduce((sum, row) => sum + Number(row.amount_due), 0)
  return { ...vendor, advance_balance: Math.round(advanceBalance * 100) / 100, payable_balance: Math.round(payableBalance * 100) / 100, vendor_balance: Math.round((payableBalance - advanceBalance) * 100) / 100 }
}
const balanceInclude = { vendor_advances: { where: { state: { in: ['open', 'partial'] } }, orderBy: { created_at: 'asc' } }, vendor_bills: { where: { state: 'posted', document_type: 'bill' }, select: { id: true, bill_number: true, bill_date: true, amount_total: true, amount_due: true, payment_state: true } } }
export const listVendors = async () => (await prisma.vendors.findMany({ include: balanceInclude, orderBy: { created_at: 'desc' } })).map(withBalances)
export const findVendor = async (id) => withBalances(await prisma.vendors.findUnique({ where: { id }, include: balanceInclude }))
export const createVendorRecord = async (data) => prisma.vendors.create({ data: { ...data, company_id: data.company_id || await defaultCompanyId() } })
export const updateVendorRecord = (id, data) => prisma.vendors.update({ where: { id }, data: { ...data, updated_at: new Date() } })
export const deleteVendorRecord = async (id) => {
  const record = await prisma.vendors.findUnique({ where: { id }, include: { vendor_bills: { select: { id: true }, take: 1 }, vendor_payments: { select: { id: true }, take: 1 } } })
  if (!record) return false
  if (record.vendor_bills.length || record.vendor_payments.length) {
    const error = new Error('Cannot delete a vendor with existing accounting transactions')
    error.status = 400
    throw error
  }
  await prisma.vendors.delete({ where: { id } })
  return record
}
