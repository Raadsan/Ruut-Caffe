import api from '../axios';

export interface User {
  id: number;
  fullName: string;
  email: string;
  username?: string | null;
  phone?: string;
  isActive: boolean;
  roleId: number;
  role?: { id: number; name: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserPayload {
  fullName: string;
  email?: string;
  password?: string;
  roleId: number;
  phone?: string;
  username?: string;
  posPin?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  password?: string;
  roleId?: number;
  phone?: string;
  isActive?: boolean;
  username?: string | null;
  posPin?: string | null;
}

const USERS_CACHE_KEY = 'users_list';
const USERS_TTL_MS = 2 * 60 * 1000;

let memoryCache: { data: User[]; at: number } | null = null;
let inflight: Promise<User[]> | null = null;

function readLocalCache(): User[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User[]) : null;
  } catch {
    return null;
  }
}

function writeLocalCache(data: User[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function clearAllCaches(): void {
  memoryCache = null;
  inflight = null;
  if (typeof window !== 'undefined') localStorage.removeItem(USERS_CACHE_KEY);
}

async function fetchUsersFromNetwork(forceRefresh = false): Promise<User[]> {
  if (inflight) return inflight;

  inflight = api
    .get('/users', { params: forceRefresh ? { refresh: true } : undefined })
    .then((res) => {
      const data: User[] = res.data.data || [];
      memoryCache = { data, at: Date.now() };
      writeLocalCache(data);
      inflight = null;
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });

  return inflight;
}

export const userApi = {
  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const res = await api.post('/users', payload);
    clearAllCaches();
    return res.data.data;
  },

  getAllUsers: async (forceRefresh = false): Promise<User[]> => {
    const now = Date.now();

    if (!forceRefresh && memoryCache && now - memoryCache.at < USERS_TTL_MS) {
      return memoryCache.data;
    }

    if (!forceRefresh) {
      const local = readLocalCache();
      if (local) {
        memoryCache = { data: local, at: now };
        if (!inflight && now - memoryCache.at >= USERS_TTL_MS / 2) {
          fetchUsersFromNetwork().catch(() => {});
        }
        return local;
      }
    }

    return fetchUsersFromNetwork(forceRefresh);
  },

  getUsersByRole: async (roleId: number): Promise<User[]> => {
    const res = await api.get(`/users/role/${roleId}`);
    return res.data.data;
  },

  updateUser: async (id: number, payload: UpdateUserPayload): Promise<User> => {
    const res = await api.patch(`/users/${id}`, payload);
    clearAllCaches();
    return res.data.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
    clearAllCaches();
  },
};
