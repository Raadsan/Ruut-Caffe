import generateToken, { generateRefreshToken } from './generateToken.js'

const MOBILE_CLIENT_ROLES = new Set(['client', 'customer'])

export function normalizeRoleName(roleName) {
  return String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

export function isMobileClientRole(roleName) {
  return MOBILE_CLIENT_ROLES.has(normalizeRoleName(roleName))
}

export function issueAccessToken(user, authContext = 'dashboard') {
  if (authContext === 'client' || isMobileClientRole(user?.role?.name)) {
    return generateToken(
      user,
      process.env.JWT_CLIENT_EXPIRES_IN || '30d',
      'access',
      'client',
    )
  }

  return generateToken(user, '15m', 'access', authContext)
}

export function issueMobileAuthTokens(user) {
  const authContext = 'client'
  return {
    token: issueAccessToken(user, authContext),
    refreshToken: generateRefreshToken(user, authContext),
  }
}

export function issueAuthTokens(user, authContext = 'dashboard') {
  if (authContext === 'client' || isMobileClientRole(user?.role?.name)) {
    return issueMobileAuthTokens(user)
  }

  return {
    token: issueAccessToken(user, authContext),
    refreshToken: generateRefreshToken(user, authContext),
  }
}
