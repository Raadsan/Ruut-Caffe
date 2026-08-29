import api from '../axios';

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  stockQuantity: number;
  minStockLevel: number;
  costPerUnit: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateIngredientPayload {
  name: string;
  unit: string;
  stockQuantity: number;
  minStockLevel: number;
  costPerUnit?: number;
}

export interface UpdateIngredientPayload {
  name?: string;
  unit?: string;
  stockQuantity?: number;
  minStockLevel?: number;
  costPerUnit?: number;
  isActive?: boolean;
}

export const ingredientApi = {
  createIngredient: async (payload: CreateIngredientPayload): Promise<Ingredient> => {
    const res = await api.post('/ingredients', payload);
    return res.data.data;
  },

  getAllIngredients: async (): Promise<Ingredient[]> => {
    const res = await api.get('/ingredients');
    return res.data.data || [];
  },

  getIngredientById: async (id: number): Promise<Ingredient> => {
    const res = await api.get(`/ingredients/${id}`);
    return res.data.data;
  },

  updateIngredient: async (id: number, payload: UpdateIngredientPayload): Promise<Ingredient> => {
    const res = await api.put(`/ingredients/${id}`, payload);
    return res.data.data;
  },

  deleteIngredient: async (id: number): Promise<void> => {
    await api.delete(`/ingredients/${id}`);
  },
};
