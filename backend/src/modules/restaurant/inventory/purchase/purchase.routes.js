import express from 'express'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'
import { createPurchase, deletePurchase, getPurchase, listPurchases } from './purchase.controller.js'

const router = express.Router()

router.use(protect)
router.get('/', checkPermission('/purchases', 'canView'), listPurchases)
router.get('/:id', checkPermission('/purchases', 'canView'), getPurchase)
router.post('/', checkPermission('/purchases', 'canAdd'), createPurchase)
router.delete('/:id', checkPermission('/purchases', 'canDelete'), deletePurchase)

export default router
