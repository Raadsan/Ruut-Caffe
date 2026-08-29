import axios from 'axios';

const TECHNICAL_ERROR_PATTERN = /prisma\.|invocation|unknown argument|argument `?.+`? is missing|validation error|stack trace|\n\s*at\s+/i;

function isSafeUserMessage(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 240 && !value.includes('\n') && !TECHNICAL_ERROR_PATTERN.test(value);
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (!axios.isAxiosError(error)) return fallback;
  const message = error.response?.data?.message;
  return isSafeUserMessage(message) ? message.trim() : fallback;
}

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    return `${protocol}//${host}:7005/api`;
  }
  return 'http://127.0.0.1:7005/api';
};

const BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach JWT token on every request ────────────────────────────
let refreshPromise: Promise<void> | null = null;

// ── Auto-logout on 401 Unauthorized ──────────────────────────────
// Skip redirect if already on the login page (so login errors show properly)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const responseMessage = error.response?.data?.message;
    if (responseMessage && !isSafeUserMessage(responseMessage)) {
      error.response.data = {
        ...error.response.data,
        message: 'Unable to complete the request. Please try again.',
      };
    }

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const original = error.config as typeof error.config & { _retried?: boolean };
      const isRefresh = original?.url?.includes('/auth/refresh');
      const isLoginRequest = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/pos-login');
      if (!original?._retried && !isRefresh && !isLoginRequest) {
        original._retried = true;
        try {
          refreshPromise ??= api.post('/auth/refresh').then(() => undefined).finally(() => { refreshPromise = null; });
          await refreshPromise;
          return api.request(original);
        } catch { /* redirect below */ }
      }
      const path = window.location.pathname;
      const isLoginPage =
        path === '/login' ||
        path === '/login/pos' ||
        path === '/pos' ||
        path === '/pos/login';
      const isPosRoute =
        path.startsWith('/pos-') ||
        path === '/pos-terminal' ||
        path === '/kitchen' ||
        path === '/ready-orders' ||
        path === '/my-sales' ||
        path === '/my-profile';
      if (!isLoginPage) {
        localStorage.removeItem('auth_user');
        window.location.replace(isPosRoute ? '/pos/login' : '/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
