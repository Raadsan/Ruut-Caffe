export function isDbAuthError(error) {
  const msg = `${error?.message || ''} ${error?.meta?.message || ''}`
  return (
    msg.includes('Authentication failed') ||
    msg.includes('Access denied') ||
    error?.code === 'P1000'
  )
}

export function isDbUnreachableError(error) {
  const msg = error?.message || ''
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    error?.code === 'P1001'
  )
}

export function dbUnavailableResponse(res, error) {
  if (isDbAuthError(error)) {
    return res.status(503).json({
      success: false,
      message:
        'Database login failed. Check DATABASE_URL in backend/.env (username, password, database name). On Contabo run: CREATE USER + GRANT for remote access.',
    })
  }
  if (isDbUnreachableError(error)) {
    return res.status(503).json({
      success: false,
      message:
        'Cannot reach MySQL server. Check host/IP, port 3306 firewall, and that MySQL is running.',
    })
  }
  return res.status(503).json({
    success: false,
    message: 'Database unavailable. Try again in a moment.',
  })
}
