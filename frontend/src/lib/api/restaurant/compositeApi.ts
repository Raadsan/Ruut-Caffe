import api from '../axios';
import { Category } from './categoryApi';
import { menuItemApi, MenuItem } from './menuItemApi';

export type CompositePricing = 'sum' | 'fixed';

export interface ComboFormData {
  categories: Category[];
  menuItems: MenuItem[];
}

export interface CompositeComponentInput {
  menuItemId: number;
  quantity: number;
}

export interface CompositeComponent {
  id?: number;
  menuItemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
}

export interface CompositeMenuItem extends MenuItem {
  isComposite: true;
  compositePricing: CompositePricing;
  components: CompositeComponent[];
  componentsTotal: number;
  effectivePrice?: number;
  savings?: number;
}

export interface CreateCompositePayload {
  name: string;
  description?: string;
  categoryId: number;
  imageUrl?: string;
  tax?: number;
  isAvailable?: boolean;
  isRecommended?: boolean;
  compositePricing: CompositePricing;
  price?: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  components: CompositeComponentInput[];
}

export type UpdateCompositePayload = Partial<CreateCompositePayload>;

const COMPOSITES_TTL_MS = 5 * 60 * 1000;
const COMPOSITES_CACHE_KEY = 'menu_composites_admin';
const COMBO_FORM_CACHE_KEY = 'combo_form_data';
const COMBO_FORM_TTL_MS = 5 * 60 * 1000;

let compositesMem: { data: CompositeMenuItem[]; at: number } | null = null;
let compositesInflight: Promise<CompositeMenuItem[]> | null = null;
let comboFormMem: { data: ComboFormData; at: number } | null = null;
let comboFormInflight: Promise<ComboFormData> | null = null;

function readCompositesLocal(): CompositeMenuItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COMPOSITES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: CompositeMenuItem[]; at: number };
    if (Date.now() - parsed.at < COMPOSITES_TTL_MS) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function writeCompositesLocal(data: CompositeMenuItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      COMPOSITES_CACHE_KEY,
      JSON.stringify({ data, at: Date.now() })
    );
  } catch { /* ignore */ }
}

async function fetchCompositesFromNetwork(): Promise<CompositeMenuItem[]> {
  const res = await api.get('/composites');
  const data: CompositeMenuItem[] = res.data.data || [];
  compositesMem = { data, at: Date.now() };
  writeCompositesLocal(data);
  return data;
}

function readComboFormLocal(): ComboFormData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COMBO_FORM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: ComboFormData; at: number };
    if (Date.now() - parsed.at < COMBO_FORM_TTL_MS) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function writeComboFormLocal(data: ComboFormData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      COMBO_FORM_CACHE_KEY,
      JSON.stringify({ data, at: Date.now() })
    );
  } catch { /* ignore */ }
}

async function fetchComboFormFromNetwork(): Promise<ComboFormData> {
  const res = await api.get('/composites/form-data');
  const data: ComboFormData = res.data.data || { categories: [], menuItems: [] };
  comboFormMem = { data, at: Date.now() };
  writeComboFormLocal(data);
  return data;
}

export const compositeApi = {
  getAll: async (forceRefresh = false): Promise<CompositeMenuItem[]> => {
    const now = Date.now();
    if (!forceRefresh && compositesMem && now - compositesMem.at < COMPOSITES_TTL_MS) {
      return compositesMem.data;
    }

    if (!forceRefresh) {
      const local = readCompositesLocal();
      if (local) {
        compositesMem = { data: local, at: now };
        if (!compositesInflight) {
          compositesInflight = fetchCompositesFromNetwork()
            .catch(() => local)
            .finally(() => {
              compositesInflight = null;
            });
        }
        return local;
      }
    }

    if (compositesInflight && !forceRefresh) return compositesInflight;

    compositesInflight = fetchCompositesFromNetwork()
      .catch((err) => {
        compositesInflight = null;
        throw err;
      })
      .finally(() => {
        compositesInflight = null;
      });

    return compositesInflight;
  },

  clearCompositeCache: () => {
    compositesMem = null;
    compositesInflight = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(COMPOSITES_CACHE_KEY);
    }
  },

  clearComboFormCache: () => {
    comboFormMem = null;
    comboFormInflight = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(COMBO_FORM_CACHE_KEY);
    }
  },

  getFormData: async (forceRefresh = false): Promise<ComboFormData> => {
    const now = Date.now();
    if (!forceRefresh && comboFormMem && now - comboFormMem.at < COMBO_FORM_TTL_MS) {
      return comboFormMem.data;
    }

    if (!forceRefresh) {
      const local = readComboFormLocal();
      if (local?.categories?.length) {
        comboFormMem = { data: local, at: now };
        if (!comboFormInflight) {
          comboFormInflight = fetchComboFormFromNetwork()
            .catch(() => local)
            .finally(() => {
              comboFormInflight = null;
            });
        }
        return local;
      }
    }

    if (comboFormInflight && !forceRefresh) return comboFormInflight;

    comboFormInflight = fetchComboFormFromNetwork()
      .catch((err) => {
        comboFormInflight = null;
        throw err;
      })
      .finally(() => {
        comboFormInflight = null;
      });

    return comboFormInflight;
  },

  getById: async (id: number): Promise<CompositeMenuItem> => {
    const res = await api.get(`/composites/${id}`);
    return res.data.data;
  },

  create: async (payload: CreateCompositePayload): Promise<CompositeMenuItem> => {
    const res = await api.post('/composites', payload);
    compositeApi.clearCompositeCache();
    compositeApi.clearComboFormCache();
    menuItemApi.clearPosMenuCache();
    return res.data.data;
  },

  update: async (id: number, payload: UpdateCompositePayload): Promise<CompositeMenuItem> => {
    const res = await api.put(`/composites/${id}`, payload);
    compositeApi.clearCompositeCache();
    compositeApi.clearComboFormCache();
    menuItemApi.clearPosMenuCache();
    return res.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/composites/${id}`);
    compositeApi.clearCompositeCache();
    compositeApi.clearComboFormCache();
    menuItemApi.clearPosMenuCache();
  },
};
