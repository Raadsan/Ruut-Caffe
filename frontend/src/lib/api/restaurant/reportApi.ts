import api from '../axios';

const SUMMARY_TTL_MS = 90 * 1000;
const WEEKLY_TTL_MS = 2 * 60 * 1000;
const INIT_TTL_MS = 90 * 1000;
const SUMMARY_KEY = 'report_dashboard_summary';
const WEEKLY_KEY = 'report_weekly_analytics';
const INIT_KEY = 'report_dashboard_init';

export interface DashboardInitPayload {
  summary: {
    totalOrders: number;
    totalCustomers: number;
    totalTables: number;
    totalPaidPayments: number;
    totalPendingPayments: number;
    totalRevenue: number;
  };
  weekly: Array<{ name: string; revenue: number; orders: number }>;
  recentOrders: unknown[];
}

let summaryMem: { data: unknown; at: number; queryKey: string } | null = null;
let summaryInflight: Promise<unknown> | null = null;
let weeklyMem: { data: unknown; at: number } | null = null;
let weeklyInflight: Promise<unknown> | null = null;
let initMem: { data: DashboardInitPayload; at: number } | null = null;
let initInflight: Promise<DashboardInitPayload> | null = null;

function summaryQueryKey(params?: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const key of ['startDate', 'endDate', 'from', 'to', 'date', 'month'].sort()) {
    const val = params?.[key];
    if (val) parts.push(`${key}=${val}`);
  }
  return parts.join('&') || 'default';
}

function readLocal<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; at: number };
    if (Date.now() - parsed.at < ttlMs) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function writeLocal<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, at: Date.now() }));
  } catch { /* ignore */ }
}

async function fetchSummaryFromNetwork(params?: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.date) query.set('date', params.date);
  if (params?.month) query.set('month', params.month);
  const res = await api.get(`/reports/summary?${query.toString()}`);
  const payload = res.data;
  const qk = summaryQueryKey(params);
  summaryMem = { data: payload, at: Date.now(), queryKey: qk };
  if (qk === 'default') writeLocal(SUMMARY_KEY, payload);
  return payload;
}

async function fetchInitFromNetwork(): Promise<{ success: boolean; data: DashboardInitPayload }> {
  const res = await api.get('/reports/dashboard-init');
  const payload = res.data as { success: boolean; data: DashboardInitPayload };
  if (payload?.data) {
    initMem = { data: payload.data, at: Date.now() };
    writeLocal(INIT_KEY, payload.data);
    if (payload.data.summary) {
      summaryMem = { data: { success: true, data: payload.data.summary }, at: Date.now(), queryKey: 'default' };
      writeLocal(SUMMARY_KEY, { success: true, data: payload.data.summary });
    }
    if (payload.data.weekly) {
      weeklyMem = { data: { success: true, data: payload.data.weekly }, at: Date.now() };
      writeLocal(WEEKLY_KEY, { success: true, data: payload.data.weekly });
    }
  }
  return payload;
}

async function fetchWeeklyFromNetwork() {
  const res = await api.get('/reports/weekly');
  const payload = res.data;
  weeklyMem = { data: payload, at: Date.now() };
  writeLocal(WEEKLY_KEY, payload);
  return payload;
}

export function clearReportApiCache() {
  summaryMem = null;
  summaryInflight = null;
  weeklyMem = null;
  weeklyInflight = null;
  initMem = null;
  initInflight = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SUMMARY_KEY);
    localStorage.removeItem(WEEKLY_KEY);
    localStorage.removeItem(INIT_KEY);
  }
}

export function peekDashboardInit(): DashboardInitPayload | null {
  const now = Date.now();
  if (initMem && now - initMem.at < INIT_TTL_MS) return initMem.data;
  return readLocal<DashboardInitPayload>(INIT_KEY, INIT_TTL_MS);
}

export const reportApi = {
  getDashboardInit: async (forceRefresh = false): Promise<{ success: boolean; data: DashboardInitPayload }> => {
    const now = Date.now();
    if (!forceRefresh && initMem && now - initMem.at < INIT_TTL_MS) {
      return { success: true, data: initMem.data };
    }

    if (!forceRefresh) {
      const local = readLocal<DashboardInitPayload>(INIT_KEY, INIT_TTL_MS);
      if (local) {
        initMem = { data: local, at: now };
        if (!initInflight) {
          initInflight = fetchInitFromNetwork()
            .then((res) => res.data)
            .catch(() => local)
            .finally(() => { initInflight = null; });
        }
        return { success: true, data: local };
      }
    }

    if (initInflight && !forceRefresh) {
      const data = await initInflight;
      return { success: true, data };
    }

    initInflight = fetchInitFromNetwork()
      .then((res) => res.data)
      .finally(() => { initInflight = null; });
    const data = await initInflight;
    return { success: true, data };
  },

  getDashboardSummary: async (params?: Record<string, string | undefined>, forceRefresh = false): Promise<any> => {
    const qk = summaryQueryKey(params);
    const now = Date.now();

    if (!forceRefresh && summaryMem && summaryMem.queryKey === qk && now - summaryMem.at < SUMMARY_TTL_MS) {
      return summaryMem.data;
    }

    if (!forceRefresh && qk === 'default') {
      const local = readLocal<unknown>(SUMMARY_KEY, SUMMARY_TTL_MS);
      if (local) {
        summaryMem = { data: local, at: now, queryKey: qk };
        if (!summaryInflight) {
          summaryInflight = fetchSummaryFromNetwork(params)
            .catch(() => local)
            .finally(() => { summaryInflight = null; });
        }
        return local;
      }
    }

    if (summaryInflight && !forceRefresh) return summaryInflight;

    summaryInflight = fetchSummaryFromNetwork(params)
      .finally(() => { summaryInflight = null; });
    return summaryInflight;
  },

  getWeeklyAnalytics: async (forceRefresh = false): Promise<any> => {
    const now = Date.now();
    if (!forceRefresh && weeklyMem && now - weeklyMem.at < WEEKLY_TTL_MS) {
      return weeklyMem.data;
    }

    if (!forceRefresh) {
      const local = readLocal<unknown>(WEEKLY_KEY, WEEKLY_TTL_MS);
      if (local) {
        weeklyMem = { data: local, at: now };
        if (!weeklyInflight) {
          weeklyInflight = fetchWeeklyFromNetwork()
            .catch(() => local)
            .finally(() => { weeklyInflight = null; });
        }
        return local;
      }
    }

    if (weeklyInflight && !forceRefresh) return weeklyInflight;

    weeklyInflight = fetchWeeklyFromNetwork()
      .finally(() => { weeklyInflight = null; });
    return weeklyInflight;
  },

  getRevenueReport: async (params?: { from?: string; to?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const res = await api.get(`/reports/revenue?${query.toString()}`);
    return res.data;
  },

  getTopSellingItems: async (params?: { limit?: number; from?: string; to?: string; date?: string; month?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.date) query.set('date', params.date);
    if (params?.month) query.set('month', params.month);
    const res = await api.get(`/reports/top-items?${query.toString()}`);
    return res.data;
  },

  getTablePerformanceReport: async (params?: any): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const res = await api.get(`/reports/table-performance?${query.toString()}`);
    return res.data;
  },

  getDailyReport: async (params?: { date?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.date) query.set('date', params.date);
    const res = await api.get(`/reports/daily?${query.toString()}`);
    return res.data;
  },

  getMonthlyReport: async (params?: { month?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', params.month);
    const res = await api.get(`/reports/monthly?${query.toString()}`);
    return res.data;
  },

  getStaffPerformanceReport: async (): Promise<any> => {
    const res = await api.get('/reports/staff-performance');
    return res.data;
  },

  getFinanceReport: async (params?: { startDate?: string; endDate?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const res = await api.get(`/reports/finance?${query.toString()}`);
    return res.data;
  },

  getOrdersReport: async (params?: { startDate?: string; endDate?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const res = await api.get(`/reports/orders?${query.toString()}`);
    return res.data;
  },

  getClientsReport: async (params?: { startDate?: string; endDate?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const res = await api.get(`/reports/clients?${query.toString()}`);
    return res.data;
  },
};
