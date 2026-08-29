import api from '../axios';

const POS_MENU_TTL_MS = 2 * 60 * 1000;
const ALL_MENU_ITEMS_TTL_MS = 5 * 60 * 1000;
const ALL_MENU_ITEMS_KEY = 'all_menu_items_admin';

let posMenuCache: { data: MenuItem[]; at: number } | null = null;
let posMenuInflight: Promise<MenuItem[]> | null = null;
let allMenuItemsMem: { data: MenuItem[]; at: number } | null = null;
let allMenuItemsInflight: Promise<MenuItem[]> | null = null;

function readAllMenuItemsLocal(): MenuItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ALL_MENU_ITEMS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: MenuItem[]; at: number };
    if (Date.now() - parsed.at < ALL_MENU_ITEMS_TTL_MS) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function writeAllMenuItemsLocal(data: MenuItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      ALL_MENU_ITEMS_KEY,
      JSON.stringify({ data, at: Date.now() })
    );
  } catch { /* ignore */ }
}

async function fetchAllMenuItemsFromNetwork(): Promise<MenuItem[]> {
  const res = await api.get('/menu-items/all');
  const data: MenuItem[] = res.data.data || [];
  allMenuItemsMem = { data, at: Date.now() };
  writeAllMenuItemsLocal(data);
  return data;
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  costPrice?: number;
  price: number;
  tax: number;
  discountType?: 'percentage' | 'fixed' | string | null;
  discountValue?: number;
  imageUrl?: string;
  isAvailable: boolean;
  isSellable?: boolean;
  isPurchasable?: boolean;
  isRecommended: boolean;
  categoryId: number;
  category?: { id: number; name: string };
  /** POS variants e.g. ["Small", "Medium", "Large"] */
  options?: string[] | null;
  isComposite?: boolean;
  compositePricing?: 'sum' | 'fixed';
  components?: Array<{
    id?: number;
    menuItemId: number;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    imageUrl?: string | null;
    isAvailable?: boolean;
  }>;
  componentsTotal?: number;
  savings?: number;
  effectivePrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMenuItemPayload {
  name: string;
  description?: string;
  costPrice?: number;
  price: number;
  tax?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  imageUrl?: string;
  isAvailable?: boolean;
  isSellable?: boolean;
  isPurchasable?: boolean;
  isRecommended?: boolean;
  categoryId: number;
  options?: string[] | string | null;
}

export interface UpdateMenuItemPayload {
  name?: string;
  description?: string;
  costPrice?: number;
  price?: number;
  tax?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  imageUrl?: string;
  isAvailable?: boolean;
  isSellable?: boolean;
  isPurchasable?: boolean;
  isRecommended?: boolean;
  categoryId?: number;
  options?: string[] | string | null;
}

export function parseMenuItemOptions(product: { options?: string[] | string | null }): string[] {
  const raw = product.options;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    const str = raw;
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return str.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export const menuItemApi = {
  createMenuItem: async (payload: CreateMenuItemPayload): Promise<MenuItem> => {
    const res = await api.post('/menu-items', payload);
    return res.data.data;
  },

  getAllMenuItems: async (forceRefresh = false): Promise<MenuItem[]> => {
    const now = Date.now();
    if (!forceRefresh && allMenuItemsMem && now - allMenuItemsMem.at < ALL_MENU_ITEMS_TTL_MS) {
      return allMenuItemsMem.data;
    }

    if (!forceRefresh) {
      const local = readAllMenuItemsLocal();
      if (local?.length) {
        allMenuItemsMem = { data: local, at: now };
        if (!allMenuItemsInflight) {
          allMenuItemsInflight = fetchAllMenuItemsFromNetwork()
            .catch(() => local)
            .finally(() => {
              allMenuItemsInflight = null;
            });
        }
        return local;
      }
    }

    if (allMenuItemsInflight && !forceRefresh) return allMenuItemsInflight;

    allMenuItemsInflight = fetchAllMenuItemsFromNetwork()
      .catch((err) => {
        allMenuItemsInflight = null;
        throw err;
      })
      .finally(() => {
        allMenuItemsInflight = null;
      });

    return allMenuItemsInflight;
  },

  /** Lightweight catalog for POS — cached, no heavy fields. */
  getPosMenuCatalog: async (forceRefresh = false): Promise<MenuItem[]> => {
    const now = Date.now();
    if (!forceRefresh && posMenuCache && now - posMenuCache.at < POS_MENU_TTL_MS) {
      return posMenuCache.data;
    }
    if (posMenuInflight && !forceRefresh) return posMenuInflight;

    posMenuInflight = api
      .get(`/menu-items/pos-catalog${forceRefresh ? '?fresh=1' : ''}`)
      .then((res) => {
        const data: MenuItem[] = res.data.data || [];
        posMenuCache = { data, at: Date.now() };
        posMenuInflight = null;
        return data;
      })
      .catch((err) => {
        posMenuInflight = null;
        throw err;
      });

    return posMenuInflight;
  },

  clearPosMenuCache: () => {
    posMenuCache = null;
    posMenuInflight = null;
    allMenuItemsMem = null;
    allMenuItemsInflight = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ALL_MENU_ITEMS_KEY);
    }
  },

  clearAllMenuItemsCache: () => {
    menuItemApi.clearPosMenuCache();
  },

  clearMenuCaches: () => {
    menuItemApi.clearPosMenuCache();
  },

  getMenuItemsByCategory: async (categoryId: number): Promise<MenuItem[]> => {
    const res = await api.get(`/menu-items/category/${categoryId}`);
    return res.data.data || [];
  },

  updateMenuItem: async (id: number, payload: UpdateMenuItemPayload): Promise<MenuItem> => {
    const res = await api.patch(`/menu-items/${id}`, payload);
    return res.data.data;
  },

  deleteMenuItem: async (id: number): Promise<void> => {
    await api.delete(`/menu-items/${id}`);
  },

  /** PUBLIC – customer scans table QR → menu + table info (no auth). */
  getPublicMenuByQrCode: async (qrCode: string): Promise<PublicMenuData> => {
    const res = await api.get(`/menu-items/menu/${encodeURIComponent(qrCode)}`);
    return res.data.data;
  },
};

export interface PublicMenuCategory {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  menuitem: MenuItem[];
}

export interface PublicMenuTable {
  id: number;
  number: number;
  name?: string | null;
}

export interface PublicMenuData {
  table: PublicMenuTable;
  categories: PublicMenuCategory[];
}
