import { generateRefreshToken } from './generateToken.js'

export const ACCESS_COOKIE = 'restaurant_access'
export const REFRESH_COOKIE = 'restaurant_refresh'
export const LOGOUT_COOKIE = 'restaurant_logout'
const secure = process.env.NODE_ENV === 'production'
// Authentication is intentionally scoped to the current browser session.
// Omitting Max-Age/Expires makes these session cookies, so the browser clears
// them when it is fully closed while refreshes and open tabs remain signed in.
const sessionCookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' }

export function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim())
  }
  return null
}

export function setAuthCookies(res, user, accessToken, authContext = 'dashboard') {
  res.clearCookie(LOGOUT_COOKIE, { secure, sameSite: 'lax', path: '/' })
  res.cookie(ACCESS_COOKIE, accessToken, sessionCookieOptions)
  res.cookie(REFRESH_COOKIE, generateRefreshToken(user, authContext), sessionCookieOptions)
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, sessionCookieOptions)
  res.clearCookie(REFRESH_COOKIE, sessionCookieOptions)
}
