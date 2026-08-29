import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'
import prisma from '../config/db.js'
import generateToken from './generateToken.js'

function googleAudiences() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
  ].filter(Boolean)
}

export async function verifyGoogleToken(idToken) {
  const audiences = googleAudiences()
  if (!audiences.length) {
    throw new Error('Google login is not configured on the server')
  }

  const client = new OAuth2Client()
  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences,
  })

  const payload = ticket.getPayload()
  if (!payload?.sub) {
    throw new Error('Invalid Google token')
  }

  return {
    providerId: payload.sub,
    email: payload.email?.trim().toLowerCase() || null,
    fullName: payload.name || payload.email?.split('@')[0] || 'Google User',
    avatarUrl: payload.picture || null,
    emailVerified: payload.email_verified === true,
    phone: null,
    address: null,
    dateOfBirth: null,
    gender: null,
  }
}

function parseFacebookBirthday(value) {
  if (!value || typeof value !== 'string') return null
  const parts = value.split('/')
  if (parts.length !== 3) return null
  const [month, day, year] = parts.map(Number)
  if (!month || !day || !year) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function verifyFacebookToken(accessToken) {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('Facebook login is not configured on the server')
  }

  const debugUrl =
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}` +
    `&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`

  const debugRes = await fetch(debugUrl)
  const debugData = await debugRes.json()

  if (!debugData?.data?.is_valid) {
    throw new Error('Invalid Facebook token')
  }

  const profileUrl =
    `https://graph.facebook.com/me?fields=id,name,email,picture.type(large),birthday,gender,address` +
    `&access_token=${encodeURIComponent(accessToken)}`

  const profileRes = await fetch(profileUrl)
  const profile = await profileRes.json()

  if (!profile?.id) {
    throw new Error('Could not load Facebook profile')
  }

  return {
    providerId: String(profile.id),
    email: profile.email?.trim().toLowerCase() || null,
    fullName: profile.name || 'Facebook User',
    avatarUrl: profile.picture?.data?.url || null,
    emailVerified: Boolean(profile.email),
    phone: null,
    address: typeof profile.address === 'string' ? profile.address : null,
    dateOfBirth: parseFacebookBirthday(profile.birthday),
    gender: typeof profile.gender === 'string' ? profile.gender : null,
  }
}

function normalizeAudience(audience) {
  const normalized = (audience || '').toLowerCase()
  if (normalized === 'customer') return 'client'
  return normalized || 'client'
}

async function getClientRole() {
  let role = await prisma.role.findFirst({
    where: { name: { equals: 'client' } },
  })

  if (!role) {
    role = await prisma.role.findFirst({
      where: { name: { equals: 'Client' } },
    })
  }

  return role
}

async function findUserBySocialProfile(profile, provider) {
  const providerField = provider === 'google' ? 'googleId' : 'facebookId'
  const orConditions = [{ [providerField]: profile.providerId }]

  if (profile.email) {
    orConditions.push({ email: profile.email })
  }

  return prisma.user.findFirst({
    where: { OR: orConditions },
    include: { role: true },
  })
}

export async function loginOrRegisterWithSocial({
  profile,
  provider,
  audience = 'client',
}) {
  const normalizedAudience = normalizeAudience(audience)

  if (!profile.email && normalizedAudience === 'client') {
    throw new Error('EMAIL_REQUIRED')
  }

  const providerField = provider === 'google' ? 'googleId' : 'facebookId'
  let user = await findUserBySocialProfile(profile, provider)

  if (user) {
    if (!user.isActive) {
      throw new Error('INACTIVE')
    }
    const roleName = user.role?.name?.toLowerCase() || ''
    if (normalizedAudience === 'staff' && roleName === 'client') {
      throw new Error('STAFF_ONLY')
    }

    const updates = {}
    if (!user[providerField]) updates[providerField] = profile.providerId
    if (!user.authProvider || user.authProvider === 'local') {
      updates.authProvider = provider
    }
    if (profile.avatarUrl && !user.avatarUrl) {
      updates.avatarUrl = profile.avatarUrl
    }
    if (!user.fullName && profile.fullName) {
      updates.fullName = profile.fullName
    }
    if (!user.phone && profile.phone) {
      updates.phone = profile.phone
    }
    if (!user.address && profile.address) {
      updates.address = profile.address
    }
    if (!user.dateOfBirth && profile.dateOfBirth) {
      updates.dateOfBirth = profile.dateOfBirth
    }
    if (!user.gender && profile.gender) {
      updates.gender = profile.gender
    }

    if (Object.keys(updates).length) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updates,
        include: { role: true },
      })
    }
  } else if (normalizedAudience === 'client') {
    const role = await getClientRole()
    if (!role) {
      throw new Error('CLIENT_ROLE_MISSING')
    }

    const randomPassword = await bcrypt.hash(
      `social-${provider}-${profile.providerId}-${Date.now()}`,
      10,
    )

    user = await prisma.user.create({
      data: {
        fullName: profile.fullName,
        email: profile.email,
        password: randomPassword,
        authProvider: provider,
        [providerField]: profile.providerId,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        address: profile.address,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        roleId: role.id,
        updatedAt: new Date(),
      },
      include: { role: true },
    })
  } else {
    throw new Error('NO_ACCOUNT')
  }

  if (!user.isActive) {
    throw new Error('INACTIVE')
  }

  const token = generateToken(user)

  await prisma.auditlog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entity: 'AUTH',
      description: `User ${user.fullName} logged in with ${provider}.`,
    },
  })

  const { password, role, ...rest } = user
  return {
    token,
    user: {
      ...rest,
      role: role.name,
      roleId: user.roleId,
      roleDescription: role.description,
    },
  }
}
