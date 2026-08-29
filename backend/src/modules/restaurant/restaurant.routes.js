import express from 'express'
import addressRoutes from './operations/address/address.routes.js'
import bomRoutes from './inventory/bom/bom.routes.js'
import cartRoutes from './sales/cart/cart.routes.js'
import categoryRoutes from './catalog/category/category.routes.js'
import compositeRoutes from './catalog/composite/composite.routes.js'
import discountAdvertisementRoutes from './catalog/discountAdvertisement/discountAdvertisement.routes.js'
import expenseRoutes from './sales/expense/expense.routes.js'
import ingredientRoutes from './inventory/ingredient/ingredient.routes.js'
import menuRoutes from './catalog/menu/menu.routes.js'
import menuItemRoutes from './catalog/menuItem/menuItem.routes.js'
import notificationRoutes from './engagement/notification/notification.routes.js'
import orderRoutes from './sales/order/order.routes.js'
import paymentRoutes from './sales/payment/payment.routes.js'
import purchaseRoutes from './inventory/purchase/purchase.routes.js'
import receiptSettingsRoutes from './operations/receiptSettings/receiptSettings.routes.js'
import reportRoutes from './reporting/report/report.routes.js'
import reviewRoutes from './engagement/review/review.routes.js'
import stockMovementRoutes from './inventory/stockMovement/stockMovement.routes.js'
import tableRoutes from './operations/table/table.routes.js'
import trackingRoutes from './operations/tracking/tracking.routes.js'
import { getAll as getAllPaymentMethods } from '../accounting/configuration/paymentMethods/paymentMethod.controller.js'
import { protect } from '../../middlewares/authMiddleware.js'

const router = express.Router()

router.use('/addresses', addressRoutes)
router.use('/bom', bomRoutes)
router.use('/cart', cartRoutes)
router.use('/categories', categoryRoutes)
router.use('/composites', compositeRoutes)
router.use('/discount-advertisements', discountAdvertisementRoutes)
router.use('/expenses', expenseRoutes)
router.use('/ingredients', ingredientRoutes)
router.use('/menus', menuRoutes)
router.use('/menu-items', menuItemRoutes)
router.use('/notifications', notificationRoutes)
router.use('/orders', orderRoutes)
router.use('/payments', paymentRoutes)
router.use('/purchases', purchaseRoutes)
router.use('/receipt-settings', receiptSettingsRoutes)
router.use('/reports', reportRoutes)
router.use('/reviews', reviewRoutes)
router.use('/stock-movements', stockMovementRoutes)
router.use('/tables', tableRoutes)
router.use('/tracking', trackingRoutes)

// Payment methods — accessible to all authenticated users (including POS)
router.get('/payment-methods', protect, getAllPaymentMethods)

export default router
