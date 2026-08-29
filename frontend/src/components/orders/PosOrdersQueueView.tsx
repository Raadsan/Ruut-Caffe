"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  PackageOpen,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { menuItemApi, MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { isKitchenPendingStatus } from "@/lib/kitchen-order-utils";
import { onDebouncedEvent, ORDERS_CHANGED } from "@/lib/live-updates";
import { matchesReadyAudience } from "@/lib/order-type-utils";
import OrderQueueCard from "@/components/orders/OrderQueueCard";
import KitchenOrderDetailDialog from "@/components/orders/KitchenOrderDetailDialog";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";

type PosQueueTab = "pending" | "preparing" | "ready";

const TABS: {
  id: PosQueueTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "pending", label: "Pending", icon: Clock },
  { id: "preparing", label: "Preparing", icon: Flame },
  { id: "ready", label: "Ready", icon: CheckCircle2 },
];

function getPickupLabel(order: Order) {
  if (order.orderType === "delivery" && order.address) {
    return `${order.address.street}, ${order.address.district}`;
  }
  if (order.orderType === "takeaway") return "Takeaway counter";
  return "Customer pickup";
}

function matchesTab(order: Order, tab: PosQueueTab) {
  const status = order.status || "pending";
  if (tab === "pending") return isKitchenPendingStatus(status);
  if (tab === "preparing") return status === "preparing";
  return status === "ready";
}

export default function PosOrdersQueueView() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PosQueueTab>("pending");
  const [servingId, setServingId] = useState<number | null>(null);
  const [preparingId, setPreparingId] = useState<number | null>(null);
  const [readyingId, setReadyingId] = useState<number | null>(null);
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const fetchOrders = useCallback(async (force = false) => {
    try {
      const [data, items] = await Promise.all([
        orderApi.getAllOrders({ posQueue: true }, force),
        menuItemApi.getAllMenuItems(),
      ]);
      setMenuItems(items || []);
      setOrders(
        (data || [])
          .filter(order => matchesReadyAudience(order, "pos"))
          .sort(
            (a, b) =>
              new Date(a.createdAt || 0).getTime() -
              new Date(b.createdAt || 0).getTime()
          )
      );
    } catch {
      showToast("Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOrders(false);
    const removeListener = onDebouncedEvent(ORDERS_CHANGED, () => {
      fetchOrders(true);
    }, 700);
    return () => removeListener();
  }, [fetchOrders]);

  const tabCounts = useMemo(
    () =>
      TABS.reduce(
        (acc, tab) => {
          acc[tab.id] = orders.filter(order => matchesTab(order, tab.id)).length;
          return acc;
        },
        {} as Record<PosQueueTab, number>
      ),
    [orders]
  );

  const visibleOrders = useMemo(
    () => orders.filter(order => matchesTab(order, activeTab)),
    [orders, activeTab]
  );

  const viewOrder = useMemo(
    () => (viewOrderId ? orders.find(o => o.id === viewOrderId) ?? null : null),
    [orders, viewOrderId]
  );

  const handleStartPreparing = async (order: Order) => {
    setPreparingId(order.id);
    try {
      const updated = await orderApi.updateStatus(order.id, "preparing");
      setOrders(prev => prev.map(o => (o.id === order.id ? updated : o)));
      showToast(`Order #${order.id} is now preparing`, "success");
      setActiveTab("preparing");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to start preparing";
      showToast(message, "error");
    } finally {
      setPreparingId(null);
    }
  };

  const handleMarkReady = async (order: Order) => {
    setReadyingId(order.id);
    try {
      const updated = await orderApi.updateStatus(order.id, "ready");
      setOrders(prev => prev.map(o => (o.id === order.id ? updated : o)));
      showToast(`Order #${order.id} is ready`, "success");
      setActiveTab("ready");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to mark order ready";
      showToast(message, "error");
    } finally {
      setReadyingId(null);
    }
  };

  const handleMarkServed = async () => {
    if (!confirmOrder) return;
    setServingId(confirmOrder.id);
    try {
      await orderApi.updateStatus(confirmOrder.id, "served");
      showToast(`Order #${confirmOrder.id} marked as served`, "success");
      setOrders(prev => prev.filter(o => o.id !== confirmOrder.id));
      setIsConfirmOpen(false);
      setConfirmOrder(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to complete order";
      showToast(message, "error");
    } finally {
      setServingId(null);
    }
  };

  const emptyCopy = {
    pending: {
      title: "No pending orders",
      hint: "New takeaway and delivery orders will appear here.",
    },
    preparing: {
      title: "Nothing preparing",
      hint: "Start preparing from the Pending tab.",
    },
    ready: {
      title: "No orders ready yet",
      hint: "Mark orders ready from the Preparing tab.",
    },
  }[activeTab];

  const activeTabLabel = TABS.find(t => t.id === activeTab)?.label ?? "Orders";

  return (
    <div className={cn(dashboardPageClass, "h-full overflow-y-auto space-y-6")} style={dashboardPageStyle}>
      <div className={cn(pageHeaderWrapperClass, "flex flex-col sm:flex-row sm:items-center justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Order Queue</h1>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-zinc-500 uppercase tracking-wider font-medium">
          <ClipboardList className="size-4 text-primary" />
          <span>{orders.length} active orders</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const count = tabCounts[tab.id];
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all shrink-0",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              <span
                className={cn(
                  "min-w-5 h-5 px-1 rounded-full text-[10px] flex items-center justify-center",
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <h2 className="text-lg font-bold text-[#1e293b] uppercase tracking-tight">{activeTabLabel} Orders</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">
            {visibleOrders.length}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[280px] bg-zinc-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-zinc-500 bg-white rounded-2xl border border-zinc-100 shadow-sm">
            <PackageOpen className="size-14 text-zinc-200" />
            <p className="mt-4 text-sm font-semibold text-zinc-600">{emptyCopy.title}</p>
            <p className="text-xs text-zinc-400 mt-1">{emptyCopy.hint}</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleOrders.map(order => (
              <OrderQueueCard
                key={order.id}
                order={order}
                showPrepareAction={
                  activeTab === "pending" && isKitchenPendingStatus(order.status || "pending")
                }
                showReadyAction={activeTab === "preparing"}
                showServedAction={activeTab === "ready"}
                isActionLoading={servingId === order.id}
                isPrepareLoading={preparingId === order.id}
                isReadyLoading={readyingId === order.id}
                onViewOrder={() => setViewOrderId(order.id)}
                onStartPreparing={() => handleStartPreparing(order)}
                onMarkReady={() => handleMarkReady(order)}
                onMarkServed={() => {
                  setConfirmOrder(order);
                  setIsConfirmOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={isConfirmOpen}
        onOpenChange={open => {
          if (!open && !servingId) {
            setIsConfirmOpen(false);
            setConfirmOrder(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-white border-zinc-100 p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Confirm mark as served</DialogTitle>
          <div className="p-8 flex items-start gap-5">
            <div className="w-14 h-14 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <div className="pt-1 min-w-0">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Mark as Served?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure order #{confirmOrder?.id} was picked up by the customer?
              </p>
              {confirmOrder && (
                <p className="text-sm font-semibold text-zinc-700 mt-3">
                  {getPickupLabel(confirmOrder)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="px-8 py-5 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsConfirmOpen(false);
                setConfirmOrder(null);
              }}
              disabled={!!servingId}
              className="rounded-xl font-bold border-zinc-200 px-6 h-11"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMarkServed}
              disabled={!!servingId}
              className="h-11 px-6 rounded-xl bg-emerald-600 !text-white hover:bg-emerald-700 hover:!text-white font-bold border-none gap-2"
            >
              {servingId ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Yes, Mark as Served
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KitchenOrderDetailDialog
        order={viewOrder}
        menuItems={menuItems}
        open={viewOrderId !== null}
        onOpenChange={open => {
          if (!open) setViewOrderId(null);
        }}
        onOrderUpdated={async updated => {
          setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
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
