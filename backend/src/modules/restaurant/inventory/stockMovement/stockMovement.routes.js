import express from 'express'
import {
  createStockMovement,
  getAllStockMovements,
  getStockMovementById,
  getStockMovementsByIngredient,
  deleteStockMovement
} from './stockMovement.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.post(
  '/',
  protect,
  checkPermission('/inventory/movements', 'canAdd'),
  createStockMovement
)

router.get(
  '/all',
  protect,
  checkPermission('/inventory/movements', 'canView'),
  getAllStockMovements
)

router.get(
  '/ingredient/:ingredientId',
  protect,
  checkPermission('/inventory/movements', 'canView'),
  getStockMovementsByIngredient
)

router.get(
  '/:id',
  protect,
  checkPermission('/inventory/movements', 'canView'),
  getStockMovementById
)

router.delete(
  '/:id',
  protect,
  checkPermission('/inventory/movements', 'canDelete'),
  deleteStockMovement
)

export default router
