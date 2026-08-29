import express from 'express'
import { retryPOSOrderAccounting } from './posOrderAccounting.controller.js'

const router = express.Router()
router.post('/:id/retry-accounting', retryPOSOrderAccounting)
export default router
