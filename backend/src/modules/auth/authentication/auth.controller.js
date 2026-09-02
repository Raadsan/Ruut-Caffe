import prisma from '../../../config/db.js'
import jwt from 'jsonwebtoken'
import { getCachedUser, invalidateUserCache } from '../../../middlewares/authMiddleware.js'
import { clearAuthCookies, readCookie, REFRESH_COOKIE, setAuthCookies } from '../../../utils/authCookies.js'

function formatAuthUser(user) {
  const { password, posPin, role, avatarUrl, ...rest } = user
  const safeAvatar =
    typeof avatarUrl === 'string' &&
    avatarUrl.length > 0 &&
    !avatarUrl.startsWith('data:') &&
    avatarUrl.length < 512
      ? avatarUrl
      : null
  return {
    ...rest,
    avatarUrl: safeAvatar,
    role: role.name,
    roleId: user.roleId,
    roleDescription: role.description
  }
}
import bcrypt from 'bcryptjs'
import generateToken from '../../../utils/generateToken.js'
import { issueAuthTokens, issueAccessToken } from '../../../utils/authTokens.js'
import {
  verifyGoogleToken,
  verifyFacebookToken,
  loginOrRegisterWithSocial,
} from '../../../utils/socialAuthService.js'
import { dbUnavailableResponse } from '../../../utils/dbErrors.js'

const POS_LOGIN_ROLES = new Set(['pos', 'cashier', 'waiter', 'admin', 'manager'])

function isValidPosPin(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin)
}

// POS LOGIN — username + 6-digit PIN
export const posLogin = async (req, res) => {
  try {
    const username = req.body.username?.trim().toLowerCase()
    const pin = req.body.pin?.trim()

    if (!username || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Username and 6-digit PIN are required',
      })
    }

    if (!isValidPosPin(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 6 digits',
      })
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    })

    if (!user || !user.posPin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or PIN',
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive',
      })
    }

    const roleName = user.role?.name?.toLowerCase() || ''
    if (!POS_LOGIN_ROLES.has(roleName)) {
      return res.status(403).json({
        success: false,
        message: 'This account is not allowed to use POS',
      })
    }

    const isMatch = await bcrypt.compare(pin, user.posPin)
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or PIN',
      })
    }

    const token = generateToken(user, '15m', 'access', 'pos')
    setAuthCookies(res, user, token, 'pos')

    prisma.auditlog
      .create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'AUTH',
          description: `Staff ${user.fullName} logged into POS.`,
        },
      })
      .catch(err => console.warn('POS login audit skipped:', err?.message))

    res.status(200).json({
      success: true,
      message: 'POS login successful',
      token,
      user: { ...formatAuthUser(user), authContext: 'pos' },
    })
  } catch (error) {
    console.error('POS Login Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to login to POS',
      error: error.message,
    })
  }
}

// LOGIN
export const login = async (req, res) => {
  try {
    let { email, password } = req.body

    email = email?.trim().toLowerCase()

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    const { token, refreshToken } = issueAuthTokens(user)
    setAuthCookies(res, user, token)

    prisma.auditlog
      .create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entity: 'AUTH',
          description: `Staff ${user.fullName} logged into the system.`,
        },
      })
      .catch(err => console.warn('Login audit skipped:', err?.message))

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        role: user.role.name,
        roleId: user.roleId,
        roleDescription: user.role.description,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    })
  } catch (error) {
    console.error('Login Error:', error)
    if (error?.name === 'PrismaClientInitializationError' || error?.code?.startsWith?.('P1')) {
      return dbUnavailableResponse(res, error)
    }
    res.status(500).json({
      success: false,
      message: 'Failed to login',
      error: error.message
    })
  }
}

// REGISTER
export const register = async (req, res) => {
  try {
    let { fullName, email, password, phone } = req.body

    email = email?.trim().toLowerCase()
    fullName = fullName?.trim()
    phone = phone?.trim() || null

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' })
    }

    const userExists = await prisma.user.findUnique({ where: { email } })
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Default role for app users
    let role = await prisma.role.findFirst({
      where: {
        name: { equals: 'client' }
      }
    })

    if (!role) {
      role = await prisma.role.findFirst({
        where: {
          name: { equals: 'Client' }
        }
      })
    }

    if (!role) {
      return res.status(500).json({ success: false, message: 'Default client role not found in system' })
    }

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        phone,
        roleId: role.id,
        updatedAt: new Date() // Manual set as fallback
      },
      include: { role: true }
    })

    const { token, refreshToken } = issueAuthTokens(user, 'client')

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      refreshToken,
      user: formatAuthUser(user)
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const { fullName, email, phone, currentPassword, newPassword, address, dateOfBirth, gender, avatarUrl } = req.body
    const userId = req.user.id

    const updateData = {}

    if (fullName !== undefined) updateData.fullName = fullName
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) {
      const normalizedPhone = phone?.trim() || null
      if (normalizedPhone) {
        const phoneTaken = await prisma.user.findFirst({
          where: {
            phone: normalizedPhone,
            NOT: { id: userId },
          },
        })
        if (phoneTaken) {
          return res.status(400).json({
            success: false,
            message: 'This phone number is already used by another account',
          })
        }
      }
      updateData.phone = normalizedPhone
    }

    if (address !== undefined) updateData.address = address;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) updateData.gender = gender;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;

    if (currentPassword && newPassword) {
      // Find the user to verify current password
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      const isMatch = await bcrypt.compare(currentPassword, existingUser.password);
      
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect current password' });
      }
      
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { role: true }
    })

    invalidateUserCache(userId)

    res.status(200).json({
      success: true,
      message: 'Profile updated',
      user: formatAuthUser(user)
    })
  } catch (error) {
    if (error.code === 'P2002') {
      const target = error.meta?.target
      const field = Array.isArray(target) ? target.join(', ') : 'field'
      return res.status(400).json({
        success: false,
        message: field.includes('phone')
          ? 'This phone number is already used by another account'
          : `This ${field} is already in use`,
      })
    }
    res.status(500).json({ success: false, message: error.message })
  }
}

// GET CURRENT LOGGED-IN USER (uses auth cache — no extra DB round-trip when warm)
export const getMe = async (req, res) => {
  try {
    const user = await getCachedUser(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    res.status(200).json({
      success: true,
      data: { ...formatAuthUser(user), authContext: req.user.authContext }
    })
  } catch (error) {
    console.error('Get Me Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current user',
      error: error.message
    })
  }
}

// FORGOT PASSWORD (CHECK EMAIL)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' })
    }

    res.status(200).json({ success: true, message: 'Email verified' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword }
    })

    res.status(200).json({ success: true, message: 'Password reset successful' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// LOGOUT
export const logout = async (req, res) => {
  try {
    clearAuthCookies(res)
    if (req.user) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { fcmToken: null, fcmTokenUpdatedAt: null },
      })
      invalidateUserCache(req.user.id)

      await prisma.auditlog.create({
        data: {
          userId: req.user.id,
          action: 'LOGOUT',
          entity: 'AUTH',
          description: `Staff ${req.user.fullName} logged out of the system.`
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
}

// SAVE FCM TOKEN (delivery app push notifications)
export const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body

    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'fcmToken is required',
      })
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fcmToken: fcmToken.trim(),
        fcmTokenUpdatedAt: new Date(),
      },
    })
    invalidateUserCache(req.user.id)

    res.status(200).json({
      success: true,
      message: 'FCM token saved',
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// CLEAR FCM TOKEN (on logout from mobile app)
export const clearFcmToken = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken: null, fcmTokenUpdatedAt: null },
    })
    invalidateUserCache(req.user.id)

    res.status(200).json({
      success: true,
      message: 'FCM token cleared',
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

function socialAuthErrorResponse(res, error) {
  const code = error.message

  if (code === 'NO_ACCOUNT') {
    return res.status(404).json({
      success: false,
      message: 'No account found for this social login. Contact your administrator.',
    })
  }

  if (code === 'STAFF_ONLY') {
    return res.status(403).json({
      success: false,
      message: 'This login is for staff accounts only.',
    })
  }

  if (code === 'EMAIL_REQUIRED') {
    return res.status(400).json({
      success: false,
      message: 'Email permission is required for social sign in.',
    })
  }

  if (code === 'INACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'User account is inactive',
    })
  }

  if (code === 'CLIENT_ROLE_MISSING') {
    return res.status(500).json({
      success: false,
      message: 'Default client role is missing in the system.',
    })
  }

  if (code.includes('not configured')) {
    return res.status(503).json({
      success: false,
      message: error.message,
    })
  }

  return res.status(401).json({
    success: false,
    message: 'Social login failed',
    error: error.message,
  })
}

export const loginWithGoogle = async (req, res) => {
  try {
    const { idToken, audience = 'client' } = req.body
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google idToken is required',
      })
    }

    const profile = await verifyGoogleToken(idToken)
    const result = await loginOrRegisterWithSocial({
      profile,
      provider: 'google',
      audience,
    })
    setAuthCookies(res, { ...result.user, role: { name: result.user.role } }, result.token)

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      ...result,
    })
  } catch (error) {
    console.error('Google Login Error:', error)
    return socialAuthErrorResponse(res, error)
  }
}

export const loginWithFacebook = async (req, res) => {
  try {
    const { accessToken, audience = 'client' } = req.body
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Facebook accessToken is required',
      })
    }

    const profile = await verifyFacebookToken(accessToken)
    const result = await loginOrRegisterWithSocial({
      profile,
      provider: 'facebook',
      audience,
    })
    setAuthCookies(res, { ...result.user, role: { name: result.user.role } }, result.token)

    res.status(200).json({
      success: true,
      message: 'Facebook login successful',
      ...result,
    })
  } catch (error) {
    console.error('Facebook Login Error:', error)
    return socialAuthErrorResponse(res, error)
  }
}

export const refresh = async (req, res) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE)
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Session expired' })

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET)
    if (decoded.type !== 'refresh') throw new Error('Invalid token type')

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    })
    if (!user?.isActive) {
      clearAuthCookies(res)
      return res.status(401).json({ success: false, message: 'Session expired' })
    }

    const authContext = decoded.authContext === 'pos' ? 'pos' : decoded.authContext || 'dashboard'
    const token = issueAccessToken(user, authContext)
    setAuthCookies(res, user, token, authContext)
    return res.status(200).json({ success: true, token })
  } catch {
    clearAuthCookies(res)
    return res.status(401).json({ success: false, message: 'Session expired' })
  }
}

export const refreshMobileToken = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(401).json({ success: false, message: 'Session expired' })
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET)
    if (decoded.type !== 'refresh') throw new Error('Invalid token type')

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    })
    if (!user?.isActive) {
      return res.status(401).json({ success: false, message: 'Session expired' })
    }

    const authContext = decoded.authContext || 'client'
    const tokens = issueAuthTokens(user, authContext)

    return res.status(200).json({
      success: true,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
    })
  } catch (error) {
    console.error('Mobile token refresh failed:', error.message)
    return res.status(401).json({ success: false, message: 'Session expired' })
  }
}
