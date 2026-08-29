import prisma from '../../../config/db.js'
import { logAudit } from '../../../utils/auditHelper.js'

// Backend in-memory cache to completely bypass remote DB latency for fetching the roles list
let cachedRolesList = null;
let cachedRolesAt = 0;
const ROLES_LIST_TTL = 60 * 1000;

export const clearRolesCache = () => {
  cachedRolesList = null;
  cachedRolesAt = 0;
};

// CREATE ROLE
export const createRole = async (req, res) => {
  try {
    let { name, description } = req.body

    name = name?.trim().toLowerCase()
    description = description?.trim()

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required'
      })
    }

    const existingRole = await prisma.role.findUnique({
      where: { name }
    })

    if (existingRole) {
      return res.status(409).json({
        success: false,
        message: 'Role already exists'
      })
    }

    const role = await prisma.role.create({
      data: {
        name,
        description: description || null
      }
    })

    logAudit({ userId: req.user?.id, action: 'Created', entity: 'Role', entityId: role.id, description: `Created role "${role.name}"` })
    clearRolesCache()

    return res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
    })
  } catch (error) {
    console.error('Create Role Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: error.message
    })
  }
}

// GET ALL ROLES
export const getAllRoles = async (req, res) => {
  try {
    if (cachedRolesList && Date.now() - cachedRolesAt < ROLES_LIST_TTL) {
      return res.status(200).json({
        success: true,
        count: cachedRolesList.length,
        data: cachedRolesList
      })
    }

    const roles = await prisma.role.findMany({
      orderBy: {
        id: 'asc'
      }
    })

    cachedRolesList = roles // populate cache
    cachedRolesAt = Date.now()

    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles
    })
  } catch (error) {
    console.error('Get Roles Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
      error: error.message
    })
  }
}

// UPDATE ROLE
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params
    let { name, description } = req.body

    const roleId = parseInt(id)

    if (isNaN(roleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role id'
      })
    }

    name = name?.trim().toLowerCase()
    description = description?.trim()

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId }
    })

    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      })
    }

    if (name) {
      const duplicateRole = await prisma.role.findFirst({
        where: {
          name,
          NOT: { id: roleId }
        }
      })

      if (duplicateRole) {
        return res.status(409).json({
          success: false,
          message: 'Another role with this name already exists'
        })
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: name ?? existingRole.name,
        description: description !== undefined ? description : existingRole.description
      }
    })

    logAudit({ userId: req.user?.id, action: 'Updated', entity: 'Role', entityId: updatedRole.id, description: `Updated role "${updatedRole.name}"` })
    clearRolesCache()

    return res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: updatedRole
    })
  } catch (error) {
    console.error('Update Role Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: error.message
    })
  }
}

// DELETE ROLE
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params
    const roleId = parseInt(id)

    if (isNaN(roleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role id'
      })
    }

    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        user: true
      }
    })

    if (!existingRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      })
    }

    if (existingRole.user.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete role because it is assigned to one or more users'
      })
    }

    await prisma.role.delete({
      where: { id: roleId }
    })

    logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'Role', entityId: roleId, description: `Deleted role "${existingRole.name}"` })
    clearRolesCache()

    return res.status(200).json({
      success: true,
      message: 'Role deleted successfully'
    })
  } catch (error) {
    console.error('Delete Role Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
      error: error.message
    })
  }
}