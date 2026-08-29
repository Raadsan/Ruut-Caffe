import api from '../axios';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface PosLoginCredentials {
  username: string;
  pin: string;
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  gender?: string;
  dateOfBirth?: string;
  avatarUrl?: string;
  role: string;
  roleId?: number;
  authContext?: 'dashboard' | 'pos';
  createdAt?: string;
}

export interface UpdateProfileData {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: string;
  dateOfBirth?: string;
  currentPassword?: string;
  newPassword?: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

const USER_STORAGE_KEY = 'auth_user';
const LOGOUT_COOKIE = 'restaurant_logout';
let getMeInflight: Promise<AuthUser> | null = null;

function clearLogoutLock(): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${LOGOUT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
    document.documentElement.style.visibility = '';
  }
}

function setLogoutLock(hidePage = true): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${LOGOUT_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=604800`;
    if (hidePage) document.documentElement.style.visibility = 'hidden';
  }
}

/** Save user to localStorage */
function saveUserToStorage(user: AuthUser): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

/** Read user from localStorage — returns null if not found */
function getUserFromStorage(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Clear user from localStorage */
function clearUserFromStorage(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

function mapAuthUser(user: Record<string, unknown>): AuthUser {
  const dob = user.dateOfBirth;
  let dateOfBirth: string | undefined;
  if (dob) {
    const d = new Date(dob as string);
    if (!isNaN(d.getTime())) dateOfBirth = d.toISOString();
  }

  return {
    id: user.id as number,
    fullName: (user.fullName as string) || '',
    email: (user.email as string) || '',
    phone: (user.phone as string) || undefined,
    address: (user.address as string) || undefined,
    gender: (user.gender as string) || undefined,
    dateOfBirth,
    avatarUrl: (user.avatarUrl as string) || undefined,
    role: (user.role as string) || 'staff',
    roleId: user.roleId as number | undefined,
    authContext: user.authContext === 'pos' ? 'pos' : 'dashboard',
    createdAt: user.createdAt
      ? new Date(user.createdAt as string).toISOString()
      : undefined,
  };
}

export const authApi = {
  /** Login – saves token AND user to localStorage */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const res = await api.post('/auth/login', credentials);
    const { token, user } = res.data;

    const authUser: AuthUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || undefined,
      address: user.address || undefined,
      gender: user.gender || undefined,
      dateOfBirth: user.dateOfBirth || undefined,
      avatarUrl: user.avatarUrl || undefined,
      role: user.role,
      roleId: user.roleId,
      authContext: user.authContext === 'pos' ? 'pos' : 'dashboard',
      createdAt: user.createdAt
    };

    if (typeof window !== 'undefined') {
      clearLogoutLock();
      saveUserToStorage(authUser);
    }

    return { token, user: authUser };
  },

  loginWithGoogle: async (payload: {
    idToken: string;
    audience?: "client" | "staff";
  }): Promise<LoginResponse> => {
    const res = await api.post("/auth/google", payload);
    const { token, user } = res.data;
    const authUser = mapAuthUser(user);

    if (typeof window !== "undefined") {
      clearLogoutLock();
      saveUserToStorage(authUser);
    }

    return { token, user: authUser };
  },

  loginWithFacebook: async (payload: {
    accessToken: string;
    audience?: "client" | "staff";
  }): Promise<LoginResponse> => {
    const res = await api.post("/auth/facebook", payload);
    const { token, user } = res.data;
    const authUser = mapAuthUser(user);

    if (typeof window !== "undefined") {
      clearLogoutLock();
      saveUserToStorage(authUser);
    }

    return { token, user: authUser };
  },

  /** POS login — username + 6-digit PIN */
  posLogin: async (credentials: PosLoginCredentials): Promise<LoginResponse> => {
    const res = await api.post('/auth/pos-login', credentials);
    const { token, user } = res.data;

    const authUser: AuthUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || undefined,
      role: user.role,
      roleId: user.roleId,
      authContext: user.authContext === 'pos' ? 'pos' : 'dashboard',
      createdAt: user.createdAt,
    };

    if (typeof window !== 'undefined') {
      clearLogoutLock();
      saveUserToStorage(authUser);
    }

    return { token, user: authUser };
  },

  /** Read cached user without a network request. */
  getCachedUser: (): AuthUser | null => getUserFromStorage(),

  /**
   * Get the currently logged-in user.
   */
  getMe: async (forceRefresh = false): Promise<AuthUser> => {
    if (!forceRefresh) {
      const cached = getUserFromStorage();
      if (cached) return cached;
    }

    if (getMeInflight && !forceRefresh) return getMeInflight;

    getMeInflight = api
      .get('/auth/me')
      .then((res) => {
        const authUser = mapAuthUser(res.data.data);
        saveUserToStorage(authUser);
        getMeInflight = null;
        return authUser;
      })
      .catch((err) => {
        getMeInflight = null;
        throw err;
      });

    return getMeInflight;
  },

  /** Update profile – updates the db then refreshes localStorage. */
  updateProfile: async (payload: UpdateProfileData): Promise<AuthUser> => {
    const res = await api.patch('/auth/update-profile', payload);
    const authUser = mapAuthUser(res.data.user);

    saveUserToStorage(authUser);
    return authUser;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  resetPassword: async (email: string, newPassword: string): Promise<void> => {
    await api.post('/auth/reset-password', { email, newPassword });
  },

  /** End a newly-created session that failed a permission check, without navigating. */
  denySession: async (): Promise<void> => {
    if (typeof window !== 'undefined') {
      setLogoutLock(false);
      clearUserFromStorage();
    }
    await api.post('/auth/logout').catch(() => {});
  },

  /** Clear token + user cache and redirect to login. */
  logout: (redirectTo = '/login') => {
    if (typeof window !== 'undefined') {
      setLogoutLock();
      clearUserFromStorage();
      void api.post('/auth/logout').catch(() => {});
      window.location.replace(redirectTo);
    } else {
      clearUserFromStorage();
    }
  },
};
