import prisma from '../config/db.js'

/**
 * Helper to create audit log entries from any controller.
 * Call this after successful create/update/delete operations.
 * 
 * @param {Object} params
 * @param {number|null} params.userId - ID of the user performing the action
 * @param {string} params.action - Action performed (e.g. "Created", "Updated", "Deleted")
 * @param {string} params.entity - Entity type (e.g. "Order", "MenuItem", "Category")
 * @param {number|null} params.entityId - ID of the affected entity
 * @param {string|null} params.description - Optional description of what happened
 */
export const logAudit = async ({ userId = null, action, entity, entityId = null, description = null }) => {
  try {
    await prisma.auditlog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        description
      }
    })
  } catch (error) {
    // Never let audit logging break the main operation
    console.error('Audit Log Error:', error.message)
  }
}
