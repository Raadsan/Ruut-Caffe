// import express from 'express'
// import {
//   createMenuItem,
//   getAllMenuItems,
//   getMenuItemsByCategory,
//   updateMenuItem,
//   deleteMenuItem
// } from './menuItem.controller.js'

// const router = express.Router()
// // Create Menu Item
// router.post('/', createMenuItem)
// // Get All Menu Items
// router.get('/all', getAllMenuItems)
// // Get Menu Items By Category
// router.get('/category/:categoryId', getMenuItemsByCategory)
// // Update Menu Item
// router.patch('/:id', updateMenuItem)
// // Delete Menu Item 
// router.delete('/:id', deleteMenuItem)

// export default router

import express from 'express'
import {
  createMenuItem,
  getAllMenuItems,
  getPosMenuCatalog,
  getMenuItemsByCategory,
  updateMenuItem,
  deleteMenuItem,
  getPublicMenuByQrCode
} from './menuItem.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

// Create menu item
router.post('/', protect, checkPermission('/menus', 'canAdd'), createMenuItem)

// Get all menu items
router.get('/pos-catalog', protect, getPosMenuCatalog)
router.get('/all', getAllMenuItems)

// Get menu items by category
router.get('/category/:categoryId', getMenuItemsByCategory)

// Update menu item
router.patch('/:id', updateMenuItem)

// Delete menu item
router.delete('/:id', protect, checkPermission('/menus', 'canDelete'), deleteMenuItem)

// Customer scans QR and gets menu (public, no auth needed)
router.get('/menu/:qrCode', getPublicMenuByQrCode)

export default router
