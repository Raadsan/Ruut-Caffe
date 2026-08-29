import prisma from '../../../config/db.js'

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100
const normalize = (value) => String(value || '').trim().toLowerCase()

export class POSAccountingError extends Error {
  constructor(message, code = 'POS_ACCOUNTING_FAILED') {
    super(message)
    this.name = 'POSAccountingError'
    this.code = code
  }
}

export function classifyPOSPayment(payment) {
  const method = normalize(payment?.method)
  const provider = normalize(payment?.providerName)
  if (['credit', 'credit_sale', 'on_account', 'accounts_receivable'].includes(method)) return 'credit'
  if (method === 'cash') return 'cash'
  if (['card', 'bank', 'bank_transfer', 'transfer', 'online', 'evc_plus', 'edahab', 'premier_wallet', 'waafi', 'zaad', 'sahal'].includes(method) || provider) return 'bank'
  return 'bank'
}

/**
 * Net-revenue discount method:
 *   Dr settlement = final total
 *   Cr revenue    = subtotal - discount
 *   Cr tax        = tax
 */
export function buildPOSJournalPlan({
  order,
  settlementAccountId,
  revenueAccountId,
  taxAccountId,
  currencyId,
  partnerId = null,
}) {
  const grossSales = roundMoney(order.subTotal)
  const discount = roundMoney(order.discountAmount)
  const tax = roundMoney(order.taxAmount)
  const finalTotal = roundMoney(order.total)
  const netSales = roundMoney(grossSales - discount)

  if (grossSales < 0 || discount < 0 || tax < 0 || finalTotal < 0 || netSales < 0) {
    throw new POSAccountingError('POS order contains invalid negative accounting totals')
  }
  if (Math.abs(roundMoney(netSales + tax) - finalTotal) > 0.01) {
    throw new POSAccountingError(
      `POS order totals do not reconcile: net sales ${netSales.toFixed(2)} + tax ${tax.toFixed(2)} != total ${finalTotal.toFixed(2)}`
    )
  }
  if (!settlementAccountId || !revenueAccountId || !currencyId) {
    throw new POSAccountingError('POS settlement, revenue, and currency configuration is required')
  }
  if (tax > 0 && !taxAccountId) {
    throw new POSAccountingError('A Sales Tax Payable account is required for taxed POS orders')
  }

  const reference = order.orderNumber || `POS-${String(order.id).padStart(8, '0')}`
  const common = { currency_id: currencyId, amount_currency: null }
  const items = [
    {
      sequence: 10,
      account_id: settlementAccountId,
      label: `POS settlement for ${reference}`,
      partner_type: partnerId ? 'customer' : null,
      partner_id: partnerId,
      debit: finalTotal,
      credit: 0,
      ...common,
    },
    {
      sequence: 20,
      account_id: revenueAccountId,
      label: `POS net sales for ${reference}`,
      partner_type: null,
      partner_id: null,
      debit: 0,
      credit: netSales,
      ...common,
    },
  ]
  if (tax > 0) {
    items.push({
      sequence: 30,
      account_id: taxAccountId,
      label: `POS sales tax for ${reference}`,
      partner_type: null,
      partner_id: null,
      debit: 0,
      credit: tax,
      ...common,
    })
  }
  const debit = roundMoney(items.reduce((sum, item) => sum + item.debit, 0))
  const credit = roundMoney(items.reduce((sum, item) => sum + item.credit, 0))
  if (debit <= 0 || Math.abs(debit - credit) > 0.005) {
    throw new POSAccountingError(`POS journal entry is unbalanced: debit ${debit.toFixed(2)}, credit ${credit.toFixed(2)}`)
  }
  return { reference, grossSales, discount, netSales, tax, finalTotal, debit, credit, items }
}

async function resolveCompany(tx, order) {
  const companyId = order.companyId || order.customer?.company_id
  if (companyId) {
    const company = await tx.companies.findUnique({ where: { id: companyId } })
    if (!company?.is_active) throw new POSAccountingError('The POS order company is inactive or missing')
    return company
  }
  const active = await tx.companies.findMany({ where: { is_active: true }, take: 2, orderBy: { id: 'asc' } })
  if (active.length !== 1) {
    throw new POSAccountingError('POS order has no company. Assign companyId or keep exactly one active Accounting company')
  }
  return active[0]
}

async function resolveRouting(tx, order, company) {
  const paymentKind = classifyPOSPayment(order.payment)
  const paymentMethodNeedles = [order.payment?.method, order.payment?.providerName].map(normalize).filter(Boolean)
  const accountingMethods = paymentMethodNeedles.length ? await tx.payment_methods.findMany({
    where: { is_active: true, gl_account_id: { not: null } },
    include: { chart_of_accounts: true },
    orderBy: { id: 'asc' },
  }) : []
  const matchedPaymentMethod = accountingMethods.find((row) => {
    const haystack = normalize(`${row.code} ${row.name}`)
    return paymentMethodNeedles.some((needle) => haystack.includes(needle) || needle.includes(normalize(row.code)) || needle.includes(normalize(row.name)))
  })
  const journals = await tx.journals.findMany({
    where: { company_id: company.id, is_active: true },
    orderBy: [{ code: 'asc' }, { id: 'asc' }],
  })
  const salesJournal = journals.find((row) => row.journal_type === 'sale' && ['POS', 'SALE', 'INV'].includes(row.code.toUpperCase()))
    || journals.find((row) => row.journal_type === 'sale')
  if (!salesJournal?.default_credit_account_id) {
    throw new POSAccountingError('Configure an active Sales journal with a default credit Sales Revenue account')
  }

  let journal
  let settlementAccountId
  if (paymentKind === 'credit') {
    journal = salesJournal
    settlementAccountId = salesJournal.default_debit_account_id
    if (!settlementAccountId) throw new POSAccountingError('Configure the Sales journal default debit Accounts Receivable account')
  } else if (matchedPaymentMethod?.gl_account_id && !matchedPaymentMethod.allow_multiple_accounts) {
    const journalType = paymentKind === 'cash' ? 'cash' : 'bank'
    settlementAccountId = matchedPaymentMethod.gl_account_id
    const settlementAccount = matchedPaymentMethod.chart_of_accounts
    const isMobileWallet = /^100[3-9]/.test(String(settlementAccount?.code || '')) || /mobile\s*wallet|evc|edahab|merchant|\bibs\b|waafi/.test(normalize(`${matchedPaymentMethod.code} ${matchedPaymentMethod.name} ${settlementAccount?.name}`))
    if (isMobileWallet) {
      const walletCode = String(matchedPaymentMethod.code || `W${settlementAccount?.code || 'ALLET'}`).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      journal = await tx.journals.upsert({
        where: { company_id_code: { company_id: company.id, code: walletCode } },
        update: { name: settlementAccount.name, journal_type: 'bank', default_debit_account_id: settlementAccountId, default_credit_account_id: settlementAccountId, is_active: true },
        create: { company_id: company.id, code: walletCode, name: settlementAccount.name, journal_type: 'bank', default_debit_account_id: settlementAccountId, default_credit_account_id: settlementAccountId, currency_id: company.currency_id, sequence_prefix: walletCode, is_active: true },
      })
    } else {
      journal = journals.find((row) => row.journal_type === journalType && row.default_debit_account_id === matchedPaymentMethod.gl_account_id)
        || journals.find((row) => row.journal_type === journalType)
    }
    if (!journal) throw new POSAccountingError(`Configure an active ${journalType === 'cash' ? 'Cash' : 'Bank'} journal for payment method ${matchedPaymentMethod.name}`)
  } else if (paymentKind === 'cash') {
    journal = journals.find((row) => row.journal_type === 'cash' && row.code.toUpperCase() === 'CASH')
      || journals.find((row) => row.journal_type === 'cash')
    settlementAccountId = journal?.default_debit_account_id
    if (!journal || !settlementAccountId) throw new POSAccountingError('Configure an active Cash journal with a default debit Cash account')
  } else {
    const method = normalize(order.payment?.method)
    const provider = normalize(order.payment?.providerName)
    const bankAccounts = await tx.bank_accounts.findMany({
      where: { company_id: company.id, is_active: true, gl_account_id: { not: null }, journal_id: { not: null } },
      include: { journals: true },
      orderBy: { id: 'asc' },
    })
    const matched = bankAccounts.find((row) => {
      const haystack = normalize(`${row.account_name} ${row.account_number} ${row.journals?.name} ${row.journals?.code}`)
      return (provider && haystack.includes(provider)) || (method && haystack.includes(method))
    })
    const bank = matched || (bankAccounts.length === 1 ? bankAccounts[0] : null)
    journal = bank?.journals || journals.find((row) => row.journal_type === 'bank')
    settlementAccountId = bank?.gl_account_id || journal?.default_debit_account_id
    if (!journal || !settlementAccountId) {
      throw new POSAccountingError('Link the POS payment method to a GL account, or configure one matching Bank account with a Bank journal and GL account')
    }
  }

  const accountIds = [settlementAccountId, salesJournal.default_credit_account_id]
  let taxAccountId = null
  if (roundMoney(order.taxAmount) > 0) {
    const taxes = await tx.taxes.findMany({
      where: { is_active: true, tax_scope: { in: ['sale', 'both'] }, tax_account_id: { not: null } },
      select: { tax_account_id: true },
    })
    const uniqueTaxAccounts = [...new Set(taxes.map((row) => row.tax_account_id).filter(Boolean))]
    if (uniqueTaxAccounts.length !== 1) {
      throw new POSAccountingError('Configure one Sales Tax Payable account across active sales taxes')
    }
    taxAccountId = uniqueTaxAccounts[0]
    accountIds.push(taxAccountId)
  }
  const validAccounts = await tx.chart_of_accounts.findMany({
    where: { id: { in: accountIds }, company_id: company.id, is_active: true },
    select: { id: true },
  })
  if (validAccounts.length !== new Set(accountIds).size) {
    throw new POSAccountingError('One or more configured POS accounts are inactive or belong to another company')
  }
  return { paymentKind, journal, revenueAccountId: salesJournal.default_credit_account_id, settlementAccountId, taxAccountId }
}

async function allocateEntryNumber(tx, journal, companyId) {
  for (;;) {
    const updated = await tx.journals.update({
      where: { id: journal.id },
      data: { next_sequence: { increment: 1 } },
      select: { next_sequence: true },
    })
    const prefix = journal.sequence_prefix || journal.code || 'POS'
    const entryNumber = `${prefix}${String(updated.next_sequence - 1).padStart(6, '0')}`
    const exists = await tx.journal_entries.findFirst({ where: { company_id: companyId, entry_number: entryNumber }, select: { id: true } })
    if (!exists) return entryNumber
  }
}

export async function processCompletedPOSOrder(orderId, { db = prisma } = {}) {
  const parsedId = Number(orderId)
  if (!Number.isInteger(parsedId) || parsedId <= 0) throw new POSAccountingError('A valid POS order id is required')
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM `order` WHERE id = ? FOR UPDATE', parsedId)
      const order = await tx.order.findUnique({
        where: { id: parsedId },
        include: { payment: true, customer: true },
      })
      if (!order) throw new POSAccountingError('POS order not found', 'NOT_FOUND')
      if (order.accountingStatus === 'posted' && order.journalEntryId) {
        return { status: 'already_posted', journalEntryId: order.journalEntryId }
      }
      const existing = await tx.journal_entries.findFirst({
        where: { source_type: 'pos_order', source_id: order.id },
        select: { id: true, state: true, posted_at: true },
      })
      if (existing) {
        if (existing.state !== 'posted') throw new POSAccountingError('Existing POS journal entry is not posted')
        await tx.order.update({ where: { id: order.id }, data: { accountingStatus: 'posted', journalEntryId: existing.id, accountedAt: existing.posted_at || new Date(), accountingError: null } })
        return { status: 'already_posted', journalEntryId: existing.id }
      }
      const orderStatus = normalize(order.status)
      const isSuccessfulPOSOrder = normalize(order.source) === 'pos' &&
        ['served', 'completed'].includes(orderStatus) &&
        normalize(order.payment?.status) === 'paid'
      if (!isSuccessfulPOSOrder) {
        return { status: 'not_eligible', orderSource: order.source, orderStatus: order.status, paymentStatus: order.payment?.status || null }
      }

      const company = await resolveCompany(tx, order)
      const currencyId = order.currencyId || company.currency_id
      const currency = await tx.currencies.findUnique({ where: { id: currencyId } })
      if (!currency?.is_active) throw new POSAccountingError('The POS order currency is inactive or missing')
      const entryDate = order.updatedAt || order.payment.paidAt || new Date()
      const fiscalPeriod = await tx.fiscal_periods.findFirst({
        where: {
          state: 'open',
          fiscal_years: { company_id: company.id, state: 'open' },
          start_date: { lte: entryDate },
          end_date: { gte: entryDate },
        },
        orderBy: { period_number: 'asc' },
      })
      if (!fiscalPeriod) throw new POSAccountingError('No open fiscal period covers the completed POS order date')

      const routing = await resolveRouting(tx, order, company)
      const orderNumber = order.orderNumber || `POS-${String(order.id).padStart(8, '0')}`
      const plan = buildPOSJournalPlan({
        order: { ...order, orderNumber },
        settlementAccountId: routing.settlementAccountId,
        revenueAccountId: routing.revenueAccountId,
        taxAccountId: routing.taxAccountId,
        currencyId,
        partnerId: routing.paymentKind === 'credit' ? order.customerId : null,
      })
      const postedAt = new Date()
      const entry = await tx.journal_entries.create({
        data: {
          company_id: company.id,
          journal_id: routing.journal.id,
          entry_number: await allocateEntryNumber(tx, routing.journal, company.id),
          entry_date: entryDate,
          fiscal_period_id: fiscalPeriod.id,
          reference: orderNumber,
          narration: `POS sale for order ${orderNumber}`,
          state: 'posted',
          source_type: 'pos_order',
          source_id: order.id,
          posted_at: postedAt,
          journal_items: { create: plan.items },
        },
        include: { journal_items: true },
      })
      await tx.order.update({
        where: { id: order.id },
        data: {
          orderNumber,
          companyId: company.id,
          currencyId,
          accountingStatus: 'posted',
          journalEntryId: entry.id,
          accountedAt: postedAt,
          accountingError: null,
        },
      })
      return { status: 'posted', journalEntryId: entry.id, entryNumber: entry.entry_number, paymentKind: routing.paymentKind, plan }
    }, { maxWait: 10000, timeout: 30000 })
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Unknown POS accounting error'
    await db.order.updateMany({
      where: { id: parsedId, status: 'completed', accountingStatus: { not: 'posted' } },
      data: { accountingStatus: 'failed', accountingError: text.slice(0, 4000) },
    }).catch((updateError) => console.error('Unable to save POS accounting failure:', updateError))
    throw error
  }
}

export async function retryFailedPOSAccounting(orderId, options) {
  return processCompletedPOSOrder(orderId, options)
}

export async function processCompletedPOSOrderSafely(orderId, context = '') {
  try {
    return await processCompletedPOSOrder(orderId)
  } catch (error) {
    console.error(`POS accounting failed${context ? ` (${context})` : ''} for order ${orderId}:`, error)
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}
