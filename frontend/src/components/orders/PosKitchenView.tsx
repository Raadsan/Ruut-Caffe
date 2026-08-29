"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import KitchenOrderDetailDialog from "@/components/orders/KitchenOrderDetailDialog";
import {
  Clock,
  Flame,
  CheckCircle2,
  UtensilsCrossed,
  MapPin,
  Loader2,
  User,
  Eye,
  PackageCheck,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { useToast } from "@/components/ui/toast";
import { btnCreatePage } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  getElapsedLabel,
  getOrderCoverImage,
  getOrderCreatorName,
  getOrderCreatorRole,
  getOrderMeta,
  getOrderSourceLabel,
  getOrderTitle,
  isKitchenPendingStatus,
} from "@/lib/kitchen-order-utils";
import { onDebouncedEvent, ORDERS_CHANGED, OrderSocketPayload } from "@/lib/live-updates";

type KitchenTab = "pending" | "preparing" | "ready" | "served";

const TAB_CONFIG: {
  id: KitchenTab;
  label: string;
  icon: React.ElementType;
  emptyTitle: string;
  emptyHint: string;
}[] = [
  {
    id: "pending",
    label: "Pending",
    icon: Clock,
    emptyTitle: "No pending orders",
    emptyHint: "New orders will appear here.",
  },
  {
    id: "preparing",
    label: "Preparing",
    icon: Flame,
    emptyTitle: "Nothing cooking",
    emptyHint: "Start preparing from Pending.",
  },
  {
    id: "ready",
    label: "Ready",
    icon: CheckCircle2,
    emptyTitle: "No orders ready",
    emptyHint: "Mark orders ready from Preparing.",
  },
  {
    id: "served",
    label: "Served",
    icon: PackageCheck,
    emptyTitle: "No served orders yet",
    emptyHint: "Completed orders appear here.",
  },
];

const GRID_CLASS = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

function KitchenCreatorBlock({ order }: { order: Order }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex items-center justify-center size-8 rounded-full bg-primary/10 shrink-0">
        <User className="size-3.5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-zinc-800 truncate">
          {getOrderCreatorName(order)}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary truncate">
          {getOrderCreatorRole(order)}
        </p>
      </div>
    </div>
  );
}

function PosKitchenCard({
  order,
  menuItems,
  activeTab,
  isUpdating,
  onView,
  onMarkReady,
  onMarkServed,
}: {
  order: Order;
  menuItems: MenuItem[];
  activeTab: KitchenTab;
  isUpdating: boolean;
  onView: () => void;
  onMarkReady: () => void;
  onMarkServed: () => void;
}) {
  const imageUrl = getOrderCoverImage(order, menuItems);
  const itemCount = order.orderitem?.reduce((s, i) => s + i.quantity, 0) || 0;
  const visibleItems = order.orderitem?.slice(0, 3) ?? [];

  return (
    <article className="flex flex-col h-full bg-white rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="relative h-36 bg-zinc-50 shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={getOrderTitle(order)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-50">
            <UtensilsCrossed className="size-8 text-zinc-300" />
          </div>
        )}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/95 text-[10px] font-bold text-zinc-600 shadow-sm">
          #{order.id}
        </span>
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-primary text-white text-[10px] font-bold">
          {getOrderSourceLabel(order)}
        </span>
      </div>

      <div className="flex flex-col flex-1 p-3 min-h-0">
        <h3 className="text-sm font-bold text-[#3d2c1e] leading-snug line-clamp-2">
          {getOrderTitle(order)}
        </h3>
        <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1 line-clamp-1">
          <MapPin className="size-3 shrink-0" />
          {getOrderMeta(order)}
        </p>
        <p className="text-[10px] text-zinc-400 mt-1">{getElapsedLabel(order.createdAt)} · {itemCount} items</p>

        <div className="mt-2 space-y-0.5 flex-1 min-h-0">
          {visibleItems.map(item => (
            <p key={item.id} className="text-[11px] text-zinc-600 truncate">
              <span className="font-bold text-primary">{item.quantity}x</span>{" "}
              {item.menuitem?.name || "Item"}
            </p>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
          <KitchenCreatorBlock order={order} />
          {activeTab === "pending" && isKitchenPendingStatus(order.status) && (
            <Button type="button" onClick={onView} className={cn(btnCreatePage, "w-full h-9 text-xs rounded-xl gap-1.5")}>
              <Eye className="size-3.5" />
              View & Prepare
            </Button>
          )}
          {activeTab === "preparing" && (
            <div className="flex flex-col gap-1.5">
              <Button type="button" onClick={onView} variant="outline" className="w-full h-9 text-xs rounded-xl gap-1.5">
                <Eye className="size-3.5" />
                View
              </Button>
              <Button
                type="button"
                disabled={isUpdating}
                onClick={onMarkReady}
                className="w-full h-9 text-xs rounded-xl gap-1.5 bg-emerald-600 !text-white hover:bg-emerald-700 border-none"
              >
                {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Mark Ready
              </Button>
            </div>
          )}
          {activeTab === "ready" && (
            <Button
              type="button"
              disabled={isUpdating}
              onClick={onMarkServed}
              className={cn(btnCreatePage, "w-full h-9 text-xs rounded-xl gap-1.5")}
            >
              {isUpdating ? <Loader2 className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />}
              Mark Served
            </Button>
          )}
          {activeTab === "served" && (
            <span className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-zinc-600 text-xs font-semibold">
              <PackageCheck className="size-3.5" />
              Served
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

interface PosKitchenViewProps {
  orders: Order[];
  loading: boolean;
  menuItems: MenuItem[];
  onRefresh: (forceRefresh?: boolean) => Promise<void>;
  datePreset: "today" | "yesterday" | "week" | "last-month" | "custom";
  dateRange: { startDate: string; endDate: string };
  onDatePresetChange: (preset: "today" | "yesterday" | "week" | "last-month" | "custom") => void;
  onDateRangeChange: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string }>>;
}

export default function PosKitchenView({
  orders,
  loading,
  menuItems,
  onRefresh,
  datePreset,
  dateRange,
  onDatePresetChange,
  onDateRangeChange,
}: PosKitchenViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<KitchenTab>("pending");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);

  const viewOrder = useMemo(
    () => (viewOrderId ? orders.find(o => o.id === viewOrderId) ?? null : null),
    [orders, viewOrderId]
  );

  useEffect(() => {
    const removeListener = onDebouncedEvent<OrderSocketPayload>(
      ORDERS_CHANGED,
      detail => {
        if (detail?.action === "new" && detail.id) {
          showToast(`New order #${detail.id} received`, "success");
          setActiveTab("pending");
        }
      },
      200
    );
    return () => removeListener();
  }, [showToast]);

  const counts = useMemo(
    () => ({
      pending: orders.filter(o => isKitchenPendingStatus(o.status)).length,
      preparing: orders.filter(o => o.status === "preparing").length,
      ready: orders.filter(o => o.status === "ready").length,
      served: orders.filter(o => o.status === "served").length,
    }),
    [orders]
  );

  const filtered = useMemo(() => {
    const list = orders.filter(o => {
      if (activeTab === "pending") return isKitchenPendingStatus(o.status);
      return o.status === activeTab;
    });
    return list.sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
  }, [orders, activeTab]);

  const activeConfig = TAB_CONFIG.find(t => t.id === activeTab)!;

  const handleMarkReady = useCallback(
    async (order: Order) => {
      setUpdatingId(order.id);
      try {
        await orderApi.updateStatus(order.id, "ready");
        showToast(`Order #${order.id} is ready`, "success");
        await onRefresh(true);
        setActiveTab("ready");
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to update order";
        showToast(message, "error");
      } finally {
        setUpdatingId(null);
      }
    },
    [onRefresh, showToast]
  );

  const handleMarkServed = useCallback(
    async (order: Order) => {
      setUpdatingId(order.id);
      try {
        await orderApi.updateStatus(order.id, "served");
        showToast(`Order #${order.id} marked as served`, "success");
        await onRefresh(true);
        setActiveTab("served");
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to mark served";
        showToast(message, "error");
      } finally {
        setUpdatingId(null);
      }
    },
    [onRefresh, showToast]
  );

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-zinc-100 bg-white">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
        <h1 className="text-xl font-bold text-[#1e293b] uppercase tracking-tight">Kitchen</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Pending → Preparing → Ready → Served</p>
          </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-2 md:max-w-[70%]">
          <div className="flex items-center gap-1 rounded-lg bg-white p-1 overflow-x-auto max-w-full">
            {([['today', 'Today'], ['yesterday', 'Yesterday'], ['week', '1 Week'], ['last-month', 'Last Month'], ['custom', 'Custom']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onDatePresetChange(value)}
                className={cn(
                  "h-8 px-2.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors",
                  datePreset === value ? "bg-primary text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-100"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {datePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-2 px-1">
              <Calendar className="size-3.5 text-zinc-400" />
              <input
                type="date"
                value={dateRange.startDate}
                max={dateRange.endDate}
                onChange={event => onDateRangeChange(previous => ({ ...previous, startDate: event.target.value }))}
                className="text-xs font-semibold bg-transparent outline-none text-zinc-700"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                min={dateRange.startDate}
                onChange={event => onDateRangeChange(previous => ({ ...previous, endDate: event.target.value }))}
                className="text-xs font-semibold bg-transparent outline-none text-zinc-700"
              />
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onRefresh(true)}
            className="h-9 px-3 rounded-lg text-xs font-bold gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TAB_CONFIG.map(tab => {
            const Icon = tab.icon;
            const count = counts[tab.id];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all",
                  isActive
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-zinc-500 border-zinc-200 hover:border-primary/30"
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
                <span
                  className={cn(
                    "min-w-5 h-5 px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center",
                    isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-bold text-[#1e293b] uppercase">{activeConfig.label}</h2>
          <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">
            {filtered.length}
          </span>
        </div>

        {loading ? (
          <div className={GRID_CLASS}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[320px] bg-zinc-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-zinc-500 bg-white rounded-2xl border border-zinc-100">
            <activeConfig.icon className="size-12 text-zinc-200" />
            <p className="mt-3 text-sm font-semibold text-zinc-600">{activeConfig.emptyTitle}</p>
            <p className="text-xs text-zinc-400 mt-1">{activeConfig.emptyHint}</p>
          </div>
        ) : (
          <div className={GRID_CLASS}>
            {filtered.map(order => (
              <PosKitchenCard
                key={order.id}
                order={order}
                menuItems={menuItems}
                activeTab={activeTab}
                isUpdating={updatingId === order.id}
                onView={() => setViewOrderId(order.id)}
                onMarkReady={() => handleMarkReady(order)}
                onMarkServed={() => handleMarkServed(order)}
              />
            ))}
          </div>
        )}
      </div>

      <KitchenOrderDetailDialog
        order={viewOrder}
        menuItems={menuItems}
        open={viewOrderId !== null}
        onOpenChange={open => {
          if (!open) setViewOrderId(null);
        }}
        onOrderUpdated={async () => {
          await onRefresh(true);
        }}
        onStartedPreparing={() => {
          setActiveTab("preparing");
          setViewOrderId(null);
        }}
        onMarkedReady={() => {
          setActiveTab("ready");
          setViewOrderId(null);
        }}
        onMarkedServed={() => {
          setActiveTab("served");
          setViewOrderId(null);
        }}
        allowMarkServed
      />
    </div>
  );
}
