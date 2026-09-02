import express from 'express'
import { login, posLogin, getMe, register, updateProfile, forgotPassword, resetPassword, logout, refresh, refreshMobileToken, updateFcmToken, clearFcmToken, loginWithGoogle, loginWithFacebook } from './auth.controller.js'
import { protect } from '../../../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/login', login)
router.post('/google', loginWithGoogle)
router.post('/facebook', loginWithFacebook)
router.post('/pos-login', posLogin)
router.post('/refresh', refresh)
router.post('/refresh-token', refreshMobileToken)
router.post('/register', register)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/logout', protect, logout)
router.get('/me', protect, getMe)
router.patch('/update-profile', protect, updateProfile)
router.patch('/fcm-token', protect, updateFcmToken)
router.delete('/fcm-token', protect, clearFcmToken)

export default router
