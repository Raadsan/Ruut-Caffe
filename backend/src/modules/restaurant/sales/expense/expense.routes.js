import express from 'express'
import {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense
} from './expense.controller.js'
import { protect, authorize } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/', protect, authorize('admin', 'manager'), getAllExpenses)
router.post('/', protect, authorize('admin', 'manager'), createExpense)
router.put('/:id', protect, authorize('admin', 'manager'), updateExpense)
router.delete('/:id', protect, authorize('admin'), deleteExpense)

export default router
