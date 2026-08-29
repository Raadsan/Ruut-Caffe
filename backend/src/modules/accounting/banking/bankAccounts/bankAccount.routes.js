import express from 'express'
import { getAll, getById, getEligibleGlAccounts, create, update, remove } from './bankAccount.controller.js'
import { protect } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/eligible-gl-accounts', getEligibleGlAccounts)

router.route('/')
    .get(getAll)
    .post(create)

router.route('/:id')
    .get(getById)
    .put(update)
    .delete(remove)

export default router
