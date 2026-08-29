import api from '../axios';

export type MovementType = 'in' | 'out' | 'adjustment';

export interface StockMovement {
  id: string;
  ingredientId: string;
  type: MovementType;
  quantity: number;
  notes?: string;
  note?: string;
  ingredient?: { id: string; name: string; unit: string };
  createdAt?: string;
}

export interface CreateStockMovementPayload {
  ingredientId: string;
  type: MovementType;
  quantity: number;
  notes?: string;
  note?: string;
}

export const stockMovementApi = {
  createStockMovement: async (payload: CreateStockMovementPayload): Promise<StockMovement> => {
    const res = await api.post('/stock-movements', {
      ...payload,
      note: payload.notes || payload.note
    });
    const data = res.data.data;
    return { ...data, note: data.note, notes: data.note };
  },

  getAllStockMovements: async (): Promise<StockMovement[]> => {
    const res = await api.get('/stock-movements/all');
    return (res.data.data || []).map((m: any) => ({ ...m, note: m.note, notes: m.note }));
  },

  getStockMovementsByIngredient: async (ingredientId: string): Promise<StockMovement[]> => {
    const res = await api.get(`/stock-movements/ingredient/${ingredientId}`);
    return (res.data.data || []).map((m: any) => ({ ...m, note: m.note, notes: m.note }));
  },

  getStockMovementById: async (id: string): Promise<StockMovement> => {
    const res = await api.get(`/stock-movements/${id}`);
    const data = res.data.data;
    return { ...data, note: data.note, notes: data.note };
  },

  deleteStockMovement: async (id: string): Promise<void> => {
    await api.delete(`/stock-movements/${id}`);
  },
};
