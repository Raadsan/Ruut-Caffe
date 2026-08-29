// import express from 'express'
// import {
//   createCategory,
//   getAllCategories,
//   updateCategory,
//   deleteCategory,
//   getCategoriesWithItems,
//   getCategoryByIdWithItems
// } from './category.controller.js'

// const router = express.Router()
// // Create Category
// router.post('/', createCategory)
// // Get All Categories
// router.get('/all', getAllCategories)
// // Update Category
// router.patch('/:id', updateCategory)
// // Delete Category
// router.delete('/:id', deleteCategory)
// // Get Categories With Items
// router.get('/with-items', getCategoriesWithItems)
// // Get Category By Id With Items
// router.get('/:id/with-items', getCategoryByIdWithItems)

// export default router

import express from 'express'
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
  getCategoriesWithItems,
  getCategoryByIdWithItems
} from './category.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

// Create category
router.post('/', protect, checkPermission('/categories', 'canAdd'), createCategory)

// Get all categories
router.get('/', getAllCategories)
router.get('/all', getAllCategories)

// Get categories with items
router.get('/with-items', getCategoriesWithItems)

// Get category by id with items
router.get('/:id/with-items', getCategoryByIdWithItems)

// Update category
router.patch('/:id', protect, checkPermission('/categories', 'canEdit'), updateCategory)

// Delete category
router.delete('/:id', protect, checkPermission('/categories', 'canDelete'), deleteCategory)

export default router
