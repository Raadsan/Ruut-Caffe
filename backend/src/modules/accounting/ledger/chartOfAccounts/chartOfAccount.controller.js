import prisma from '../../../../config/db.js'

export const getAll = async (req, res) => {
    try {
        const data = await prisma.chart_of_accounts.findMany()
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const getById = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.chart_of_accounts.findUnique({ where: { id: parseInt(id) } })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const create = async (req, res) => {
    try {
        const data = await prisma.chart_of_accounts.create({ data: req.body })
        res.status(201).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const update = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.chart_of_accounts.update({ where: { id: parseInt(id) }, data: req.body })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const remove = async (req, res) => {
    try {
        const { id } = req.params
        await prisma.chart_of_accounts.delete({ where: { id: parseInt(id) } })
        res.status(200).json({ success: true, message: 'Deleted successfully' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}
