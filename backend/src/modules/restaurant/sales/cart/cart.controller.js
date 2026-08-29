import prisma from '../../../../config/db.js'
import { notifyNewOrder } from '../../../../utils/orderNotifications.js'
import { clearOrderListCache } from '../order/order.controller.js'
import {
  assertMenuItemSellable,
  buildOrderItemsPayload,
  getItemUnitPrice,
  loadMenuItemsForOrderSale,
} from '../../../../utils/compositeMenuHelper.js'

const cartInclude = {
  items: {
    include: {
      menuItem: true,
    },
    orderBy: { id: 'asc' },
  },
  table: {
    select: { id: true, number: true, name: true },
  },
}

function formatCart(cart) {
  if (!cart) return null
  let totalAmount = 0
  const items = (cart.items || []).map((row) => {
    const unitPrice = getItemUnitPrice(row.menuItem)
    const lineTotal = unitPrice * row.quantity
    totalAmount += lineTotal
    return {
      id: String(row.id),
      menuItemId: String(row.menuItemId),
      quantity: row.quantity,
      unitPrice,
      menuItem: row.menuItem
        ? {
            id: String(row.menuItem.id),
            name: row.menuItem.name,
            price: row.menuItem.price,
            imageUrl: row.menuItem.imageUrl,
            isComposite: row.menuItem.isComposite,
          }
        : undefined,
    }
  })

  return {
    id: String(cart.id),
    tableId: String(cart.tableId),
    items,
    totalAmount: Math.round(totalAmount * 100) / 100,
    createdAt: cart.createdAt,
  }
}

async function getActiveCartByTable(tableId) {
  return prisma.cart.findFirst({
    where: {
      tableId: Number(tableId),
      status: 'active',
    },
    include: cartInclude,
  })
}

// GET OR CREATE CART BY TABLE (PUBLIC)
export const getOrCreateCartByTable = async (req, res) => {
  try {
    const tableId = Number(req.params.tableId)
    if (!tableId) {
      return res.status(400).json({ success: false, message: 'tableId is required' })
    }

    const table = await prisma.table.findUnique({ where: { id: tableId } })
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' })
    }

    let cart = await getActiveCartByTable(tableId)
    if (!cart) {
      cart = await prisma.cart.create({
        data: { tableId },
        include: cartInclude,
      })
    }

    res.status(200).json({ success: true, data: formatCart(cart) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// CREATE OR GET CART (legacy POST)
export const getOrCreateCart = async (req, res) => {
  req.params = { tableId: String(req.body.tableId) }
  return getOrCreateCartByTable(req, res)
}

// ADD ITEM TO CART (PUBLIC)
export const addToCart = async (req, res) => {
  try {
    const { cartId, menuItemId, quantity } = req.body
    const parsedCartId = Number(cartId)
    const parsedMenuItemId = Number(menuItemId)
    const qty = Math.max(1, Number(quantity) || 1)

    const cart = await prisma.cart.findUnique({
      where: { id: parsedCartId },
      include: { items: true },
    })
    if (!cart || cart.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Cart not found' })
    }

    const { itemMap, componentMap } = await loadMenuItemsForOrderSale([parsedMenuItemId], prisma)
    const menuItem = itemMap.get(parsedMenuItemId)
    const sellError = assertMenuItemSellable(menuItem, componentMap)
    if (sellError) {
      return res.status(400).json({ success: false, message: sellError })
    }

    const existing = cart.items.find((row) => row.menuItemId === parsedMenuItemId)
    if (existing) {
      await prisma.cartitem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty },
      })
    } else {
      await prisma.cartitem.create({
        data: {
          cartId: parsedCartId,
          menuItemId: parsedMenuItemId,
          quantity: qty,
        },
      })
    }

    const updated = await prisma.cart.findUnique({
      where: { id: parsedCartId },
      include: cartInclude,
    })

    res.status(200).json({ success: true, data: formatCart(updated) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// GET CART
export const getCart = async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { id: Number(req.params.id) },
      include: cartInclude,
    })
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' })
    }
    res.status(200).json({ success: true, data: formatCart(cart) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// REMOVE ITEM
export const removeCartItem = async (req, res) => {
  try {
    const item = await prisma.cartitem.findUnique({
      where: { id: Number(req.params.id) },
    })
    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' })
    }

    await prisma.cartitem.delete({ where: { id: item.id } })

    const cart = await prisma.cart.findUnique({
      where: { id: item.cartId },
      include: cartInclude,
    })

    res.status(200).json({ success: true, data: formatCart(cart) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// CLEAR CART
export const clearCart = async (req, res) => {
  try {
    const cartId = Number(req.params.cartId)
    await prisma.cartitem.deleteMany({ where: { cartId } })
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: cartInclude,
    })
    res.status(200).json({ success: true, data: formatCart(cart) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// CHECKOUT → CREATE ORDER (PUBLIC)
export const checkoutCart = async (req, res) => {
  try {
    const { cartId, notes, orderType } = req.body
    const parsedCartId = Number(cartId)

    const cart = await prisma.cart.findUnique({
      where: { id: parsedCartId },
      include: cartInclude,
    })

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' })
    }

    const items = cart.items.map((row) => ({
      menuItemId: row.menuItemId,
      quantity: row.quantity,
    }))

    const priced = await buildOrderItemsPayload(items, prisma)
    if (priced.error) {
      return res.status(400).json({ success: false, message: priced.error })
    }

    const orderTotal = priced.subTotal + priced.taxAmount

    const order = await prisma.order.create({
      data: {
        tableId: cart.tableId,
        subTotal: priced.subTotal,
        taxAmount: priced.taxAmount,
        total: orderTotal,
        status: 'pending',
        source: 'table',
        orderType: orderType || 'dine-in',
        notes: notes?.trim() || null,
        orderitem: {
          create: priced.orderItemsData,
        },
      },
      include: {
        table: true,
        orderitem: { include: { menuitem: true } },
      },
    })

    await prisma.cartitem.deleteMany({ where: { cartId: cart.id } })
    await prisma.cart.update({
      where: { id: cart.id },
      data: { status: 'completed' },
    })

    await notifyNewOrder(order, null)
    clearOrderListCache()

    res.status(200).json({
      success: true,
      message: 'Order placed',
      data: { orderId: order.id, order },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
