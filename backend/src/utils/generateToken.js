import jwt from 'jsonwebtoken'

const generateToken = (user, expiresIn = '15m', type = 'access', authContext = 'dashboard') => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role.name,
      type,
      authContext,
    },
    process.env.JWT_SECRET,
    {
      expiresIn
    }
  )
}

export const generateRefreshToken = (user, authContext = 'dashboard') =>
  generateToken(user, process.env.JWT_REFRESH_EXPIRES_IN || '7d', 'refresh', authContext)

export default generateToken
