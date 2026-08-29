import express from 'express'
import {
  createAuditLog,
  getAllAuditLogs,
  getAuditLogById,
  getAuditLogsByUser,
  getAuditLogsByEntity,
  deleteAuditLog
} from './auditLog.controller.js'
import { protect, authorize } from '../../../middlewares/authMiddleware.js'

const router = express.Router()

router.post(
  '/',
  protect,
  authorize('admin', 'manager'),
  createAuditLog
)

router.get(
  '/all',
  protect,
  authorize('admin', 'manager'),
  getAllAuditLogs
)

router.get(
  '/user/:userId',
  protect,
  authorize('admin', 'manager'),
  getAuditLogsByUser
)

router.get(
  '/entity/:entity',
  protect,
  authorize('admin', 'manager'),
  getAuditLogsByEntity
)

router.get(
  '/:id',
  protect,
  authorize('admin', 'manager'),
  getAuditLogById
)

router.delete(
  '/:id',
  protect,
  authorize('admin'),
  deleteAuditLog
)

export default router
