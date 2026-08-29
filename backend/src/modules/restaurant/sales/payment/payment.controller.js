import prisma from '../../../../config/db.js'
import { emitOrderUpdate, emitPaymentSuccess } from '../../../../utils/socketEvents.js'
import { notifyNewOrder } from '../../../../utils/orderNotifications.js'
import { sendWaafiPayment, normalizeWaafiPhone } from '../../../../utils/waafiPayment.js'
import { clearOrderListCache } from '../order/order.controller.js'
import { upsertCustomerByPhone } from '../../../shared/customers/customer.service.js'
import { processCompletedPOSOrderSafely } from '../../../accounting/services/posOrderAccounting.service.js'

// GET AVAILABLE PAYMENT METHODS
export const getPaymentMethods = async (req, res) => {
  try {
    // You can also fetch this from DB if you create a model
    // For now, let's return the standard ones as per the user's screenshot
    const methods = [
      { id: 'evc_plus', name: 'Merchant', icon: 'E', color: '#FFEBEE', textColor: '#D32F2F', available: false },
      { id: 'edahab', name: 'eDahab', icon: 'e', color: '#F1F8E9', textColor: '#388E3C', available: false },
      { id: 'zaad', name: 'ZAAD', icon: 'Z', color: '#E8EAF6', textColor: '#303F9F', available: false },
      { id: 'waafi', name: 'WAAFI', icon: 'W', color: '#E8EAF6', textColor: '#3F51B5', available: true },
      { id: 'sahal', name: 'SAHAL', icon: 'S', color: '#E0F2F1', textColor: '#00796B', available: false },
    ]

    res.status(200).json({
      success: true,
      data: methods
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

const MOBILE_WALLET_METHODS = ['evc_plus', 'edahab', 'premier_wallet', 'waafi']

const generateInternalRef = () => {
  const random = Math.floor(1000 + Math.random() * 9000)
  return `PAY-${Date.now()}-${random}`
}

// ── WAAFI MOBILE MONEY PAYMENT ──────────────────────────────────────────────
/**
 * POST /api/payments/waafi
 * Body: { orderId, phone }
 * 
 * 1. Finds the pending payment for the order (or creates one)
 * 2. Calls the Waafi API to push payment to customer's phone
 * 3. On success → marks payment as paid, closes table, fires sockets
 */
export const processWaafiPayment = async (req, res) => {
  try {
    let { orderId, phone } = req.body

    if (!orderId || !phone) {
      return res.status(400).json({ success: false, message: 'orderId and phone are required' })
    }

    orderId = Number(orderId)
    let normalizedPhone
    try {
      normalizedPhone = normalizeWaafiPhone(phone)
    } catch (phoneErr) {
      return res.status(400).json({ success: false, message: phoneErr.message })
    }

    // ── 1. FIND ORDER ───────────────────────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, table: true, customer: true }
    })

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    if (order.payment && order.payment.status === 'paid') {
      return res.status(409).json({ success: false, message: 'Order is already paid' })
    }

    const internalRef = order.payment?.internalRef || generateInternalRef()

    // ── 2. CREATE / UPDATE PAYMENT RECORD (pending) ─────────────────────────
    let payment
    if (!order.payment) {
      payment = await prisma.payment.create({
        data: {
          orderId,
          amount:      order.total,
          method:      'waafi',
          status:      'pending',
          internalRef,
          providerName: 'WAAFI',
          phone: normalizedPhone
        },
        include: { order: { include: { table: true, customer: true } } }
      })
    } else {
      payment = await prisma.payment.update({
        where: { id: order.payment.id },
        data:  { method: 'waafi', phone: normalizedPhone, status: 'pending' },
        include: { order: { include: { table: true, customer: true } } }
      })
    }

    // ── 3. CALL WAAFI API ───────────────────────────────────────────────────
    const waafiResponse = await sendWaafiPayment({
      transactionId: internalRef,
      accountNo:     normalizedPhone,
      amount:        Number(order.total),
      description:   `Ruut Caffe – Order #${orderId}`
    })

    console.log('Waafi response code:', waafiResponse.responseCode, 'state:', waafiResponse.raw?.params?.state)

    const isSuccess = waafiResponse.isSuccess
    const newStatus = isSuccess ? 'paid' : 'failed'

    // ── 4. UPDATE ORDER AND PAYMENT STATUS ──────────────────────────────────
    if (isSuccess) {
      // Update order status from 'unpaid' to 'pending' (active)
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'pending' }
      })

      // Mobile wallet POS payments keep the table open for more orders
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:      newStatus,
        providerRef: waafiResponse.referenceId || null,
        paidAt:      isSuccess ? new Date() : null
      },
      include: { 
        order: { 
          include: { 
            table: true, 
            customer: true,
            orderitem: { include: { menuitem: true } }
          } 
        } 
      }
    })

    if (!isSuccess) {
      return res.status(402).json({
        success: false,
        message: waafiResponse.userMessage,
        code: waafiResponse.responseCode,
        data:    updatedPayment
      })
    }

    await processCompletedPOSOrderSafely(orderId, 'Waafi payment confirmation')

    // ── 5. NOTIFICATIONS ────────────────────────────────────────────────────
    await prisma.notification.create({
      data: {
        title: 'Payment Successful',
        message: 'Your Waafi payment was processed successfully',
        role: 'customer',
        orderId,
        customerId: updatedPayment.order?.customerId || null,
      },
    })

    await notifyNewOrder(updatedPayment.order, req.user?.id)

    // ── 6. SOCKET EVENTS ────────────────────────────────────────────────────
    emitPaymentSuccess(updatedPayment.order)

    return res.json({
      success: true,
      message: 'Payment processed successfully via Waafi',
      data:    updatedPayment
    })

  } catch (error) {
    console.error('processWaafiPayment Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

// ── PROCESS CHECKOUT PAYMENT FIRST, THEN SAVE ORDER ──────────────────────────
export const processCheckoutPayment = async (req, res) => {
  try {
    const {
      type,
      tableId,
      addressId,
      items,
      notes,
      phone,
      customerName,
      customerPhone
    } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required and must be a non-empty array' })
    }

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Payment phone number is required' })
    }

    let normalizedPhone
    try {
      normalizedPhone = normalizeWaafiPhone(phone)
    } catch (phoneErr) {
      return res.status(400).json({ success: false, message: phoneErr.message })
    }

    // 1. CALCULATE AMOUNT SECURELY FROM DB
    let subTotal = 0
    let taxAmount = 0
    const orderItemsData = []

    for (const item of items) {
      const { menuItemId, quantity } = item
      const menuItem = await prisma.menuitem.findUnique({
        where: { id: Number(menuItemId) }
      })

      if (!menuItem) {
        return res.status(404).json({ success: false, message: `Menu item with ID ${menuItemId} not found` })
      }

      const unitPrice = menuItem.price
      const itemTaxRate = menuItem.tax || 0

      const itemSubtotal = quantity * unitPrice
      const itemTaxAmount = itemSubtotal * (itemTaxRate / 100)

      subTotal += itemSubtotal
      taxAmount += itemTaxAmount

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity,
        unitPrice,
        tax: itemTaxRate
      })
    }

    const totalAmount = subTotal + taxAmount
    const internalRef = generateInternalRef()

    console.log(`Checkout payment → phone: ${normalizedPhone}, amount: $${totalAmount.toFixed(2)}`)

    // 2. CALL WAAFI API DIRECTLY BEFORE PERSISTING ANYTHING
    const waafiResponse = await sendWaafiPayment({
      transactionId: internalRef,
      accountNo:     normalizedPhone,
      amount:        totalAmount,
      description:   `Ruut Caffe – Checkout`
    })

    console.log('Checkout Waafi response code:', waafiResponse.responseCode, 'state:', waafiResponse.raw?.params?.state)

    if (!waafiResponse.isSuccess) {
      return res.status(402).json({
        success: false,
        message: waafiResponse.userMessage,
        code: waafiResponse.responseCode,
      })
    }

    // 3. PAYMENT SUCCESSFUL! CREATE THE ORDER IN DATABASE NOW!
    const resolvedCustomerName =
      customerName?.trim() || req.user?.fullName?.trim() || null
    const resolvedCustomerPhone = customerPhone?.trim() || normalizedPhone
    const normalizedOrderType =
      type === 'eating' ? 'dine-in' : (type || 'dine-in')

    let customer = null
    if (resolvedCustomerName && resolvedCustomerPhone) {
      customer = await upsertCustomerByPhone({ name: resolvedCustomerName, phone: resolvedCustomerPhone })
    }

    const order = await prisma.order.create({
      data: {
        orderType: normalizedOrderType,
        tableId: tableId ? Number(tableId) : null,
        addressId: addressId ? Number(addressId) : null,
        customerId: customer?.id || null,
        userId: req.user?.id || null,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        notes: notes || 'Ordered via App',
        subTotal,
        taxAmount,
        total: totalAmount,
        status: 'pending',
        source: 'mobile',
        orderitem: {
          create: orderItemsData
        }
      },
      include: {
        table: true,
        address: true,
        orderitem: { include: { menuitem: true } }
      }
    })

    // 4. CREATE THE PAYMENT RECORD IN THE DATABASE
    const payment = await prisma.payment.create({
      data: {
        orderId:     order.id,
        amount:      totalAmount,
        method:      'waafi',
        phone:       normalizedPhone,
        status:      'paid',
        internalRef,
        providerRef: waafiResponse.referenceId || null,
        paidAt:      new Date()
      }
    })

    await processCompletedPOSOrderSafely(order.id, 'mobile checkout payment')

    // 5. UPDATE TABLE STATUS
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'active' }
      })
    }

    // 6. NOTIFICATIONS
    await prisma.notification.create({
      data: {
        title: 'Payment Successful',
        message: 'Your Waafi payment was processed successfully. Order is sent to kitchen.',
        role: 'customer',
        orderId: order.id,
        customerId: order.customerId || null,
      },
    })

    await notifyNewOrder(order, req.user?.id)

    // 7. SOCKET EVENTS
    emitPaymentSuccess(order)
    clearOrderListCache()

    return res.status(201).json({
      success: true,
      message: 'Payment processed and Order created successfully!',
      data: order
    })

  } catch (error) {
    console.error('processCheckoutPayment Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

//  CREATE PAYMENT REQUEST (PUBLIC / QR)
export const createPublicPayment = async (req, res) => {
  try {
    let { orderId, method, phone, providerName } = req.body

    if (!orderId || !method) {
      return res.status(400).json({
        success: false,
        message: 'orderId and method are required'
      })
    }

    const parsedOrderId = Number(orderId)

    const order = await prisma.order.findUnique({
      where: { id: parsedOrderId },
      include: { payment: true, table: true, customer: true }
    })

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    if (order.payment) {
      return res.status(409).json({ success: false, message: 'Payment already exists' })
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: parsedOrderId,
        amount: order.total,
        method: method.toLowerCase(),
        status: 'pending',
        internalRef: generateInternalRef(),
        providerName: providerName || method,
        phone
      },
      include: {
        order: { include: { table: true, customer: true } }
      }
    })

    res.status(201).json({ success: true, data: payment })

  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

//  CONFIRM PAYMENT (PUBLIC)
export const confirmPublicPayment = async (req, res) => {
  try {
    const paymentId = Number(req.params.id)
    let { status, providerRef } = req.body

    status = status?.toLowerCase() || 'paid'

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: { table: true, customer: true, orderitem: true }
        }
      }
    })

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' })
    }

    if (payment.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Already paid' })
    }

    if (status === 'paid') {
      // update order status from 'unpaid' to 'pending'
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'pending' }
      })

      // Fetch final fully-populated order with items for socket
      const finalOrder = await prisma.order.findUnique({
        where: { id: payment.orderId },
        include: { 
          table: true, 
          customer: true,
          orderitem: { include: { menuitem: true } }
        }
      })

      // 🔥 UPDATE TABLE
      if (payment.order.tableId) {
        await prisma.table.update({
          where: { id: payment.order.tableId },
          data: { status: 'active' }
        })
      }

      // 🔥 NOTIFICATIONS
      await prisma.notification.create({
        data: {
          title: 'Payment Successful',
          message: 'Your payment was successful',
          role: 'customer',
          orderId: payment.order.id,
          customerId: payment.order.customerId,
        },
      })

      if (finalOrder) {
        await notifyNewOrder(finalOrder, req.user?.id)
        emitPaymentSuccess(finalOrder)
      }
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        providerRef,
        paidAt: status === 'paid' ? new Date() : null
      },
      include: {
        order: { 
          include: { 
            table: true, 
            customer: true,
            orderitem: { include: { menuitem: true } }
          } 
        }
      }
    })

    if (status === 'paid') {
      await processCompletedPOSOrderSafely(payment.orderId, 'public payment confirmation')
    }

    res.json({ success: true, data: updatedPayment })

  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}


//  STAFF PAYMENT (CASH / POS)
export const createPayment = async (req, res) => {
  try {
    const { orderId, method, phone, providerName } = req.body

    const order = await prisma.order.findUnique({
      where: { id: Number(orderId) },
      include: { payment: true, table: true }
    })

    if (!order) return res.status(404).json({ success: false })

    if (order.payment) {
      return res.status(409).json({ success: false, message: 'Already paid' })
    }

    const previousStatus = order.status

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        method: method || 'cash',
        phone: phone?.trim() || null,
        providerName: providerName?.trim() || null,
        status: 'paid',
        internalRef: generateInternalRef(),
        paidAt: new Date()
      },
      include: {
        order: {
          include: {
            table: true,
            orderitem: true,
          },
        },
      },
    })

    await Promise.all([
      req.user?.id && !order.userId
        ? prisma.order.update({
            where: { id: order.id },
            data: { userId: req.user.id },
          })
        : Promise.resolve(),
      order.status !== 'preparing' && order.status !== 'ready' && order.status !== 'served'
        ? prisma.order.update({
            where: { id: order.id },
            data: { status: 'pending' },
          })
        : Promise.resolve(),
      order.tableId && !MOBILE_WALLET_METHODS.includes((method || 'cash').toLowerCase())
        ? prisma.table.update({
            where: { id: order.tableId },
            data: { status: 'active' },
          })
        : Promise.resolve(),
    ])

    await processCompletedPOSOrderSafely(order.id, 'staff POS payment')

    emitPaymentSuccess(payment.order)
    res.json({ success: true, data: payment })

    const fullOrder = payment.order
    void (async () => {
      if (!fullOrder) return
      if (previousStatus === 'unpaid') {
        await notifyNewOrder(fullOrder, req.user?.id)
      } else {
        emitOrderUpdate(fullOrder)
      }
    })().catch((err) => console.error('Post-payment notify:', err))

  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

//  GET ALL PAYMENTS  
export const getAllPayments = async (req, res) => {
  const payments = await prisma.payment.findMany({
    include: {
      order: { include: { table: true, customer: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  res.json({ success: true, data: payments })
}

//  GET PAYMENT BY ID
export const getPaymentById = async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      order: {
        include: {
          table: true,
          customer: true,
          orderitem: { include: { menuitem: true } }
        }
      }
    }
  })

  if (!payment) {
    return res.status(404).json({ success: false })
  }

  res.json({ success: true, data: payment })
}


//  GET PAYMENT BY ORDER ID
export const getPaymentByOrderId = async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { orderId: Number(req.params.orderId) },
    include: {
      order: {
        include: {
          table: true,
          customer: true,
          orderitem: { include: { menuitem: true } }
        }
      }
    }
  })

  if (!payment) {
    return res.status(404).json({ success: false })
  }

  res.json({ success: true, data: payment })
}

//  UPDATE PAYMENT STATUS (ADMIN)
export const updatePaymentStatus = async (req, res) => {
  try {
    const payment = await prisma.payment.update({
      where: { id: Number(req.params.id) },
      data: {
        status: req.body.status,
        paidAt: req.body.status === 'paid' ? new Date() : null
      }
    })

    if (req.body.status === 'paid') {
      await processCompletedPOSOrderSafely(payment.orderId, 'payment status update')
    }

    res.json({ success: true, data: payment })

  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

//  DELETE PAYMENT
export const deletePayment = async (req, res) => {
  await prisma.payment.delete({
    where: { id: Number(req.params.id) }
  })

  res.json({ success: true })
}
