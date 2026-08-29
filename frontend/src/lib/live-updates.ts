export const ORDERS_CHANGED = "orders_changed";
export const MENU_CHANGED = "menu_changed";
export const POS_SOFT_REFRESH = "pos_soft_refresh";
export const REFRESH_NOTIFICATIONS = "refresh_notifications";
export const NOTIFICATION_READ = "notification_read";
export const NOTIFICATIONS_MARKED_ALL_READ = "notifications_marked_all_read";

export type OrderSocketPayload = {
  id?: number;
  status?: string;
  table?: number;
  orderType?: string;
  action?: "new" | "update" | "ready";
};

export function dispatchOrdersChanged(detail: OrderSocketPayload) {
  window.dispatchEvent(new CustomEvent(ORDERS_CHANGED, { detail }));
}

export function dispatchMenuChanged(detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent(MENU_CHANGED, { detail }));
}

export function dispatchPosSoftRefresh() {
  window.dispatchEvent(new CustomEvent(POS_SOFT_REFRESH));
}

export function dispatchRefreshNotifications() {
  window.dispatchEvent(new CustomEvent(REFRESH_NOTIFICATIONS));
}

export function dispatchNotificationRead(id: number) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_READ, { detail: { id } }));
}

export function dispatchNotificationsMarkedAllRead() {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_MARKED_ALL_READ));
}

/** Debounced handler — avoids rapid API refetches when many socket events arrive. */
export function onDebouncedEvent<T>(
  eventName: string,
  handler: (detail: T) => void,
  delayMs = 600
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const listener = (e: Event) => {
    if (timer) clearTimeout(timer);
    const detail = (e as CustomEvent<T>).detail;
    timer = setTimeout(() => handler(detail), delayMs);
  };

  window.addEventListener(eventName, listener);
  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener(eventName, listener);
  };
}
