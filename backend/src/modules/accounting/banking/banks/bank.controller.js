import prisma from '../../../../config/db.js'

export const getAll = async (req, res) => {
    try {
        const data = await prisma.banks.findMany()
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const getById = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.banks.findUnique({ where: { id: parseInt(id) } })
        if (!data) return res.status(404).json({ success: false, message: 'Not found' })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const create = async (req, res) => {
    try {
        const data = await prisma.banks.create({ data: req.body })
        res.status(201).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const update = async (req, res) => {
    try {
        const { id } = req.params
        const data = await prisma.banks.update({ where: { id: parseInt(id) }, data: req.body })
        res.status(200).json({ success: true, data })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

export const remove = async (req, res) => {
    try {
        const { id } = req.params
        await prisma.banks.delete({ where: { id: parseInt(id) } })
        res.status(200).json({ success: true, message: 'Deleted successfully' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}
