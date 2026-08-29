import express from 'express'
import {
  getDashboardSummary,
  getDashboardInit,
  getRevenueReport,
  getTopSellingItems,
  getTablePerformanceReport,
  getDailyReport,
  getMonthlyReport,
  getStaffPerformanceReport,
  getFinanceReport,
  getWeeklyAnalytics,
  getOrdersReport,
  getClientsReport
} from './report.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

// Admin and Manager share the dashboard summary
router.get('/summary', protect, getDashboardSummary)
router.get('/dashboard-init', protect, getDashboardInit)
router.get('/revenue', protect, checkPermission('/report', 'canView'), getRevenueReport)
router.get('/top-items', protect, checkPermission('/report', 'canView'), getTopSellingItems)
router.get('/table-performance', protect, checkPermission('/report', 'canView'), getTablePerformanceReport)
router.get('/daily', protect, checkPermission('/report', 'canView'), getDailyReport)
router.get('/monthly', protect, checkPermission('/report', 'canView'), getMonthlyReport)
router.get('/staff-performance', protect, checkPermission('/report', 'canView'), getStaffPerformanceReport)
router.get('/finance', protect, checkPermission('/report', 'canView'), getFinanceReport)
router.get('/weekly', protect, checkPermission('/report', 'canView'), getWeeklyAnalytics)
router.get('/orders', protect, checkPermission('/report', 'canView'), getOrdersReport)
router.get('/clients', protect, checkPermission('/report', 'canView'), getClientsReport)

export default router
