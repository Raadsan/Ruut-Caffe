// import express from 'express'
// import {
//   createRole,
//   getAllRoles,
//   updateRole,
//   deleteRole
// } from './role.controller.js'

// const router = express.Router()
// // create role
// router.post('/', createRole)
// // get all roles
// router.get('/', getAllRoles)
// // update role
// router.patch('/:id', updateRole)
// // delete role
// router.delete('/:id', deleteRole)

// export default router


import express from 'express'
import {
  createRole,
  getAllRoles,
  updateRole,
  deleteRole
} from './role.controller.js'
import { protect, authorize, checkPermission } from '../../../middlewares/authMiddleware.js'

const router = express.Router()

// Create role — admin-only action, keep authorize as fallback
router.post('/', protect, authorize('admin'), createRole)

// Get all roles — needed by multiple pages, keep authorize
router.get('/', protect, authorize('admin', 'manager'), getAllRoles)

// Update role
router.patch('/:id', protect, authorize('admin'), updateRole)

// Delete role
router.delete('/:id', protect, authorize('admin'), deleteRole)

export default router
