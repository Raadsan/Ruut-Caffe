"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  PackageOpen,
  UtensilsCrossed,
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
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  btnCreatePage,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  getElapsedLabel,
  getOrderCoverImage,
  getOrderMeta,
  getOrderTitle,
} from "@/lib/kitchen-order-utils";
import { onDebouncedEvent, ORDERS_CHANGED, OrderSocketPayload } from "@/lib/live-updates";
import { matchesReadyAudience } from "@/lib/order-type-utils";

function getPickupLabel(order: Order) {
  if (order.orderType === "delivery" && order.address) {
    return `${order.address.street}, ${order.address.district}`;
  }
  if (order.table?.number) {
    return `Table ${order.table.number}`;
  }
  if (order.orderType === "takeaway") return "Takeaway counter";
  return getOrderMeta(order);
}

type ReadyOrdersAudience = "waiter" | "pos";

interface WaiterReadyOrdersViewProps {
  audience?: ReadyOrdersAudience;
}

export default function WaiterReadyOrdersView({
  audience = "waiter",
}: WaiterReadyOrdersViewProps) {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [servingId, setServingId] = useState<number | null>(null);
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const fetchReadyOrders = useCallback(async (force = false) => {
    try {
      const [data, items] = await Promise.all([
        orderApi.getAllOrders({ status: "ready", readyPickup: true }, force),
        menuItemApi.getAllMenuItems(),
      ]);
      setOrders(
        (data || [])
          .filter(order => matchesReadyAudience(order, audience))
          .sort(
            (a, b) =>
              new Date(a.createdAt || 0).getTime() -
              new Date(b.createdAt || 0).getTime()
          )
      );
      setMenuItems(items || []);
    } catch {
      showToast("Failed to load ready orders", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, audience]);

  useEffect(() => {
    fetchReadyOrders(false);
    const removeListener = onDebouncedEvent<OrderSocketPayload>(ORDERS_CHANGED, (detail) => {
      if (!detail?.status || detail.status === "ready" || detail.action === "new") {
        fetchReadyOrders(true);
      }
    }, 700);
    return () => removeListener();
  }, [fetchReadyOrders]);

  const isPos = audience === "pos";
  const pageTitle = isPos ? "Ready Orders" : "Ready for Service";
  const pickupHeading = isPos ? "Hand to customer" : "Serve at table";
  const servedLabel = isPos ? "Handed to Customer" : "Mark as Served";
  const confirmTitle = isPos ? "Handed to customer?" : "Mark as Served?";
  const confirmBody = isPos
    ? "Confirm this takeaway or delivery order was given to the customer."
    : "Are you sure order was delivered to the table?";

  const openConfirmServed = (order: Order) => {
    setConfirmOrder(order);
    setIsConfirmOpen(true);
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
          ?.message || "Failed to mark order as served";
      showToast(message, "error");
    } finally {
      setServingId(null);
    }
  };

  return (
    <div
      className={isPos ? "h-full overflow-y-auto bg-gradient-to-br from-background via-secondary/8 to-secondary/15 p-5 md:p-6" : dashboardPageClass}
      style={isPos ? undefined : dashboardPageStyle}
    >
      <div className={cn("mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4", !isPos && "px-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>
            {pageTitle}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <ClipboardList className="size-4 text-primary" />
          <span>{orders.length} ready now</span>
        </div>
      </div>

      <div className={cn("pb-8", !isPos && "px-4")}>
        {loading ? (
          <div className="space-y-5 w-full">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-[190px] w-full bg-zinc-100 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-zinc-500 bg-white rounded-2xl border border-zinc-100 shadow-sm">
            <PackageOpen className="size-14 text-zinc-200" />
            <p className="mt-4 text-sm font-semibold text-zinc-600">
              No orders ready yet
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              When kitchen marks orders ready, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5 w-full">
            {orders.map(order => {
              const imageUrl = getOrderCoverImage(order, menuItems);
              const itemCount =
                order.orderitem?.reduce((s, i) => s + i.quantity, 0) || 0;
              const isServing = servingId === order.id;

              return (
                <article
                  key={order.id}
                  className="flex w-full bg-white rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden min-h-[190px]"
                >
                  <div className="w-[38%] sm:w-[34%] md:w-[30%] lg:w-[28%] max-w-[320px] shrink-0 bg-zinc-50 self-stretch">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={getOrderTitle(order)}
                        className="w-full h-full min-h-[190px] object-cover"
                      />
                    ) : (
                      <div className="w-full h-full min-h-[190px] flex items-center justify-center bg-gradient-to-br from-emerald-50 to-zinc-50">
                        <UtensilsCrossed className="size-12 text-emerald-200" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-5 sm:p-6 flex flex-col min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-wide border border-emerald-100">
                            <CheckCircle2 className="size-3.5" />
                            Ready
                          </span>
                          <span className="text-[12px] text-zinc-500">
                            {getElapsedLabel(order.createdAt)}
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-[#3d2c1e] leading-snug">
                          {getOrderTitle(order)}
                        </h3>
                        <p className="text-[12px] text-zinc-500 mt-1">
                          Order #{order.id} · {itemCount} items
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                      <MapPin className="size-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
                          {pickupHeading}
                        </p>
                        <p className="text-base font-bold text-[#1e293b] mt-0.5">
                          {getPickupLabel(order)}
                        </p>
                        <p className="text-[12px] text-zinc-500 mt-0.5">
                          {order.customerName || "Guest"}
                          {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {order.orderitem?.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-[13px] text-zinc-700"
                        >
                          <span className="font-bold text-primary min-w-[28px]">
                            {item.quantity}x
                          </span>
                          <span className="truncate font-medium">
                            {item.menuitem?.name || "Item"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div className="mt-3 text-[13px] text-zinc-600 bg-zinc-100 border border-zinc-200/80 rounded-xl px-4 py-2.5">
                        <span className="font-semibold text-zinc-500">Note:</span>{" "}
                        {order.notes}
                      </div>
                    )}

                    <div className="mt-auto pt-5 flex justify-end border-t border-zinc-50">
                      <Button
                        type="button"
                        disabled={isServing}
                        onClick={() => openConfirmServed(order)}
                        className={cn(
                          btnCreatePage,
                          "h-11 px-6 text-sm rounded-full gap-2"
                        )}
                      >
                        {isServing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {servedLabel}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
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
          <DialogTitle className="sr-only">Confirm served</DialogTitle>
          <div className="p-8 flex items-start gap-5">
            <div className="w-14 h-14 shrink-0 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <div className="pt-1 min-w-0">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">{confirmTitle}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {confirmBody} Order #{confirmOrder?.id}.
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
                  {isPos ? "Yes, Handed Over" : "Yes, Mark as Served"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
