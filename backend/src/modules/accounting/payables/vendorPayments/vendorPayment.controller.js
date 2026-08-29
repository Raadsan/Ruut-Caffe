import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'

const include = {
  vendors: { select: { id: true, name: true, vendor_code: true } },
  currencies: { select: { id: true, code: true, symbol: true } },
  payment_methods: { select: { id: true, name: true, code: true, gl_account_id: true, allow_multiple_accounts: true, chart_of_accounts: { select: { id: true, code: true, name: true } } } },
  journals: { select: { id: true, name: true, code: true } },
  bank_accounts: { select: { id: true, account_name: true, account_number: true } },
  payment_allocations: { include: { vendor_bills: { select: { id: true, bill_number: true, bill_date: true, amount_total: true, amount_due: true } } } },
  vendor_advances: true,
}
const id = (value) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null }
const date = (value) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed }
const inputError = (message) => Object.assign(new Error(message), { status: 400 })
const fail = (res, error, fallback) => {
  console.error(fallback, error)
  return res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message || fallback })
}
function paymentChannel(method, account) {
  const code = String(account.code || '')
  const identity = `${method.code || ''} ${method.name || ''} ${account.name || ''}`.toLowerCase()
  if (code === '1001' || /\bcash\b/.test(identity)) return { journalCode: 'CASH', journalName: 'Cash', journalType: 'cash', label: 'Cash Payment' }
  if (code === '1002' || /\bbank\b|transfer/.test(identity)) return { journalCode: 'BANK', journalName: 'Bank', journalType: 'bank', label: 'Bank Payment' }
  const label = /edahab/.test(identity) ? 'eDahab Payment'
    : /merchant/.test(identity) ? 'Merchant Payment'
      : /\bibs\b/.test(identity) ? 'IBS Payment'
        : /evc/.test(identity) ? 'EVC Payment'
          : `${method.name || 'Mobile Wallet'} Payment`
  return { journalCode: 'WALLET', journalName: 'Mobile Wallet', journalType: 'bank', label }
}
async function resolvePaymentAccount({ vendor, method, bankAccountId, currencyId }) {
  let bank = null
  if (method.allow_multiple_accounts && !bankAccountId) {
    const activeBanks = await prisma.bank_accounts.findMany({
      where: { company_id: vendor.company_id, currency_id, is_active: true, gl_account_id: { not: null }, journal_id: { not: null } },
      orderBy: [{ institution_name: 'asc' }, { account_name: 'asc' }, { id: 'asc' }],
    })
    if (activeBanks.length !== 1) throw inputError('Select a bank account for this payment method')
    bank = activeBanks[0]
  }
  if (bankAccountId) {
    bank = await prisma.bank_accounts.findUnique({ where: { id: bankAccountId } })
    if (!bank?.is_active || bank.company_id !== vendor.company_id || !bank.journal_id || !bank.gl_account_id) throw inputError('Select an active vendor-company bank account with a journal and GL account')
  }
  const accountId = method.allow_multiple_accounts ? bank?.gl_account_id : method.gl_account_id || bank?.gl_account_id
  if (!accountId) throw inputError('Link this payment method to a GL account before using it')
  const account = await prisma.chart_of_accounts.findFirst({
    where: {
      id: accountId, company_id: vendor.company_id, is_active: true, allow_manual_entry: true,
      account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} },
      ...(currencyId ? { OR: [{ currency_id: null }, { currency_id: currencyId }] } : {}),
    },
  })
  if (!account) throw inputError('The selected payment method GL account is inactive, a parent, or incompatible')
  const channel = paymentChannel(method, account)
  let journal = bank?.journal_id ? await prisma.journals.findUnique({ where: { id: bank.journal_id } }) : null
  if (journal) journal = await prisma.journals.update({ where: { id: journal.id }, data: { name: channel.journalName, journal_type: channel.journalType, default_credit_account_id: account.id, is_active: true } })
  if (!journal) journal = await prisma.journals.upsert({
    where: { company_id_code: { company_id: vendor.company_id, code: channel.journalCode } },
    update: { name: channel.journalName, journal_type: channel.journalType, default_credit_account_id: account.id, is_active: true },
    create: {
      company_id: vendor.company_id, code: channel.journalCode, name: channel.journalName,
      journal_type: channel.journalType, default_credit_account_id: account.id,
      currency_id: currencyId, sequence_prefix: channel.journalCode, is_active: true,
    },
  })
  if (!journal?.is_active || journal.company_id !== vendor.company_id) throw inputError('Configure an active payment journal for this company')
  if (bank && journal.id !== bank.journal_id) throw inputError('The selected bank account journal is inactive or invalid')
  if (channel.journalCode === 'CASH' && journal.journal_type !== 'cash') throw inputError('The Cash journal is not configured as a cash journal')
  if (channel.journalCode !== 'CASH' && journal.journal_type !== 'bank') throw inputError(`The ${channel.journalName} journal is not configured as a bank-type journal`)
  return { bank, journal, account, channel }
}
async function prepare(input) {
  const vendorId = id(input.vendor_id)
  const paymentDate = date(input.payment_date)
  const paymentMethodId = id(input.payment_method_id)
  const bankAccountId = id(input.bank_account_id)
  const amount = Number(input.amount)
  if (!vendorId || !paymentDate || !paymentMethodId) throw inputError('Vendor, date, and payment method are required')
  if (!Number.isFinite(amount) || amount <= 0) throw inputError('Payment amount must be greater than zero')
  const [vendor, method] = await Promise.all([
    prisma.vendors.findUnique({ where: { id: vendorId }, include: { companies: true } }),
    prisma.payment_methods.findUnique({ where: { id: paymentMethodId } }),
  ])
  if (!vendor?.is_active) throw inputError('Active vendor not found')
  if (!vendor.companies?.is_active) throw inputError('Vendor company is inactive or missing')
  if (!method?.is_active || !['outbound', 'both'].includes(method.payment_type)) throw inputError('Select an active outbound payment method')
  const fiscalPeriod = await prisma.fiscal_periods.findFirst({ where: { state: 'open', fiscal_years: { company_id: vendor.company_id, state: 'open' }, start_date: { lte: paymentDate }, end_date: { gte: paymentDate } } })
  if (!fiscalPeriod) throw inputError('No open fiscal period covers the payment date')
  const currencyId = id(input.currency_id) || vendor.currency_id || vendor.companies.currency_id
  const { bank, journal, account, channel } = await resolvePaymentAccount({ vendor, method, bankAccountId, currencyId })
  if (bank && currencyId !== bank.currency_id) throw inputError('Payment currency must match the selected bank account')
  const exchangeRate = Number(input.exchange_rate || 1)
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw inputError('A positive exchange rate is required')
  const allocations = (Array.isArray(input.allocations) ? input.allocations : []).map((row) => ({ bill_id: id(row.bill_id), allocated_amount: Math.round(Number(row.allocated_amount) * 100) / 100 }))
  if (allocations.some((row) => !row.bill_id || !Number.isFinite(row.allocated_amount) || row.allocated_amount <= 0)) throw inputError('Every allocation needs a bill and a positive amount')
  if (new Set(allocations.map((row) => row.bill_id)).size !== allocations.length) throw inputError('A bill can only be allocated once')
  const bills = allocations.length ? await prisma.vendor_bills.findMany({ where: { id: { in: allocations.map((row) => row.bill_id) } } }) : []
  for (const allocation of allocations) {
    const bill = bills.find((row) => row.id === allocation.bill_id)
    if (!bill || bill.vendor_id !== vendorId || bill.document_type !== 'bill' || bill.state !== 'posted' || bill.currency_id !== currencyId) throw inputError('Allocation contains an invalid vendor bill')
    if (allocation.allocated_amount > Number(bill.amount_due) + 0.005) throw inputError(`Allocation exceeds the balance of ${bill.bill_number}`)
  }
  const allocated = Math.round(allocations.reduce((sum, row) => sum + row.allocated_amount, 0) * 100) / 100
  if (!allocations.length) throw inputError('Select at least one bill and enter an allocation greater than zero')
  if (allocated > amount + 0.005) throw inputError('Total allocation cannot exceed the payment amount')
  const [payableAccount, advanceAccount] = await Promise.all([
    prisma.chart_of_accounts.findFirst({ where: {
      company_id: vendor.company_id, code: '2000', is_active: true, allow_manual_entry: true,
      account_types: { internal_group: 'liability' }, other_chart_of_accounts: { none: {} },
    } }),
    allocated < amount - 0.005 ? prisma.chart_of_accounts.findFirst({ where: {
      company_id: vendor.company_id, code: '1400', is_active: true, allow_manual_entry: true,
      account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} },
    } }) : Promise.resolve(null),
  ])
  if (!payableAccount) throw inputError('Accounts Payable account 2000 was not found')
  if (allocated < amount - 0.005 && !advanceAccount) throw inputError('Vendor Advances account 1400 was not found')
  return {
    header: { company_id: vendor.company_id, vendor_id: vendorId, journal_id: journal.id, payment_method_id: paymentMethodId, bank_account_id: bank?.id || null, fiscal_period_id: fiscalPeriod.id, payment_date: paymentDate, currency_id: currencyId, exchange_rate: exchangeRate, amount, unallocated_amount: Math.round((amount - allocated) * 100) / 100, reference: String(input.reference || '').trim() || null, memo: String(input.memo || '').trim() || null, state: 'draft' },
    allocations,
    payableAccountId: payableAccount.id,
    advanceAccountId: advanceAccount?.id || null,
    allocatedAmount: allocated,
    paymentAccountId: account.id,
    paymentLabel: channel.label,
    vendorName: vendor.name,
  }
}

function paymentEntryData(prepared, paymentNumber, paymentId, state = 'draft', postedAt = null) {
  const baseAmount = Math.round(Number(prepared.header.amount) * Number(prepared.header.exchange_rate) * 100) / 100
  const allocatedBase = Math.round(Number(prepared.allocatedAmount) * Number(prepared.header.exchange_rate) * 100) / 100
  const unallocated = Number(prepared.header.unallocated_amount || 0)
  const debitLines = [{ sequence: 10, account_id: prepared.payableAccountId, label: 'Accounts Payable', partner_type: 'vendor', partner_id: prepared.header.vendor_id, debit: allocatedBase, credit: 0, currency_id: prepared.header.currency_id, amount_currency: Number(prepared.allocatedAmount) }]
  if (unallocated > 0.005) debitLines.push({ sequence: 20, account_id: prepared.advanceAccountId, label: 'Vendor Advance', partner_type: 'vendor', partner_id: prepared.header.vendor_id, debit: Math.round(unallocated * Number(prepared.header.exchange_rate) * 100) / 100, credit: 0, currency_id: prepared.header.currency_id, amount_currency: unallocated })
  return {
    company_id: prepared.header.company_id,
    journal_id: prepared.header.journal_id,
    entry_number: paymentNumber,
    entry_date: prepared.header.payment_date,
    fiscal_period_id: prepared.header.fiscal_period_id,
    reference: paymentNumber,
    narration: `Vendor payment ${paymentNumber} to ${prepared.vendorName}`,
    state,
    source_type: 'vendor_payment',
    source_id: paymentId,
    posted_at: postedAt,
    journal_items: { create: [...debitLines, { sequence: (debitLines.length + 1) * 10, account_id: prepared.paymentAccountId, label: prepared.paymentLabel, partner_type: 'vendor', partner_id: prepared.header.vendor_id, debit: 0, credit: baseAmount, currency_id: prepared.header.currency_id, amount_currency: -Number(prepared.header.amount) }] },
  }
}
async function number(tx, journalId, companyId) {
  const [journal, existing] = await Promise.all([
    tx.journals.findUnique({ where: { id: journalId }, select: { next_sequence: true } }),
    tx.vendor_payments.findMany({ where: { company_id: companyId, payment_number: { startsWith: 'PAY' } }, select: { payment_number: true } }),
  ])
  let sequence = Math.max(Number(journal.next_sequence), ...existing.map((row) => Number(String(row.payment_number).slice(3)) + 1).filter(Number.isFinite))
  for (;;) {
    const paymentNumber = `PAY${String(sequence).padStart(4, '0')}`
    const duplicate = await tx.vendor_payments.findFirst({ where: { company_id: companyId, payment_number: paymentNumber }, select: { id: true } })
    if (!duplicate) {
      await tx.journals.update({ where: { id: journalId }, data: { next_sequence: sequence + 1 } })
      return paymentNumber
    }
    sequence += 1
  }
}
export const getAll = async (_req, res) => {
  try { res.json({ success: true, data: await prisma.vendor_payments.findMany({ include, orderBy: { created_at: 'desc' } }) }) }
  catch (error) { fail(res, error, 'Failed to fetch vendor payments') }
}
export const getById = async (req, res) => {
  const paymentId = id(req.params.id)
  if (!paymentId) return res.status(400).json({ success: false, message: 'Invalid payment id' })
  try {
    const data = await prisma.vendor_payments.findUnique({ where: { id: paymentId }, include })
    if (!data) return res.status(404).json({ success: false, message: 'Vendor payment not found' })
    res.json({ success: true, data })
  } catch (error) { fail(res, error, 'Failed to fetch vendor payment') }
}
export const getAdvances = async (req, res) => {
  const vendorId = id(req.query.vendor_id)
  const currencyId = id(req.query.currency_id)
  if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' })
  try {
    const data = await prisma.vendor_advances.findMany({
      where: { vendor_id: vendorId, ...(currencyId ? { currency_id: currencyId } : {}), state: { in: ['open', 'partial'] }, remaining_amount: { gt: 0 } },
      include: { vendor_payments: { select: { payment_number: true, payment_date: true } }, applications: { include: { vendor_bills: { select: { bill_number: true } } } } },
      orderBy: { created_at: 'asc' },
    })
    const balance = data.reduce((sum, row) => sum + Number(row.remaining_amount), 0)
    res.json({ success: true, data, summary: { advance_balance: Math.round(balance * 100) / 100 } })
  } catch (error) { fail(res, error, 'Failed to fetch vendor advances') }
}
export const create = async (req, res) => {
  try {
    const prepared = await prepare(req.body)
    const data = await prisma.$transaction(async (tx) => {
      const paymentNumber = await number(tx, prepared.header.journal_id, prepared.header.company_id)
      const payment = await tx.vendor_payments.create({ data: { ...prepared.header, payment_number: paymentNumber, payment_allocations: { create: prepared.allocations } } })
      const entry = await tx.journal_entries.create({ data: paymentEntryData(prepared, paymentNumber, payment.id) })
      return tx.vendor_payments.update({ where: { id: payment.id }, data: { journal_entry_id: entry.id }, include })
    }, { maxWait: 10000, timeout: 30000 })
    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'VendorPayment', entityId: data.id, description: `Created draft vendor payment "${data.payment_number}"` })
    res.status(201).json({ success: true, message: 'Draft vendor payment created successfully', data })
  } catch (error) { fail(res, error, 'Failed to create vendor payment') }
}
export const update = async (req, res) => {
  const paymentId = id(req.params.id)
  if (!paymentId) return res.status(400).json({ success: false, message: 'Invalid payment id' })
  try {
    const existing = await prisma.vendor_payments.findUnique({ where: { id: paymentId } })
    if (!existing || existing.state !== 'draft') throw inputError('Draft vendor payment not found')
    const prepared = await prepare(req.body)
    const data = await prisma.$transaction(async (tx) => {
      await tx.payment_allocations.deleteMany({ where: { payment_id: paymentId } })
      await tx.vendor_payments.update({ where: { id: paymentId }, data: { ...prepared.header, payment_number: existing.payment_number, payment_allocations: { create: prepared.allocations }, updated_at: new Date() } })
      if (existing.journal_entry_id) {
        await tx.journal_items.deleteMany({ where: { entry_id: existing.journal_entry_id } })
        await tx.journal_entries.update({ where: { id: existing.journal_entry_id }, data: { ...paymentEntryData(prepared, existing.payment_number, paymentId), journal_items: { create: paymentEntryData(prepared, existing.payment_number, paymentId).journal_items.create } } })
      } else {
        const entry = await tx.journal_entries.create({ data: paymentEntryData(prepared, existing.payment_number, paymentId) })
        await tx.vendor_payments.update({ where: { id: paymentId }, data: { journal_entry_id: entry.id } })
      }
      return tx.vendor_payments.findUnique({ where: { id: paymentId }, include })
    }, { maxWait: 10000, timeout: 30000 })
    res.json({ success: true, message: 'Draft vendor payment updated successfully', data })
  } catch (error) { fail(res, error, 'Failed to update vendor payment') }
}
export const remove = async (req, res) => {
  const paymentId = id(req.params.id)
  if (!paymentId) return res.status(400).json({ success: false, message: 'Invalid payment id' })
  try {
    const existing = await prisma.vendor_payments.findUnique({ where: { id: paymentId } })
    if (!existing || existing.state !== 'draft') throw inputError('Draft vendor payment not found')
    await prisma.$transaction(async (tx) => {
      await tx.vendor_payments.delete({ where: { id: paymentId } })
      if (existing.journal_entry_id) await tx.journal_entries.deleteMany({ where: { id: existing.journal_entry_id, state: 'draft', source_type: 'vendor_payment' } })
    })
    res.json({ success: true, message: 'Draft vendor payment deleted successfully' })
  } catch (error) { fail(res, error, 'Failed to delete vendor payment') }
}
export const post = async (req, res) => {
  const paymentId = id(req.params.id)
  if (!paymentId) return res.status(400).json({ success: false, message: 'Invalid payment id' })
  try {
    const data = await prisma.$transaction(async (tx) => {
      const payment = await tx.vendor_payments.findUnique({ where: { id: paymentId }, include: { payment_allocations: true, payment_methods: true } })
      if (!payment || payment.state !== 'draft') throw inputError('Draft vendor payment not found')
      if (!payment.fiscal_period_id) throw inputError('Vendor payment is missing its fiscal period')
      const allocated = payment.payment_allocations.reduce((sum, allocation) => sum + Number(allocation.allocated_amount), 0)
      if (!payment.payment_allocations.length) throw inputError('Select at least one bill and enter an allocation greater than zero')
      if (allocated > Number(payment.amount) + 0.005) throw inputError('Total allocation cannot exceed the payment amount')
      const unallocated = Math.max(0, Math.round((Number(payment.amount) - allocated) * 100) / 100)
      const [vendor, bank, journal, payableAccount, advanceAccount] = await Promise.all([
        tx.vendors.findUnique({ where: { id: payment.vendor_id }, include: { companies: true } }),
        payment.bank_account_id ? tx.bank_accounts.findUnique({ where: { id: payment.bank_account_id } }) : Promise.resolve(null),
        tx.journals.findUnique({ where: { id: payment.journal_id } }),
        tx.chart_of_accounts.findFirst({
          where: {
            company_id: payment.company_id,
            is_active: true,
            code: '2000',
          },
          orderBy: { code: 'asc' },
        }),
        unallocated > 0.005 ? tx.chart_of_accounts.findFirst({ where: { company_id: payment.company_id, code: '1400', is_active: true, allow_manual_entry: true, account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} } } }) : Promise.resolve(null),
      ])
      if (!vendor?.is_active) throw inputError('Active vendor not found')
      if (payment.payment_methods?.allow_multiple_accounts && !bank) throw inputError('Vendor payment is missing the selected bank account')
      const paymentAccountId = payment.payment_methods?.allow_multiple_accounts ? bank?.gl_account_id : payment.payment_methods?.gl_account_id || bank?.gl_account_id
      if (!payment.payment_methods?.is_active || !['outbound', 'both'].includes(payment.payment_methods.payment_type)) throw inputError('Payment method is inactive or incompatible')
      if (!paymentAccountId) throw inputError('Link this payment method to a GL account before posting')
      const paymentAccount = await tx.chart_of_accounts.findFirst({
        where: {
          id: paymentAccountId, company_id: payment.company_id, is_active: true, allow_manual_entry: true,
          account_types: { internal_group: 'asset' }, other_chart_of_accounts: { none: {} },
        },
        include: { account_types: true, other_chart_of_accounts: { select: { id: true } } },
      })
      if (!paymentAccount) throw inputError('The selected payment method GL account is inactive, a parent, or incompatible')
      const channel = paymentChannel(payment.payment_methods, paymentAccount)
      if (bank && (!bank.is_active || bank.company_id !== payment.company_id || bank.gl_account_id !== paymentAccountId)) throw inputError('The selected bank account is inactive or inconsistent with the payment method')
      if (!journal?.is_active || journal.company_id !== payment.company_id || (bank && journal.id !== bank.journal_id)) throw inputError('The selected payment journal is inactive or invalid')
      if (!payableAccount) throw inputError('Accounts Payable account 2000 was not found')
      if (unallocated > 0.005 && !advanceAccount) throw inputError('Vendor Advances account 1400 was not found')
      const fiscalPeriod = await tx.fiscal_periods.findUnique({ where: { id: payment.fiscal_period_id } })
      if (!fiscalPeriod || fiscalPeriod.state !== 'open') throw inputError('Payment fiscal period is closed or invalid')
      const existingEntry = await tx.journal_entries.findFirst({ where: { source_type: 'vendor_payment', source_id: paymentId }, select: { id: true, state: true } })
      if (existingEntry && existingEntry.state !== 'draft') throw inputError('Linked vendor payment journal entry is invalid')
      for (const allocation of payment.payment_allocations) {
        const bill = await tx.vendor_bills.findUnique({ where: { id: allocation.bill_id } })
        if (!bill || bill.state !== 'posted' || bill.vendor_id !== payment.vendor_id) throw inputError('An allocated bill is no longer available')
        if (bill.currency_id !== payment.currency_id) throw inputError('An allocated bill has a different currency')
        if (Number(allocation.allocated_amount) > Number(bill.amount_due) + 0.005) throw inputError(`Allocation exceeds the balance of ${bill.bill_number}`)
        const applied = Number(allocation.allocated_amount)
        const changed = await tx.vendor_bills.updateMany({
          where: { id: bill.id, amount_due: { gte: applied } },
          data: { amount_paid: { increment: applied }, amount_due: { decrement: applied }, updated_at: new Date() },
        })
        if (changed.count !== 1) throw inputError(`The balance of ${bill.bill_number} changed; reload the outstanding bills and try again`)
        const updatedBill = await tx.vendor_bills.findUnique({ where: { id: bill.id }, select: { amount_total: true, amount_paid: true, amount_due: true } })
        const paid = Math.min(Number(updatedBill.amount_total), Number(updatedBill.amount_paid))
        const due = Math.max(0, Number(updatedBill.amount_due))
        await tx.vendor_bills.update({ where: { id: bill.id }, data: { amount_paid: due <= 0.005 ? Number(updatedBill.amount_total) : paid, amount_due: due <= 0.005 ? 0 : due, payment_state: due <= 0.005 ? 'paid' : 'partial' } })
      }
      const postedAt = new Date()
      const narration = `Vendor payment ${payment.payment_number} to ${vendor.name}`
      const journalItems = [
        { sequence: 10, account_id: payableAccount.id, label: 'Accounts Payable', partner_type: 'vendor', partner_id: payment.vendor_id, debit: Math.round(allocated * Number(payment.exchange_rate) * 100) / 100, credit: 0, currency_id: payment.currency_id, amount_currency: allocated },
        ...(unallocated > 0.005 ? [{ sequence: 20, account_id: advanceAccount.id, label: 'Vendor Advance', partner_type: 'vendor', partner_id: payment.vendor_id, debit: Math.round(unallocated * Number(payment.exchange_rate) * 100) / 100, credit: 0, currency_id: payment.currency_id, amount_currency: unallocated }] : []),
        { sequence: unallocated > 0.005 ? 30 : 20, account_id: paymentAccountId, label: channel.label, partner_type: 'vendor', partner_id: payment.vendor_id, debit: 0, credit: Math.round(Number(payment.amount) * Number(payment.exchange_rate) * 100) / 100, currency_id: payment.currency_id, amount_currency: -Number(payment.amount) },
      ]
      if (existingEntry) await tx.journal_items.deleteMany({ where: { entry_id: existingEntry.id } })
      const entry = existingEntry
        ? await tx.journal_entries.update({ where: { id: existingEntry.id }, data: { journal_id: journal.id, reference: payment.payment_number, narration, state: 'posted', posted_at: postedAt, journal_items: { create: journalItems } } })
        : await tx.journal_entries.create({ data: {
          company_id: payment.company_id, journal_id: payment.journal_id, entry_number: payment.payment_number,
          entry_date: payment.payment_date, fiscal_period_id: payment.fiscal_period_id,
          reference: payment.payment_number, narration,
          state: 'posted', source_type: 'vendor_payment', source_id: payment.id, posted_at: postedAt,
          journal_items: { create: journalItems },
        } })
      if (unallocated > 0.005) await tx.vendor_advances.upsert({ where: { payment_id: paymentId }, update: { original_amount: unallocated, remaining_amount: unallocated, advance_account_id: advanceAccount.id, state: 'open', updated_at: postedAt }, create: { company_id: payment.company_id, vendor_id: payment.vendor_id, currency_id: payment.currency_id, payment_id: paymentId, advance_account_id: advanceAccount.id, original_amount: unallocated, remaining_amount: unallocated, state: 'open' } })
      await tx.vendor_payments.update({ where: { id: paymentId }, data: { unallocated_amount: unallocated, state: 'posted', journal_entry_id: entry.id, posted_at: postedAt, updated_at: postedAt } })
      for (const billId of new Set(payment.payment_allocations.map((allocation) => allocation.bill_id))) {
        const [bill, aggregate] = await Promise.all([
          tx.vendor_bills.findUnique({ where: { id: billId }, select: { amount_total: true } }),
          tx.payment_allocations.aggregate({
            where: { bill_id: billId, vendor_payments: { state: 'posted' } },
            _sum: { allocated_amount: true },
          }),
        ])
        if (!bill) continue
        const paid = Math.min(Number(bill.amount_total), Math.round(Number(aggregate._sum.allocated_amount || 0) * 100) / 100)
        const due = Math.max(0, Math.round((Number(bill.amount_total) - paid) * 100) / 100)
        await tx.vendor_bills.update({ where: { id: billId }, data: { amount_paid: paid, amount_due: due, payment_state: due <= 0.005 ? 'paid' : paid > 0.005 ? 'partial' : 'not_paid', updated_at: postedAt } })
      }
      return tx.vendor_payments.findUnique({ where: { id: paymentId }, include })
    }, { maxWait: 10000, timeout: 30000 })
    await logAudit({ userId: req.user?.id, action: 'Posted', entity: 'VendorPayment', entityId: paymentId, description: `Posted vendor payment "${data.payment_number}"` })
    res.json({ success: true, message: 'Vendor payment posted successfully', data })
  } catch (error) { fail(res, error, 'Failed to post vendor payment') }
}
