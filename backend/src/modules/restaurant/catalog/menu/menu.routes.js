import express from 'express';
import { 
  getMenusByRole, 
  seedDefaultMenus, 
  getAllMenus, 
  createMenu, 
  updateMenu, 
  deleteMenu, 
  createSubMenu, 
  updateSubMenu, 
  deleteSubMenu,
  updatePermissions,
  reorderMenus,
  reorderSubMenus,
  saveMenuBundle,
  getResolvedMenus,
} from './menu.controller.js';
import { protect } from '../../../../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/resolved', protect, getResolvedMenus);
router.get('/permissions/:roleId', protect, getMenusByRole);
router.post('/permissions/:roleId', protect, updatePermissions);
router.get('/', protect, getAllMenus);
router.put('/reorder', protect, reorderMenus);
router.put('/submenu/reorder', protect, reorderSubMenus);
router.post('/bundle', protect, saveMenuBundle);
router.put('/:id/bundle', protect, saveMenuBundle);
router.post('/', protect, createMenu);
router.put('/:id', protect, updateMenu);
router.delete('/:id', protect, deleteMenu);
router.post('/seed', protect, seedDefaultMenus);

// Submenu routes
router.post('/submenu', protect, createSubMenu);
router.put('/submenu/:id', protect, updateSubMenu);
router.delete('/submenu/:id', protect, deleteSubMenu);

export default router;
