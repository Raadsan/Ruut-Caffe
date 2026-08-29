import express from 'express'
import {
  getAllComposites,
  getComboFormData,
  getCompositeById,
  createComposite,
  updateComposite,
  deleteComposite,
} from './composite.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/', protect, getAllComposites)
router.get('/form-data', protect, getComboFormData)
router.get('/:id', protect, getCompositeById)
router.post('/', protect, checkPermission('/composites', 'canAdd'), createComposite)
router.put('/:id', protect, checkPermission('/composites', 'canEdit'), updateComposite)
router.delete('/:id', protect, checkPermission('/composites', 'canDelete'), deleteComposite)

export default router
