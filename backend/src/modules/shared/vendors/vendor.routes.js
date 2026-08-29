import express from 'express'
import { protect, checkPermission } from '../../../middlewares/authMiddleware.js'
import { create, getAll, getById, remove, update } from './vendor.controller.js'

const router = express.Router()
const permission = (type) => (req, res, next) => {
  const current = String(req.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_')
  if (current === 'admin' || current === 'super_admin') return next()
  const url = ['accounting', 'accountant'].includes(current) ? '/vendors' : '/suppliers'
  return checkPermission(url, type)(req, res, next)
}
router.use(protect)
router.route('/').get(permission('canView'), getAll).post(permission('canAdd'), create)
router.route('/:id').get(permission('canView'), getById).put(permission('canEdit'), update).delete(permission('canDelete'), remove)
export default router
