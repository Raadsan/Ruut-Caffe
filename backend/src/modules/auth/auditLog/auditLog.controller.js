import prisma from '../../../config/db.js'

// CREATE AUDIT LOG,,,,,,,
export const createAuditLog = async (req, res) => {
  try {
    let { userId, action, entity, entityId, description } = req.body

    if (!action || !entity) {
      return res.status(400).json({
        success: false,
        message: 'action and entity are required'
      })
    }

    userId = userId ? Number(userId) : null
    entityId = entityId ? Number(entityId) : null

    if (userId && isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user id'
      })
    }

    if (entityId && isNaN(entityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity id'
      })
    }

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        })
      }
    }

    const auditLog = await prisma.auditlog.create({
      data: {
        userId,
        action: action.trim(),
        entity: entity.trim(),
        entityId,
        description: description?.trim() || null
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Audit log created successfully',
      data: auditLog
    })
  } catch (error) {
    console.error('Create AuditLog Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to create audit log',
      error: error.message
    })
  }
}

// GET ALL AUDIT LOGS
export const getAllAuditLogs = async (req, res) => {
  try {
    const auditLogs = await prisma.auditlog.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      count: auditLogs.length,
      data: auditLogs
    })
  } catch (error) {
    console.error('Get AuditLogs Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    })
  }
}

// GET AUDIT LOG BY ID
export const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params
    const auditLogId = Number(id)

    if (isNaN(auditLogId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audit log id'
      })
    }

    const auditLog = await prisma.auditlog.findUnique({
      where: { id: auditLogId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: auditLog
    })
  } catch (error) {
    console.error('Get AuditLog By Id Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit log',
      error: error.message
    })
  }
}

// GET AUDIT LOGS BY USER
export const getAuditLogsByUser = async (req, res) => {
  try {
    const { userId } = req.params
    const parsedUserId = Number(userId)

    if (isNaN(parsedUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user id'
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: parsedUserId },
      include: {
        role: true
      }
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    const auditLogs = await prisma.auditlog.findMany({
      where: {
        userId: parsedUserId
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name
      },
      count: auditLogs.length,
      data: auditLogs
    })
  } catch (error) {
    console.error('Get AuditLogs By User Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user audit logs',
      error: error.message
    })
  }
}

// GET AUDIT LOGS BY ENTITY
export const getAuditLogsByEntity = async (req, res) => {
  try {
    const { entity } = req.params

    const auditLogs = await prisma.auditlog.findMany({
      where: {
        entity: entity.trim()
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      entity,
      count: auditLogs.length,
      data: auditLogs
    })
  } catch (error) {
    console.error('Get AuditLogs By Entity Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch entity audit logs',
      error: error.message
    })
  }
}

// DELETE AUDIT LOG
export const deleteAuditLog = async (req, res) => {
  try {
    const { id } = req.params
    const auditLogId = Number(id)

    if (isNaN(auditLogId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audit log id'
      })
    }

    const existingAuditLog = await prisma.auditlog.findUnique({
      where: { id: auditLogId }
    })

    if (!existingAuditLog) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      })
    }

    await prisma.auditlog.delete({
      where: { id: auditLogId }
    })

    return res.status(200).json({
      success: true,
      message: 'Audit log deleted successfully'
    })
  } catch (error) {
    console.error('Delete AuditLog Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete audit log',
      error: error.message
    })
  }
}