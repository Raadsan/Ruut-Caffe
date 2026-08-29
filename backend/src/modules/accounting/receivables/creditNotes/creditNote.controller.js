import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'

const transactionOptions = { maxWait: 10000, timeout: 30000 }
const include = {
  customers: { select: { id: true, name: true, phone: true } },
  companies: { select: { id: true, name: true } },
  currencies: { select: { id: true, code: true, symbol: true } },
  journals: { select: { id: true, name: true, code: true } },
  customer_invoices: { select: { id: true, invoice_number: true, invoice_date: true, amount_total: true, amount_due: true, payment_state: true } },
  customer_invoice_lines: {
    orderBy: { sequence: 'asc' },
    include: {
      products: { select: { id: true, name: true, sku: true } },
      taxes: { select: { id: true, name: true, rate_percent: true, price_includes_tax: true } },
      chart_of_accounts: { select: { id: true, code: true, name: true } },
    },
  },
  fiscal_periods: { select: { id: true, name: true, state: true } },
  journal_entries: { select: { id: true, entry_number: true, state: true } },
}
const asId = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
const asDate = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const inputError = (message) => Object.assign(new Error(message), { status: 400 })
const fail = (res, error, fallback) => {
  console.error(fallback, error)
  return res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message || fallback })
}

async function prepare(input) {
  const originalId = asId(input.reversed_invoice_id)
  const creditDate = asDate(input.invoice_date)
  const lines = Array.isArray(input.lines) ? input.lines : []
  if (!originalId || !creditDate) throw inputError('Original invoice and credit note date are required')
  if (!lines.length) throw inputError('Add at least one credit note line')

  const original = await prisma.customer_invoices.findUnique({
    where: { id: originalId },
    include: { customers: true, companies: true, journals: true },
  })
  if (!original || original.document_type !== 'invoice' || original.state !== 'posted') throw inputError('Select a posted customer invoice')
  if (!original.customers.is_active || !original.companies.is_active) throw inputError('Customer or company is inactive')
  if (!original.journals.is_active || original.journals.journal_type !== 'sale') throw inputError('The invoice sales journal is inactive')

  const fiscalPeriod = await prisma.fiscal_periods.findFirst({
    where: {
      state: 'open', start_date: { lte: creditDate }, end_date: { gte: creditDate },
      fiscal_years: { company_id: original.company_id, state: 'open' },
    },
  })
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the credit note date')

  const productIds = [...new Set(lines.map((line) => asId(line.product_id)).filter(Boolean))]
  const taxIds = [...new Set(lines.map((line) => asId(line.tax_id)).filter(Boolean))]
  const [products, taxes, accounts] = await Promise.all([
    prisma.products.findMany({ where: { id: { in: productIds } } }),
    prisma.taxes.findMany({ where: { id: { in: taxIds } } }),
    prisma.chart_of_accounts.findMany({ where: { company_id: original.company_id, is_active: true } }),
  ])
  const productMap = new Map(products.map((row) => [row.id, row]))
  const taxMap = new Map(taxes.map((row) => [row.id, row]))
  const accountMap = new Map(accounts.map((row) => [row.id, row]))
  const debitLines = []
  let amountUntaxed = 0
  let amountTax = 0
  const preparedLines = lines.map((line, index) => {
    const productId = asId(line.product_id)
    const product = productId ? productMap.get(productId) : null
    const taxId = asId(line.tax_id)
    const tax = taxId ? taxMap.get(taxId) : null
    const accountId = asId(line.income_account_id) || product?.income_account_id
    const description = String(line.description || product?.name || '').trim()
    const quantity = Number(line.quantity)
    const unitPrice = Number(line.unit_price)
    const discount = Number(line.discount_percent || 0)
    if (!description) throw inputError(`Line ${index + 1}: description is required`)
    if (!Number.isFinite(quantity) || quantity <= 0) throw inputError(`Line ${index + 1}: quantity must be greater than zero`)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw inputError(`Line ${index + 1}: unit price cannot be negative`)
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw inputError(`Line ${index + 1}: discount must be between 0 and 100`)
    if (!accountId || !accountMap.has(accountId)) throw inputError(`Line ${index + 1}: a valid income account is required`)
    if (taxId && !tax) throw inputError(`Line ${index + 1}: tax not found`)
    const discounted = quantity * unitPrice * (1 - discount / 100)
    const rate = tax ? Number(tax.rate_percent) / 100 : 0
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0
    const roundedUntaxed = Math.round(untaxed * 100) / 100
    const roundedTax = Math.round(taxAmount * 100) / 100
    amountUntaxed += roundedUntaxed
    amountTax += roundedTax
    debitLines.push({ account_id: accountId, amount: roundedUntaxed, label: description })
    if (roundedTax) {
      if (!tax.tax_account_id) throw inputError(`Line ${index + 1}: selected tax has no tax account`)
      debitLines.push({ account_id: tax.tax_account_id, amount: roundedTax, label: tax.name })
    }
    return { sequence: (index + 1) * 10, product_id: productId, description, quantity, unit_price: unitPrice, discount_percent: discount, tax_id: taxId, income_account_id: accountId, subtotal: roundedUntaxed }
  })
  amountUntaxed = Math.round(amountUntaxed * 100) / 100
  amountTax = Math.round(amountTax * 100) / 100
  const amountTotal = Math.round((amountUntaxed + amountTax) * 100) / 100
  if (amountTotal <= 0) throw inputError('Credit note total must be greater than zero')
  const credited = await prisma.customer_invoices.aggregate({
    where: { document_type: 'credit_note', reversed_invoice_id: original.id, state: 'posted' },
    _sum: { amount_total: true },
  })
  const creditableAmount = Math.max(0, Math.round((Number(original.amount_total) - Number(credited._sum.amount_total || 0)) * 100) / 100)
  if (amountTotal > creditableAmount + 0.005) throw inputError(`Credit note total cannot exceed the remaining creditable amount of ${creditableAmount.toFixed(2)}`)

  return {
    original,
    header: {
      company_id: original.company_id, document_type: 'credit_note', customer_id: original.customer_id,
      journal_id: original.journal_id, fiscal_period_id: fiscalPeriod.id, invoice_date: creditDate, due_date: creditDate,
      payment_term_id: null, currency_id: original.currency_id, exchange_rate: original.exchange_rate,
      receivable_account_id: original.receivable_account_id, reversed_invoice_id: original.id,
      customer_reference: String(input.customer_reference || '').trim() || null,
      state: 'draft', payment_state: 'not_paid', amount_untaxed: amountUntaxed, amount_tax: amountTax,
      amount_total: amountTotal, amount_due: amountTotal, notes: String(input.notes || '').trim() || null,
    },
    lines: preparedLines,
    debitLines,
  }
}

function journalItems(prepared) {
  const rate = Number(prepared.header.exchange_rate)
  const grouped = new Map()
  for (const row of prepared.debitLines) grouped.set(row.account_id, (grouped.get(row.account_id) || 0) + row.amount)
  const total = Math.round(prepared.header.amount_total * rate * 100) / 100
  const items = [...grouped.entries()].map(([accountId, amount], index) => ({
    sequence: (index + 1) * 10, account_id: accountId, label: 'Customer credit note',
    debit: Math.round(amount * rate * 100) / 100, credit: 0,
    currency_id: prepared.header.currency_id, amount_currency: amount,
  }))
  items.push({
    sequence: (items.length + 1) * 10, account_id: prepared.header.receivable_account_id,
    label: 'Accounts Receivable', partner_type: 'customer', partner_id: prepared.header.customer_id,
    debit: 0, credit: total, currency_id: prepared.header.currency_id, amount_currency: -prepared.header.amount_total,
  })
  const debit = items.slice(0, -1).reduce((sum, row) => sum + row.debit, 0)
  if (Math.abs(debit - total) > 0) items[items.length - 2].debit = Math.round((items[items.length - 2].debit + total - debit) * 100) / 100
  return items
}

async function allocateNumber(tx, journal) {
  for (;;) {
    const updated = await tx.journals.update({ where: { id: journal.id }, data: { next_sequence: { increment: 1 } }, select: { next_sequence: true } })
    const number = `CN${String(updated.next_sequence - 1).padStart(4, '0')}`
    const exists = await tx.customer_invoices.findFirst({ where: { company_id: journal.company_id, invoice_number: number }, select: { id: true } })
    if (!exists) return number
  }
}

export const getAll = async (req, res) => {
  try {
    const data = await prisma.customer_invoices.findMany({ where: { document_type: 'credit_note' }, include, orderBy: { created_at: 'desc' } })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch credit notes') }
}

export const getById = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    const data = await prisma.customer_invoices.findFirst({ where: { id: creditId, document_type: 'credit_note' }, include })
    if (!data) return res.status(404).json({ success: false, message: 'Credit note not found' })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch credit note') }
}

export const create = async (req, res) => {
  try {
    const prepared = await prepare(req.body)
    const creditId = await prisma.$transaction(async (tx) => {
      const number = await allocateNumber(tx, prepared.original.journals)
      const credit = await tx.customer_invoices.create({ data: { ...prepared.header, invoice_number: number, customer_invoice_lines: { create: prepared.lines } } })
      const entry = await tx.journal_entries.create({
        data: {
          company_id: prepared.header.company_id, journal_id: prepared.header.journal_id, entry_number: number,
          entry_date: prepared.header.invoice_date, fiscal_period_id: prepared.header.fiscal_period_id,
          reference: prepared.original.invoice_number, narration: `Draft credit note ${number} for ${prepared.original.invoice_number}`,
          state: 'draft', source_type: 'customer_invoice', source_id: credit.id,
          journal_items: { create: journalItems(prepared) },
        },
      })
      await tx.customer_invoices.update({ where: { id: credit.id }, data: { journal_entry_id: entry.id } })
      return credit.id
    }, transactionOptions)
    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'CreditNote', entityId: creditId, description: `Created draft credit note "${data.invoice_number}"` })
    res.status(201).json({ success: true, message: 'Draft credit note created successfully', data })
  } catch (error) { fail(res, error, 'Failed to create credit note') }
}

export const update = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    const existing = await prisma.customer_invoices.findFirst({ where: { id: creditId, document_type: 'credit_note' } })
    if (!existing) return res.status(404).json({ success: false, message: 'Credit note not found' })
    if (existing.state !== 'draft') throw inputError('Only draft credit notes can be edited')
    const prepared = await prepare(req.body)
    await prisma.$transaction(async (tx) => {
      await tx.customer_invoice_lines.deleteMany({ where: { invoice_id: creditId } })
      await tx.customer_invoices.update({ where: { id: creditId }, data: { ...prepared.header, invoice_number: existing.invoice_number, customer_invoice_lines: { create: prepared.lines }, updated_at: new Date() } })
      if (!existing.journal_entry_id) throw inputError('Linked draft journal entry is missing')
      const entry = await tx.journal_entries.findUnique({ where: { id: existing.journal_entry_id } })
      if (!entry || entry.state !== 'draft') throw inputError('Linked journal entry is not editable')
      await tx.journal_items.deleteMany({ where: { entry_id: entry.id } })
      await tx.journal_entries.update({
        where: { id: entry.id },
        data: {
          company_id: prepared.header.company_id, journal_id: prepared.header.journal_id,
          entry_date: prepared.header.invoice_date, fiscal_period_id: prepared.header.fiscal_period_id,
          reference: prepared.original.invoice_number, narration: `Draft credit note ${existing.invoice_number} for ${prepared.original.invoice_number}`,
          source_id: creditId, journal_items: { create: journalItems(prepared) },
        },
      })
    }, transactionOptions)
    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    res.json({ success: true, message: 'Draft credit note updated successfully', data })
  } catch (error) { fail(res, error, 'Failed to update credit note') }
}

export const remove = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    const existing = await prisma.customer_invoices.findFirst({ where: { id: creditId, document_type: 'credit_note' } })
    if (!existing) return res.status(404).json({ success: false, message: 'Credit note not found' })
    if (existing.state !== 'draft') throw inputError('Only draft credit notes can be deleted')
    await prisma.$transaction(async (tx) => {
      await tx.customer_invoices.delete({ where: { id: creditId } })
      if (existing.journal_entry_id) await tx.journal_entries.deleteMany({ where: { id: existing.journal_entry_id, state: 'draft' } })
    }, transactionOptions)
    res.json({ success: true, message: 'Draft credit note deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete credit note') }
}

export const post = async (req, res) => {
  const creditId = asId(req.params.id)
  if (!creditId) return res.status(400).json({ success: false, message: 'Invalid credit note id' })
  try {
    await prisma.$transaction(async (tx) => {
      const credit = await tx.customer_invoices.findUnique({
        where: { id: creditId },
        include: { journal_entries: { include: { journal_items: true } }, fiscal_periods: { include: { fiscal_years: true } }, customer_invoices: true },
      })
      if (!credit || credit.document_type !== 'credit_note') throw inputError('Credit note not found')
      if (credit.state !== 'draft') throw inputError('Only draft credit notes can be posted')
      if (!credit.journal_entries || credit.journal_entries.state !== 'draft') throw inputError('Linked draft journal entry is invalid')
      if (!credit.fiscal_periods || credit.fiscal_periods.state !== 'open' || credit.fiscal_periods.fiscal_years.state !== 'open') throw inputError('Credit note fiscal period is closed')
      const debit = credit.journal_entries.journal_items.reduce((sum, row) => sum + Number(row.debit), 0)
      const journalCredit = credit.journal_entries.journal_items.reduce((sum, row) => sum + Number(row.credit), 0)
      if (debit <= 0 || Math.abs(debit - journalCredit) > 0.005) throw inputError('Credit note journal entry is unbalanced')
      const amount = Number(credit.amount_total)
      const original = credit.customer_invoices
      if (!original || original.state !== 'posted' || original.document_type !== 'invoice') throw inputError('Original invoice is no longer eligible')
      const postedAt = new Date()
      const claimed = await tx.customer_invoices.updateMany({ where: { id: creditId, document_type: 'credit_note', state: 'draft' }, data: { state: 'posted', posted_at: postedAt, amount_due: 0, payment_state: 'reversed', updated_at: postedAt } })
      if (claimed.count !== 1) throw inputError('Credit note was already posted by another request')
      await tx.$queryRawUnsafe('SELECT id FROM customer_invoices WHERE id = ? FOR UPDATE', original.id)
      const credited = await tx.customer_invoices.aggregate({
        where: { document_type: 'credit_note', reversed_invoice_id: original.id, state: 'posted' },
        _sum: { amount_total: true },
      })
      if (Number(credited._sum.amount_total || 0) > Number(original.amount_total) + 0.005) throw inputError('Credit notes exceed the original invoice total')
      const currentOriginal = await tx.customer_invoices.findUnique({ where: { id: original.id } })
      const appliedToOutstanding = Math.min(amount, Number(currentOriginal.amount_due))
      const remainingDue = Math.max(0, Math.round((Number(currentOriginal.amount_due) - appliedToOutstanding) * 100) / 100)
      const fullyCredited = Math.abs(Number(credited._sum.amount_total || 0) - Number(original.amount_total)) <= 0.005
      await tx.customer_invoices.update({
        where: { id: original.id },
        data: {
          amount_due: remainingDue,
          payment_state: fullyCredited ? 'reversed' : remainingDue <= 0.005 ? 'paid' : currentOriginal.payment_state === 'partial' ? 'partial' : 'not_paid',
          updated_at: postedAt,
        },
      })
      await tx.journal_entries.update({ where: { id: credit.journal_entries.id }, data: { state: 'posted', posted_at: postedAt, narration: `Credit note ${credit.invoice_number} for ${original.invoice_number}` } })
    }, transactionOptions)
    const data = await prisma.customer_invoices.findUnique({ where: { id: creditId }, include })
    await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'CreditNote', entityId: creditId, description: `Posted credit note "${data.invoice_number}"` })
    res.json({ success: true, message: 'Credit note posted successfully', data })
  } catch (error) { fail(res, error, 'Failed to post credit note') }
}
