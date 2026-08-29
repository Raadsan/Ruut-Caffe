import api from '../axios';

export interface AccountingRecord {
  id: number;
  [key: string]: unknown;
}

export function createAccountingCrudApi<T extends AccountingRecord = AccountingRecord>(resource: string) {
  return {
    getAll: async (): Promise<T[]> => {
      const response = await api.get(resource);
      return response.data.data || [];
    },
    getById: async (id: number): Promise<T> => {
      const response = await api.get(`${resource}/${id}`);
      return response.data.data;
    },
    create: async (data: Omit<Partial<T>, 'id'>): Promise<T> => {
      const response = await api.post(resource, data);
      return response.data.data;
    },
    update: async (id: number, data: Partial<T>): Promise<T> => {
      const response = await api.put(`${resource}/${id}`, data);
      return response.data.data;
    },
    remove: async (id: number): Promise<void> => {
      await api.delete(`${resource}/${id}`);
    },
  };
}
