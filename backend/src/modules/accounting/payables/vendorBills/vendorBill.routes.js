import express from 'express'
import { getAll, getById, create, update, remove, post, getRefunds, createRefund, updateRefund, removeRefund, postRefund } from './vendorBill.controller.js'
import { protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.route('/refunds')
    .get(getRefunds)
    .post(createRefund)

router.route('/refunds/:id')
    .put(updateRefund)
    .delete(removeRefund)

router.post('/refunds/:id/post', postRefund)
router.post('/:id/post', post)

router.route('/')
    .get(getAll)
    .post(create)

router.route('/:id')
    .get(getById)
    .put(update)
    .delete(remove)

export default router
