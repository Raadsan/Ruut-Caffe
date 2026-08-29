import express from 'express'
import { getAll, getById, create, update, remove, post } from './customerInvoice.controller.js'
import { protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.route('/')
    .get(getAll)
    .post(create)

router.route('/:id')
    .get(getById)
    .put(update)
    .delete(remove)

router.post('/:id/post', post)

export default router
