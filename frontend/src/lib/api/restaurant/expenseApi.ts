import api from '../axios';

export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  receiver?: string;
  date: string;
  description?: string;
  paymentMethod?: string;
  createdById?: number;
  createdBy?: { fullName: string };
  createdAt?: string;
}

export const expenseApi = {
  getAllExpenses: async (): Promise<Expense[]> => {
    const res = await api.get('/expenses');
    return res.data.data || [];
  },

  createExpense: async (payload: Partial<Expense>): Promise<Expense> => {
    const res = await api.post('/expenses', payload);
    return res.data.data;
  },

  updateExpense: async (id: number, payload: Partial<Expense>): Promise<Expense> => {
    const res = await api.put(`/expenses/${id}`, payload);
    return res.data.data;
  },

  deleteExpense: async (id: number): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  }
};
