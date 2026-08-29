import prisma from "../../../../config/db.js"

const notifCache = new Map()
const NOTIF_CACHE_TTL = 60 * 1000

function lightEnrichNotifications(notifications) {
  return notifications.map((n) => {
    const { sender: _prismaSender, ...rest } = n
    return {
      ...rest,
      sender: toSenderDto(null, n.senderName, n.senderAvatarUrl, n.senderId),
    }
  })
}

function buildRoleWhere(req) {
  const role = req.user.role?.toLowerCase()

  if (role === 'admin' || role === 'manager') {
    return {}
  }

  if (role === 'waiter') {
    return {
      role: 'waiter',
      OR: [{ userId: null }, { userId: req.user.id }],
    }
  }

  if (role === 'kitchen') {
    return { role: 'kitchen' }
  }

  if (role === 'pos' || role === 'cashier') {
    return { role: 'pos' }
  }

  return { role }
}

const senderSelect = {
  id: true,
  fullName: true,
  avatarUrl: true,
}

function toSenderDto(user, fallbackName, fallbackAvatar, fallbackId) {
  const safeAvatar = (url) =>
    typeof url === 'string' && url.length > 0 && !url.startsWith('data:') && url.length < 512
      ? url
      : null

  if (user) {
    return {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: safeAvatar(user.avatarUrl),
    }
  }
  if (fallbackName) {
    return {
      id: fallbackId || 0,
      fullName: fallbackName,
      avatarUrl: safeAvatar(fallbackAvatar),
    }
  }
  return null
}

async function enrichNotificationsWithSenders(notifications) {
  const needsLookup = notifications.filter(
    (n) => !n.senderName && !n.sender?.fullName
  )

  const senderIds = [
    ...new Set(
      needsLookup.map((n) => n.senderId).filter(Boolean)
    ),
  ]

  const orderIds = [
    ...new Set(
      needsLookup.filter((n) => n.orderId).map((n) => n.orderId)
    ),
  ]

  const [usersBySenderId, orders, auditLogs] = await Promise.all([
    senderIds.length
      ? prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: senderSelect,
        })
      : [],
    orderIds.length
      ? prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            userId: true,
            user: { select: senderSelect },
          },
        })
      : [],
    orderIds.length
      ? prisma.auditlog.findMany({
          where: {
            entity: 'Order',
            entityId: { in: orderIds },
            userId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            entityId: true,
            action: true,
            description: true,
            user: { select: senderSelect },
          },
        })
      : [],
  ])

  const senderIdMap = new Map(usersBySenderId.map((u) => [u.id, u]))
  const orderUserMap = new Map(
    orders.filter((o) => o.user).map((o) => [o.id, o.user])
  )

  const auditByOrder = new Map()
  for (const log of auditLogs) {
    if (!log.entityId || !log.user) continue
    const list = auditByOrder.get(log.entityId) || []
    list.push(log)
    auditByOrder.set(log.entityId, list)
  }

  function pickAuditUser(orderId, title) {
    const logs = auditByOrder.get(orderId) || []
    const t = (title || '').toLowerCase()

    if (t.includes('ready')) {
      const readyLog = logs.find(
        (l) =>
          l.action === 'Status Changed' &&
          (l.description || '').toLowerCase().includes('ready')
      )
      if (readyLog?.user) return readyLog.user
    }

    if (t.includes('new order') || t.includes('payment')) {
      const createdLog = logs.find((l) => l.action === 'Created')
      if (createdLog?.user) return createdLog.user
    }

    const statusLog = logs.find((l) => l.action === 'Status Changed')
    if (statusLog?.user) return statusLog.user

    return logs[0]?.user || null
  }

  return notifications.map((n) => {
    const { sender: _prismaSender, ...rest } = n

    if (n.senderName) {
      return {
        ...rest,
        sender: toSenderDto(null, n.senderName, n.senderAvatarUrl, n.senderId),
      }
    }

    let user =
      n.sender ||
      (n.senderId ? senderIdMap.get(n.senderId) : null) ||
      (n.orderId ? orderUserMap.get(n.orderId) : null) ||
      (n.orderId ? pickAuditUser(n.orderId, n.title) : null)

    return {
      ...rest,
      sender: toSenderDto(user, null, null, null),
    }
  })
}

// GET MY NOTIFICATIONS (role-aware)
export const getMyNotifications = async (req, res) => {
  try {
    const light = req.query.light === '1' || req.query.light === 'true'
    const cacheKey = `${req.user.id}:${req.user.role?.toLowerCase()}:${light ? 'light' : 'full'}`
    const cached = notifCache.get(cacheKey)
    if (cached && Date.now() - cached.at < NOTIF_CACHE_TTL) {
      return res.status(200).json(cached.payload)
    }

    const where = buildRoleWhere(req)

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const data = light
      ? lightEnrichNotifications(notifications)
      : await enrichNotificationsWithSenders(notifications)

    const payload = {
      success: true,
      count: data.length,
      data,
    }

    notifCache.set(cacheKey, { payload, at: Date.now() })

    res.status(200).json(payload)
  } catch (error) {
    console.error('Get My Notifications Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    })
  }
}

// GET MY NOTIFICATIONS BY LOGGED IN USER ROLE
export const getAllNotifications = async (req, res) => {
  try {
    const where = buildRoleWhere(req)

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      }
    })

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    })
  } catch (error) {
    console.error("Get Notifications Error:", error)

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message
    })
  }
}

// KITCHEN STAFF → GET KITCHEN NOTIFICATIONS
export const getKitchenNotifications = async (req, res) => {

  try {

    const notifications = await prisma.notification.findMany({
      where: {
        role: "kitchen"
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    })

  } catch (error) {

    console.error("Kitchen Notification Error:", error)

    res.status(500).json({
      success: false,
      message: "Failed to fetch kitchen notifications",
      error: error.message
    })

  }

}

// WAITER → GET WAITER NOTIFICATIONS
export const getWaiterNotifications = async (req, res) => {

  try {

    const notifications = await prisma.notification.findMany({
      where: {
        role: "waiter",
        OR: [{ userId: null }, { userId: req.user.id }],
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    })

  } catch (error) {

    console.error("Waiter Notification Error:", error)

    res.status(500).json({
      success: false,
      message: "Failed to fetch waiter notifications",
      error: error.message
    })

  }

}

// MARK NOTIFICATION AS READ
export const markNotificationRead = async (req, res) => {

  try {

    const { id } = req.params

    const notification = await prisma.notification.update({
      where: {
        id: Number(id)
      },
      data: {
        isRead: true
      }
    })

    notifCache.clear()

    res.status(200).json({
      success: true,
      data: notification
    })

  } catch (error) {

    console.error("Mark Notification Error:", error)

    res.status(500).json({
      success: false,
      message: error.message
    })

  }

}

// CUSTOMER NOTIFICATIONS BY CUSTOMER ID
export const getCustomerNotifications = async (req, res) => {
  try {
    const { customerId } = req.params
    const id = Number(customerId)

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id"
      })
    }

    const customer = await prisma.customers.findUnique({
      where: { id }
    })

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      })
    }

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { customerId: id },
          { role: "customer", customerId: null }
        ]
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    res.status(200).json({
      success: true,
      count: notifications.length,
      customer: {
        id: customer.id,
        fullName: customer.name,
        phone: customer.phone
      },
      data: notifications
    })
  } catch (error) {
    console.error("Get Customer Notifications Error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer notifications",
      error: error.message
    })
  }
}

// CUSTOMER NOTIFICATIONS BY ORDER ID
export const getCustomerNotificationsByOrder = async (req, res) => {
  try {
    const { orderId } = req.params
    const id = Number(orderId)

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id"
      })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        table: true
      }
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }

    const notifications = await prisma.notification.findMany({
      where: {
        orderId: id,
        role: "customer"
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    res.status(200).json({
      success: true,
      count: notifications.length,
      order: {
        id: order.id,
        status: order.status,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        tableNumber: order.table?.number || null
      },
      data: notifications
    })
  } catch (error) {
    console.error("Get Customer Notifications By Order Error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch order notifications",
      error: error.message
    })
  }
}

// // MARK ONE NOTIFICATION AS READ
// export const markNotificationRead = async (req, res) => {
//   try {
//     const { id } = req.params
//     const notificationId = Number(id)

//     if (isNaN(notificationId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid notification id"
//       })
//     }

//     const notification = await prisma.notification.findUnique({
//       where: { id: notificationId }
//     })

//     if (!notification) {
//       return res.status(404).json({
//         success: false,
//         message: "Notification not found"
//       })
//     }

//     const updatedNotification = await prisma.notification.update({
//       where: { id: notificationId },
//       data: {
//         isRead: true
//       }
//     })

//     res.status(200).json({
//       success: true,
//       message: "Notification marked as read",
//       data: updatedNotification
//     })
//   } catch (error) {
//     console.error("Mark Notification Read Error:", error)
//     res.status(500).json({
//       success: false,
//       message: "Failed to mark notification as read",
//       error: error.message
//     })
//   }
// }

// MARK ALL CUSTOMER NOTIFICATIONS AS READ
export const markAllCustomerNotificationsRead = async (req, res) => {
  try {
    const { customerId } = req.params
    const id = Number(customerId)

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id"
      })
    }

    await prisma.notification.updateMany({
      where: {
        OR: [
          { customerId: id },
          { role: "customer", customerId: null }
        ],
        isRead: false
      },
      data: {
        isRead: true
      }
    })

    res.status(200).json({
      success: true,
      message: "All customer notifications marked as read"
    })
  } catch (error) {
    console.error("Mark All Customer Notifications Read Error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to mark all customer notifications as read",
      error: error.message
    })
  }
}

// GET CUSTOMER UNREAD COUNT
export const getCustomerUnreadCount = async (req, res) => {
  try {
    const { customerId } = req.params
    const id = Number(customerId)

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id"
      })
    }

    const unread = await prisma.notification.count({
      where: {
        OR: [
          { customerId: id },
          { role: "customer", customerId: null }
        ],
        isRead: false
      }
    })

    res.status(200).json({
      success: true,
      unread
    })
  } catch (error) {
    console.error("Customer Unread Count Error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
      error: error.message
    })
  }
}
