import express from 'express'
import {
  createBOMItem,
  getAllBOMItems,
  getBOMByMenuItem,
  updateBOMItem,
  deleteBOMItem
} from './bom.controller.js'
import { protect, authorize } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.post(
  '/',
  protect,
  authorize('admin', 'manager'),
  createBOMItem
)

router.get(
  '/',
  protect,
  authorize('admin', 'manager', 'kitchen'),
  getAllBOMItems
)

router.get(
  '/menu-item/:menuItemId',
  protect,
  authorize('admin', 'manager', 'kitchen'),
  getBOMByMenuItem
)

router.patch(
  '/:id',
  protect,
  authorize('admin', 'manager'),
  updateBOMItem
)

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteBOMItem
)

export default router
