import prisma from '../../../../config/db.js'
const include = { chart_of_accounts: { select: { id: true, code: true, name: true, company_id: true } } }
const inputError = (message) => Object.assign(new Error(message), { status: 400 })
const fail = (res, error) => res.status(error.status || (error.code === 'P2025' ? 404 : 500)).json({ success: false, message: error.message })
const moneyAccountWhere = {
    is_active: true,
    allow_manual_entry: true,
    other_chart_of_accounts: { none: {} },
    // "Assets" is this schema's Current Assets account type (internal asset
    // group); the code restriction below excludes receivables and advances.
    account_types: { internal_group: 'asset' },
    // There are no isCashAccount/isBankAccount columns in this schema. Its
    // 10xx codes are the configured 1000-series for cash, bank, and wallets.
    code: { startsWith: '10' },
}

function sanitize(body) {
    const allowed = ['name', 'code', 'payment_type', 'gl_account_id', 'allow_multiple_accounts', 'requires_reference', 'is_active']
    const data = Object.fromEntries(Object.entries(body || {}).filter(([key]) => allowed.includes(key)))
    if (data.gl_account_id === '') data.gl_account_id = null
    if (data.gl_account_id !== null && data.gl_account_id !== undefined) data.gl_account_id = Number(data.gl_account_id)
    return data
}

async function validateGlAccount(glAccountId) {
    if (!glAccountId) return
    if (!Number.isInteger(glAccountId) || glAccountId <= 0) throw inputError('Linked GL account is invalid')
    const account = await prisma.chart_of_accounts.findFirst({ where: { id: glAccountId, ...moneyAccountWhere } })
    if (!account) throw inputError('Linked GL account must be a Cash, Bank, or Mobile Wallet Current Asset account in the 1000-series')
}

export const getEligibleGlAccounts = async (req, res) => {
    try {
        const data = await prisma.chart_of_accounts.findMany({
            where: moneyAccountWhere,
            select: { id: true, code: true, name: true, company_id: true },
            orderBy: [{ company_id: 'asc' }, { code: 'asc' }],
        })
        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const getAll = async (req, res) => {
    try {
        const data = await prisma.payment_methods.findMany({ include, orderBy: { name: 'asc' } })
        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const getById = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.payment_methods.findUnique({ where: { id: parseInt(id) }, include })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const create = async (req, res) => {
    try {
        const payload = sanitize(req.body)
        await validateGlAccount(payload.gl_account_id)
        const data = await prisma.payment_methods.create({ data: payload, include })
        res.status(201).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const update = async (req, res) => {
    try {
        const { id } = req.params
        const payload = sanitize(req.body)
        await validateGlAccount(payload.gl_account_id)
        const data = await prisma.payment_methods.update({ where: { id: parseInt(id) }, data: payload, include })
        res.status(200).json({ success: true, data })
    } catch (error) {
        fail(res, error)
    }
}

export const remove = async (req, res) => {
    try {
        const { id } = req.params
        await prisma.payment_methods.delete({ where: { id: parseInt(id) } })
        res.status(200).json({ success: true, message: 'Deleted successfully' })
    } catch (error) {
        fail(res, error)
    }
}
