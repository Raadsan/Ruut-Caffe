import api from '../axios';

export type CampaignType = 'discount' | 'advertisement';

export interface CampaignProductLink {
  id: number;
  menuItemId: number;
  menuitem?: {
    id: number;
    name: string;
    price: number;
    imageUrl?: string | null;
    isAvailable: boolean;
    categoryId: number;
  };
}

export interface DiscountAdvertisement {
  id: number;
  type: CampaignType;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  discountPercent?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive: boolean;
  isCurrentlyActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  products?: CampaignProductLink[];
}

export interface CreateCampaignPayload {
  type: CampaignType;
  title?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  discountPercent?: number;
  startAt?: string;
  endAt?: string;
  isActive?: boolean;
  menuItemIds?: number[];
}

export interface UpdateCampaignPayload extends Partial<CreateCampaignPayload> {}

export const discountAdvertisementApi = {
  getAll: async (): Promise<DiscountAdvertisement[]> => {
    const res = await api.get('/discount-advertisements/all');
    return res.data.data || [];
  },

  getById: async (id: number): Promise<DiscountAdvertisement> => {
    const res = await api.get(`/discount-advertisements/${id}`);
    return res.data.data;
  },

  create: async (payload: CreateCampaignPayload): Promise<DiscountAdvertisement> => {
    const res = await api.post('/discount-advertisements', payload);
    return res.data.data;
  },

  update: async (id: number, payload: UpdateCampaignPayload): Promise<DiscountAdvertisement> => {
    const res = await api.patch(`/discount-advertisements/${id}`, payload);
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/discount-advertisements/${id}`);
  },
};
