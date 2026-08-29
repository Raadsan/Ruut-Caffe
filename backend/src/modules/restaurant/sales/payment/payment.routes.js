import express from 'express'
import {
  createPayment,
  createPublicPayment,
  confirmPublicPayment,
  getAllPayments,
  getPaymentById,
  getPaymentByOrderId,
  updatePaymentStatus,
  deletePayment,
  getPaymentMethods,
  processWaafiPayment,
  processCheckoutPayment
} from './payment.controller.js'
import { protect, authorize } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

// PUBLIC ROUTES
router.get('/methods', getPaymentMethods)
router.post('/pay',            createPublicPayment)
router.patch('/pay/:id/confirm', confirmPublicPayment)
router.post('/waafi',          processWaafiPayment)   // Waafi mobile money
router.post('/checkout-pay',   protect, processCheckoutPayment) // Direct Waafi Checkout payment-first

// PROTECTED ROUTES
// Create payment — accessible to pos & waiter (order checkout)
router.post(
  '/',
  protect,
  authorize('admin', 'manager', 'cashier', 'pos', 'waiter'),
  createPayment
)

router.get(
  '/',
  protect,
  authorize('admin', 'manager', 'cashier'),
  getAllPayments
)

router.get(
  '/order/:orderId',
  protect,
  authorize('admin', 'manager', 'cashier'),
  getPaymentByOrderId
)

router.get(
  '/:id',
  protect,
  authorize('admin', 'manager', 'cashier'),
  getPaymentById
)

router.patch(
  '/:id/status',
  protect,
  authorize('admin', 'manager'),
  updatePaymentStatus
)

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deletePayment
)

export default router
