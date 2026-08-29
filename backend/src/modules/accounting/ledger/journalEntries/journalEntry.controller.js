import prisma from '../../../../config/db.js'

class JournalEntryError extends Error {
    constructor(status, message) { super(message); this.status = status }
}

const safeError = (res, error, operation) => {
    if (error instanceof JournalEntryError) return res.status(error.status).json({ success: false, message: error.message })
    console.error(`Journal entry ${operation} error:`, error)
    return res.status(500).json({ success: false, message: `Unable to ${operation} journal entry` })
}

const entryInclude = { journal_items: { orderBy: { sequence: 'asc' } } }

export const getAll = async (_req, res) => {
    try {
        const data = await prisma.journal_entries.findMany({ include: entryInclude, orderBy: [{ entry_date: 'desc' }, { id: 'desc' }] })
        res.status(200).json({ success: true, data })
    } catch (error) { safeError(res, error, 'load') }
}

export const getById = async (req, res) => {
    try {
        const data = await prisma.journal_entries.findUnique({ where: { id: Number(req.params.id) }, include: entryInclude })
        if (!data) return res.status(404).json({ success: false, message: 'Journal entry not found' })
        res.status(200).json({ success: true, data })
    } catch (error) { safeError(res, error, 'load') }
}

export const create = async (req, res) => {
    try {
        const { items = [], ...input } = req.body
        if (input.source_type && input.source_type !== 'manual') throw new JournalEntryError(403, 'Source-controlled entries cannot be created from the manual journal module')
        if (!Array.isArray(items) || items.length < 2) throw new JournalEntryError(400, 'A journal entry requires at least two lines')
        const data = await prisma.journal_entries.create({
            data: { ...input, state: 'draft', source_type: 'manual', posted_at: null, journal_items: { create: items.map((item, index) => ({ ...item, sequence: item.sequence || (index + 1) * 10 })) } },
            include: entryInclude,
        })
        res.status(201).json({ success: true, data })
    } catch (error) { safeError(res, error, 'create') }
}

export const update = async (req, res) => {
    try {
        const id = Number(req.params.id)
        const existing = await prisma.journal_entries.findUnique({ where: { id }, select: { state: true, source_type: true } })
        if (!existing) throw new JournalEntryError(404, 'Journal entry not found')
        if (existing.source_type !== 'manual') throw new JournalEntryError(403, 'Source-controlled journal entries cannot be edited here')
        if (existing.state !== 'draft') throw new JournalEntryError(409, 'Only draft journal entries can be edited')
        const { items, state: _ignoredState, source_type: _ignoredSource, posted_at: _ignoredPostedAt, ...header } = req.body
        if (Array.isArray(items) && items.length < 2) throw new JournalEntryError(400, 'A journal entry requires at least two lines')
        const data = await prisma.$transaction(async (tx) => {
            if (Array.isArray(items)) await tx.journal_items.deleteMany({ where: { entry_id: id } })
            return tx.journal_entries.update({ where: { id }, data: { ...header, ...(Array.isArray(items) ? { journal_items: { create: items.map((item, index) => ({ ...item, sequence: item.sequence || (index + 1) * 10 })) } } : {}) }, include: entryInclude })
        })
        res.status(200).json({ success: true, data })
    } catch (error) { safeError(res, error, 'update') }
}

export const remove = async (req, res) => {
    try {
        const id = Number(req.params.id)
        const existing = await prisma.journal_entries.findUnique({ where: { id }, select: { state: true, source_type: true } })
        if (!existing) throw new JournalEntryError(404, 'Journal entry not found')
        if (existing.source_type !== 'manual') throw new JournalEntryError(403, 'Source-controlled journal entries cannot be deleted here')
        if (existing.state !== 'draft') throw new JournalEntryError(409, 'Only draft journal entries can be deleted')
        await prisma.journal_entries.delete({ where: { id } })
        res.status(200).json({ success: true, message: 'Deleted successfully' })
    } catch (error) { safeError(res, error, 'delete') }
}

export const post = async (req, res) => {
    try {
        const id = Number(req.params.id)
        const updated = await prisma.$transaction(async (tx) => {
            const entry = await tx.journal_entries.findUnique({
                where: { id },
                include: {
                    journal_items: true,
                    companies: { include: { currencies: true } },
                    journals: { include: { currencies: true } },
                    fiscal_periods: { include: { fiscal_years: true } },
                },
            })
            if (!entry) throw new JournalEntryError(404, 'Journal entry not found')
            if (entry.source_type !== 'manual') throw new JournalEntryError(403, 'Source-controlled journal entries cannot be posted manually')
            if (entry.state !== 'draft') throw new JournalEntryError(409, 'This journal entry has already been posted or is no longer available for posting')
            if (entry.journal_items.length < 2) throw new JournalEntryError(400, 'A journal entry requires at least two lines')
            if (!entry.companies?.is_active) throw new JournalEntryError(400, 'The company is inactive or invalid')
            if (!entry.journals?.is_active || !['general', 'adjustment', 'cash', 'bank'].includes(entry.journals.journal_type)) throw new JournalEntryError(400, 'This journal is not an active manual journal')
            if (!entry.fiscal_periods || entry.fiscal_periods.state !== 'open') throw new JournalEntryError(400, 'The fiscal period is closed or invalid')
            if (entry.fiscal_periods.fiscal_years.state !== 'open') throw new JournalEntryError(400, 'The fiscal year is closed')
            if (entry.fiscal_periods.fiscal_years.company_id !== entry.company_id) throw new JournalEntryError(400, 'The fiscal period does not belong to this company')
            const entryDate = new Date(entry.entry_date).getTime()
            if (entryDate < new Date(entry.fiscal_periods.start_date).getTime() || entryDate > new Date(entry.fiscal_periods.end_date).getTime()) throw new JournalEntryError(400, 'The fiscal period does not match the entry date')

            const accountIds = [...new Set(entry.journal_items.map((line) => line.account_id))]
            const [accounts, parentCount] = await Promise.all([
                tx.chart_of_accounts.findMany({ where: { id: { in: accountIds } }, select: { id: true, company_id: true, currency_id: true, is_active: true, allow_manual_entry: true } }),
                tx.chart_of_accounts.count({ where: { parent_id: { in: accountIds } } }),
            ])
            if (accounts.length !== accountIds.length) throw new JournalEntryError(400, 'One or more journal lines reference an invalid account')
            if (parentCount > 0 || accounts.some((account) => !account.is_active || !account.allow_manual_entry || account.company_id !== entry.company_id)) throw new JournalEntryError(400, 'Journal lines must use active leaf posting accounts from this company')

            let totalDebit = 0
            let totalCredit = 0
            for (const line of entry.journal_items) {
                const debit = Number(line.debit)
                const credit = Number(line.credit)
                if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) throw new JournalEntryError(400, 'Debit and credit values must be valid non-negative numbers')
                if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) throw new JournalEntryError(400, 'Each line must contain either a debit or a credit, but not both')
                totalDebit += debit
                totalCredit += credit
            }
            if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.005) throw new JournalEntryError(400, 'Journal entry is unbalanced')
            if (!entry.companies.currencies?.is_active || (entry.journals.currency_id && !entry.journals.currencies?.is_active)) throw new JournalEntryError(400, 'The journal currency context is invalid')

            const claimed = await tx.journal_entries.updateMany({ where: { id, state: 'draft', source_type: 'manual' }, data: { state: 'posted', posted_at: new Date() } })
            if (claimed.count !== 1) throw new JournalEntryError(409, 'This journal entry has already been posted or is no longer available for posting')
            return tx.journal_entries.findUnique({ where: { id }, include: entryInclude })
        }, { maxWait: 10000, timeout: 30000 })
        res.status(200).json({ success: true, message: 'Journal entry posted successfully.', data: updated })
    } catch (error) { safeError(res, error, 'post') }
}
