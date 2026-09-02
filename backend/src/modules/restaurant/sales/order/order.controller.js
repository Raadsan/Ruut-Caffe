// import prisma from '../../../../config/db.js'

// // CREATE ORDER (STAFF)
// export const createOrder = async (req, res) => {
//   try {
//     const { tableId, customerName, customerPhone, notes, items } = req.body

//     if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'tableId and items are required'
//       })
//     }

//     const table = await prisma.table.findUnique({
//       where: { id: Number(tableId) }
//     })

//     if (!table) {
//       return res.status(404).json({
//         success: false,
//         message: 'Table not found'
//       })
//     }

//     let total = 0
//     const orderItemsData = []

//     for (const item of items) {
//       const menuItem = await prisma.menuItem.findUnique({
//         where: { id: Number(item.menuItemId) }
//       })

//       if (!menuItem) {
//         return res.status(404).json({
//           success: false,
//           message: `Menu item with id ${item.menuItemId} not found`
//         })
//       }

//       if (!menuItem.isAvailable) {
//         return res.status(400).json({
//           success: false,
//           message: `${menuItem.name} is not available`
//         })
//       }

//       const quantity = Number(item.quantity) || 1
//       const unitPrice = menuItem.price

//       total += quantity * unitPrice

//       orderItemsData.push({
//         menuItemId: menuItem.id,
//         quantity,
//         unitPrice
//       })
//     }

//     let customer = null

//     if (customerName && customerPhone) {
//       customer = await prisma.customer.findUnique({
//         where: { phone: customerPhone.trim() }
//       })

//       if (!customer) {
//         customer = await prisma.customer.create({
//           data: {
//             fullName: customerName.trim(),
//             phone: customerPhone.trim()
//           }
//         })
//       } else {
//         customer = await prisma.customer.update({
//           where: { id: customer.id },
//           data: {
//             fullName: customerName.trim()
//           }
//         })
//       }
//     }

//     const order = await prisma.order.create({
//       data: {
//         tableId: Number(tableId),
//         customerId: customer ? customer.id : null,
//         customerName: customerName || null,
//         customerPhone: customerPhone || null,
//         notes: notes || null,
//         total,
//         status: 'pending',
//         items: {
//           create: orderItemsData
//         }
//       },
//       include: {
//         table: true,
//         customer: true,
//         items: {
//           include: {
//             menuItem: true
//           }
//         }
//       }
//     })

//     await prisma.table.update({
//       where: { id: Number(tableId) },
//       data: {
//         status: 'occupied'
//       }
//     })

//     res.status(201).json({
//       success: true,
//       message: 'Order created successfully',
//       data: order
//     })
//   } catch (error) {
//     console.error('Create Order Error:', error)
//     res.status(500).json({
//       success: false,
//       message: 'Failed to create order',
//       error: error.message
//     })
//   }
// }
// // GET ALL ORDERS
// export const getAllOrders = async (req, res) => {
//   try {
//     const orders = await prisma.order.findMany({
//       include: {
//         table: true,
//         customer: true,
//         items: {
//           include: {
//             menuItem: true
//           }
//         }
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     })

//     res.status(200).json({
//       success: true,
//       count: orders.length,
//       data: orders
//     })
//   } catch (error) {
//     console.error('Get Orders Error:', error)
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch orders',
//       error: error.message
//     })
//   }
// }

// // GET ORDER BY ID
// export const getOrderById = async (req, res) => {
//   try {
//     const { id } = req.params
//     const orderId = parseInt(id)

//     if (isNaN(orderId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid order id'
//       })
//     }

//     const order = await prisma.order.findUnique({
//       where: { id: orderId },
//       include: {
//         table: true,
//         customer: true,
//         items: {
//           include: {
//             menuItem: true
//           }
//         }
//       }
//     })

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: 'Order not found'
//       })
//     }

//     res.status(200).json({
//       success: true,
//       data: order
//     })
//   } catch (error) {
//     console.error('Get Order By Id Error:', error)
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch order',
//       error: error.message
//     })
//   }
// }

// // UPDATE ORDER STATUS
// // export const updateOrderStatus = async (req, res) => {
// //   try {
// //     const { id } = req.params
// //     const { status } = req.body

// //     const orderId = parseInt(id)

// //     if (isNaN(orderId)) {
// //       return res.status(400).json({
// //         success: false,
// //         message: 'Invalid order id'
// //       })
// //     }

// //     const allowedStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled']

// //     if (!status || !allowedStatuses.includes(status)) {
// //       return res.status(400).json({
// //         success: false,
// //         message: 'Invalid status. Allowed: pending, preparing, ready, served, cancelled'
// //       })
// //     }

// //     const existingOrder = await prisma.order.findUnique({
// //       where: { id: orderId }
// //     })

// //     if (!existingOrder) {
// //       return res.status(404).json({
// //         success: false,
// //         message: 'Order not found'
// //       })
// //     }

// //     const updatedOrder = await prisma.order.update({
// //       where: { id: orderId },
// //       data: { status },
// //       include: {
// //         table: true,
// //         customer: true,
// //         items: {
// //           include: {
// //             menuItem: true
// //           }
// //         }
// //       }
// //     })

// //     if (status === 'served' || status === 'cancelled') {
// //       const tableOrders = await prisma.order.findMany({
// //         where: {
// //           tableId: existingOrder.tableId,
// //           status: {
// //             in: ['pending', 'preparing', 'ready']
// //           }
// //         }
// //       })

// //       if (tableOrders.length === 0) {
// //         await prisma.table.update({
// //           where: { id: existingOrder.tableId },
// //           data: { status: 'available' }
// //         })
// //       }
// //     }

// //     res.status(200).json({
// //       success: true,
// //       message: 'Order status updated successfully',
// //       data: updatedOrder
// //     })
// //   } catch (error) {
// //     console.error('Update Order Status Error:', error)
// //     res.status(500).json({
// //       success: false,
// //       message: 'Failed to update order status',
// //       error: error.message
// //     })
// //   }
// // }

// // DELETE ORDER
// export const deleteOrder = async (req, res) => {
//   try {
//     const { id } = req.params
//     const orderId = parseInt(id)

//     if (isNaN(orderId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid order id'
//       })
//     }

//     const existingOrder = await prisma.order.findUnique({
//       where: { id: orderId },
//       include: {
//         items: true
//       }
//     })

//     if (!existingOrder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Order not found'
//       })
//     }

//     await prisma.orderItem.deleteMany({
//       where: { orderId }
//     })

//     await prisma.order.delete({
//       where: { id: orderId }
//     })

//     const remainingOrders = await prisma.order.findMany({
//       where: {
//         tableId: existingOrder.tableId,
//         status: {
//           in: ['pending', 'preparing', 'ready']
//         }
//       }
//     })

//     if (remainingOrders.length === 0) {
//       await prisma.table.update({
//         where: { id: existingOrder.tableId },
//         data: { status: 'available' }
//       })
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Order deleted successfully'
//     })
//   } catch (error) {
//     console.error('Delete Order Error:', error)
//     res.status(500).json({
//       success: false,
//       message: 'Failed to delete order',
//       error: error.message
//     })
//   }
// }

// // GET ORDERS BY TABLE
// export const getOrdersByTable = async (req, res) => {
//   try {
//     const { tableId } = req.params
//     const id = parseInt(tableId)

//     if (isNaN(id)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid table id'
//       })
//     }

//     const orders = await prisma.order.findMany({
//       where: {
//         tableId: id
//       },
//       include: {
//         table: true,
//         customer: true,
//         items: {
//           include: {
//             menuItem: true
//           }
//         }
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     })

//     res.status(200).json({
//       success: true,
//       count: orders.length,
//       data: orders
//     })
//   } catch (error) {
//     console.error('Get Orders By Table Error:', error)
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch orders by table',
//       error: error.message
//     })
//   }
// }

// // CREATE PUBLIC ORDER (CUSTOMER)
// export const createPublicOrder = async (req, res) => {
//   try {
//     const { tableId, items } = req.body

//     if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "tableId and items are required"
//       })
//     }

//     const result = await prisma.$transaction(async (tx) => {

//       // 1. CHECK TABLE
//       const table = await tx.table.findUnique({
//         where: { id: Number(tableId) }
//       })

//       if (!table) {
//         throw new Error("Table not found")
//       }

//       let total = 0
//       const orderItemsData = []

//       // 2. VALIDATE MENU ITEMS + CALCULATE TOTAL
//       for (const item of items) {
//         const menuItem = await tx.menuItem.findUnique({
//           where: { id: Number(item.menuItemId) }
//         })

//         if (!menuItem) {
//           throw new Error(`Menu item ${item.menuItemId} not found`)
//         }

//         if (!menuItem.isAvailable) {
//           throw new Error(`${menuItem.name} is not available`)
//         }

//         const quantity = Number(item.quantity) || 1
//         const unitPrice = menuItem.price

//         total += quantity * unitPrice

//         orderItemsData.push({
//           menuItemId: menuItem.id,
//           quantity,
//           unitPrice
//         })
//       }

//       // 3. CREATE ORDER
//       const order = await tx.order.create({
//         data: {
//           tableId: Number(tableId),
//           total,
//           status: "pending",
//           items: {
//             create: orderItemsData
//           }
//         },
//         include: {
//           items: true
//         }
//       })

//       // 4. STOCK AUTO-DEDUCTION
//       for (const item of orderItemsData) {

//         const bomItems = await tx.menuItemBOM.findMany({
//           where: { menuItemId: item.menuItemId }
//         })

//         for (const bom of bomItems) {

//           const totalRequired = bom.quantity * item.quantity

//           const ingredient = await tx.ingredient.findUnique({
//             where: { id: bom.ingredientId }
//           })

//           if (!ingredient || ingredient.stockQuantity < totalRequired) {
//             throw new Error(
//               `Not enough stock for ingredient ID ${bom.ingredientId}`
//             )
//           }

//           // UPDATE STOCK
//           await tx.ingredient.update({
//             where: { id: bom.ingredientId },
//             data: {
//               stockQuantity: {
//                 decrement: totalRequired
//               }
//             }
//           })

//           // STOCK MOVEMENT LOG
//           await tx.stockMovement.create({
//             data: {
//               ingredientId: bom.ingredientId,
//               type: "out",
//               quantity: totalRequired,
//               note: `Auto deduction for order ${order.id}`
//             }
//           })
//         }
//       }

//       // 5. UPDATE TABLE STATUS
//       await tx.table.update({
//         where: { id: Number(tableId) },
//         data: { status: "occupied" }
//       })

//       return order
//     })

//     res.status(201).json({
//       success: true,
//       message: "Order created successfully with stock deduction",
//       data: result
//     })

//   } catch (error) {
//     console.error("Create Public Order Error:", error)

//     res.status(500).json({
//       success: false,
//       message: error.message
//     })
//   }
// }

// // UPDATE ORDER STATUS
// export const updateOrderStatus = async (req, res) => {
//   try {
//     const { id } = req.params
//     const { status } = req.body

//     const orderId = parseInt(id)

//     if (isNaN(orderId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid order id'
//       })
//     }

//     const allowedStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled']

//     if (!status || !allowedStatuses.includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid status. Allowed: pending, preparing, ready, served, cancelled'
//       })
//     }

//     const existingOrder = await prisma.order.findUnique({
//       where: { id: orderId },
//       include: {
//         table: true,
//         customer: true,
//         items: {
//           include: {
//             menuItem: true
//           }
//         }
//       }
//     })

//     if (!existingOrder) {
//       return res.status(404).json({
//         success: false,
//         message: 'Order not found'
//       })
//     }

//     const updatedOrder = await prisma.order.update({
//       where: { id: orderId },
//       data: { status },
//       include: {
//         table: true,
//         customer: true,
//         items: {
//           include: {
//             menuItem: true
//           }
//         }
//       }
//     })

//     // NOTIFICATIONS BY STATUS
//     if (status === 'preparing') {
//   await prisma.notification.createMany({
//     data: [
//       {
//         title: 'Order Preparing',
//         message: `Kitchen started preparing order for Table ${updatedOrder.table.number}`,
//         role: 'admin',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Preparing',
//         message: `Kitchen started preparing order for Table ${updatedOrder.table.number}`,
//         role: 'manager',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Preparing',
//         message: 'Kitchen is preparing your order',
//         role: 'customer',
//         orderId: updatedOrder.id,
//         customerId: updatedOrder.customerId
//       }
//     ]
//   })
// }

//     if (status === 'ready') {
//   await prisma.notification.createMany({
//     data: [
//       {
//         title: 'Order Ready',
//         message: `Order for Table ${updatedOrder.table.number} is ready`,
//         role: 'waiter',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Ready',
//         message: `Order for Table ${updatedOrder.table.number} is ready`,
//         role: 'admin',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Ready',
//         message: `Order for Table ${updatedOrder.table.number} is ready`,
//         role: 'manager',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Ready',
//         message: 'Your order is ready',
//         role: 'customer',
//         orderId: updatedOrder.id,
//         customerId: updatedOrder.customerId
//       }
//     ]
//   })
// }

//     if (status === 'served') {
//   await prisma.notification.createMany({
//     data: [
//       {
//         title: 'Order Served',
//         message: `Order for Table ${updatedOrder.table.number} has been served`,
//         role: 'admin',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Served',
//         message: `Order for Table ${updatedOrder.table.number} has been served`,
//         role: 'manager',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Served',
//         message: 'Your order has been served',
//         role: 'customer',
//         orderId: updatedOrder.id,
//         customerId: updatedOrder.customerId
//       }
//     ]
//   })
// }

//    if (status === 'cancelled') {
//   await prisma.notification.createMany({
//     data: [
//       {
//         title: 'Order Cancelled',
//         message: `Order for Table ${updatedOrder.table.number} was cancelled`,
//         role: 'admin',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Cancelled',
//         message: `Order for Table ${updatedOrder.table.number} was cancelled`,
//         role: 'manager',
//         orderId: updatedOrder.id
//       },
//       {
//         title: 'Order Cancelled',
//         message: 'Your order was cancelled',
//         role: 'customer',
//         orderId: updatedOrder.id,
//         customerId: updatedOrder.customerId
//       }
//     ]
//   })
// }

//     // UPDATE TABLE STATUS IF ORDER FINISHED
//     if (status === 'served' || status === 'cancelled') {
//       const activeOrders = await prisma.order.findMany({
//         where: {
//           tableId: existingOrder.tableId,
//           status: {
//             in: ['pending', 'preparing', 'ready']
//           }
//         }
//       })

//       if (activeOrders.length === 0) {
//         await prisma.table.update({
//           where: { id: existingOrder.tableId },
//           data: { status: 'available' }
//         })
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Order status updated successfully',
//       data: updatedOrder
//     })
//   } catch (error) {
//     console.error('Update Order Status Error:', error)
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update order status',
//       error: error.message
//     })
//   }
// }



import prisma from '../../../../config/db.js'
import { emitOrderUpdate, emitPaymentSuccess } from '../../../../utils/socketEvents.js'
import { notifyNewOrder, notifyOrderReady, notifyCustomerOrderStatus } from '../../../../utils/orderNotifications.js'
import { logAudit } from '../../../../utils/auditHelper.js'
import { sendWaafiPayment, normalizeWaafiPhone } from '../../../../utils/waafiPayment.js'
import { clearTablesCache } from '../../operations/table/table.controller.js'
import { clearReportCache } from '../../reporting/report/report.controller.js'
import { buildOrderItemsPayload } from '../../../../utils/compositeMenuHelper.js'
import { upsertCustomerByPhone } from '../../../shared/customers/customer.service.js'
import { processCompletedPOSOrderSafely } from '../../../accounting/services/posOrderAccounting.service.js'

const MOBILE_WALLET_METHODS = ['evc_plus', 'edahab', 'premier_wallet', 'waafi']

const generateInternalRef = () => {
  const random = Math.floor(1000 + Math.random() * 9000)
  return `PAY-${Date.now()}-${random}`
}

const orderListCache = new Map()
const orderListInflight = new Map()
const ORDER_LIST_TTL_MS = 90 * 1000

function orderListCacheKey(req) {
  const { status, onlyMine, readyPickup, waiterHistory, posQueue, kitchenQueue, includeServed, startDate, endDate, limit } = req.query
  return `${req.user?.id || 0}:${status || ''}:${onlyMine || ''}:${readyPickup || ''}:${waiterHistory || ''}:${posQueue || ''}:${kitchenQueue || ''}:${includeServed || ''}:${startDate || ''}:${endDate || ''}:${limit || ''}`
}

function parseOrderLimit(req, fallback = 80) {
  const parsed = parseInt(req.query.limit, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, 200)
}

export const clearOrderListCache = () => {
  orderListCache.clear()
  orderListInflight.clear()
  clearReportCache()
}

/**
 * 🔥 CREATE ORDER (STAFF)
 */
export const createOrder = async (req, res) => {
  try {
    const {
      tableId,
      addressId,
      type,
      customerName,
      customerPhone,
      notes,
      items,
      discountAmount: discountAmountInput,
      discountType,
      discountValue,
    } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'items are required'
      })
    }

    // Validation based on type
    /* Relaxed table requirement for POS flexibility */
    if (type === 'delivery' && !addressId) {
      return res.status(400).json({ success: false, message: 'addressId is required for delivery orders' })
    }

    let table = null
    if (tableId) {
      table = await prisma.table.findUnique({
        where: { id: Number(tableId) }
      })

      if (!table) {
        return res.status(404).json({
          success: false,
          message: 'Table not found'
        })
      }
    }

    let subTotal = 0
    let taxAmount = 0
    const priced = await buildOrderItemsPayload(items, prisma)
    if (priced.error) {
      return res.status(400).json({ success: false, message: priced.error })
    }
    subTotal = priced.subTotal
    taxAmount = priced.taxAmount
    const orderItemsData = priced.orderItemsData

    let customer = null

    if (customerName && customerPhone) {
      customer = await upsertCustomerByPhone({ name: customerName.trim(), phone: customerPhone.trim() })
    }

    const discountAmount = Math.max(0, Number(discountAmountInput) || 0)
    const parsedDiscountValue = Math.max(0, Number(discountValue) || 0)
    const orderTotal = Math.max(0, subTotal + taxAmount - discountAmount)

    const order = await prisma.order.create({
      data: {
        orderType: type || 'dine-in',
        tableId: tableId ? Number(tableId) : null,
        addressId: addressId ? Number(addressId) : null,
        customerId: customer?.id || null,
        userId: req.user?.id || null,
        customerName,
        customerPhone,
        notes,
        subTotal,
        taxAmount,
        discountAmount,
        discountType: discountAmount > 0 ? (discountType || null) : null,
        discountValue: discountAmount > 0 ? parsedDiscountValue : 0,
        total: orderTotal,
        status: req.body.status || 'pending',
        source: req.body.source || 'pos',
        orderitem: {
          create: orderItemsData
        }
      },
      include: {
        table: true,
        address: true,
        orderitem: { 
          include: { 
            menuitem: {
              select: {
                id: true,
                name: true,
                price: true,
                costPrice: true,
                tax: true,
                categoryId: true,
                isAvailable: true
              }
            } 
          } 
        }
      }
    })

    // Table stays active/inactive only — no separate "occupied" status
    // (orders track table usage; admin sets inactive to disable a table)

    /* 
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'pending'
      }
    })
    */

    if (order.status === 'pending' || order.status === 'paid') {
      await notifyNewOrder(order, req.user?.id)
    }

    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'Order', entityId: order.id, description: `Created order #${order.id} for table ${table?.number || 'N/A'}` })

    clearOrderListCache()

    res.status(201).json({
      success: true,
      data: order
    })

  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * POS checkout — create order + payment in one request (faster than two round trips).
 */
export const createPosCheckout = async (req, res) => {
  try {
    const {
      tableId,
      addressId,
      type,
      customerName,
      customerPhone,
      notes,
      items,
      discountAmount: discountAmountInput,
      discountType,
      discountValue,
      paymentMethod,
      paymentPhone,
      providerName,
    } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items are required' })
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'paymentMethod is required' })
    }

    if (type === 'delivery' && !addressId) {
      return res.status(400).json({ success: false, message: 'addressId is required for delivery orders' })
    }

    if (tableId) {
      const table = await prisma.table.findUnique({ where: { id: Number(tableId) } })
      if (!table) {
        return res.status(404).json({ success: false, message: 'Table not found' })
      }
    }

    const priced = await buildOrderItemsPayload(items, prisma, { allowOverrides: true })
    if (priced.error) {
      return res.status(400).json({ success: false, message: priced.error })
    }
    const { subTotal, taxAmount, orderItemsData } = priced

    let customer = null
    if (customerName && customerPhone) {
      customer = await upsertCustomerByPhone({ name: customerName.trim(), phone: customerPhone.trim() })
    }

    const discountAmount = Math.max(0, Number(discountAmountInput) || 0)
    const parsedDiscountValue = Math.max(0, Number(discountValue) || 0)
    const orderTotal = Math.max(0, subTotal + taxAmount - discountAmount)

    const method = String(paymentMethod).toLowerCase()
    let phone = paymentPhone?.trim() || customerPhone?.trim() || null
    const internalRef = generateInternalRef()

    if (method === 'premier_wallet' && !phone) {
      return res.status(400).json({ success: false, message: 'Phone required for Premier Wallet payment' })
    }

    let waafiResponse = null
    if (method === 'premier_wallet') {
      try {
        phone = normalizeWaafiPhone(phone)
      } catch (phoneErr) {
        return res.status(400).json({ success: false, message: phoneErr.message })
      }

      waafiResponse = await sendWaafiPayment({
        transactionId: internalRef,
        accountNo: phone,
        amount: orderTotal,
        description: 'Ruut Caffe – POS Order',
      })

      if (!waafiResponse.isSuccess) {
        return res.status(402).json({
          success: false,
          message: waafiResponse.userMessage,
          code: waafiResponse.responseCode,
        })
      }
    }

    const order = await prisma.order.create({
      data: {
        orderType: type || 'dine-in',
        tableId: tableId ? Number(tableId) : null,
        addressId: addressId ? Number(addressId) : null,
        customerId: customer?.id || null,
        userId: req.user?.id || null,
        customerName,
        customerPhone,
        notes,
        subTotal,
        taxAmount,
        discountAmount,
        discountType: discountAmount > 0 ? discountType || null : null,
        discountValue: discountAmount > 0 ? parsedDiscountValue : 0,
        total: orderTotal,
        // Takeaway from POS is served immediately (no kitchen steps needed)
        // Mobile orders (source='mobile') keep the full pending→preparing→ready→served flow
        status: (type === 'takeaway' && (req.body.source || 'pos') !== 'mobile') ? 'served' : 'pending',
        source: req.body.source || 'pos',
        orderitem: { create: orderItemsData },
        payment: {
          create: {
            amount: orderTotal,
            method: method === 'premier_wallet' ? 'waafi' : method,
            phone,
            providerName: providerName?.trim() || null,
            status: 'paid',
            internalRef,
            providerRef: waafiResponse?.referenceId || null,
            paidAt: new Date(),
          },
        },
      },
      include: orderListLightInclude,
    })

    await processCompletedPOSOrderSafely(order.id, 'POS checkout payment')

    clearOrderListCache()
    emitPaymentSuccess(order)

    res.status(201).json({
      success: true,
      data: order,
    })

    void Promise.all([
      order.tableId && !MOBILE_WALLET_METHODS.includes(method)
        ? prisma.table.update({
            where: { id: order.tableId },
            data: { status: 'active' },
          }).then(() => clearTablesCache())
        : Promise.resolve(),
      prisma.order
        .findUnique({
          where: { id: order.id },
          include: { table: true, orderitem: true },
        })
        .then((fullOrder) =>
          fullOrder ? notifyNewOrder(fullOrder, req.user?.id) : Promise.resolve()
        ),
      logAudit({
        userId: req.user?.id,
        action: 'Created',
        entity: 'Order',
        entityId: order.id,
        description: `Checkout order #${order.id}`,
      }),
    ]).catch((err) => console.error('Post-checkout side effects:', err))
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

///////////////////////////////////////////////////////////////

/**
 * 🔥 UPDATE ORDER STATUS (FULL + SOCKET)
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: { table: true, customer: true }
    })

    if (!order) {
      return res.status(404).json({ success: false })
    }

    const userRole = req.user?.role?.toLowerCase()?.trim()

    if (userRole === 'kitchen' || userRole === 'pos') {
      // Takeaway: allow direct jump to served (skip kitchen steps)
      const isTakeaway = order.orderType === 'takeaway'
      const directServeAllowed =
        isTakeaway &&
        (order.status === 'pending' || order.status === 'paid') &&
        status === 'served'

      const kitchenAllowed =
        (order.status === 'pending' && status === 'preparing') ||
        (order.status === 'paid' && status === 'preparing') ||
        (order.status === 'preparing' && status === 'ready')
      const posServeAllowed =
        userRole === 'pos' &&
        order.status === 'ready' &&
        status === 'served'

      if (!kitchenAllowed && !posServeAllowed && !directServeAllowed) {
        return res.status(400).json({
          success: false,
          message:
            userRole === 'pos'
              ? 'POS can move pending/paid → preparing, preparing → ready, or mark ready orders as served'
              : 'Kitchen can only move pending/paid → preparing or preparing → ready',
        })
      }
    }

    if (userRole === 'waiter') {
      const allowed = order.status === 'ready' && status === 'served'
      if (!allowed) {
        return res.status(400).json({
          success: false,
          message: 'Waiter can only mark ready orders as served',
        })
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status },
      include: {
        table: true,
        customer: true,
        orderitem: { include: { menuitem: true } }
      }
    })

    if (status === 'completed') {
      await processCompletedPOSOrderSafely(updatedOrder.id, 'order completion')
    }

    /*
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status
      }
    })
    */

    if (status === 'ready') {
      await notifyOrderReady(updatedOrder, req.user?.id)
    } else if (updatedOrder.userId) {
      await notifyCustomerOrderStatus(updatedOrder, order.status)
    }

    // 🔥 TABLE FREE
    if ((status === 'served' || status === 'cancelled') && order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'active' }
      })
      clearTablesCache()
    }

    // 🔥 SOCKET → WAITER/KITCHEN
    emitOrderUpdate(updatedOrder)

    logAudit({ userId: req.user?.id, action: 'Status Changed', entity: 'Order', entityId: updatedOrder.id, description: `Order #${updatedOrder.id} status changed to "${status}"` })

    clearOrderListCache()

    res.status(200).json({
      success: true,
      data: updatedOrder
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * 🔥 UPDATE ORDER DETAILS (ITEMS, TABLE, ETC)
 */
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params
    const { tableId, addressId, type, customerName, customerPhone, notes, items } = req.body

    const orderId = Number(id)
    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id' })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items are required' })
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    const priced = await buildOrderItemsPayload(items, prisma)
    if (priced.error) {
      return res.status(400).json({ success: false, message: priced.error })
    }
    const total = priced.subTotal + priced.taxAmount
    const orderItemsData = priced.orderItemsData

    // Delete old items
    await prisma.orderitem.deleteMany({
      where: { orderId: orderId }
    })

    // Update customer if needed
    let customer = null
    if (customerName && customerPhone) {
      customer = await upsertCustomerByPhone({ name: customerName.trim(), phone: customerPhone.trim() })
    }

    // Update order and create new items
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        orderType: type || existingOrder.orderType,
        tableId: tableId ? Number(tableId) : existingOrder.tableId,
        addressId: addressId ? Number(addressId) : existingOrder.addressId,
        customerId: customer?.id || existingOrder.customerId,
        customerName: customerName || existingOrder.customerName,
        customerPhone: customerPhone || existingOrder.customerPhone,
        notes: notes || existingOrder.notes,
        total,
        orderitem: {
          create: orderItemsData
        }
      },
      include: orderListInclude,
    })

    emitOrderUpdate(updatedOrder)

    logAudit({ userId: req.user?.id, action: 'Updated', entity: 'Order', entityId: updatedOrder.id, description: `Updated order #${updatedOrder.id}` })

    clearOrderListCache()

    res.status(200).json({
      success: true,
      data: updatedOrder
    })
  } catch (error) {
    console.error('Update Order Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}


///////////////////////////////////////////////////////////////

const orderUserInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      role: { select: { id: true, name: true } },
    },
  },
}

const orderListInclude = {
  table: {
    select: {
      id: true,
      number: true,
    },
  },
  address: true,
  ...orderUserInclude,
  orderitem: {
    include: {
      menuitem: {
        select: {
          id: true,
          name: true,
          price: true,
          costPrice: true,
          tax: true,
          categoryId: true,
          isAvailable: true,
          imageUrl: true,
          description: true,
        },
      },
    },
  },
}

const orderListLightInclude = {
  table: {
    select: {
      id: true,
      number: true,
    },
  },
  address: {
    select: { id: true, street: true, district: true, name: true, phone: true },
  },
  ...orderUserInclude,
  orderitem: {
    include: {
      menuitem: {
        select: { id: true, name: true, price: true, imageUrl: true, tax: true },
      },
    },
  },
}

/**
 * Lightweight queue counts for POS header badges (no full order payload).
 */
export const getOrderQueueCounts = async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase()
    if (role !== 'pos' && role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }

    const [kitchenCount, readyCount] = await Promise.all([
      prisma.order.count({
        where: { status: { in: ['pending', 'paid', 'preparing'] } },
      }),
      prisma.order.count({
        where: {
          status: 'ready',
          tableId: { not: null },
        },
      }),
    ])

    res.json({
      success: true,
      data: { kitchenCount, readyCount },
    })
  } catch (error) {
    console.error('Get Order Queue Counts Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * 🔥 GET ALL ORDERS
 */
export const getAllOrders = async (req, res) => {
  try {
    const cacheKey = orderListCacheKey(req)
    const userRole = req.user?.role?.toLowerCase()?.trim()
    const isClientRole = userRole === 'client' || userRole === 'customer'
    const ttl = isClientRole ? 3000 : ORDER_LIST_TTL_MS
    const now = Date.now()
    const cached = orderListCache.get(cacheKey)

    if (cached && now - cached.at < ttl) {
      return res.json({ success: true, data: cached.data })
    }

    const pending = orderListInflight.get(cacheKey)
    if (pending) {
      const orders = await pending
      return res.json({ success: true, data: orders })
    }

    const { status, onlyMine, readyPickup, startDate, endDate } = req.query
    const isWaiterHistory = req.query.waiterHistory === 'true'

    const where = {}
    if (status) where.status = status
    if (startDate || endDate) {
      const createdAt = {}
      if (startDate) {
        const start = new Date(startDate)
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid startDate' })
        }
        createdAt.gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid endDate' })
        }
        createdAt.lte = end
      }
      where.createdAt = createdAt
    }

    let useLightInclude = false
    let takeLimit

    if (userRole === 'waiter' && readyPickup === 'true') {
      where.status = 'ready'
      where.orderType = 'dine-in'
      useLightInclude = true
      takeLimit = 80
    } else if (userRole === 'pos' && req.query.kitchenQueue === 'true') {
      const includeServed = req.query.includeServed === 'true'
      where.status = includeServed
        ? { in: ['pending', 'paid', 'preparing', 'ready', 'served', 'cancelled', 'completed'] }
        : { in: ['pending', 'paid', 'preparing', 'ready'] }
      useLightInclude = true
      takeLimit = includeServed ? 200 : 150
    } else if (userRole === 'pos' && req.query.posQueue === 'true') {
      where.orderType = { in: ['takeaway', 'delivery'] }
      where.status = { in: ['pending', 'paid', 'preparing', 'ready'] }
      useLightInclude = true
      takeLimit = 120
    } else if (userRole === 'pos' && readyPickup === 'true') {
      where.status = 'ready'
      where.orderType = { in: ['takeaway', 'delivery'] }
      useLightInclude = true
      takeLimit = 80
    } else if (userRole === 'waiter' && isWaiterHistory) {
      where.userId = req.user.id
      where.status = 'served'
      useLightInclude = true
      takeLimit = parseOrderLimit(req, 100)
    } else if (userRole === 'kitchen') {
      where.status = { in: ['pending', 'paid', 'preparing', 'ready'] }
      useLightInclude = true
      takeLimit = parseOrderLimit(req, 100)
    } else {
      const ownOrdersOnly = ['client', 'customer', 'waiter']
      if (ownOrdersOnly.includes(userRole)) {
        const conditions = []
        if (req.user?.id) conditions.push({ userId: req.user.id })
        if (req.user?.phone) conditions.push({ customerPhone: req.user.phone })
        if (conditions.length > 0) {
          where.OR = conditions
        }
      } else if (onlyMine === 'true' && req.user?.id) {
        where.userId = req.user.id
      }
      useLightInclude = true
      takeLimit = parseOrderLimit(req, 80)
    }

    const fifoQueue =
      userRole === 'kitchen' ||
      (userRole === 'pos' &&
        (req.query.kitchenQueue === 'true' || req.query.posQueue === 'true'))

    const fetchPromise = prisma.order
      .findMany({
        where,
        include: useLightInclude ? orderListLightInclude : orderListInclude,
        orderBy: { createdAt: fifoQueue ? 'asc' : 'desc' },
        ...(takeLimit ? { take: takeLimit } : {}),
      })
      .then((orders) => {
        orderListCache.set(cacheKey, { data: orders, at: Date.now() })
        orderListInflight.delete(cacheKey)
        return orders
      })
      .catch((err) => {
        orderListInflight.delete(cacheKey)
        throw err
      })

    orderListInflight.set(cacheKey, fetchPromise)
    const orders = await fetchPromise

    res.json({ success: true, data: orders })
  } catch (error) {
    console.error('Get All Orders Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * 🔥 GET ORDER BY ID
 */
export const getOrderById = async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    include: orderListInclude,
  })

  if (!order) return res.status(404).json({ success: false })

  res.json({ success: true, data: order })
}

/**
 * 🔥 DELETE ORDER
 */
export const deleteOrder = async (req, res) => {
  const id = Number(req.params.id)

  await prisma.orderitem.deleteMany({ where: { orderId: id } })
  await prisma.order.delete({ where: { id } })

  logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'Order', entityId: id, description: `Deleted order #${id}` })

  clearOrderListCache()

  res.json({ success: true })
}

export const getOrdersByTable = async (req, res) => {
  try {
    const { tableId } = req.params

    const id = Number(tableId)

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table id'
      })
    }

    const orders = await prisma.order.findMany({
      where: { tableId: id },
      include: {
        table: true,
        customer: true,
        orderitem: {
          include: { 
            menuitem: {
              select: {
                id: true,
                name: true,
                price: true,
                costPrice: true,
                tax: true,
                categoryId: true,
                isAvailable: true,
                imageUrl: true,
                description: true,
              }
            } 
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({
      success: true,
      data: orders
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}
