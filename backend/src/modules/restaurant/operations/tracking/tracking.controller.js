import prisma from '../../../../config/db.js'

export const trackingController = {
  // Get all logs
  getAllLogs: async (req, res) => {
    try {
      const logs = await prisma.auditlog.findMany({
        include: {
          user: {
            select: {
              fullName: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      res.status(200).json({ success: true, data: logs });
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },

  // Log an action (Internal helper usage)
  logAction: async (userId, action, entity, entityId, description) => {
    try {
      await prisma.auditlog.create({
        data: {
          userId,
          action,
          entity,
          entityId: entityId ? parseInt(entityId) : null,
          description
        }
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
};
