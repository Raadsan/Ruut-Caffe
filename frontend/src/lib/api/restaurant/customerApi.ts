import api from '../axios';

const POS_CUSTOMER_TTL_MS = 5 * 60 * 1000;
let posCustomerCache: { data: Customer[]; at: number } | null = null;
let posCustomerInflight: Promise<Customer[]> | null = null;

export interface Customer {
  id: number;
  fullName: string;
  phone: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  totalOrders?: number;
  lastOrderDate?: string | null;
}

export interface CreateCustomerPayload {
  fullName: string;
  phone: string;
  email?: string;
}

export const customerApi = {
  /** Lightweight list for POS — id, name, phone only (cached). */
  getPosCustomers: async (forceRefresh = false): Promise<Customer[]> => {
    const now = Date.now();
    if (!forceRefresh && posCustomerCache && now - posCustomerCache.at < POS_CUSTOMER_TTL_MS) {
      return posCustomerCache.data;
    }
    if (posCustomerInflight && !forceRefresh) return posCustomerInflight;

    posCustomerInflight = api
      .get('/customers/pos-list')
      .then((res) => {
        const data: Customer[] = res.data.data || [];
        posCustomerCache = { data, at: Date.now() };
        posCustomerInflight = null;
        return data;
      })
      .catch((err) => {
        posCustomerInflight = null;
        throw err;
      });

    return posCustomerInflight;
  },

  clearPosCustomerCache: () => {
    posCustomerCache = null;
    posCustomerInflight = null;
  },

  getAllCustomers: async (): Promise<Customer[]> => {
    const res = await api.get('/customers/all');
    return res.data.data || [];
  },

  getCustomerById: async (id: number): Promise<Customer> => {
    const res = await api.get(`/customers/${id}`);
    return res.data.data;
  },

  getCustomerByPhone: async (phone: string): Promise<Customer | null> => {
    const trimmed = phone.trim();
    if (!trimmed) return null;
    try {
      const res = await api.get(`/customers/by-phone/${encodeURIComponent(trimmed)}`);
      return res.data.data;
    } catch {
      return null;
    }
  },

  createCustomer: async (payload: CreateCustomerPayload): Promise<Customer> => {
    const res = await api.post('/customers', payload);
    posCustomerCache = null;
    return res.data.data;
  },

  updateCustomer: async (id: number, payload: Partial<CreateCustomerPayload>): Promise<Customer> => {
    const res = await api.put(`/customers/${id}`, payload);
    return res.data.data;
  },

  deleteCustomer: async (id: number): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },
};
