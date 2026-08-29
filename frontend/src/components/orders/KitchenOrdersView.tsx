"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderApi, Order, OrderStatus } from "@/lib/api/restaurant/orderApi";
import { MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { useToast } from "@/components/ui/toast";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  btnCreatePage,
} from "@/lib/dashboard-ui";
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

type KitchenTab = "pending" | "preparing" | "ready";
type KitchenViewMode = "grid" | "list";

const TAB_CONFIG: {
  id: KitchenTab;
  label: string;
  icon: React.ElementType;
  status: OrderStatus;
  emptyTitle: string;
  emptyHint: string;
}[] = [
  {
    id: "pending",
    label: "Pending",
    icon: Clock,
    status: "pending",
    emptyTitle: "No pending orders",
    emptyHint: "New paid orders will appear here for the kitchen.",
  },
  {
    id: "preparing",
    label: "Preparing",
    icon: Flame,
    status: "preparing",
    emptyTitle: "Nothing cooking right now",
    emptyHint: "Start preparing from the Pending tab.",
  },
  {
    id: "ready",
    label: "Ready",
    icon: CheckCircle2,
    status: "ready",
    emptyTitle: "No orders ready yet",
    emptyHint: "Mark orders ready from the Preparing tab.",
  },
];

interface KitchenOrdersViewProps {
  orders: Order[];
  loading: boolean;
  menuItems: MenuItem[];
  onRefresh: (forceRefresh?: boolean) => Promise<void>;
}

function KitchenOrderActions({
  order,
  activeTab,
  isUpdating,
  onView,
  onMarkReady,
  layout,
}: {
  order: Order;
  activeTab: KitchenTab;
  isUpdating: boolean;
  onView: () => void;
  onMarkReady: () => void;
  layout: KitchenViewMode;
}) {
  const row = layout === "list";

  if (activeTab === "pending" && isKitchenPendingStatus(order.status)) {
    return (
      <Button
        type="button"
        onClick={onView}
        className={cn(
          btnCreatePage,
          row ? "h-11 px-6 text-sm shrink-0 rounded-full" : "w-full h-10 text-xs rounded-xl"
        )}
      >
        <Eye className="size-4" />
        View Order
      </Button>
    );
  }

  if (activeTab === "preparing") {
    return (
      <div className={cn(row ? "flex items-center gap-2 shrink-0" : "flex flex-col gap-2")}>
        <Button
          type="button"
          onClick={onView}
          className={cn(
            btnCreatePage,
            row ? "h-11 px-5 text-sm rounded-full" : "w-full h-10 text-xs rounded-xl"
          )}
        >
          <Eye className="size-4" />
          View Order
        </Button>
        <Button
          type="button"
          disabled={isUpdating}
          onClick={onMarkReady}
          className={cn(
            "bg-emerald-600 !text-white hover:bg-emerald-700 hover:!text-white font-medium border-none",
            row ? "h-11 px-6 text-sm rounded-full" : "w-full h-10 text-xs rounded-xl"
          )}
        >
          {isUpdating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Mark as Ready
        </Button>
      </div>
    );
  }

  if (activeTab === "ready") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold shrink-0",
          row ? "h-11 px-5" : "w-full h-10"
        )}
      >
        <CheckCircle2 className="size-3.5" />
        Ready for pickup
      </span>
    );
  }

  return null;
}

function KitchenCreatorBlock({ order }: { order: Order }) {
  const creatorName = getOrderCreatorName(order);
  const creatorRole = getOrderCreatorRole(order);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex items-center justify-center size-8 rounded-full bg-primary/10 shrink-0">
        <User className="size-3.5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-zinc-800 truncate">{creatorName}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary truncate">
          {creatorRole}
        </p>
      </div>
    </div>
  );
}

function KitchenOrderCard({
  order,
  menuItems,
  activeTab,
  isUpdating,
  onView,
  onMarkReady,
}: {
  order: Order;
  menuItems: MenuItem[];
  activeTab: KitchenTab;
  isUpdating: boolean;
  onView: () => void;
  onMarkReady: () => void;
}) {
  const imageUrl = getOrderCoverImage(order, menuItems);
  const itemCount = order.orderitem?.reduce((s, i) => s + i.quantity, 0) || 0;
  const visibleItems = order.orderitem?.slice(0, 4) ?? [];
  const hiddenCount = (order.orderitem?.length ?? 0) - visibleItems.length;

  return (
    <article className="flex flex-col h-full bg-white rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-primary/15 transition-all overflow-hidden">
      <div className="relative h-48 sm:h-52 bg-zinc-50 shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={getOrderTitle(order)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-50">
            <UtensilsCrossed className="size-10 text-zinc-300" />
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/95 border border-zinc-100 text-[10px] font-bold text-zinc-600 shadow-sm">
          #{order.id}
        </span>
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm">
          {getOrderSourceLabel(order)}
        </span>
      </div>

      <div className="flex flex-col flex-1 p-4 min-h-0">
        <h3 className="text-base font-bold text-[#3d2c1e] leading-snug line-clamp-2">
          {getOrderTitle(order)}
        </h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-50 border border-zinc-100 text-[10px] text-zinc-600">
            <Clock className="size-3 text-primary" />
            {getElapsedLabel(order.createdAt)}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-50 border border-zinc-100 text-[10px] font-medium text-zinc-600">
            {itemCount} items
          </span>
        </div>

        <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1 line-clamp-1">
          <MapPin className="size-3 shrink-0 text-zinc-400" />
          <span className="font-medium capitalize">{getOrderMeta(order)}</span>
        </p>

        <div className="mt-3 space-y-1 flex-1 min-h-0">
          {visibleItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 text-[12px] text-zinc-700"
            >
              <span className="font-bold text-primary min-w-[26px]">{item.quantity}x</span>
              <span className="truncate font-medium">{item.menuitem?.name || "Item"}</span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <p className="text-[11px] text-zinc-400 font-medium">+{hiddenCount} more items</p>
          )}
        </div>

        {order.notes && (
          <div className="mt-2 text-[11px] text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg px-2.5 py-2 line-clamp-2">
            <span className="font-semibold text-zinc-500">Note:</span> {order.notes}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-100 space-y-3">
          <KitchenCreatorBlock order={order} />
          <KitchenOrderActions
            order={order}
            activeTab={activeTab}
            isUpdating={isUpdating}
            onView={onView}
            onMarkReady={onMarkReady}
            layout="grid"
          />
        </div>
      </div>
    </article>
  );
}

function KitchenOrderListRow({
  order,
  menuItems,
  activeTab,
  isUpdating,
  onView,
  onMarkReady,
}: {
  order: Order;
  menuItems: MenuItem[];
  activeTab: KitchenTab;
  isUpdating: boolean;
  onView: () => void;
  onMarkReady: () => void;
}) {
  const imageUrl = getOrderCoverImage(order, menuItems);
  const itemCount = order.orderitem?.reduce((s, i) => s + i.quantity, 0) || 0;

  return (
    <article className="flex w-full bg-white rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden min-h-[200px]">
      <div className="w-[32%] sm:w-[28%] md:w-[24%] max-w-[280px] shrink-0 bg-zinc-50 self-stretch">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={getOrderTitle(order)}
            className="w-full h-full min-h-[200px] object-cover"
          />
        ) : (
          <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-50">
            <UtensilsCrossed className="size-12 text-zinc-300" />
          </div>
        )}
      </div>

      <div className="flex-1 p-5 sm:p-6 flex flex-col min-w-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-bold text-[#3d2c1e] leading-snug">
            {getOrderTitle(order)}
          </h3>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100 text-[12px] text-zinc-600">
              <Clock className="size-3.5 text-primary" />
              {getElapsedLabel(order.createdAt)}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100 text-[12px] font-medium text-zinc-600">
              Order #{order.id}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-100 text-[12px] font-medium text-zinc-600">
              {itemCount} items
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-[12px] font-medium text-primary">
              {getOrderSourceLabel(order)}
            </span>
          </div>

          <p className="text-[13px] text-zinc-500 mt-2.5 flex items-center gap-1.5 capitalize">
            <MapPin className="size-3.5 shrink-0 text-zinc-400" />
            <span className="font-medium">{getOrderMeta(order)}</span>
          </p>

          <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {order.orderitem?.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2.5 text-[14px] text-zinc-700"
              >
                <span className="font-bold text-primary text-[15px] min-w-[32px]">
                  {item.quantity}x
                </span>
                <span className="font-medium truncate">{item.menuitem?.name || "Item"}</span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="mt-4 text-[13px] text-zinc-600 bg-zinc-100 border border-zinc-200/80 rounded-xl px-4 py-2.5">
              <span className="font-semibold text-zinc-500">Note:</span>{" "}
              <span className="text-zinc-700">{order.notes}</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-5 flex items-center justify-between gap-4 border-t border-zinc-50">
          <KitchenCreatorBlock order={order} />
          <KitchenOrderActions
            order={order}
            activeTab={activeTab}
            isUpdating={isUpdating}
            onView={onView}
            onMarkReady={onMarkReady}
            layout="list"
          />
        </div>
      </div>
    </article>
  );
}

export default function KitchenOrdersView({
  orders,
  loading,
  menuItems,
  onRefresh,
}: KitchenOrdersViewProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<KitchenTab>("pending");
  const [viewMode, setViewMode] = useState<KitchenViewMode>("grid");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);

  const viewOrder = useMemo(
    () => (viewOrderId ? orders.find(o => o.id === viewOrderId) ?? null : null),
    [orders, viewOrderId]
  );

  useEffect(() => {
    const saved = localStorage.getItem("kitchen-view-mode");
    if (saved === "grid" || saved === "list") setViewMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("kitchen-view-mode", viewMode);
  }, [viewMode]);

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

  const handleMarkReady = async (order: Order) => {
    setUpdatingId(order.id);
    try {
      await orderApi.updateStatus(order.id, "ready");
      showToast(`Order #${order.id} is ready for pickup`, "success");
      await onRefresh(true);
      setActiveTab("ready");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update order status";
      showToast(message, "error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Kitchen Queue</h1>
      </div>

      <div className="px-4 mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                "shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border whitespace-nowrap transition-all",
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-white/90 text-muted-foreground border-border hover:border-primary/30 hover:text-primary"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
              <span
                className={cn(
                  "min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center",
                  isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-8">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-lg font-bold text-[#1e293b]">{activeConfig.label} Orders</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(["grid", "list"] as KitchenViewMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={mode === "grid" ? "Grid view" : "List view"}
                className={cn(
                  "size-9 rounded-lg border flex items-center justify-center transition-all",
                  viewMode === mode
                    ? "bg-white border-primary/40 text-primary shadow-sm"
                    : "bg-white/80 border-border text-muted-foreground hover:border-primary/20"
                )}
              >
                {mode === "grid" ? (
                  <LayoutGrid className="size-4" />
                ) : (
                  <List className="size-4" />
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-[420px] bg-zinc-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-[200px] bg-zinc-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-zinc-500 bg-white rounded-2xl border border-zinc-100 shadow-sm">
            <activeConfig.icon className="size-14 text-zinc-200" />
            <p className="mt-4 text-sm font-semibold text-zinc-600">{activeConfig.emptyTitle}</p>
            <p className="text-xs text-zinc-400 mt-1">{activeConfig.emptyHint}</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(order => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                menuItems={menuItems}
                activeTab={activeTab}
                isUpdating={updatingId === order.id}
                onView={() => setViewOrderId(order.id)}
                onMarkReady={() => handleMarkReady(order)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map(order => (
              <KitchenOrderListRow
                key={order.id}
                order={order}
                menuItems={menuItems}
                activeTab={activeTab}
                isUpdating={updatingId === order.id}
                onView={() => setViewOrderId(order.id)}
                onMarkReady={() => handleMarkReady(order)}
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
      />
    </div>
  );
}
