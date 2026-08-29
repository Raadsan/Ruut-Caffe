import api from '../axios';

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entity: string;
  entityId: number | null;
  description: string | null;
  createdAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
    role?: { id: number; name: string };
  } | null;
}

export const auditLogApi = {
  getAllLogs: async (): Promise<AuditLog[]> => {
    const res = await api.get('/audit-logs/all');
    return res.data.data || [];
  },

  getLogById: async (id: number): Promise<AuditLog> => {
    const res = await api.get(`/audit-logs/${id}`);
    return res.data.data;
  },

  getLogsByUser: async (userId: number): Promise<AuditLog[]> => {
    const res = await api.get(`/audit-logs/user/${userId}`);
    return res.data.data || [];
  },

  getLogsByEntity: async (entity: string): Promise<AuditLog[]> => {
    const res = await api.get(`/audit-logs/entity/${entity}`);
    return res.data.data || [];
  },

  deleteLog: async (id: number): Promise<void> => {
    await api.delete(`/audit-logs/${id}`);
  },
};
