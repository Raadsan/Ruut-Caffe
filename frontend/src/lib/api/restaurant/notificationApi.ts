import api from '../axios';
import {
  dispatchNotificationRead,
  dispatchNotificationsMarkedAllRead,
} from '@/lib/live-updates';

export interface NotificationSender {
  id: number;
  fullName: string;
  avatarUrl?: string | null;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  role?: string;
  orderId?: number;
  customerId?: number;
  userId?: number | null;
  senderId?: number | null;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  sender?: NotificationSender | null;
  createdAt?: string;
}

const NOTIF_TTL_MS = 60 * 1000;
const NOTIF_CACHE_KEY = 'header_notifications';
let notifCache: { data: Notification[]; at: number } | null = null;
let notifInflight: Promise<Notification[]> | null = null;

function readNotifLocal(): Notification[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(NOTIF_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: Notification[]; at: number };
    if (Date.now() - parsed.at < NOTIF_TTL_MS) return parsed.data;
  } catch { /* ignore */ }
  return null;
}

function writeNotifLocal(data: Notification[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      NOTIF_CACHE_KEY,
      JSON.stringify({ data, at: Date.now() })
    );
  } catch { /* ignore */ }
}

async function fetchMyNotifications(full: boolean): Promise<Notification[]> {
  const res = await api.get('/notifications/me', {
    params: full ? undefined : { light: '1' },
  });
  const data: Notification[] = res.data.data || [];
  notifCache = { data, at: Date.now() };
  writeNotifLocal(data);
  return data;
}

export const notificationApi = {
  getAllNotifications: async (): Promise<Notification[]> => {
    const res = await api.get('/notifications');
    return res.data.data || [];
  },

  getMyNotifications: async (
    forceRefresh = false,
    options?: { full?: boolean }
  ): Promise<Notification[]> => {
    const full = options?.full ?? false;
    const now = Date.now();
    if (!forceRefresh && notifCache && now - notifCache.at < NOTIF_TTL_MS) {
      return notifCache.data;
    }

    if (!forceRefresh && !full) {
      const local = readNotifLocal();
      if (local) {
        notifCache = { data: local, at: now };
        if (!notifInflight) {
          notifInflight = fetchMyNotifications(false)
            .catch(() => local)
            .finally(() => {
              notifInflight = null;
            });
        }
        return local;
      }
    }

    if (notifInflight && !forceRefresh) return notifInflight;

    notifInflight = fetchMyNotifications(full)
      .catch((err) => {
        notifInflight = null;
        throw err;
      })
      .finally(() => {
        notifInflight = null;
      });

    return notifInflight;
  },

  clearNotificationCache: () => {
    notifCache = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(NOTIF_CACHE_KEY);
    }
  },

  patchNotificationReadLocal: (id: number) => {
    if (notifCache) {
      notifCache = {
        at: notifCache.at,
        data: notifCache.data.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
      };
    }
    dispatchNotificationRead(id);
  },

  patchAllNotificationsReadLocal: () => {
    if (notifCache) {
      notifCache = {
        at: notifCache.at,
        data: notifCache.data.map((n) => ({ ...n, isRead: true })),
      };
    }
    dispatchNotificationsMarkedAllRead();
  },

  getKitchenNotifications: async (): Promise<Notification[]> => {
    const res = await api.get('/notifications/kitchen');
    return res.data.data || [];
  },

  getWaiterNotifications: async (): Promise<Notification[]> => {
    const res = await api.get('/notifications/waiter');
    return res.data.data || [];
  },

  markNotificationRead: async (id: number): Promise<Notification> => {
    notificationApi.patchNotificationReadLocal(id);
    try {
      const res = await api.patch(`/notifications/${id}/read`);
      const updated = res.data.data as Notification;
      if (notifCache) {
        notifCache = {
          at: Date.now(),
          data: notifCache.data.map((n) =>
            n.id === id ? { ...n, ...updated } : n
          ),
        };
      }
      return updated;
    } catch (err) {
      notificationApi.clearNotificationCache();
      throw err;
    }
  },

  getCustomerNotifications: async (customerId: number): Promise<Notification[]> => {
    const res = await api.get(`/notifications/customer/${customerId}`);
    return res.data.data || [];
  },

  getOrderByNotification: async (orderId: number): Promise<Notification[]> => {
    const res = await api.get(`/notifications/customer/order/${orderId}`);
    return res.data.data || [];
  },

  markAllCustomerRead: async (customerId: number): Promise<void> => {
    await api.patch(`/notifications/customer/${customerId}/read-all`);
  },

  getUnreadCount: async (customerId: number): Promise<number> => {
    const res = await api.get(`/notifications/customer/${customerId}/unread-count`);
    return res.data.unread || 0;
  },
};
