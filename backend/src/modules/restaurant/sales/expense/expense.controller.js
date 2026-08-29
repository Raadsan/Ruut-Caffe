import prisma from '../../../../config/db.js'

// GET ALL EXPENSES
export const getAllExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: 'desc' },
      include: {
        createdBy: {
          select: { fullName: true }
        }
      }
    })
    res.status(200).json({ success: true, data: expenses })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// CREATE EXPENSE
export const createExpense = async (req, res) => {
  try {
    const { title, amount, category, date, description, paymentMethod, receiver } = req.body
    const expense = await prisma.expense.create({
      data: {
        title,
        amount: parseFloat(amount),
        category,
        receiver,
        date: date ? new Date(date) : new Date(),
        description,
        paymentMethod,
        createdById: req.user?.id
      }
    })
    res.status(201).json({ success: true, data: expense })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// UPDATE EXPENSE
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params
    const { title, amount, category, date, description, paymentMethod, receiver } = req.body
    const expense = await prisma.expense.update({
      where: { id: parseInt(id) },
      data: {
        title,
        amount: parseFloat(amount),
        category,
        receiver,
        date: date ? new Date(date) : undefined,
        description,
        paymentMethod
      }
    })
    res.status(200).json({ success: true, data: expense })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// DELETE EXPENSE
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params
    await prisma.expense.delete({
      where: { id: parseInt(id) }
    })
    res.status(200).json({ success: true, message: 'Expense deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
