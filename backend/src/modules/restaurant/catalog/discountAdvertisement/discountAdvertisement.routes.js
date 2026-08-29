import express from 'express'
import {
  createDiscountAdvertisement,
  getAllDiscountAdvertisements,
  getDiscountAdvertisementById,
  getHomepagePromotions,
  updateDiscountAdvertisement,
  deleteDiscountAdvertisement,
} from './discountAdvertisement.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/homepage', getHomepagePromotions)
router.get('/all', protect, checkPermission('/discount-advertisements', 'canView'), getAllDiscountAdvertisements)
router.get('/:id', protect, checkPermission('/discount-advertisements', 'canView'), getDiscountAdvertisementById)
router.post('/', protect, checkPermission('/discount-advertisements', 'canAdd'), createDiscountAdvertisement)
router.patch('/:id', protect, checkPermission('/discount-advertisements', 'canEdit'), updateDiscountAdvertisement)
router.delete('/:id', protect, checkPermission('/discount-advertisements', 'canDelete'), deleteDiscountAdvertisement)

export default router
