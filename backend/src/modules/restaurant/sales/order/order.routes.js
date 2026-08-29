// import express from 'express'
// import {
//   createOrder,
//   getAllOrders,
//   getOrderById,
//   updateOrderStatus,
//   deleteOrder,
//   getOrdersByTable
// } from './order.controller.js'

// const router = express.Router()
// // Create Order
// router.post('/', createOrder)
// // Get All Orders
// router.get('/all', getAllOrders)
// // Get Order By Id
// router.get('/:id', getOrderById)
// // Update Order Status
// router.patch('/:id/status', updateOrderStatus)
// // Delete Order
// router.delete('/:id', deleteOrder)
// // Get Orders By Table
// router.get('/table/:tableId', getOrdersByTable)
// export default router

import express from 'express'
import {
  createOrder,
  createPosCheckout,
  getAllOrders,
  getOrderQueueCounts,
  getOrderById,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getOrdersByTable,
} from './order.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'
import prisma from '../../../../config/db.js'

const router = express.Router()

const canUpdateOrderStatus = (req, res, next) => {
  const role = req.user?.role?.toLowerCase()
  if (role === 'kitchen' || role === 'waiter' || role === 'pos') {
    return next()
  }
  return checkPermission('/orders', 'canEdit')(req, res, next)
}

const canEditOrder = (req, res, next) => {
  const role = req.user?.role?.toLowerCase()
  if (role === 'pos' || role === 'admin' || role === 'manager') {
    return next()
  }
  return checkPermission('/orders', 'canEdit')(req, res, next)
}

const canViewOrder = (req, res, next) => {
  if (req.user?.role?.toLowerCase() === 'kitchen') {
    return next()
  }
  return checkPermission('/orders', 'canView')(req, res, next)
}

// Create order — accessible to any logged-in user (needed by POS)
router.post('/', protect, createOrder)
router.post('/pos-checkout', protect, createPosCheckout)

// Get all orders (Accessible to any logged-in user for POS retrieval)
router.get('/all', protect, getAllOrders)
router.get('/counts', protect, getOrderQueueCounts)

// Get orders by table
router.get('/table/:tableId', protect, checkPermission('/orders', 'canView'), getOrdersByTable)

// PUBLIC ticket view — no auth needed (for QR code scanning)
router.get('/ticket/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id' })
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        table: true,
        orderitem: {
          include: {
            menuitem: { select: { id: true, name: true, price: true } }
          }
        }
      }
    })
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' })
    res.json({ success: true, data: order })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// Get order by id
router.get('/:id', protect, canViewOrder, getOrderById)

// Update order status
router.patch('/:id/status', protect, canUpdateOrderStatus, updateOrderStatus)

// Update full order
router.put('/:id', protect, canEditOrder, updateOrder)

// Delete order (Accessible to any logged-in user to allow resuming held orders)
router.delete('/:id', protect, deleteOrder)

export default router
