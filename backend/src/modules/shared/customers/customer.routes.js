import express from 'express'
import { protect, checkPermission } from '../../../middlewares/authMiddleware.js'
import { create, getAll, getById, getByPhone, getPosList, remove, update } from './customer.controller.js'

const router = express.Router()
const role = (req) => String(req.user?.role || '').toLowerCase().replace(/[\s-]+/g, '_')
const permission = (type) => (req, res, next) => {
  const current = role(req)
  if (current === 'admin' || current === 'super_admin') return next()
  if (req.user?.authContext === 'pos' && (type === 'canView' || type === 'canAdd')) return next()
  const url = ['accounting', 'accountant'].includes(current) ? '/customers' : '/clients'
  return checkPermission(url, type)(req, res, next)
}

router.use(protect)
router.get('/', permission('canView'), getAll)
router.get('/all', permission('canView'), getAll)
router.get('/pos-list', permission('canView'), getPosList)
router.get('/by-phone/:phone', permission('canView'), getByPhone)
router.get('/:id', permission('canView'), getById)
router.post('/', permission('canAdd'), create)
router.put('/:id', permission('canEdit'), update)
router.delete('/:id', permission('canDelete'), remove)

export default router
