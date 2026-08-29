"use client";

import React from "react";
import { Clock, MapPin, Phone, User, Loader2, CheckCircle2, Flame, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Order, OrderStatus } from "@/lib/api/restaurant/orderApi";
import { btnCreatePage } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string }
> = {
  pending: { label: "Pending", bg: "bg-orange-100", text: "text-orange-700" },
  preparing: { label: "Preparing", bg: "bg-blue-100", text: "text-blue-700" },
  ready: { label: "Ready", bg: "bg-green-100", text: "text-green-700" },
  paid: { label: "Paid", bg: "bg-emerald-100", text: "text-emerald-700" },
  served: { label: "Served", bg: "bg-zinc-100", text: "text-zinc-700" },
  cancelled: { label: "Cancelled", bg: "bg-rose-100", text: "text-rose-700" },
  held: { label: "Held", bg: "bg-zinc-100", text: "text-zinc-600" },
  completed: { label: "Completed", bg: "bg-emerald-100", text: "text-emerald-700" },
};

function getCustomerInitial(name?: string) {
  const n = (name || "Guest").trim();
  return n.charAt(0).toUpperCase();
}

function CustomerAvatar({ name, className }: { name?: string; className?: string }) {
  const isGuest = !name?.trim();
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/10 shrink-0",
        className
      )}
    >
      {isGuest ? <User className="size-[45%]" strokeWidth={2} /> : getCustomerInitial(name)}
    </div>
  );
}

function formatTimeAgo(dateStr?: string) {
  if (!dateStr) return "Just now";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getOrderTypeLabel(order: Order) {
  const type = order.orderType || "takeaway";
  if (type === "dine-in") return "Dine-in";
  if (type === "delivery") return "Delivery";
  return "Takeaway";
}

function getOrderLocation(order: Order): string | null {
  const type = order.orderType || "takeaway";
  if (type === "dine-in" && order.table) {
    return `Table ${order.table.number}`;
  }
  if (type === "delivery" && order.address) {
    const parts = [order.address.street, order.address.district].filter(Boolean);
    return parts.join(", ") || order.address.name;
  }
  if (type === "takeaway") return "Takeaway counter";
  return null;
}

function getStatusConfig(order: Order) {
  const status = order.status || "pending";
  if (status === "paid") return STATUS_CONFIG.paid;
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

interface OrderQueueCardProps {
  order: Order;
  showServedAction?: boolean;
  isActionLoading?: boolean;
  onMarkServed?: () => void;
  showPrepareAction?: boolean;
  showReadyAction?: boolean;
  isPrepareLoading?: boolean;
  isReadyLoading?: boolean;
  onViewOrder?: () => void;
  onStartPreparing?: () => void;
  onMarkReady?: () => void;
}

export default function OrderQueueCard({
  order,
  showServedAction = false,
  isActionLoading = false,
  onMarkServed,
  showPrepareAction = false,
  showReadyAction = false,
  isPrepareLoading = false,
  isReadyLoading = false,
  onViewOrder,
  onStartPreparing,
  onMarkReady,
}: OrderQueueCardProps) {
  const cfg = getStatusConfig(order);
  const itemTags = (order.orderitem || []).map(
    i => i.menuitem?.name || `Item #${i.menuItemId}`
  );
  const itemCount = (order.orderitem || []).reduce((s, i) => s + i.quantity, 0);
  const typeLabel = getOrderTypeLabel(order);
  const location = getOrderLocation(order);

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-5 flex flex-col h-full hover:shadow-[0_8px_28px_rgba(15,23,42,0.09)] transition-all duration-200">
      <div className="flex gap-3.5">
        <div className="shrink-0 flex flex-col items-center gap-2">
          <CustomerAvatar name={order.customerName} className="size-[52px] text-lg" />
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap",
              cfg.bg,
              cfg.text
            )}
          >
            {cfg.label}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13px] text-zinc-500 font-medium">
            Order #{order.id} · {typeLabel}
          </p>
          <h3 className="font-bold text-[#1e293b] text-[15px] leading-tight truncate mt-1">
            {order.customerName || "Walk-in Guest"}
          </h3>
          {order.customerPhone && (
            <p className="text-[13px] text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
              <Phone className="size-3 text-zinc-400 shrink-0" />
              {order.customerPhone}
            </p>
          )}
        </div>
      </div>

      {location && (
        <div className="mt-3 flex items-center gap-1.5 text-[13px] text-zinc-600">
          <MapPin className="size-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{location}</span>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
        <span>
          <span className="font-semibold text-zinc-700">{itemCount}</span> items
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3 text-zinc-400" />
          <span className="font-semibold text-zinc-700">{formatTimeAgo(order.createdAt)}</span>
        </span>
      </div>

      {itemTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {itemTags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-medium truncate max-w-[120px]"
            >
              {tag}
            </span>
          ))}
          {itemTags.length > 3 && (
            <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-semibold">
              +{itemTags.length - 3}
            </span>
          )}
        </div>
      )}

      {order.notes && (
        <p className="mt-2 text-[11px] text-zinc-400 italic line-clamp-1" title={order.notes}>
          Note: {order.notes}
        </p>
      )}

      <div className="mt-auto pt-4 border-t border-zinc-50 space-y-3">
        <div>
          <p className="text-[22px] font-bold text-[#1e293b] leading-none">
            ${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wide">{typeLabel}</p>
        </div>
        {showPrepareAction && onViewOrder && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={onViewOrder}
              variant="outline"
              className="w-full h-10 text-xs rounded-full gap-2"
            >
              <Eye className="size-4" />
              View Order
            </Button>
            {onStartPreparing && (
              <Button
                type="button"
                onClick={onStartPreparing}
                disabled={isPrepareLoading}
                className={cn(btnCreatePage, "w-full h-10 text-xs rounded-full gap-2")}
              >
                {isPrepareLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Flame className="size-4" />
                )}
                Start Preparing
              </Button>
            )}
          </div>
        )}
        {showReadyAction && (
          <div className="flex flex-col gap-2">
            {onViewOrder && (
              <Button
                type="button"
                onClick={onViewOrder}
                variant="outline"
                className="w-full h-10 text-xs rounded-full gap-2"
              >
                <Eye className="size-4" />
                View Order
              </Button>
            )}
            {onMarkReady && (
              <Button
                type="button"
                onClick={onMarkReady}
                disabled={isReadyLoading}
                className="w-full h-10 text-xs rounded-full gap-2 bg-emerald-600 !text-white hover:bg-emerald-700 hover:!text-white border-none"
              >
                {isReadyLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Mark as Ready
              </Button>
            )}
          </div>
        )}
        {showServedAction && onMarkServed && (
          <Button
            type="button"
            onClick={onMarkServed}
            disabled={isActionLoading}
            className={cn(btnCreatePage, "w-full h-11 text-sm rounded-full gap-2")}
          >
            {isActionLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Mark as Served
          </Button>
        )}
      </div>
    </div>
  );
}
