// import express from 'express';
// const router = express.Router();
// import { createUser, updateUser, getAllUsers, deleteUser, getUsersByRole } from './user.controller.js';

// // Create user
// router.post('/', createUser);
// // Update user
// router.patch('/:id', updateUser);
// // GET ALL USERS
// router.get('/', getAllUsers);
// // DELETE USER
// router.delete('/:id', deleteUser);
// // GET USERS BY ROLE
// router.get('/role/:role', getUsersByRole);

// export default router;

import express from 'express'
import {
  createUser,
  updateUser,
  getAllUsers,
  deleteUser,
  getUsersByRole
} from './user.controller.js'
import { protect, authorize, checkPermission } from '../../../middlewares/authMiddleware.js'

const router = express.Router()

// Create user
router.post('/', protect, checkPermission('/users', 'canAdd'), createUser)

// Get all users
router.get('/', protect, checkPermission('/users', 'canView'), getAllUsers)

// Get users by role
router.get('/role/:roleId', protect, checkPermission('/users', 'canView'), getUsersByRole)

// Update user
router.patch('/:id', protect, checkPermission('/users', 'canEdit'), updateUser)

// Delete user
router.delete('/:id', protect, checkPermission('/users', 'canDelete'), deleteUser)

export default router
