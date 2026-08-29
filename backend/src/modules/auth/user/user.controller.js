import prisma from '../../../config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logAudit } from '../../../utils/auditHelper.js';
import { clearAuthCaches } from '../../../middlewares/authMiddleware.js';

// Backend in-memory cache to bypass remote DB latency for the users list
let cachedUsersList = null;
let cachedUsersAt = 0;
let usersFetchInflight = null;
const USERS_LIST_TTL = 2 * 60 * 1000;

export const clearUsersCache = () => {
  cachedUsersList = null;
  cachedUsersAt = 0;
  usersFetchInflight = null;
};

function sanitizeUser(user) {
  if (!user) return user;
  const { password, posPin, ...rest } = user;
  return rest;
}

function isValidPosPin(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

function isPosRole(role) {
  return role?.name?.toLowerCase() === 'pos';
}

async function generateUniquePosEmail(username) {
  const base = `pos.${username}@internal.local`;
  let email = base;
  let suffix = 0;

  while (await prisma.user.findUnique({ where: { email } })) {
    suffix += 1;
    email = `pos.${username}.${suffix}@internal.local`;
  }

  return email;
}

async function validateUsername(username, excludeUserId) {
  if (!username) return null;
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(normalized)) {
    return 'Username must be 3–30 characters (letters, numbers, . _ -)';
  }
  const existing = await prisma.user.findUnique({ where: { username: normalized } });
  if (existing && existing.id !== excludeUserId) {
    return 'Username already taken';
  }
  return null;
}

// CREATE USER
export const createUser = async (req, res) => {
  try {
    let { fullName, email, phone, password, roleId, isActive, username, posPin } = req.body

    fullName = fullName?.trim()
    email = email?.trim().toLowerCase()
    phone = phone?.trim()
    username = username?.trim().toLowerCase() || null

    if (!fullName || !roleId) {
      return res.status(400).json({
        success: false,
        message: 'fullName and roleId are required'
      })
    }

    roleId = parseInt(roleId)

    if (isNaN(roleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid roleId'
      })
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId }
    })

    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      })
    }

    const posRole = isPosRole(existingRole)

    if (posRole) {
      if (!username) {
        return res.status(400).json({
          success: false,
          message: 'Username is required for POS staff',
        })
      }

      if (!posPin || !isValidPosPin(String(posPin))) {
        return res.status(400).json({
          success: false,
          message: 'POS PIN must be exactly 6 digits',
        })
      }

      if (!email) {
        email = await generateUniquePosEmail(username)
      }

      if (!password) {
        password = crypto.randomBytes(24).toString('hex')
      }
    } else {
      username = null
      posPin = null

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        })
      }
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      })
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email }
    })

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      })
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone }
      }).catch(() => null)

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: 'Phone already exists'
        })
      }
    }

    if (posRole) {
      const usernameError = await validateUsername(username)
      if (usernameError) {
        return res.status(400).json({ success: false, message: usernameError })
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const hashedPosPin = posRole
      ? await bcrypt.hash(String(posPin), 10)
      : null

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        username: posRole ? username : null,
        posPin: hashedPosPin,
        password: hashedPassword,
        roleId,
        isActive: typeof isActive === 'boolean' ? isActive : true
      },
      include: {
        role: true
      }
    })

    const userWithoutSecrets = sanitizeUser(user)

    logAudit({ userId: req.user?.id, action: 'Created', entity: 'User', entityId: user.id, description: `Created user "${user.fullName}"` })
    clearAuthCaches()
    clearUsersCache()

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userWithoutSecrets
    })
  } catch (error) {
    console.error('Create User Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    })
  }
}

// UPDATE USER
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    let { fullName, email, phone, password, roleId, isActive, username, posPin } = req.body

    const userId = parseInt(id)

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user id'
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    if (email) {
      email = email.trim().toLowerCase()
    }

    if (phone) {
      phone = phone.trim()
    }

    if (roleId !== undefined) {
      roleId = parseInt(roleId)

      if (isNaN(roleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid roleId'
        })
      }

      const existingRole = await prisma.role.findUnique({
        where: { id: roleId }
      })

      if (!existingRole) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        })
      }
    }

    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      })

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        })
      }
    }

    if (phone && phone !== existingUser.phone) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone }
      }).catch(() => null)

      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: 'Phone already exists'
        })
      }
    }

    let hashedPassword = existingUser.password

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        })
      }

      hashedPassword = await bcrypt.hash(password, 10)
    }

    const targetRoleId = roleId ?? existingUser.roleId
    const targetRole = await prisma.role.findUnique({ where: { id: targetRoleId } })
    const posRole = isPosRole(targetRole)

    let nextUsername = null
    let nextPosPin = null

    if (posRole) {
      nextUsername =
        username !== undefined
          ? username?.trim().toLowerCase() || null
          : existingUser.username

      if (!nextUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username is required for POS staff',
        })
      }

      const usernameError = await validateUsername(nextUsername, userId)
      if (usernameError) {
        return res.status(400).json({ success: false, message: usernameError })
      }

      if (posPin !== undefined) {
        if (posPin === null || posPin === '') {
          nextPosPin = existingUser.posPin
        } else if (!isValidPosPin(String(posPin))) {
          return res.status(400).json({
            success: false,
            message: 'POS PIN must be exactly 6 digits',
          })
        } else {
          nextPosPin = await bcrypt.hash(String(posPin), 10)
        }
      } else {
        nextPosPin = existingUser.posPin
      }

      if (!nextPosPin) {
        return res.status(400).json({
          success: false,
          message: 'POS PIN must be exactly 6 digits',
        })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName ?? existingUser.fullName,
        email: email ?? existingUser.email,
        phone: phone !== undefined ? phone : existingUser.phone,
        username: nextUsername,
        posPin: nextPosPin,
        password: hashedPassword,
        roleId: roleId ?? existingUser.roleId,
        isActive: typeof isActive === 'boolean' ? isActive : existingUser.isActive
      },
      include: {
        role: true
      }
    })

    const userWithoutSecrets = sanitizeUser(updatedUser)

    logAudit({ userId: req.user?.id, action: 'Updated', entity: 'User', entityId: updatedUser.id, description: `Updated user "${updatedUser.fullName}"` })
    clearAuthCaches()
    clearUsersCache()

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: userWithoutSecrets
    })
  } catch (error) {
    console.error('Update User Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    })
  }
}

// GET ALL USERS
export const getAllUsers = async (req, res) => {
  try {
    const now = Date.now();
    const forceRefresh = String(req.query.refresh || '').toLowerCase() === 'true';
    if (!forceRefresh && cachedUsersList && now - cachedUsersAt < USERS_LIST_TTL) {
      return res.status(200).json({
        success: true,
        count: cachedUsersList.length,
        data: cachedUsersList,
      });
    }

    if (!forceRefresh && usersFetchInflight) {
      const data = await usersFetchInflight;
      return res.status(200).json({
        success: true,
        count: data.length,
        data,
      });
    }

    usersFetchInflight = prisma.user
      .findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true,
          phone: true,
          isActive: true,
          roleId: true,
          createdAt: true,
          updatedAt: true,
          role: { select: { id: true, name: true } },
        },
        orderBy: { id: 'asc' },
      })
      .then((users) => {
        cachedUsersList = users;
        cachedUsersAt = Date.now();
        usersFetchInflight = null;
        return users;
      })
      .catch((err) => {
        usersFetchInflight = null;
        throw err;
      });

    const usersWithoutPasswords = await usersFetchInflight;

    res.status(200).json({
      success: true,
      count: usersWithoutPasswords.length,
      data: usersWithoutPasswords,
    });
  } catch (error) {
    console.error('[GetAllUsers] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
};

// DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user id'
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    await prisma.user.delete({
      where: { id: userId }
    })

    logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'User', entityId: userId, description: `Deleted user "${existingUser.fullName}"` })
    clearAuthCaches()
    clearUsersCache()

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    })
  } catch (error) {
    console.error('Delete User Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    })
  }
}

// GET USERS BY ROLE ID
export const getUsersByRole = async (req, res) => {
  try {
    const { roleId } = req.params
    const parsedRoleId = parseInt(roleId)

    if (isNaN(parsedRoleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role id'
      })
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: parsedRoleId }
    })

    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      })
    }

    const users = await prisma.user.findMany({
      where: {
        roleId: parsedRoleId
      },
      include: {
        role: true
      },
      orderBy: {
        id: 'asc'
      }
    })

    const usersWithoutPasswords = users.map((user) => sanitizeUser(user))

    res.status(200).json({
      success: true,
      role: existingRole.name,
      count: usersWithoutPasswords.length,
      data: usersWithoutPasswords
    })
  } catch (error) {
    console.error('Get Users By Role Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users by role',
      error: error.message
    })
  }
}

