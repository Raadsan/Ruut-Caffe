import api from '../axios';

export interface ReceiptSettings {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  vatNumber?: string;
  footerText?: string;
  updatedAt?: string;
}

export interface UpdateReceiptSettingsPayload {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  vatNumber?: string;
  footerText?: string;
}

const RECEIPT_TTL_MS = 10 * 60 * 1000;
let receiptCache: { data: ReceiptSettings; at: number } | null = null;
let receiptInflight: Promise<ReceiptSettings> | null = null;

export const receiptSettingsApi = {
  getSettings: async (forceRefresh = false): Promise<ReceiptSettings> => {
    const now = Date.now();
    if (!forceRefresh && receiptCache && now - receiptCache.at < RECEIPT_TTL_MS) {
      return receiptCache.data;
    }
    if (receiptInflight && !forceRefresh) return receiptInflight;

    receiptInflight = api
      .get('/receipt-settings')
      .then((res) => {
        const data: ReceiptSettings = res.data.data;
        receiptCache = { data, at: Date.now() };
        receiptInflight = null;
        return data;
      })
      .catch((err) => {
        receiptInflight = null;
        throw err;
      });

    return receiptInflight;
  },

  clearReceiptCache: () => {
    receiptCache = null;
    receiptInflight = null;
  },

  updateSettings: async (payload: UpdateReceiptSettingsPayload): Promise<ReceiptSettings> => {
    const res = await api.patch('/receipt-settings', payload);
    receiptCache = null;
    return res.data.data;
  }
};
