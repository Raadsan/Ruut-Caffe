import api from '../axios';

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  entity: string;
  entityId?: number;
  description: string;
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
  };
}

export const trackingApi = {
  getAllLogs: async (): Promise<AuditLog[]> => {
    const res = await api.get('/tracking/all');
    return res.data.data || [];
  }
};
