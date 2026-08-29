import express from 'express'
import { create, getAll, getById, post, remove, update } from './creditNote.controller.js'
import { checkPermission, protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()
router.use(protect)
router.route('/')
  .get(checkPermission('/credit-notes', 'canView'), getAll)
  .post(checkPermission('/credit-notes', 'canAdd'), create)
router.route('/:id')
  .get(checkPermission('/credit-notes', 'canView'), getById)
  .put(checkPermission('/credit-notes', 'canEdit'), update)
  .delete(checkPermission('/credit-notes', 'canDelete'), remove)
router.patch('/:id/post', checkPermission('/credit-notes', 'canAdd'), post)
router.post('/:id/post', checkPermission('/credit-notes', 'canAdd'), post)

export default router
