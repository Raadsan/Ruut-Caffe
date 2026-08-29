// import express from 'express';
// import { createTable, updateTable, deleteTable, getAllTables } from './table.controller.js';

// const router = express.Router();
// // Create Table
// router.post('/', createTable);
// // Update Table
// router.patch('/:id', updateTable);
// // Delete Table
// router.delete('/:id', deleteTable);
// // Get All Tables
// router.get('/all', getAllTables);

// export default router;

import express from 'express'
import {
  createTable,
  updateTable,
  deleteTable,
  getAllTables,
  getTableByQrCode
} from './table.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

// Get table by QR Code (Public or protected? User needs it to order)
router.get('/qr/:qrCode', getTableByQrCode)

// Create table
router.post('/', protect, checkPermission('/tables', 'canAdd'), createTable)

// Get all tables — accessible to any logged-in user (needed by POS)
router.get('/all', protect, getAllTables)

// Update table
router.patch('/:id', protect, checkPermission('/tables', 'canEdit'), updateTable)

// Delete table
router.delete('/:id', protect, checkPermission('/tables', 'canDelete'), deleteTable)

export default router
