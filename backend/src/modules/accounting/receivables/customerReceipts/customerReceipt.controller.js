import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'

const transactionOptions = { maxWait: 10000, timeout: 30000 }
const include = {
  customers: { select: { id: true, name: true, phone: true } },
  companies: { select: { id: true, name: true } },
  currencies: { select: { id: true, code: true, symbol: true } },
  journals: { select: { id: true, name: true, code: true } },
  payment_methods: { select: { id: true, name: true, code: true, gl_account_id: true, chart_of_accounts: { select: { id: true, code: true, name: true } } } },
  fiscal_periods: { select: { id: true, name: true, state: true } },
  journal_entries: {
    select: {
      id: true, entry_number: true, state: true,
      journal_items: {
        where: { sequence: 10 },
        take: 1,
        select: { account_id: true, chart_of_accounts: { select: { id: true, code: true, name: true } } },
      },
    },
  },
  receipt_allocations: {
    include: { customer_invoices: { select: { id: true, invoice_number: true, invoice_date: true, amount_total: true, amount_due: true, payment_state: true } } },
  },
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

const paymentChannel = (method) => {
  const value = `${method?.code || ''} ${method?.name || ''}`.toLowerCase()
  if (value.includes('cash')) return 'cash'
  if (value.includes('mobile') || value.includes('wallet')) return 'mobile_money'
  if (value.includes('cheque') || value.includes('check')) return 'cheque'
  if (value.includes('card')) return 'card'
  if (value.includes('bank') || value.includes('transfer')) return 'bank_transfer'
  return 'other'
}

async function compatibleSetups({ companyId, currencyId, method }) {
  const channel = paymentChannel(method)
  if (method?.gl_account_id) {
    const account = await prisma.chart_of_accounts.findFirst({
      where: {
        id: method.gl_account_id, company_id: companyId, is_active: true, allow_manual_entry: true,
        account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} },
        OR: [{ currency_id: null }, { currency_id: currencyId }],
      },
      select: { id: true, code: true, name: true, currency_id: true },
    })
    if (!account) return []
    const journalType = channel === 'cash' ? 'cash' : 'bank'
    const journal = await prisma.journals.findFirst({
      where: {
        company_id: companyId, journal_type: journalType, is_active: true,
        OR: [{ default_debit_account_id: account.id }, { default_debit_account_id: null }],
      },
      orderBy: [{ default_debit_account_id: 'desc' }, { code: 'asc' }, { id: 'asc' }],
    }) || await prisma.journals.findFirst({
      where: { company_id: companyId, journal_type: journalType, is_active: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    })
    if (!journal) return []
    return [{ channel, journal, account, fixed: true }]
  }
  if (channel === 'cash') {
    const journals = await prisma.journals.findMany({
      where: { company_id: companyId, journal_type: 'cash', is_active: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    })
    const journalAccountIds = journals.map((row) => row.default_debit_account_id).filter(Boolean)
    const accounts = await prisma.chart_of_accounts.findMany({
      where: {
        company_id: companyId, is_active: true, allow_manual_entry: true,
        account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} },
        OR: [
          { id: { in: journalAccountIds.length ? journalAccountIds : [0] } },
          { name: { contains: 'cash' } },
          { code: { startsWith: '111' } },
        ],
      },
      select: { id: true, code: true, name: true, currency_id: true },
      orderBy: { code: 'asc' },
    })
    return journals.flatMap((journal) => {
      const compatible = accounts.filter((account) => !account.currency_id || account.currency_id === currencyId)
      return compatible.map((account) => ({ channel, journal, account, fixed: compatible.length === 1 }))
    })
  }

  const bankAccounts = await prisma.bank_accounts.findMany({
    where: {
      company_id: companyId, currency_id: currencyId, is_active: true,
      gl_account_id: { not: null }, journal_id: { not: null },
      journals: { is_active: true, journal_type: 'bank' },
      chart_of_accounts: {
        is_active: true, allow_manual_entry: true,
        account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} },
      },
    },
    include: {
      journals: true,
      chart_of_accounts: { select: { id: true, code: true, name: true, currency_id: true } },
    },
    orderBy: { account_name: 'asc' },
  })
  return bankAccounts.map((bank) => ({
    channel, journal: bank.journals, account: bank.chart_of_accounts,
    bank_account_id: bank.id, account_name: bank.account_name, fixed: bankAccounts.length === 1,
  }))
}

async function prepare(input) {
  const customerId = asId(input.customer_id)
  const paymentMethodId = asId(input.payment_method_id)
  const receiptDate = asDate(input.receipt_date)
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!customerId || !paymentMethodId || !receiptDate) throw inputError('Customer, payment method, and receipt date are required')
  if (!Number.isFinite(amount) || amount <= 0) throw inputError('Receipt amount must be greater than zero')

  const [customer, method] = await Promise.all([
    prisma.customers.findUnique({ where: { id: customerId }, include: { companies: true } }),
    prisma.payment_methods.findUnique({ where: { id: paymentMethodId } }),
  ])
  if (!customer || !customer.is_active) throw inputError('Customer is inactive or missing')
  if (!customer.companies?.is_active) throw inputError('Customer company is inactive or missing')
  if (!method?.is_active || !['inbound', 'both'].includes(method.payment_type)) throw inputError('Select an active inbound payment method')
  if (!method.gl_account_id) throw inputError('The selected payment method must have a linked Cash, Bank, or Mobile Wallet GL account')
  const fiscalPeriod = await prisma.fiscal_periods.findFirst({
    where: {
      state: 'open', start_date: { lte: receiptDate }, end_date: { gte: receiptDate },
      fiscal_years: { company_id: customer.company_id, state: 'open' },
    },
  })
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the receipt date')

  const currencyId = asId(input.currency_id) || customer.companies.currency_id
  const currency = await prisma.currencies.findUnique({ where: { id: currencyId } })
  if (!currency?.is_active) throw inputError('Receipt currency is inactive or missing')
  const exchangeRate = currencyId === customer.companies.currency_id ? 1 : Number(input.exchange_rate)
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw inputError('A positive exchange rate is required')
  const setups = await compatibleSetups({ companyId: customer.company_id, currencyId, method })
  if (!setups.length) throw inputError(`No compatible ${paymentChannel(method) === 'cash' ? 'cash' : 'bank'} journal and account are configured for this payment method`)
  const setup = setups[0]
  if (!setup) throw inputError('The selected payment method has no compatible active GL account and journal')
  const journal = setup.journal

  const receivable = await prisma.chart_of_accounts.findFirst({
    where: {
      company_id: customer.company_id, code: '1100', is_active: true, allow_manual_entry: true,
      account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} },
    },
  })
  if (!receivable) throw inputError('Accounts Receivable account 1100 was not found')

  const requested = Array.isArray(input.allocations) ? input.allocations : []
  const normalized = requested
    .map((row) => ({ invoice_id: asId(row.invoice_id), allocated_amount: Math.round(Number(row.allocated_amount) * 100) / 100 }))
    .filter((row) => row.invoice_id && row.allocated_amount > 0)
  if (new Set(normalized.map((row) => row.invoice_id)).size !== normalized.length) throw inputError('An invoice can only be allocated once per receipt')
  const invoices = normalized.length ? await prisma.customer_invoices.findMany({ where: { id: { in: normalized.map((row) => row.invoice_id) } } }) : []
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  for (const allocation of normalized) {
    const invoice = invoiceMap.get(allocation.invoice_id)
    if (!invoice || invoice.customer_id !== customerId || invoice.company_id !== customer.company_id) throw inputError('Allocated invoice does not belong to the selected customer')
    if (invoice.state !== 'posted' || !['not_paid', 'partial'].includes(invoice.payment_state)) throw inputError(`Invoice ${invoice.invoice_number} is not open for payment`)
    if (invoice.currency_id !== currencyId) throw inputError(`Invoice ${invoice.invoice_number} uses a different currency`)
    if (allocation.allocated_amount > Number(invoice.amount_due) + 0.005) throw inputError('The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.')
  }
  const allocated = Math.round(normalized.reduce((sum, row) => sum + row.allocated_amount, 0) * 100) / 100
  if (allocated > amount + 0.005) throw inputError('The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.')

  return {
    header: {
      company_id: customer.company_id, customer_id: customerId, journal_id: journal.id,
      payment_method_id: paymentMethodId, fiscal_period_id: fiscalPeriod.id, receipt_date: receiptDate,
      currency_id: currencyId, exchange_rate: exchangeRate, amount,
      unallocated_amount: Math.round((amount - allocated) * 100) / 100,
      reference: String(input.reference || '').trim() || null,
      memo: String(input.memo || '').trim() || null, state: 'draft',
    },
    allocations: normalized,
    journal,
    paymentAccountId: setup.account.id,
    receivableAccountId: receivable.id,
  }
}

async function allocateNumber(tx, journal) {
  for (;;) {
    const updated = await tx.journals.update({ where: { id: journal.id }, data: { next_sequence: { increment: 1 } }, select: { next_sequence: true } })
    const prefix = journal.sequence_prefix || 'RCPT'
    const number = `${prefix}${String(updated.next_sequence - 1).padStart(4, '0')}`
    const exists = await tx.customer_receipts.findFirst({ where: { company_id: journal.company_id, receipt_number: number }, select: { id: true } })
    if (!exists) return number
  }
}

function entryData(prepared, receiptNumber, receiptId) {
  // Only the amount applied to selected invoices affects Accounts Receivable.
  // Any remaining receipt amount stays unallocated and is not silently applied.
  const baseAmount = Math.round(prepared.allocations.reduce((sum, row) => sum + Number(row.allocated_amount), 0) * prepared.header.exchange_rate * 100) / 100
  const allocatedAmount = Math.round(prepared.allocations.reduce((sum, row) => sum + Number(row.allocated_amount), 0) * 100) / 100
  return {
    company_id: prepared.header.company_id, journal_id: prepared.header.journal_id,
    entry_number: receiptNumber, entry_date: prepared.header.receipt_date,
    fiscal_period_id: prepared.header.fiscal_period_id, reference: prepared.header.reference || receiptNumber,
    narration: `Draft customer receipt ${receiptNumber}`, state: 'draft',
    source_type: 'customer_receipt', source_id: receiptId,
    journal_items: { create: [
      { sequence: 10, account_id: prepared.paymentAccountId, label: 'Customer receipt', debit: baseAmount, credit: 0, currency_id: prepared.header.currency_id, amount_currency: allocatedAmount },
      { sequence: 20, account_id: prepared.receivableAccountId, label: 'Accounts Receivable', partner_type: 'customer', partner_id: prepared.header.customer_id, debit: 0, credit: baseAmount, currency_id: prepared.header.currency_id, amount_currency: -allocatedAmount },
    ] },
  }
}

export const getAll = async (req, res) => {
  try {
    const data = await prisma.customer_receipts.findMany({ include, orderBy: { created_at: 'desc' } })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch customer receipts') }
}

export const getOptions = async (req, res) => {
  const customerId = asId(req.query.customer_id)
  const methodId = asId(req.query.payment_method_id)
  const requestedCurrencyId = asId(req.query.currency_id)
  if (!customerId || !methodId) return res.status(400).json({ success: false, message: 'Customer and payment method are required' })
  try {
    const [customer, method] = await Promise.all([
      prisma.customers.findUnique({ where: { id: customerId }, include: { companies: true } }),
      prisma.payment_methods.findUnique({ where: { id: methodId } }),
    ])
    if (!customer?.is_active || !customer.companies?.is_active) throw inputError('Customer or company is inactive')
    if (!method?.is_active || !['inbound', 'both'].includes(method.payment_type)) throw inputError('Payment method is inactive or incompatible')
    const currencyId = requestedCurrencyId || customer.companies.currency_id
    const setups = await compatibleSetups({ companyId: customer.company_id, currencyId, method })
    const uniqueAccounts = [...new Map(setups.map((row) => [row.account.id, {
      id: row.account.id, code: row.account.code, name: row.account.name,
      bank_account_id: row.bank_account_id || null, account_name: row.account_name || row.account.name,
      journal_id: row.journal.id, journal_name: row.journal.name, journal_code: row.journal.code,
    }])).values()]
    res.json({
      success: true,
      data: {
        channel: paymentChannel(method), company_currency_id: customer.companies.currency_id,
        currency_id: currencyId, accounts: uniqueAccounts,
        selected_account_id: uniqueAccounts.length === 1 ? uniqueAccounts[0].id : null,
      },
    })
  } catch (error) { fail(res, error, 'Failed to resolve receipt payment options') }
}

export const getOutstandingInvoices = async (req, res) => {
  const customerId = asId(req.query.customer_id)
  if (!customerId) return res.status(400).json({ success: false, message: 'Customer is required' })
  try {
    const data = await prisma.customer_invoices.findMany({
      where: { customer_id: customerId, document_type: 'invoice', state: 'posted', payment_state: { in: ['not_paid', 'partial'] }, amount_due: { gt: 0 } },
      select: {
        id: true, customer_id: true, currency_id: true, invoice_number: true, invoice_date: true,
        due_date: true, amount_total: true, paid_amount: true, amount_due: true, state: true,
        payment_state: true, currencies: { select: { code: true, symbol: true } },
      },
      orderBy: [{ invoice_date: 'asc' }, { id: 'asc' }],
    })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch outstanding invoices') }
}

export const getById = async (req, res) => {
  const receiptId = asId(req.params.id)
  if (!receiptId) return res.status(400).json({ success: false, message: 'Invalid receipt id' })
  try {
    const data = await prisma.customer_receipts.findUnique({ where: { id: receiptId }, include })
    if (!data) return res.status(404).json({ success: false, message: 'Customer receipt not found' })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch customer receipt') }
}

export const create = async (req, res) => {
  try {
    const prepared = await prepare(req.body)
    const receiptId = await prisma.$transaction(async (tx) => {
      const receiptNumber = await allocateNumber(tx, prepared.journal)
      const receipt = await tx.customer_receipts.create({
        data: { ...prepared.header, receipt_number: receiptNumber, receipt_allocations: { create: prepared.allocations } },
      })
      const entry = await tx.journal_entries.create({ data: entryData(prepared, receiptNumber, receipt.id) })
      await tx.customer_receipts.update({ where: { id: receipt.id }, data: { journal_entry_id: entry.id } })
      return receipt.id
    }, transactionOptions)
    const data = await prisma.customer_receipts.findUnique({ where: { id: receiptId }, include })
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'CustomerReceipt', entityId: receiptId, description: `Created draft receipt "${data.receipt_number}"` })
    res.status(201).json({ success: true, message: 'Draft receipt created successfully', data })
  } catch (error) { fail(res, error, 'Failed to create customer receipt') }
}

export const update = async (req, res) => {
  const receiptId = asId(req.params.id)
  if (!receiptId) return res.status(400).json({ success: false, message: 'Invalid receipt id' })
  try {
    const existing = await prisma.customer_receipts.findUnique({ where: { id: receiptId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Customer receipt not found' })
    if (existing.state !== 'draft') throw inputError('Only draft receipts can be edited')
    const prepared = await prepare(req.body)
    await prisma.$transaction(async (tx) => {
      await tx.receipt_allocations.deleteMany({ where: { receipt_id: receiptId } })
      await tx.customer_receipts.update({ where: { id: receiptId }, data: { ...prepared.header, receipt_number: existing.receipt_number, receipt_allocations: { create: prepared.allocations }, updated_at: new Date() } })
      if (!existing.journal_entry_id) throw inputError('Linked draft journal entry is missing')
      const entry = await tx.journal_entries.findUnique({ where: { id: existing.journal_entry_id } })
      if (!entry || entry.state !== 'draft' || entry.source_type !== 'customer_receipt') throw inputError('Linked draft journal entry is invalid')
      await tx.journal_items.deleteMany({ where: { entry_id: entry.id } })
      await tx.journal_entries.update({ where: { id: entry.id }, data: { ...entryData(prepared, existing.receipt_number, receiptId), journal_items: entryData(prepared, existing.receipt_number, receiptId).journal_items } })
    }, transactionOptions)
    const data = await prisma.customer_receipts.findUnique({ where: { id: receiptId }, include })
    await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'CustomerReceipt', entityId: receiptId, description: `Updated draft receipt "${data.receipt_number}"` })
    res.json({ success: true, message: 'Draft receipt updated successfully', data })
  } catch (error) { fail(res, error, 'Failed to update customer receipt') }
}

export const remove = async (req, res) => {
  const receiptId = asId(req.params.id)
  if (!receiptId) return res.status(400).json({ success: false, message: 'Invalid receipt id' })
  try {
    const existing = await prisma.customer_receipts.findUnique({ where: { id: receiptId } })
    if (!existing) return res.status(404).json({ success: false, message: 'Customer receipt not found' })
    if (existing.state !== 'draft') throw inputError('Only draft receipts can be deleted')
    await prisma.$transaction(async (tx) => {
      await tx.customer_receipts.delete({ where: { id: receiptId } })
      if (existing.journal_entry_id) await tx.journal_entries.deleteMany({ where: { id: existing.journal_entry_id, state: 'draft', source_type: 'customer_receipt' } })
    }, transactionOptions)
    res.json({ success: true, message: 'Draft receipt deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete customer receipt') }
}

export const post = async (req, res) => {
  const receiptId = asId(req.params.id)
  if (!receiptId) return res.status(400).json({ success: false, message: 'Invalid receipt id' })
  try {
    await prisma.$transaction(async (tx) => {
      const receipt = await tx.customer_receipts.findUnique({
        where: { id: receiptId },
        include: {
          receipt_allocations: true,
          journal_entries: { include: { journal_items: { include: { chart_of_accounts: { include: { account_types: true, other_chart_of_accounts: { select: { id: true } } } } } } } },
          fiscal_periods: { include: { fiscal_years: true } },
          customers: { include: { companies: true } },
          payment_methods: true,
          journals: true,
        },
      })
      if (!receipt) throw inputError('Customer receipt not found')
      if (receipt.state !== 'draft') throw inputError('Only draft receipts can be posted')
      if (!receipt.journal_entries || receipt.journal_entries.state !== 'draft') throw inputError('Linked draft journal entry is missing or invalid')
      if (!receipt.fiscal_periods || receipt.fiscal_periods.state !== 'open' || receipt.fiscal_periods.fiscal_years.state !== 'open') throw inputError('Receipt fiscal period is closed or invalid')
      if (!receipt.customers?.is_active || !receipt.customers.companies?.is_active) throw inputError('Customer or company is inactive')
      if (!receipt.payment_methods?.is_active || !['inbound', 'both'].includes(receipt.payment_methods.payment_type)) throw inputError('Payment method is inactive or incompatible')
      if (!receipt.journals?.is_active || !['cash', 'bank'].includes(receipt.journals.journal_type)) throw inputError('Receipt journal is inactive or incompatible')
      if (Number(receipt.amount) <= 0) throw inputError('Receipt amount must be greater than zero')
      const allocatedTotal = Math.round(receipt.receipt_allocations.reduce((sum, row) => sum + Number(row.allocated_amount), 0) * 100) / 100
      if (allocatedTotal > Number(receipt.amount) + 0.005) throw inputError('The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.')
      if (!receipt.receipt_allocations.length || allocatedTotal <= 0.005) throw inputError('Select at least one invoice and enter an allocation greater than zero.')
      const debit = receipt.journal_entries.journal_items.reduce((sum, row) => sum + Number(row.debit), 0)
      const credit = receipt.journal_entries.journal_items.reduce((sum, row) => sum + Number(row.credit), 0)
      if (debit <= 0 || Math.abs(debit - credit) > 0.005) throw inputError('Receipt journal entry is unbalanced')
      const debitLine = receipt.journal_entries.journal_items.find((row) => Number(row.debit) > 0)
      const debitAccount = debitLine?.chart_of_accounts
      if (!debitAccount?.is_active || !debitAccount.allow_manual_entry || debitAccount.account_types.internal_group !== 'asset' || debitAccount.other_chart_of_accounts.length) {
        throw inputError('Cash/Bank account is inactive, a parent, or incompatible')
      }
      if (!receipt.payment_methods.gl_account_id || receipt.payment_methods.gl_account_id !== debitAccount.id) {
        throw inputError('Receipt journal entry does not use the GL account linked to the payment method')
      }
      const postedAt = new Date()
      const claimed = await tx.customer_receipts.updateMany({
        where: { id: receiptId, state: 'draft' },
        data: { state: 'posted', posted_at: postedAt, updated_at: postedAt },
      })
      if (claimed.count !== 1) throw inputError('Receipt was already posted or changed by another request')
      for (const allocation of receipt.receipt_allocations) {
        const invoice = await tx.customer_invoices.findUnique({ where: { id: allocation.invoice_id } })
        const allocated = Number(allocation.allocated_amount)
        if (!invoice || invoice.customer_id !== receipt.customer_id || invoice.company_id !== receipt.company_id || invoice.currency_id !== receipt.currency_id || invoice.state !== 'posted' || !['not_paid', 'partial'].includes(invoice.payment_state) || allocated <= 0) throw inputError('An invoice allocation is no longer valid')
        if (allocated > Number(invoice.amount_due) + 0.005) throw inputError('The allocated amount cannot exceed the invoice outstanding balance or the receipt amount.')
        const reserved = await tx.customer_invoices.updateMany({
          where: { id: invoice.id, state: 'posted', payment_state: { in: ['not_paid', 'partial'] }, amount_due: { gte: allocated } },
          data: { amount_due: { decrement: allocated }, updated_at: postedAt },
        })
        if (reserved.count !== 1) throw inputError(`Invoice ${invoice.invoice_number} was paid or changed by another receipt`)
        const paid = await tx.receipt_allocations.aggregate({
          where: { invoice_id: invoice.id, customer_receipts: { state: 'posted' } },
          _sum: { allocated_amount: true },
        })
        const due = Math.max(0, Math.round((Number(invoice.amount_total) - Number(paid._sum.allocated_amount || 0)) * 100) / 100)
        const paidAmount = Math.max(0, Math.round((Number(invoice.amount_total) - due) * 100) / 100)
        await tx.customer_invoices.update({ where: { id: invoice.id }, data: { paid_amount: paidAmount, amount_due: due, payment_state: due <= 0.005 ? 'paid' : due < Number(invoice.amount_total) ? 'partial' : 'not_paid', updated_at: postedAt } })
      }
      await tx.journal_entries.update({ where: { id: receipt.journal_entries.id }, data: { state: 'posted', posted_at: postedAt, narration: `Customer receipt ${receipt.receipt_number}` } })
    }, transactionOptions)
    const data = await prisma.customer_receipts.findUnique({ where: { id: receiptId }, include })
    await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'CustomerReceipt', entityId: receiptId, description: `Posted receipt "${data.receipt_number}"` })
    res.json({ success: true, message: 'Customer receipt posted successfully', data })
  } catch (error) { fail(res, error, 'Failed to post customer receipt') }
}
