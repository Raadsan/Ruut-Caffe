import api from '../axios';

export interface Role {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
}

const ROLES_CACHE_KEY = 'roles_list';
const ROLES_TTL_MS = 5 * 60 * 1000;

let memoryCache: { data: Role[]; at: number } | null = null;
let inflight: Promise<Role[]> | null = null;

function readLocalCache(): Role[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ROLES_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Role[]) : null;
  } catch {
    return null;
  }
}

function writeLocalCache(data: Role[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function clearAllCaches(): void {
  memoryCache = null;
  inflight = null;
  if (typeof window !== 'undefined') localStorage.removeItem(ROLES_CACHE_KEY);
}

async function fetchRolesFromNetwork(): Promise<Role[]> {
  if (inflight) return inflight;

  inflight = api
    .get('/roles')
    .then((res) => {
      const data: Role[] = res.data.data || [];
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

export const roleApi = {
  createRole: async (payload: CreateRolePayload): Promise<Role> => {
    const res = await api.post('/roles', payload);
    clearAllCaches();
    return res.data.data;
  },

  getAllRoles: async (forceRefresh = false): Promise<Role[]> => {
    const now = Date.now();

    if (!forceRefresh && memoryCache && now - memoryCache.at < ROLES_TTL_MS) {
      return memoryCache.data;
    }

    if (!forceRefresh) {
      const local = readLocalCache();
      if (local) {
        memoryCache = { data: local, at: now };
        return local;
      }
    }

    return fetchRolesFromNetwork();
  },

  updateRole: async (id: number, payload: UpdateRolePayload): Promise<Role> => {
    const res = await api.patch(`/roles/${id}`, payload);
    clearAllCaches();
    return res.data.data;
  },

  deleteRole: async (id: number): Promise<void> => {
    await api.delete(`/roles/${id}`);
    clearAllCaches();
  },
};
