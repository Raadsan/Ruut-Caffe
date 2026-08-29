"use client";

import React from "react";
import { Bell, CheckCircle, Package, AlertTriangle } from "lucide-react";
import { Notification } from "@/lib/api/restaurant/notificationApi";
import { formatRelativeTimeShort } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";

function getTypeIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("ready") || t.includes("success")) {
    return { Icon: CheckCircle, className: "text-emerald-500" };
  }
  if (t.includes("order") || t.includes("new")) {
    return { Icon: Package, className: "text-blue-500" };
  }
  if (t.includes("warning") || t.includes("alert")) {
    return { Icon: AlertTriangle, className: "text-orange-500" };
  }
  return { Icon: Bell, className: "text-primary" };
}

export function getNotificationActionText(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("new order")) return "sent a new order";
  if (t.includes("order ready")) return "marked order ready";
  if (t.includes("your order")) return "your order is ready";
  if (t.includes("payment")) return "payment update";
  return title.toLowerCase();
}

function SenderAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const initial = (name || "S").trim().charAt(0).toUpperCase();
  return (
    <div className="size-11 rounded-full bg-primary border-2 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-white">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}

interface NotificationListItemProps {
  notification: Notification;
  onClick: () => void;
}

export default function NotificationListItem({
  notification: n,
  onClick,
}: NotificationListItemProps) {
  const senderName =
    n.sender?.fullName || n.senderName || "Staff";
  const senderAvatar = n.sender?.avatarUrl ?? n.senderAvatarUrl;
  const actionText = getNotificationActionText(n.title);
  const { Icon, className: iconClass } = getTypeIcon(n.title);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-zinc-50/90 transition-colors border-b border-zinc-100 last:border-b-0",
        n.isRead && "opacity-75"
      )}
    >
      <Icon className={cn("size-4 shrink-0", iconClass)} />

      <SenderAvatar name={senderName} avatarUrl={senderAvatar} />

      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm text-zinc-800 leading-snug">
          <span className="font-bold">{senderName}</span>{" "}
          <span className="text-zinc-600">{actionText}.</span>
        </p>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">{n.message}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-zinc-400 whitespace-nowrap">
          {formatRelativeTimeShort(n.createdAt)}
        </span>
        {!n.isRead && <span className="size-2 rounded-full bg-red-500" />}
      </div>
    </button>
  );
}
