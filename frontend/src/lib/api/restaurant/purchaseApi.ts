import api from '../axios';

export interface PurchaseLineInput { menuItemId?: number | null; description: string; quantity: number; unit: string; unitCost: number; }
export interface PurchaseLine extends PurchaseLineInput { id: number; lineTotal: number; ingredientId?: number | null; }
export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierId: number;
  purchaseDate: string;
  totalAmount: number;
  notes?: string | null;
  createdAt: string;
  supplier: { id: number; name: string; phone?: string | null };
  lines: PurchaseLine[];
}

export const purchaseApi = {
  getAll: async (): Promise<Purchase[]> => (await api.get('/purchases')).data.data || [],
  getById: async (id: number): Promise<Purchase> => (await api.get(`/purchases/${id}`)).data.data,
  create: async (payload: { supplierId: number; purchaseDate: string; notes?: string; lines: PurchaseLineInput[] }): Promise<Purchase> => (await api.post('/purchases', payload)).data.data,
  remove: async (id: number): Promise<void> => { await api.delete(`/purchases/${id}`); },
};
