import api from '../axios';

export type PaymentMethod = 'cash' | 'card' | 'online' | 'evc_plus' | 'edahab' | 'premier_wallet';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt?: string;
}

export interface CreatePaymentPayload {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  phone?: string;
  providerName?: string;
}

export const paymentApi = {
  createPublicPayment: async (payload: CreatePaymentPayload): Promise<Payment> => {
    const res = await api.post('/payments/pay', payload);
    return res.data.data;
  },

  confirmPublicPayment: async (id: string): Promise<Payment> => {
    const res = await api.patch(`/payments/pay/${id}/confirm`);
    return res.data.data;
  },

  createPayment: async (payload: CreatePaymentPayload): Promise<Payment> => {
    const res = await api.post('/payments', payload);
    return res.data.data;
  },

  processWaafiPayment: async (orderId: number, phone: string): Promise<Payment> => {
    const res = await api.post('/payments/waafi', { orderId, phone });
    return res.data.data;
  },

  getAllPayments: async (): Promise<Payment[]> => {
    const res = await api.get('/payments');
    return res.data.data || [];
  },

  getPaymentByOrderId: async (orderId: string): Promise<Payment> => {
    const res = await api.get(`/payments/order/${orderId}`);
    return res.data.data;
  },

  getPaymentById: async (id: string): Promise<Payment> => {
    const res = await api.get(`/payments/${id}`);
    return res.data.data;
  },

  updatePaymentStatus: async (id: string, status: PaymentStatus): Promise<Payment> => {
    const res = await api.patch(`/payments/${id}/status`, { status });
    return res.data.data;
  },

  deletePayment: async (id: string): Promise<void> => {
    await api.delete(`/payments/${id}`);
  },
};
