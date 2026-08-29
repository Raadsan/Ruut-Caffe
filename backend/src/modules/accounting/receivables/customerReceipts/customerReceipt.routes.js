import express from 'express'
import { getAll, getById, getOptions, getOutstandingInvoices, create, update, remove, post } from './customerReceipt.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.route('/')
    .get(checkPermission('/customer-receipts', 'canView'), getAll)
    .post(checkPermission('/customer-receipts', 'canAdd'), create)

router.get('/options', checkPermission('/customer-receipts', 'canView'), getOptions)
router.get('/outstanding-invoices', checkPermission('/customer-receipts', 'canView'), getOutstandingInvoices)
router.route('/:id')
    .get(checkPermission('/customer-receipts', 'canView'), getById)
    .put(checkPermission('/customer-receipts', 'canEdit'), update)
    .delete(checkPermission('/customer-receipts', 'canDelete'), remove)

router.patch('/:id/post', checkPermission('/customer-receipts', 'canAdd'), post)
router.post('/:id/post', checkPermission('/customer-receipts', 'canAdd'), post)

export default router
