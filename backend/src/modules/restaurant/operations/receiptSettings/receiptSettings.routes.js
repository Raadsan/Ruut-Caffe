import express from 'express'
import { getReceiptSettings, updateReceiptSettings } from './receiptSettings.controller.js'
import { protect, authorize } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/', getReceiptSettings)
router.patch('/', protect, authorize('admin', 'Admin'), updateReceiptSettings)

export default router
