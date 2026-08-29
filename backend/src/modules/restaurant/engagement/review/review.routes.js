import express from 'express'
import { createReview, getMenuItemReviews, checkCanReview } from './review.controller.js'
import { protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createReview)
router.get('/check/:menuItemId', protect, checkCanReview)
router.get('/:menuItemId', getMenuItemReviews)

export default router
