import express from 'express'
import { getAll, getById, getEligibleGlAccounts, create, update, remove } from './paymentMethod.controller.js'
import { protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.route('/')
    .get(getAll)
    .post(create)

router.get('/eligible-gl-accounts', getEligibleGlAccounts)

router.route('/:id')
    .get(getById)
    .put(update)
    .delete(remove)

export default router
