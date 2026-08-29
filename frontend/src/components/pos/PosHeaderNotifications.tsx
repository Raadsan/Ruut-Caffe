"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notificationApi, Notification } from "@/lib/api/restaurant/notificationApi";
import {
  onDebouncedEvent,
  REFRESH_NOTIFICATIONS,
  NOTIFICATION_READ,
  NOTIFICATIONS_MARKED_ALL_READ,
} from "@/lib/live-updates";
import { useCallback, useEffect, useState } from "react";

export default function PosHeaderNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await notificationApi.getMyNotifications(silent);
      setNotifications(data);
    } catch {
      /* ignore — POS still works offline */
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchNotifications(true), 1200);

    const onRead = (e: Event) => {
      const id = (e as CustomEvent<{ id: number }>).detail.id;
      setNotifications(prev =>
        prev.map(item => (item.id === id ? { ...item, isRead: true } : item))
      );
    };

    const onAllRead = () => {
      setNotifications(prev => prev.map(item => ({ ...item, isRead: true })));
    };

    window.addEventListener(NOTIFICATION_READ, onRead);
    window.addEventListener(NOTIFICATIONS_MARKED_ALL_READ, onAllRead);
    const removeRefresh = onDebouncedEvent(
      REFRESH_NOTIFICATIONS,
      () => fetchNotifications(true),
      600
    );

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(NOTIFICATION_READ, onRead);
      window.removeEventListener(NOTIFICATIONS_MARKED_ALL_READ, onAllRead);
      removeRefresh();
    };
  }, [fetchNotifications]);

  return (
    <DropdownMenu
      onOpenChange={open => {
        if (open) fetchNotifications(true);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-lg text-zinc-500 hover:text-primary hover:bg-zinc-100"
          aria-label="Notifications"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 bg-primary text-[8px] font-bold text-white rounded-full ring-2 ring-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 mt-1 rounded-xl shadow-xl border-zinc-200 p-0 overflow-hidden"
        align="end"
      >
        <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="text-[9px] font-bold text-white bg-primary px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="max-h-[280px] overflow-auto">
          {loading ? (
            <p className="p-6 text-center text-[11px] text-zinc-400">Loading...</p>
          ) : notifications.length > 0 ? (
            notifications.slice(0, 10).map(n => (
              <button
                key={n.id}
                type="button"
                className={`w-full text-left px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors ${
                  n.isRead ? "opacity-60" : "bg-primary/5"
                }`}
                onClick={() => {
                  if (!n.isRead) {
                    setNotifications(prev =>
                      prev.map(item =>
                        item.id === n.id ? { ...item, isRead: true } : item
                      )
                    );
                    notificationApi.markNotificationRead(n.id).catch(() =>
                      fetchNotifications(true)
                    );
                  }
                }}
              >
                <p className="text-[11px] font-bold text-zinc-800">{n.title}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{n.message}</p>
                {n.createdAt && (
                  <p className="text-[9px] text-zinc-400 mt-1">
                    {new Date(n.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </button>
            ))
          ) : (
            <div className="p-8 text-center">
              <Bell className="size-7 text-zinc-200 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-400">No notifications yet</p>
            </div>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <Link
          href="/ready-orders"
          className="block py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-zinc-50 transition-colors"
        >
          View order history
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
