"use client";

import React, { useEffect, useState } from "react";
import { Inbox, Settings, UtensilsCrossed } from "lucide-react";
import { notificationApi, Notification } from "@/lib/api/restaurant/notificationApi";
import { onDebouncedEvent, REFRESH_NOTIFICATIONS } from "@/lib/live-updates";
import { formatRelativeTime } from "@/lib/format-relative-time";
import NotificationListItem, {
  getNotificationActionText,
} from "@/components/notifications/NotificationListItem";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchNotifications = async (force = false) => {
    try {
      const data = await notificationApi.getMyNotifications(force, { full: true });
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);
    const removeListener = onDebouncedEvent(REFRESH_NOTIFICATIONS, () => {
      fetchNotifications(true);
    }, 800);
    return () => removeListener();
  }, []);

  const openDetail = (n: Notification) => {
    setSelected(n.isRead ? n : { ...n, isRead: true });
    setDetailOpen(true);
    if (!n.isRead) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
      );
      notificationApi.markNotificationRead(n.id).catch((error) => {
        console.error("Failed to mark notification read", error);
        fetchNotifications(true);
      });
    }
  };

  const handleMarkAllRead = () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notificationApi.patchAllNotificationsReadLocal();

    Promise.all(unread.map((n) => notificationApi.markNotificationRead(n.id))).catch(
      (error) => {
        console.error("Failed to mark all read", error);
        fetchNotifications(true);
      }
    );
  };

  const senderName =
    selected?.sender?.fullName || selected?.senderName || "Staff";
  const senderAvatar =
    selected?.sender?.avatarUrl ?? selected?.senderAvatarUrl;

  return (
    <div className={`${dashboardPageClass} w-full`} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Notifications</h1>
      </div>

      <div className="px-4 pb-8 w-full">
        <div className="w-full rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-zinc-900">Notification</h2>
            <div className="flex items-center gap-3">
              {notifications.some(n => !n.isRead) && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              <span className="size-8 rounded-lg text-zinc-400 flex items-center justify-center">
                <Settings className="size-4" />
              </span>
            </div>
          </div>

          {loading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-3 border-b border-zinc-100 animate-pulse">
                  <div className="size-4 rounded bg-zinc-100" />
                  <div className="size-11 rounded-full bg-zinc-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-zinc-100 rounded w-2/3" />
                    <div className="h-2 bg-zinc-100 rounded w-full" />
                  </div>
                  <div className="h-3 w-10 bg-zinc-100 rounded" />
                </div>
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div>
              {notifications.map(n => (
                <NotificationListItem
                  key={n.id}
                  notification={n}
                  onClick={() => openDetail(n)}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center">
              <Inbox className="size-10 text-zinc-200 mb-3" />
              <p className="text-sm font-semibold text-zinc-500">All caught up!</p>
              <p className="text-xs text-zinc-400 mt-1">No notifications at the moment</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl border-zinc-200 p-0 overflow-hidden">
          {selected && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-full bg-primary shrink-0 overflow-hidden flex items-center justify-center text-lg font-bold text-white">
                    {senderAvatar ? (
                      <img
                        src={senderAvatar}
                        alt={senderName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      senderName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <DialogTitle className="text-base font-bold text-zinc-900">
                      {senderName}
                    </DialogTitle>
                    <p className="text-sm text-zinc-600 mt-0.5 capitalize">
                      {getNotificationActionText(selected.title)}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {formatRelativeTime(selected.createdAt)}
                      {selected.createdAt && (
                        <>
                          <span className="text-zinc-300 mx-1">·</span>
                          {new Date(selected.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  {!selected.isRead && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-600 shrink-0">
                      New
                    </span>
                  )}
                </div>
              </DialogHeader>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <p className="text-[11px] font-medium text-zinc-400 mb-1">Details</p>
                  <p className="text-sm font-semibold text-zinc-800">{selected.title}</p>
                  <p className="text-sm text-zinc-600 leading-relaxed mt-1">{selected.message}</p>
                </div>

                {selected.orderId && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 border border-zinc-100">
                    <UtensilsCrossed className="size-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[11px] font-medium text-zinc-400">Related Order</p>
                      <p className="text-sm font-semibold text-zinc-800">Order #{selected.orderId}</p>
                    </div>
                  </div>
                )}

                {selected.role && (
                  <div>
                    <p className="text-[11px] font-medium text-zinc-400 mb-1">Category</p>
                    <p className="text-sm font-semibold text-zinc-800 uppercase">{selected.role}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
