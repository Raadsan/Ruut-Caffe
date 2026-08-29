import express from 'express'
import { getAll, getById, create, update, remove, post } from './journalEntry.controller.js'
import { protect, checkPermission } from '../../../../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.route('/')
    .get(getAll)
    .post(create)

router.route('/:id')
    .get(getById)
    .put(update)
    .delete(remove)

router.patch('/:id/post', checkPermission('/journal-entries', 'canAdd'), post)

export default router
