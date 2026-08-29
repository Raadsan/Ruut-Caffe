import express from 'express'
import {
  createIngredient,
  getAllIngredients,
  getIngredientById,
  updateIngredient,
  deleteIngredient
} from './ingredient.controller.js'
import { protect, authorize, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.post(
  '/',
  protect,
  checkPermission('/inventory', 'canAdd'),
  createIngredient
)

router.get(
  '/',
  protect,
  checkPermission('/inventory', 'canView'),
  getAllIngredients
)

router.get(
  '/:id',
  protect,
  checkPermission('/inventory', 'canView'),
  getIngredientById
)

router.put(
  '/:id',
  protect,
  checkPermission('/inventory', 'canEdit'),
  updateIngredient
)

router.delete(
  '/:id',
  protect,
  checkPermission('/inventory', 'canDelete'),
  deleteIngredient
)

export default router
