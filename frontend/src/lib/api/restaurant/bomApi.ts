import api from '../axios';

export interface BOMItem {
  id: string;
  menuItemId: string;
  ingredientId: string;
  quantity: number;
  menuItem?: { id: string; name: string };
  ingredient?: { id: string; name: string; unit: string };
}

export interface CreateBOMItemPayload {
  menuItemId: string;
  ingredientId: string;
  quantity: number;
}

export interface UpdateBOMItemPayload {
  quantity?: number;
}

export const bomApi = {
  createBOMItem: async (payload: CreateBOMItemPayload): Promise<BOMItem> => {
    const res = await api.post('/bom', payload);
    return res.data.data;
  },

  getAllBOMItems: async (): Promise<BOMItem[]> => {
    const res = await api.get('/bom');
    return res.data.data || [];
  },

  getBOMByMenuItem: async (menuItemId: string): Promise<BOMItem[]> => {
    const res = await api.get(`/bom/menu-item/${menuItemId}`);
    return res.data.data || [];
  },

  updateBOMItem: async (id: string, payload: UpdateBOMItemPayload): Promise<BOMItem> => {
    const res = await api.patch(`/bom/${id}`, payload);
    return res.data.data;
  },

  deleteBOMItem: async (id: string): Promise<void> => {
    await api.delete(`/bom/${id}`);
  },
};
