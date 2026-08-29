import api from '../axios';
import { clearReportApiCache } from './reportApi';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled' | 'held' | 'completed';

export interface OrderAddress {
  id: number;
  name: string;
  district: string;
  street: string;
  phone: string;
}

export interface OrderItem {
  id: number;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  menuitem?: { id: number; name: string; price: number; imageUrl?: string; description?: string };
}

export interface OrderCreator {
  id: number;
  fullName: string;
  role?: { id: number; name: string };
}

export interface Order {
  id: number;
  tableId: number;
  status: OrderStatus;
  total: number;
  taxAmount: number;
  subTotal: number;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed' | string | null;
  discountValue?: number;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  orderType?: string;
  orderitem: OrderItem[];
  table?: { id: number; number: number };
  address?: OrderAddress;
  user?: OrderCreator | null;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrderPayload {
  tableId?: number;
  addressId?: number;
  type?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  status?: string;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  items: {
    menuItemId: number;
    quantity: number;
    unitPrice?: number;
    tax?: number;
    discountAmount?: number;
  }[];
}

export interface PosCheckoutPayload extends CreateOrderPayload {
  paymentMethod: string;
  paymentPhone?: string;
  providerName?: string;
  source?: string;
}

export interface CheckoutResult {
  id: number;
  total: number;
  subTotal: number;
  taxAmount: number;
  status: string;
}

export type GetAllOrdersParams = {
  status?: string;
  onlyMine?: boolean;
  readyPickup?: boolean;
  waiterHistory?: boolean;
  posQueue?: boolean;
  kitchenQueue?: boolean;
  includeServed?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

const ORDERS_TTL_MS = 90 * 1000;
const ORDERS_LS_PREFIX = 'orders_list_';

const memoryCache = new Map<string, { data: Order[]; at: number }>();
const inflight = new Map<string, Promise<Order[]>>();

function readOrdersLocal(key: string): Order[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ORDERS_LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: Order[]; at: number };
    if (Date.now() - parsed.at < ORDERS_TTL_MS) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function writeOrdersLocal(key: string, data: Order[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ORDERS_LS_PREFIX + key, JSON.stringify({ data, at: Date.now() }));
  } catch { /* ignore */ }
}

function cacheKey(params?: GetAllOrdersParams): string {
  return JSON.stringify(params || {});
}

export function clearOrdersListCache(): void {
  memoryCache.clear();
  inflight.clear();
  clearReportApiCache();
  if (typeof window !== 'undefined') {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(ORDERS_LS_PREFIX)) localStorage.removeItem(k);
    }
  }
}

export function peekOrders(params?: GetAllOrdersParams): Order[] | null {
  const key = cacheKey(params);
  const now = Date.now();
  const cached = memoryCache.get(key);
  if (cached && now - cached.at < ORDERS_TTL_MS) return cached.data;
  return readOrdersLocal(key);
}

async function fetchOrdersFromNetwork(params?: GetAllOrdersParams): Promise<Order[]> {
  const key = cacheKey(params);
  const pending = inflight.get(key);
  if (pending) return pending;

  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.onlyMine) query.set('onlyMine', 'true');
  if (params?.readyPickup) query.set('readyPickup', 'true');
  if (params?.waiterHistory) query.set('waiterHistory', 'true');
  if (params?.posQueue) query.set('posQueue', 'true');
  if (params?.kitchenQueue) query.set('kitchenQueue', 'true');
  if (params?.includeServed) query.set('includeServed', 'true');
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.limit) query.set('limit', String(params.limit));

  const request = api
    .get(`/orders/all?${query.toString()}`)
    .then((res) => {
      const data: Order[] = res.data.data || [];
      memoryCache.set(key, { data, at: Date.now() });
      writeOrdersLocal(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, request);
  return request;
}

export const orderApi = {
  createOrder: async (payload: CreateOrderPayload): Promise<Order> => {
    const res = await api.post('/orders', payload);
    clearOrdersListCache();
    return res.data.data;
  },

  posCheckout: async (payload: PosCheckoutPayload): Promise<CheckoutResult> => {
    const res = await api.post('/orders/pos-checkout', payload);
    clearOrdersListCache();
    return res.data.data;
  },

  getAllOrders: async (
    params?: GetAllOrdersParams,
    forceRefresh = false
  ): Promise<Order[]> => {
    const key = cacheKey(params);
    const now = Date.now();
    const cached = memoryCache.get(key);

    if (!forceRefresh && cached && now - cached.at < ORDERS_TTL_MS) {
      return cached.data;
    }

    if (!forceRefresh) {
      const local = readOrdersLocal(key);
      if (local?.length) {
        memoryCache.set(key, { data: local, at: now });
        if (!inflight.has(key)) {
          void fetchOrdersFromNetwork(params).catch(() => local);
        }
        return local;
      }
    }

    return fetchOrdersFromNetwork(params);
  },

  getQueueCounts: async (): Promise<{ kitchenCount: number; readyCount: number }> => {
    const res = await api.get('/orders/counts');
    return res.data.data;
  },

  getOrdersByTable: async (tableId: number): Promise<Order[]> => {
    const res = await api.get(`/orders/table/${tableId}`);
    return res.data.data || [];
  },

  getOrderById: async (id: number): Promise<Order> => {
    const res = await api.get(`/orders/${id}`);
    return res.data.data;
  },

  updateOrder: async (id: number, payload: CreateOrderPayload): Promise<Order> => {
    const res = await api.put(`/orders/${id}`, payload);
    clearOrdersListCache();
    return res.data.data;
  },

  updateStatus: async (id: number, status: OrderStatus): Promise<Order> => {
    const res = await api.patch(`/orders/${id}/status`, { status });
    clearOrdersListCache();
    return res.data.data;
  },

  deleteOrder: async (id: number): Promise<void> => {
    await api.delete(`/orders/${id}`);
    clearOrdersListCache();
  },
};
