import api from '../axios';

export type TableStatus = 'active' | 'inactive';

export interface Table {
  id: number;
  number: number;
  name?: string;
  description?: string | null;
  capacity?: number;
  status: TableStatus;
  qrCode?: string;
  createdAt?: string;
}

export interface CreateTablePayload {
  number: number;
  name?: string;
  description?: string | null;
  capacity?: number;
  status?: TableStatus;
}

export interface UpdateTablePayload {
  number?: number;
  name?: string;
  description?: string | null;
  capacity?: number;
  status?: TableStatus;
}

const TABLE_TTL_MS = 5 * 60 * 1000;
let tableCache: { data: Table[]; at: number } | null = null;
let tableInflight: Promise<Table[]> | null = null;

export const tableApi = {
  createTable: async (payload: CreateTablePayload): Promise<Table> => {
    const res = await api.post('/tables', payload);
    tableCache = null;
    return res.data.data;
  },

  getAllTables: async (forceRefresh = false): Promise<Table[]> => {
    const now = Date.now();
    if (!forceRefresh && tableCache && now - tableCache.at < TABLE_TTL_MS) {
      return tableCache.data;
    }
    if (tableInflight && !forceRefresh) return tableInflight;

    tableInflight = api
      .get('/tables/all')
      .then((res) => {
        const data: Table[] = res.data.data || [];
        tableCache = { data, at: Date.now() };
        tableInflight = null;
        return data;
      })
      .catch((err) => {
        tableInflight = null;
        throw err;
      });

    return tableInflight;
  },

  clearTableCache: () => {
    tableCache = null;
    tableInflight = null;
  },

  updateTable: async (id: string | number, payload: UpdateTablePayload): Promise<Table> => {
    const res = await api.patch(`/tables/${id}`, payload);
    tableCache = null;
    return res.data.data;
  },

  deleteTable: async (id: string | number): Promise<void> => {
    await api.delete(`/tables/${id}`);
    tableCache = null;
  },
};
