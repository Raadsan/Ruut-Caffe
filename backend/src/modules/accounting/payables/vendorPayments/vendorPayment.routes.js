import express from 'express'
import { getAll, getById, getAdvances, create, update, remove, post } from './vendorPayment.controller.js'
import { protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.get('/advances/available', getAdvances)
router.post('/:id/post', post)

router.route('/')
    .get(getAll)
    .post(create)

router.route('/:id')
    .get(getById)
    .put(update)
    .delete(remove)

export default router
