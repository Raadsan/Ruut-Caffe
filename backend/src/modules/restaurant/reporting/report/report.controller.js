import prisma from '../../../../config/db.js'
import { createResponseCache } from '../../../../utils/responseCache.js'

const reportCache = createResponseCache(90 * 1000)
const WEEKLY_TTL_MS = 2 * 60 * 1000

function reportCacheKey(prefix, query = {}) {
  const parts = [prefix]
  for (const key of Object.keys(query).sort()) {
    if (query[key] != null && query[key] !== '') parts.push(`${key}=${query[key]}`)
  }
  return parts.join(':')
}

export const clearReportCache = () => {
  reportCache.clear()
}

async function fetchDashboardSummaryData(query) {
  const dateRange = parseDateRange(query)

  const orderWhere = dateRange ? { createdAt: dateRange } : {}

  const paidPaymentWhere = {
    status: 'paid',
    ...(dateRange ? { paidAt: dateRange } : {}),
  }

  const [totalOrders, totalCustomers, totalTables, totalRevenueResult, paidPayments, pendingPayments] =
    await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.customers.count(),
      prisma.table.count(),
      prisma.payment.aggregate({
        where: paidPaymentWhere,
        _sum: { amount: true },
      }),
      prisma.payment.count({
        where: {
          status: 'paid',
          ...(dateRange ? { paidAt: dateRange } : {}),
        },
      }),
      prisma.payment.count({
        where: {
          status: 'pending',
          ...(dateRange ? { createdAt: dateRange } : {}),
        },
      }),
    ])

  return {
    totalOrders,
    totalCustomers,
    totalTables,
    totalPaidPayments: paidPayments,
    totalPendingPayments: pendingPayments,
    totalRevenue: totalRevenueResult._sum.amount || 0,
  }
}

async function fetchWeeklyAnalyticsData() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date()
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const buckets = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().split('T')[0]
    buckets.push({
      key,
      name: dayLabels[d.getDay()],
      revenue: 0,
      orders: 0,
    })
  }

  const payments = await prisma.payment.findMany({
    where: {
      status: 'paid',
      paidAt: { gte: start, lte: end },
    },
    select: {
      amount: true,
      paidAt: true,
      orderId: true,
    },
  })

  const ordersPerDay = {}

  for (const payment of payments) {
    const key = new Date(payment.paidAt).toISOString().split('T')[0]
    const bucket = buckets.find((b) => b.key === key)
    if (!bucket) continue

    bucket.revenue += payment.amount
    if (!ordersPerDay[key]) ordersPerDay[key] = new Set()
    ordersPerDay[key].add(payment.orderId)
  }

  buckets.forEach((bucket) => {
    bucket.orders = ordersPerDay[bucket.key]?.size || 0
    delete bucket.key
  })

  return buckets
}

async function fetchRecentOrdersForDashboard() {
  return prisma.order.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      table: { select: { id: true, number: true } },
      user: {
        select: {
          id: true,
          fullName: true,
          role: { select: { id: true, name: true } },
        },
      },
      orderitem: {
        include: {
          menuitem: { select: { id: true, name: true, price: true } },
        },
      },
    },
  })
}

async function fetchDashboardInitData() {
  const [summary, weekly, recentOrders] = await Promise.all([
    fetchDashboardSummaryData({}),
    fetchWeeklyAnalyticsData(),
    fetchRecentOrdersForDashboard(),
  ])
  return { summary, weekly, recentOrders }
}

export async function warmReportCaches() {
  await Promise.all([
    reportCache.get(reportCacheKey('summary', {}), () => fetchDashboardSummaryData({}), 90 * 1000),
    reportCache.get('weekly', () => fetchWeeklyAnalyticsData(), WEEKLY_TTL_MS),
    reportCache.get('dashboard-init', () => fetchDashboardInitData(), 90 * 1000),
  ]).catch(() => {})
}

// 🔹 DATE RANGE
const parseDateRange = (query) => {
  const { startDate, endDate } = query

  if (!startDate && !endDate) return null

  const range = {}

  if (startDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    range.gte = start
  }

  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    range.lte = end
  }

  return range
}

// 🔹 MOVE OUTSIDE (VERY IMPORTANT)
const getStartOfDay = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const getEndOfDay = () => {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

const getStartOfMonth = () => {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

const getEndOfMonth = () => {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

// DASHBOARD INIT — summary + weekly chart + recent orders in one round trip
export const getDashboardInit = async (req, res) => {
  try {
    const role = req.user?.role?.toLowerCase()
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }

    const data = await reportCache.get(
      'dashboard-init',
      () => fetchDashboardInitData(),
      90 * 1000
    )

    return res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('Get Dashboard Init Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message,
    })
  }
}

// DASHBOARD SUMMARY
export const getDashboardSummary = async (req, res) => {
  try {
    const key = reportCacheKey('summary', req.query)
    const data = await reportCache.get(key, () => fetchDashboardSummaryData(req.query), 90 * 1000)

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Get Dashboard Summary Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: error.message
    })
  }
}

// REVENUE REPORT
export const getRevenueReport = async (req, res) => {
  try {
    const dateRange = parseDateRange(req.query)

    const payments = await prisma.payment.findMany({
      where: {
        status: 'paid',
        ...(dateRange ? { paidAt: dateRange } : {})
      },
      orderBy: {
        paidAt: 'desc'
      },
      include: {
        order: {
          include: {
            table: true,
            customer: true
          }
        }
      }
    })

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0)

    const revenueByMethodMap = {}

    for (const payment of payments) {
      const key = payment.method || 'unknown'

      if (!revenueByMethodMap[key]) {
        revenueByMethodMap[key] = {
          method: key,
          totalAmount: 0,
          count: 0
        }
      }

      revenueByMethodMap[key].totalAmount += payment.amount
      revenueByMethodMap[key].count += 1
    }

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalPaidTransactions: payments.length,
        revenueByMethod: Object.values(revenueByMethodMap),
        payments
      }
    })
  } catch (error) {
    console.error('Get Revenue Report Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue report',
      error: error.message
    })
  }
}

// BEST SELLING ITEMS
export const getTopSellingItems = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10
    const dateRange = parseDateRange(req.query)

    const groupedItems = await prisma.orderitem.groupBy({
      by: ['menuItemId'],
      _sum: {
        quantity: true,
        unitPrice: true
      },
      where: {
        menuitem: { isSellable: true },
        ...(dateRange ? { order: { createdAt: dateRange } } : {}),
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: limit
    })

    const menuItemIds = groupedItems.map(item => item.menuItemId)

    const menuItems = await prisma.menuitem.findMany({
      where: {
        id: {
          in: menuItemIds
        }
      },
      select: {
        id: true,
        name: true,
        category: {
          select: { name: true }
        }
      }
    })

    const result = groupedItems.map(item => {
      const menuItem = menuItems.find(menu => menu.id === item.menuItemId)

      return {
        menuItemId: item.menuItemId,
        name: menuItem?.name || 'Unknown Item',
        category: menuItem?.category?.name || null,
        totalQuantitySold: item._sum.quantity || 0
      }
    })

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result
    })
  } catch (error) {
    console.error('Get Top Selling Items Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch top selling items',
      error: error.message
    })
  }
}

// TABLE PERFORMANCE REPORT
export const getTablePerformanceReport = async (req, res) => {
  try {
    const dateRange = parseDateRange(req.query)

    const groupedOrders = await prisma.order.groupBy({
      by: ['tableId'],
      _count: {
        id: true
      },
      _sum: {
        total: true
      },
      where: dateRange
        ? {
            createdAt: dateRange
          }
        : {},
      orderBy: {
        _sum: {
          total: 'desc'
        }
      }
    })

    const tableIds = groupedOrders.map(item => item.tableId)

    const tables = await prisma.table.findMany({
      where: {
        id: {
          in: tableIds
        }
      }
    })

    const result = groupedOrders.map(item => {
      const table = tables.find(t => t.id === item.tableId)

      return {
        tableId: item.tableId,
        tableNumber: table?.number || null,
        tableName: table?.name || null,
        totalOrders: item._count.id || 0,
        totalRevenue: item._sum.total || 0
      }
    })

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result
    })
  } catch (error) {
    console.error('Get Table Performance Report Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch table performance report',
      error: error.message
    })
  }
}

// DAILY REPORT
export const getDailyReport = async (req, res) => {
  try {
    const start = getStartOfDay()
    const end = getEndOfDay()

    const [ordersCount, payments, topItems] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: {
            gte: start,
            lte: end
          }
        }
      }),
      prisma.payment.findMany({
        where: {
          status: 'paid',
          paidAt: {
            gte: start,
            lte: end
          }
        },
        include: {
          order: {
            include: {
              table: true,
              customer: true
            }
          }
        }
      }),
      prisma.orderItem.groupBy({
        by: ['menuItemId'],
        _sum: {
          quantity: true
        },
        where: {
          order: {
            createdAt: {
              gte: start,
              lte: end
            }
          }
        },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 5
      })
    ])

    const revenue = payments.reduce((sum, item) => sum + item.amount, 0)

    return res.status(200).json({
      success: true,
      data: {
        reportType: 'daily',
        date: start,
        totalOrders: ordersCount,
        totalRevenue: revenue,
        totalPaidPayments: payments.length,
        topItems
      }
    })
  } catch (error) {
    console.error('Get Daily Report Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch daily report',
      error: error.message
    })
  }
}

// MONTHLY REPORT
export const getMonthlyReport = async (req, res) => {
  try {
    const start = getStartOfMonth()
    const end = getEndOfMonth()

    const [ordersCount, payments, topItems] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: {
            gte: start,
            lte: end
          }
        }
      }),
      prisma.payment.findMany({
        where: {
          status: 'paid',
          paidAt: {
            gte: start,
            lte: end
          }
        },
        include: {
          order: {
            include: {
              table: true,
              customer: true
            }
          }
        }
      }),
      prisma.orderItem.groupBy({
        by: ['menuItemId'],
        _sum: {
          quantity: true
        },
        where: {
          order: {
            createdAt: {
              gte: start,
              lte: end
            }
          }
        },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 10
      })
    ])

    const revenue = payments.reduce((sum, item) => sum + item.amount, 0)

    return res.status(200).json({
      success: true,
      data: {
        reportType: 'monthly',
        month: start.getMonth() + 1,
        year: start.getFullYear(),
        totalOrders: ordersCount,
        totalRevenue: revenue,
        totalPaidPayments: payments.length,
        topItems
      }
    })
  } catch (error) {
    console.error('Get Monthly Report Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly report',
      error: error.message
    })
  }
}

// STAFF PERFORMANCE REPORT
export const getStaffPerformanceReport = async (req, res) => {
  try {
    const logs = await prisma.auditlog.findMany({
      where: {
        userId: {
          not: null
        }
      },
      include: {
        user: {
          include: {
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const performanceMap = {}

    for (const log of logs) {
      if (!log.user) continue

      const key = log.user.id

      if (!performanceMap[key]) {
        performanceMap[key] = {
          userId: log.user.id,
          fullName: log.user.fullName,
          email: log.user.email,
          role: log.user.role?.name || null,
          totalActions: 0,
          actions: {}
        }
      }

      performanceMap[key].totalActions += 1

      if (!performanceMap[key].actions[log.action]) {
        performanceMap[key].actions[log.action] = 0
      }

      performanceMap[key].actions[log.action] += 1
    }

    return res.status(200).json({
      success: true,
      count: Object.keys(performanceMap).length,
      data: Object.values(performanceMap)
    })
  } catch (error) {
    console.error('Get Staff Performance Report Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch staff performance report',
      error: error.message
    })
  }
}

// FINANCE REPORT (Detailed)
export const getFinanceReport = async (req, res) => {
  try {
    const dateRange = parseDateRange(req.query)

    const payments = await prisma.payment.findMany({
      where: {
        status: 'paid',
        ...(dateRange ? { paidAt: dateRange } : {})
      },
      include: {
        order: {
          include: {
            orderitem: {
              where: { menuitem: { isSellable: true } },
              include: {
                menuitem: {
                  select: {
                    id: true,
                    name: true,
                    costPrice: true,
                    price: true
                  }
                }
              }
            }
          }
        }
      }
    })

    let totalRevenue = 0
    let totalCost = 0
    let transactionCount = payments.length
    
    const itemsList = []
    const breakdownByMethod = {}
    const breakdownBySource = {}

    payments.forEach(p => {
      totalRevenue += p.amount
      
      // By Method
      const method = p.method || 'Unknown'
      if (!breakdownByMethod[method]) breakdownByMethod[method] = 0
      breakdownByMethod[method] += p.amount

      // By Source (from Order)
      const source = p.order?.source || 'pos'
      if (!breakdownBySource[source]) breakdownBySource[source] = 0
      breakdownBySource[source] += p.amount

      // Items calculation
      if (p.order && p.order.orderitem) {
        p.order.orderitem.forEach(item => {
          const cost = (item.menuitem?.costPrice || 0) * item.quantity
          const selling = item.unitPrice * item.quantity
          totalCost += cost
          
          itemsList.push({
            id: item.id,
            orderId: p.orderId,
            name: item.menuitem?.name || 'Unknown',
            quantity: item.quantity,
            costPrice: item.menuitem?.costPrice || 0,
            sellingPrice: item.unitPrice,
            totalCost: cost,
            totalSelling: selling,
            profit: selling - cost,
            date: p.paidAt,
            paymentMethod: p.method || 'unknown',
            providerName: p.providerName || null,
          })
        })
      }
    })

    const netProfit = totalRevenue - totalCost
    const averageTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalCost,
        netProfit,
        averageTransaction,
        transactionCount,
        breakdownByMethod,
        breakdownBySource,
        items: itemsList.sort((a, b) => new Date(b.date) - new Date(a.date))
      }
    })
  } catch (error) {
    console.error('Finance Report Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

// WEEKLY REVENUE CHART (last 7 days)
export const getWeeklyAnalytics = async (req, res) => {
  try {
    const data = await reportCache.get('weekly', () => fetchWeeklyAnalyticsData(), WEEKLY_TTL_MS)

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Weekly Analytics Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly analytics',
      error: error.message,
    })
  }
}

// ORDERS REPORT (Detailed)
export const getOrdersReport = async (req, res) => {
  try {
    const dateRange = parseDateRange(req.query)

    const [orders, stats] = await Promise.all([
      prisma.order.findMany({
        where: dateRange ? { createdAt: dateRange } : {},
        include: { table: true, customer: true }
      }),
      prisma.order.aggregate({
        where: dateRange ? { createdAt: dateRange } : {},
        _count: { id: true },
        _sum: { total: true }
      })
    ])

    const breakdownByStatus = {}
    const breakdownByType = {}
    const breakdownBySource = {}

    orders.forEach(o => {
      breakdownByStatus[o.status] = (breakdownByStatus[o.status] || 0) + 1
      breakdownByType[o.orderType] = (breakdownByType[o.orderType] || 0) + 1
      breakdownBySource[o.source] = (breakdownBySource[o.source] || 0) + 1
    })

    return res.status(200).json({
      success: true,
      data: {
        totalOrders: stats._count.id || 0,
        totalAmount: stats._sum.total || 0,
        breakdownByStatus,
        breakdownByType,
        breakdownBySource,
        orders: orders.slice(0, 50) // Return last 50 for preview
      }
    })
  } catch (error) {
    console.error('Orders Report Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

// CLIENTS REPORT
export const getClientsReport = async (req, res) => {
  try {
    const dateRange = parseDateRange(req.query)

    // Find customers who have made orders
    const customers = await prisma.customers.findMany({
      include: {
        order: {
          where: dateRange ? { createdAt: dateRange } : {},
          select: { total: true, source: true, createdAt: true }
        }
      }
    })

    const clientStats = customers.map(c => {
      const totalSpent = c.order.reduce((sum, o) => sum + o.total, 0)
      const orderCount = c.order.length
      
      // Determine primary source
      const sources = {}
      c.order.forEach(o => { sources[o.source] = (sources[o.source] || 0) + 1 })
      const primarySource = Object.keys(sources).reduce((a, b) => (sources[a] || 0) > (sources[b] || 0) ? a : b, 'pos')

      return {
        id: c.id,
        fullName: c.name,
        phone: c.phone,
        totalSpent,
        orderCount,
        primarySource,
        lastOrder: c.order.length > 0 ? c.order[c.order.length - 1].createdAt : null
      }
    }).filter(c => c.orderCount > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)

    return res.status(200).json({
      success: true,
      data: {
        totalClients: clientStats.length,
        topClients: clientStats.slice(0, 20),
        fullStats: clientStats
      }
    })
  } catch (error) {
    console.error('Clients Report Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}
