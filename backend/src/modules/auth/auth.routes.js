import express from 'express'
import authenticationRoutes from './authentication/auth.routes.js'
import userRoutes from './user/user.routes.js'
import roleRoutes from './role/role.routes.js'
import auditLogRoutes from './auditLog/auditLog.routes.js'

const router = express.Router()

router.use('/auth', authenticationRoutes)
router.use('/users', userRoutes)
router.use('/roles', roleRoutes)
router.use('/audit-logs', auditLogRoutes)

export default router
