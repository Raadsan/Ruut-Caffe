import api from '../axios';
import { MenuItem } from './menuItemApi';

const CATEGORY_TTL_MS = 5 * 60 * 1000;
const WITH_ITEMS_KEY = 'categories_with_items';

let categoryCache: { data: Category[]; at: number } | null = null;
let categoryInflight: Promise<Category[]> | null = null;
let withItemsMem: { data: CategoryWithItems[]; at: number } | null = null;
let withItemsInflight: Promise<CategoryWithItems[]> | null = null;

function readWithItemsLocal(): CategoryWithItems[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WITH_ITEMS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: CategoryWithItems[]; at: number };
    if (Date.now() - parsed.at < CATEGORY_TTL_MS) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function writeWithItemsLocal(data: CategoryWithItems[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WITH_ITEMS_KEY, JSON.stringify({ data, at: Date.now() }));
  } catch { /* ignore */ }
}

async function fetchCategoriesFromNetwork(): Promise<Category[]> {
  const res = await api.get('/categories');
  const data: Category[] = res.data.data || [];
  categoryCache = { data, at: Date.now() };
  return data;
}

async function fetchWithItemsFromNetwork(): Promise<CategoryWithItems[]> {
  const res = await api.get('/categories/with-items');
  const data: CategoryWithItems[] = res.data.data || [];
  withItemsMem = { data, at: Date.now() };
  writeWithItemsLocal(data);
  return data;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface CategoryWithItems extends Category {
  menuitem: MenuItem[];
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export const categoryApi = {
  createCategory: async (payload: CreateCategoryPayload): Promise<Category> => {
    const res = await api.post('/categories', payload);
    categoryApi.clearCategoryCache();
    return res.data.data;
  },

  getAllCategories: async (forceRefresh = false): Promise<Category[]> => {
    const now = Date.now();
    if (!forceRefresh && categoryCache && now - categoryCache.at < CATEGORY_TTL_MS) {
      return categoryCache.data;
    }
    if (categoryInflight && !forceRefresh) return categoryInflight;

    categoryInflight = fetchCategoriesFromNetwork()
      .finally(() => { categoryInflight = null; });
    return categoryInflight;
  },

  clearCategoryCache: () => {
    categoryCache = null;
    categoryInflight = null;
    withItemsMem = null;
    withItemsInflight = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(WITH_ITEMS_KEY);
    }
  },

  getCategoriesWithItems: async (forceRefresh = false): Promise<CategoryWithItems[]> => {
    const now = Date.now();
    if (!forceRefresh && withItemsMem && now - withItemsMem.at < CATEGORY_TTL_MS) {
      return withItemsMem.data;
    }

    if (!forceRefresh) {
      const local = readWithItemsLocal();
      if (local?.length) {
        withItemsMem = { data: local, at: now };
        if (!withItemsInflight) {
          withItemsInflight = fetchWithItemsFromNetwork()
            .catch(() => local)
            .finally(() => { withItemsInflight = null; });
        }
        return local;
      }
    }

    if (withItemsInflight && !forceRefresh) return withItemsInflight;

    withItemsInflight = fetchWithItemsFromNetwork()
      .finally(() => { withItemsInflight = null; });
    return withItemsInflight;
  },

  getCategoryWithItemsById: async (id: number): Promise<CategoryWithItems> => {
    const res = await api.get(`/categories/${id}/with-items`);
    return res.data.data;
  },

  updateCategory: async (id: number, payload: UpdateCategoryPayload): Promise<Category> => {
    const res = await api.patch(`/categories/${id}`, payload);
    categoryApi.clearCategoryCache();
    return res.data.data;
  },

  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
    categoryApi.clearCategoryCache();
  },
};
