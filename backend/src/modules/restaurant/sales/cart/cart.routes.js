import express from 'express'
import {
  getOrCreateCart,
  getOrCreateCartByTable,
  addToCart,
  getCart,
  removeCartItem,
  clearCart,
  checkoutCart,
} from './cart.controller.js'

const router = express.Router()

/** PUBLIC — QR table customer flow (no auth) */

router.get('/table/:tableId', getOrCreateCartByTable)
router.post('/create', getOrCreateCart)
router.post('/add', addToCart)
router.get('/:id', getCart)
router.delete('/item/:id', removeCartItem)
router.delete('/:cartId/clear', clearCart)
router.post('/checkout', checkoutCart)

export default router
