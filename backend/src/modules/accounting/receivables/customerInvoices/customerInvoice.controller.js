import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'

const invoiceInclude = {
  customers: { select: { id: true, name: true, phone: true, email: true } },
  companies: { select: { id: true, name: true } },
  currencies: { select: { id: true, code: true, symbol: true } },
  journals: { select: { id: true, name: true, code: true } },
  customer_invoice_lines: {
    orderBy: { sequence: 'asc' },
    include: {
      products: { select: { id: true, name: true, sku: true } },
      taxes: { select: { id: true, name: true, rate_percent: true, price_includes_tax: true } },
      chart_of_accounts: { select: { id: true, code: true, name: true } },
    },
  },
  payment_terms: { select: { id: true, name: true } },
  fiscal_periods: { select: { id: true, name: true, start_date: true, end_date: true, state: true } },
  journal_entries: { select: { id: true, entry_number: true, state: true } },
}

// The database can be remote, and invoice transactions create the invoice,
// lines, journal entry, and journal items atomically. Prisma's 5-second default
// is too short for that multi-query unit of work on a higher-latency connection.
const invoiceTransactionOptions = { maxWait: 10000, timeout: 30000 }

const id = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
const date = (value) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const fail = (res, error, fallback) => {
  console.error(fallback, error)
  return res.status(error.status || (error.code === 'P2025' ? 404 : 500))
    .json({ success: false, message: error.message || fallback })
}
const inputError = (message) => {
  const error = new Error(message)
  error.status = 400
  return error
}

export async function ensureCustomerInvoiceDefaults() {
  const defaults = [
    ['Immediate', 0],
    ['Net 7', 7],
    ['Net 15', 15],
    ['Net 30', 30],
    ['Net 45', 45],
    ['Net 60', 60],
  ]
  for (const [name, dueDays] of defaults) {
    const term = await prisma.payment_terms.upsert({
      where: { name },
      update: { is_active: true },
      create: { name, description: dueDays ? `Payment due in ${dueDays} days` : 'Payment due immediately', is_active: true },
      include: { payment_term_lines: true },
    })
    if (!term.payment_term_lines.length) {
      await prisma.payment_term_lines.create({
        data: { payment_term_id: term.id, sequence: 10, value_type: 'balance', value_amount: 0, due_days: dueDays },
      })
    }
  }
}

async function prepareInvoice(input) {
  const customerId = id(input.customer_id)
  const invoiceDate = date(input.invoice_date)
  const lines = Array.isArray(input.lines) ? input.lines : []

  if (!customerId || !invoiceDate) throw inputError('Customer and invoice date are required')
  if (!lines.length) throw inputError('Add at least one invoice line')

  const customer = await prisma.customers.findUnique({ where: { id: customerId } })
  if (!customer) throw inputError('Customer not found')
  const [company, journal, paymentTerm, fiscalPeriod, revenueAccount] = await Promise.all([
    prisma.companies.findUnique({ where: { id: customer.company_id } }),
    prisma.journals.findUnique({ where: { company_id_code: { company_id: customer.company_id, code: 'INV' } } }),
    id(input.payment_term_id) ? prisma.payment_terms.findUnique({ where: { id: id(input.payment_term_id) }, include: { payment_term_lines: true } }) : null,
    prisma.fiscal_periods.findFirst({
      where: {
        state: 'open',
        fiscal_years: { company_id: customer.company_id, state: 'open' },
        start_date: { lte: invoiceDate },
        end_date: { gte: invoiceDate },
      },
      orderBy: { period_number: 'asc' },
    }),
    prisma.chart_of_accounts.findFirst({
      where: { company_id: customer.company_id, code: '4000', is_active: true, allow_manual_entry: true, account_types: { internal_group: 'income' }, other_chart_of_accounts: { none: {} } },
    }),
  ])
  if (!company?.is_active) throw inputError('Customer company is inactive or missing')
  if (!journal?.is_active || journal.journal_type !== 'sale') throw inputError('Active Customer Invoices journal (INV) was not found')
  if (!revenueAccount) throw inputError('Default Sales Revenue account 4000 was not found')
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the invoice date')

  const currencyId = id(input.currency_id) || company.currency_id
  const receivableAccount = await prisma.chart_of_accounts.findFirst({
    where: {
      company_id: customer.company_id,
      code: '1100',
      is_active: true,
      allow_manual_entry: true,
      account_types: { internal_group: 'asset' },
      other_chart_of_accounts: { none: {} },
    },
  })
  const currency = await prisma.currencies.findUnique({ where: { id: currencyId } })
  if (!currency?.is_active) throw inputError('Invoice currency is inactive or missing')
  if (!receivableAccount) throw inputError('Accounts Receivable account 1100 was not found')

  const dueDays = paymentTerm?.payment_term_lines?.length
    ? Math.max(...paymentTerm.payment_term_lines.map((line) => Number(line.due_days || 0)))
    : 0
  const dueDate = date(input.due_date) || new Date(invoiceDate)
  if (!date(input.due_date)) dueDate.setUTCDate(dueDate.getUTCDate() + dueDays)
  if (dueDate < invoiceDate) throw inputError('Due date cannot be before the invoice date')

  const exchangeRate = currencyId === company.currency_id ? 1 : Number(input.exchange_rate)
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw inputError('A positive exchange rate is required')

  const productIds = [...new Set(lines.map((line) => id(line.product_id)).filter(Boolean))]
  const taxIds = [...new Set(lines.map((line) => id(line.tax_id)).filter(Boolean))]
  const [products, taxes] = await Promise.all([
    prisma.products.findMany({ where: { id: { in: productIds } } }),
    prisma.taxes.findMany({ where: { id: { in: taxIds } } }),
  ])
  const productMap = new Map(products.map((item) => [item.id, item]))
  const taxMap = new Map(taxes.map((item) => [item.id, item]))

  let amountUntaxed = 0
  let amountTax = 0
  let amountDiscount = 0
  const journalCredits = []
  const preparedLines = lines.map((line, index) => {
    const productId = id(line.product_id)
    const product = productId ? productMap.get(productId) : null
    const taxId = id(line.tax_id)
    const tax = taxId ? taxMap.get(taxId) : null
    const incomeAccountId = revenueAccount.id
    const quantity = Number(line.quantity)
    const unitPrice = Number(line.unit_price)
    const discount = Number(line.discount_percent || 0)
    const description = String(line.description || product?.name || '').trim()
    if (productId && (!product || !product.is_active || !product.can_be_sold)) throw inputError(`Line ${index + 1}: product is not active and sellable`)
    if (!description) throw inputError(`Line ${index + 1}: description is required`)
    if (!Number.isFinite(quantity) || quantity <= 0) throw inputError(`Line ${index + 1}: quantity must be greater than zero`)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw inputError(`Line ${index + 1}: unit price cannot be negative`)
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw inputError(`Line ${index + 1}: discount must be between 0 and 100`)
    if (taxId && !tax) throw inputError(`Line ${index + 1}: tax not found`)

    const discounted = quantity * unitPrice * (1 - discount / 100)
    amountDiscount += quantity * unitPrice - discounted
    const rate = tax ? Number(tax.rate_percent) / 100 : 0
    const untaxed = tax?.price_includes_tax && rate ? discounted / (1 + rate) : discounted
    const taxAmount = tax ? (tax.price_includes_tax ? discounted - untaxed : untaxed * rate) : 0
    const roundedUntaxed = Math.round(untaxed * 100) / 100
    const roundedTax = Math.round(taxAmount * 100) / 100
    amountUntaxed += roundedUntaxed
    amountTax += roundedTax
    journalCredits.push({ account_id: incomeAccountId, amount: roundedUntaxed, label: description })
    if (roundedTax) {
      if (!tax.tax_account_id) throw inputError(`Line ${index + 1}: selected tax has no tax account`)
      journalCredits.push({ account_id: tax.tax_account_id, amount: roundedTax, label: tax.name })
    }
    return {
      sequence: (index + 1) * 10,
      product_id: productId,
      description,
      quantity,
      unit_price: unitPrice,
      discount_percent: discount,
      tax_id: taxId,
      income_account_id: incomeAccountId,
      subtotal: roundedUntaxed,
    }
  })

  amountUntaxed = Math.round(amountUntaxed * 100) / 100
  amountTax = Math.round(amountTax * 100) / 100
  const amountTotal = Math.round((amountUntaxed + amountTax) * 100) / 100
  return {
    header: {
      company_id: customer.company_id,
      document_type: 'invoice',
      customer_id: customerId,
      journal_id: journal.id,
      fiscal_period_id: fiscalPeriod.id,
      invoice_date: invoiceDate,
      due_date: dueDate,
      payment_term_id: paymentTerm?.id || null,
      currency_id: currencyId,
      exchange_rate: exchangeRate,
      receivable_account_id: receivableAccount.id,
      customer_reference: String(input.customer_reference || '').trim() || null,
      state: 'draft',
      payment_state: 'not_paid',
      amount_untaxed: amountUntaxed,
      amount_tax: amountTax,
      amount_total: amountTotal,
      paid_amount: 0,
      amount_due: amountTotal,
      notes: String(input.notes || '').trim() || null,
    },
    lines: preparedLines,
    amountDiscount: Math.round(amountDiscount * 100) / 100,
    journalCredits,
    companyCurrencyId: company.currency_id,
  }
}

function journalItems(prepared) {
  const rate = Number(prepared.header.exchange_rate)
  const credits = new Map()
  for (const line of prepared.journalCredits) {
    credits.set(line.account_id, (credits.get(line.account_id) || 0) + line.amount)
  }
  const totalBase = Math.round(prepared.header.amount_total * rate * 100) / 100
  const items = [
    {
      sequence: 10,
      account_id: prepared.header.receivable_account_id,
      label: 'Accounts Receivable',
      partner_type: 'customer',
      partner_id: prepared.header.customer_id,
      debit: totalBase,
      credit: 0,
      currency_id: prepared.header.currency_id,
      amount_currency: prepared.header.amount_total,
    },
    ...[...credits.entries()].map(([accountId, amount], index) => ({
      sequence: (index + 2) * 10,
      account_id: accountId,
      label: 'Customer invoice revenue',
      debit: 0,
      credit: Math.round(amount * rate * 100) / 100,
      currency_id: prepared.header.currency_id,
      amount_currency: -amount,
    })),
  ]
  const debit = items[0].debit
  const credit = items.slice(1).reduce((sum, item) => sum + item.credit, 0)
  if (items.length > 1 && Math.abs(debit - credit) > 0) {
    items[items.length - 1].credit = Math.round((items[items.length - 1].credit + debit - credit) * 100) / 100
  }
  return items
}

async function allocateInvoiceNumber(tx, journal) {
  for (;;) {
    const updated = await tx.journals.update({
      where: { id: journal.id },
      data: { next_sequence: { increment: 1 } },
      select: { next_sequence: true },
    })
    const number = `${journal.code}${String(updated.next_sequence - 1).padStart(4, '0')}`
    const exists = await tx.customer_invoices.findFirst({ where: { company_id: journal.company_id, invoice_number: number }, select: { id: true } })
    if (!exists) return number
  }
}

export const getAll = async (req, res) => {
  try {
    const data = await prisma.customer_invoices.findMany({ where: { document_type: 'invoice' }, include: invoiceInclude, orderBy: { created_at: 'desc' } })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch customer invoices') }
}

export const getById = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const data = await prisma.customer_invoices.findUnique({ where: { id: invoiceId }, include: invoiceInclude })
    if (!data) return res.status(404).json({ success: false, message: 'Customer invoice not found' })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch customer invoice') }
}

export const create = async (req, res) => {
  try {
    const prepared = await prepareInvoice(req.body)
    const data = await prisma.$transaction(async (tx) => {
      const journal = await tx.journals.findUnique({ where: { id: prepared.header.journal_id } })
      const invoiceNumber = await allocateInvoiceNumber(tx, journal)
      const invoice = await tx.customer_invoices.create({
        data: { ...prepared.header, invoice_number: invoiceNumber, customer_invoice_lines: { create: prepared.lines } },
      })
      const entry = await tx.journal_entries.create({
        data: {
          company_id: prepared.header.company_id,
          journal_id: prepared.header.journal_id,
          entry_number: invoiceNumber,
          entry_date: prepared.header.invoice_date,
          fiscal_period_id: prepared.header.fiscal_period_id,
          reference: invoiceNumber,
          narration: `Draft customer invoice ${invoiceNumber}`,
          state: 'draft',
          source_type: 'customer_invoice',
          source_id: invoice.id,
          journal_items: { create: journalItems(prepared) },
        },
      })
      return tx.customer_invoices.update({
        where: { id: invoice.id },
        data: { journal_entry_id: entry.id },
        include: invoiceInclude,
      })
    }, invoiceTransactionOptions)
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'CustomerInvoice', entityId: data.id, description: `Created draft invoice "${data.invoice_number}"` })
    res.status(201).json({ success: true, message: 'Draft invoice created successfully', data })
  } catch (error) { fail(res, error, 'Failed to create customer invoice') }
}

export const update = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const existing = await prisma.customer_invoices.findUnique({ where: { id: invoiceId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Customer invoice not found' })
    if (existing.state !== 'draft') throw inputError('Only draft invoices can be edited')
    const prepared = await prepareInvoice(req.body)
    const data = await prisma.$transaction(async (tx) => {
      await tx.customer_invoice_lines.deleteMany({ where: { invoice_id: invoiceId } })
      const invoice = await tx.customer_invoices.update({
        where: { id: invoiceId },
        data: { ...prepared.header, invoice_number: existing.invoice_number, customer_invoice_lines: { create: prepared.lines }, updated_at: new Date() },
      })
      let entryId = existing.journal_entry_id
      if (entryId) {
        const entry = await tx.journal_entries.findUnique({ where: { id: entryId } })
        if (!entry || entry.state !== 'draft' || entry.source_type !== 'customer_invoice') throw inputError('Linked draft journal entry is invalid')
        await tx.journal_items.deleteMany({ where: { entry_id: entryId } })
        await tx.journal_entries.update({
          where: { id: entryId },
          data: {
            company_id: prepared.header.company_id,
            journal_id: prepared.header.journal_id,
            entry_date: prepared.header.invoice_date,
            fiscal_period_id: prepared.header.fiscal_period_id,
            reference: existing.invoice_number,
            narration: `Draft customer invoice ${existing.invoice_number}`,
            journal_items: { create: journalItems(prepared) },
          },
        })
      } else {
        const entry = await tx.journal_entries.create({
          data: {
            company_id: prepared.header.company_id,
            journal_id: prepared.header.journal_id,
            entry_number: existing.invoice_number,
            entry_date: prepared.header.invoice_date,
            fiscal_period_id: prepared.header.fiscal_period_id,
            reference: existing.invoice_number,
            narration: `Draft customer invoice ${existing.invoice_number}`,
            state: 'draft',
            source_type: 'customer_invoice',
            source_id: invoiceId,
            journal_items: { create: journalItems(prepared) },
          },
        })
        entryId = entry.id
      }
      return tx.customer_invoices.update({ where: { id: invoiceId }, data: { journal_entry_id: entryId }, include: invoiceInclude })
    }, invoiceTransactionOptions)
    await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'CustomerInvoice', entityId: data.id, description: `Updated draft invoice "${data.invoice_number}"` })
    res.json({ success: true, message: 'Draft invoice updated successfully', data })
  } catch (error) { fail(res, error, 'Failed to update customer invoice') }
}

export const remove = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const existing = await prisma.customer_invoices.findUnique({ where: { id: invoiceId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Customer invoice not found' })
    if (existing.state !== 'draft') throw inputError('Only draft invoices can be deleted')
    await prisma.$transaction(async (tx) => {
      await tx.customer_invoices.delete({ where: { id: invoiceId } })
      if (existing.journal_entry_id) {
        await tx.journal_entries.deleteMany({ where: { id: existing.journal_entry_id, state: 'draft', source_type: 'customer_invoice' } })
      }
    }, invoiceTransactionOptions)
    await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'CustomerInvoice', entityId: invoiceId, description: `Deleted draft invoice "${existing.invoice_number}"` })
    res.json({ success: true, message: 'Draft invoice deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete customer invoice') }
}

export const post = async (req, res) => {
  const invoiceId = id(req.params.id)
  if (!invoiceId) return res.status(400).json({ success: false, message: 'Invalid invoice id' })
  try {
    const data = await prisma.$transaction(async (tx) => {
      const invoice = await tx.customer_invoices.findUnique({
        where: { id: invoiceId },
        include: {
          journal_entries: { include: { journal_items: true } },
          fiscal_periods: { include: { fiscal_years: true } },
        },
      })
      if (!invoice) throw inputError('Customer invoice not found')
      if (invoice.state !== 'draft') throw inputError('Only draft invoices can be posted')
      if (!invoice.journal_entries || invoice.journal_entries.state !== 'draft' || invoice.journal_entries.source_type !== 'customer_invoice') {
        throw inputError('Linked draft journal entry is missing or invalid')
      }
      if (!invoice.fiscal_periods || invoice.fiscal_periods.state !== 'open' || invoice.fiscal_periods.fiscal_years.state !== 'open') {
        throw inputError('Invoice fiscal period is closed or invalid')
      }
      const debit = invoice.journal_entries.journal_items.reduce((sum, line) => sum + Number(line.debit), 0)
      const credit = invoice.journal_entries.journal_items.reduce((sum, line) => sum + Number(line.credit), 0)
      if (debit <= 0 || Math.abs(debit - credit) > 0.005) throw inputError('Invoice journal entry is unbalanced')
      const postedAt = new Date()
      await tx.journal_entries.update({ where: { id: invoice.journal_entries.id }, data: { state: 'posted', posted_at: postedAt } })
      await tx.customer_invoices.update({ where: { id: invoiceId }, data: { state: 'posted', payment_state: 'not_paid', paid_amount: 0, amount_due: invoice.amount_total, posted_at: postedAt, updated_at: postedAt } })
      return tx.customer_invoices.findUnique({ where: { id: invoiceId }, include: invoiceInclude })
    }, invoiceTransactionOptions)
    await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'CustomerInvoice', entityId: invoiceId, description: `Posted invoice "${data.invoice_number}"` })
    res.json({ success: true, message: 'Customer invoice posted successfully', data })
  } catch (error) { fail(res, error, 'Failed to post customer invoice') }
}
