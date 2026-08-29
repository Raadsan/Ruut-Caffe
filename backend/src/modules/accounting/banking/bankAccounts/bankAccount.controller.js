import prisma from '../../../../config/db.js'

const include = {
    banks: { select: { id: true, name: true } },
    chart_of_accounts: { select: { id: true, code: true, name: true } },
    currencies: { select: { id: true, code: true, symbol: true } },
}
const id = (value) => {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
const fail = (res, error) => res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message })
const inputError = (message) => Object.assign(new Error(message), { status: 400 })

async function resolveInstitution(name) {
    const institutionName = String(name || '').trim()
    if (!institutionName) throw inputError('Institution name is required')
    const existing = await prisma.banks.findFirst({ where: { name: institutionName } })
    if (existing) {
        if (!existing.is_active) return prisma.banks.update({ where: { id: existing.id }, data: { is_active: true } })
        return existing
    }
    return prisma.banks.create({ data: { name: institutionName, is_active: true } })
}

async function resolveJournal(companyId, submittedJournalId) {
    if (submittedJournalId) return submittedJournalId
    const journal = await prisma.journals.findFirst({
        where: { company_id: companyId, code: 'BANK', is_active: true, journal_type: 'bank' },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        select: { id: true },
    })
    return journal?.id || null
}

const eligibleBankAccountWhere = (companyId) => ({
    ...(companyId ? { company_id: companyId } : {}),
    code: '1002',
    is_active: true,
    allow_manual_entry: true,
    account_types: { internal_group: 'asset' },
    other_chart_of_accounts: { none: {} },
})

async function validateBankGlAccount(companyId, glAccountId, currencyId) {
    const account = await prisma.chart_of_accounts.findFirst({
        where: { id: glAccountId, ...eligibleBankAccountWhere(companyId), OR: [{ currency_id: null }, { currency_id: currencyId }] },
        select: { id: true },
    })
    if (!account) throw inputError('Linked GL account must be the active 1002 – Bank Account posting ledger for this company and currency')
}

function payload(body) {
    const companyId = id(body.company_id)
    const currencyId = id(body.currency_id)
    const glAccountId = id(body.gl_account_id)
    const journalId = id(body.journal_id)
    const accountName = String(body.account_name || '').trim()
    const institutionName = String(body.institution_name || '').trim()
    if (!companyId || !currencyId || !glAccountId || !accountName || !institutionName) {
        throw inputError('Company, institution name, account name, currency, and linked GL account are required')
    }
    return {
        company_id: companyId,
        institution_name: institutionName,
        account_name: accountName,
        account_number: String(body.account_number || '').trim() || null,
        iban: String(body.iban || '').trim() || null,
        currency_id: currencyId,
        gl_account_id: glAccountId,
        payment_method_id: id(body.payment_method_id),
        journal_id: journalId,
        is_active: body.is_active !== false,
    }
}

export const getAll = async (_req, res) => {
    try {
        const rows = await prisma.bank_accounts.findMany({ include, orderBy: [{ is_active: 'desc' }, { institution_name: 'asc' }, { account_name: 'asc' }] })
        res.status(200).json({ success: true, data: rows.map((row) => ({ ...row, institution_name: row.institution_name || row.banks?.name || '' })) })
    } catch (error) { fail(res, error) }
}

export const getEligibleGlAccounts = async (req, res) => {
    try {
        const companyId = id(req.query.company_id)
        const data = await prisma.chart_of_accounts.findMany({
            where: eligibleBankAccountWhere(companyId),
            select: { id: true, company_id: true, currency_id: true, code: true, name: true },
            orderBy: [{ company_id: 'asc' }, { code: 'asc' }],
        })
        res.status(200).json({ success: true, data })
    } catch (error) { fail(res, error) }
}

export const getById = async (req, res) => {
    try {
        const data = await prisma.bank_accounts.findUnique({ where: { id: parseInt(req.params.id) }, include })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data: { ...data, institution_name: data.institution_name || data.banks?.name || '' } })
    } catch (error) { fail(res, error) }
}

export const create = async (req, res) => {
    try {
        const data = payload(req.body)
        await validateBankGlAccount(data.company_id, data.gl_account_id, data.currency_id)
        const institution = await resolveInstitution(data.institution_name)
        const journalId = await resolveJournal(data.company_id, data.journal_id)
        const created = await prisma.bank_accounts.create({ data: { ...data, bank_id: institution.id, journal_id: journalId }, include })
        res.status(201).json({ success: true, data: created })
    } catch (error) { fail(res, error) }
}

export const update = async (req, res) => {
    try {
        const data = payload(req.body)
        await validateBankGlAccount(data.company_id, data.gl_account_id, data.currency_id)
        const institution = await resolveInstitution(data.institution_name)
        const journalId = await resolveJournal(data.company_id, data.journal_id)
        const updated = await prisma.bank_accounts.update({ where: { id: parseInt(req.params.id) }, data: { ...data, bank_id: institution.id, journal_id: journalId }, include })
        res.status(200).json({ success: true, data: updated })
    } catch (error) { fail(res, error) }
}

export const remove = async (req, res) => {
    try {
        await prisma.bank_accounts.delete({ where: { id: parseInt(req.params.id) } })
        res.status(200).json({ success: true, message: 'Deleted successfully' })
    } catch (error) { fail(res, error) }
}
