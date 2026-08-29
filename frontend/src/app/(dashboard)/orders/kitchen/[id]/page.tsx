"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  MapPin,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { menuItemApi, MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { authApi } from "@/lib/api/auth/authApi";
import { useToast } from "@/components/ui/toast";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  btnCreatePage,
} from "@/lib/dashboard-ui";
import {
  getElapsedLabel,
  getLineImage,
  getOrderMeta,
  getOrderSourceLabel,
  isKitchenPendingStatus,
} from "@/lib/kitchen-order-utils";
import { cn } from "@/lib/utils";
import { onDebouncedEvent, ORDERS_CHANGED, OrderSocketPayload } from "@/lib/live-updates";

export default function KitchenOrderPreparePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const orderId = Number(params.id);

  const [order, setOrder] = useState<Order | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingPrep, setStartingPrep] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId || Number.isNaN(orderId)) return;
    try {
      const [orders, items] = await Promise.all([
        orderApi.getAllOrders(),
        menuItemApi.getAllMenuItems(),
      ]);
      setMenuItems(items || []);
      const found = (orders || []).find(o => o.id === orderId) ?? null;
      setOrder(found);
      if (!found) showToast("Order not found", "error");
    } catch {
      showToast("Failed to load order", "error");
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast]);

  useEffect(() => {
    authApi.getMe().then(user => {
      if (user.role?.toLowerCase() !== "kitchen") {
        router.replace("/orders");
      }
    });
    loadOrder();

    const removeListener = onDebouncedEvent<OrderSocketPayload>(
      ORDERS_CHANGED,
      (detail) => {
        if (detail?.id === orderId) {
          if (detail.status) {
            setOrder(prev => (prev ? { ...prev, status: detail.status as Order["status"] } : prev));
          } else {
            loadOrder();
          }
        }
      },
      400
    );

    return () => removeListener();
  }, [loadOrder, router, orderId]);

  const handleStartPreparing = async () => {
    if (!order) return;
    setStartingPrep(true);
    try {
      const updated = await orderApi.updateStatus(order.id, "preparing");
      setOrder(updated);
      showToast(`Order #${order.id} is now preparing`, "success");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to start preparing";
      showToast(message, "error");
    } finally {
      setStartingPrep(false);
    }
  };

  const handleMarkReady = async () => {
    if (!order) return;
    setMarkingReady(true);
    try {
      await orderApi.updateStatus(order.id, "ready");
      showToast(`Order #${order.id} is ready for pickup`, "success");
      router.push("/orders");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to mark order ready";
      showToast(message, "error");
    } finally {
      setMarkingReady(false);
    }
  };

  if (loading) {
    return (
      <div
        className={cn(dashboardPageClass, "flex items-center justify-center min-h-[60vh]")}
        style={dashboardPageStyle}
      >
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className={dashboardPageClass} style={dashboardPageStyle}>
        <div className="px-4 py-16 text-center">
          <p className="text-zinc-600">Order not found</p>
          <Link
            href="/orders"
            className={cn(buttonVariants({ variant: "link" }), "mt-2 inline-flex")}
          >
            Back to Kitchen Queue
          </Link>
        </div>
      </div>
    );
  }

  const customerLabel =
    order.user?.fullName || order.customerName || "Walk-in guest";
  const lines = order.orderitem ?? [];

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className="px-4 pb-8 max-w-2xl">
        <Link
          href="/orders"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "gap-2 text-zinc-500 hover:text-primary -ml-2 mb-4 h-9 px-2 inline-flex"
          )}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <h1 className={pageHeaderTitleClass}>
          Order #{order.id}
        </h1>

        <div className="space-y-2 text-sm text-zinc-600 mb-6">
          <p className="flex items-center gap-2">
            <Clock className="size-3.5 text-zinc-400 shrink-0" />
            {getElapsedLabel(order.createdAt)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-3.5 text-zinc-400 shrink-0" />
            {getOrderMeta(order)}
          </p>
          <p className="flex items-center gap-2">
            <User className="size-3.5 text-zinc-400 shrink-0" />
            {customerLabel}
            {order.customerPhone && (
              <span className="text-zinc-400">· {order.customerPhone}</span>
            )}
          </p>
          <p className="text-zinc-600">
            <span className="text-zinc-400">Placed via:</span> {getOrderSourceLabel(order)}
            {order.user?.fullName && (
              <span className="text-zinc-400"> · {order.user.fullName}</span>
            )}
          </p>
          {order.notes && (
            <p className="text-zinc-600 pt-1">
              <span className="text-zinc-400">Note:</span> {order.notes}
            </p>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-4">
            Items to prepare
          </p>

          {lines.length === 0 ? (
            <p className="text-sm text-zinc-500">No items in this order.</p>
          ) : (
            <ul className="space-y-4">
              {lines.map(line => {
                const menuDetail = menuItems.find(m => m.id === line.menuItemId);
                const name =
                  line.menuitem?.name || menuDetail?.name || "Item";
                const categoryName = menuDetail?.category?.name;
                const itemDescription =
                  menuDetail?.description || line.menuitem?.description;
                const imageUrl = getLineImage(
                  line.menuItemId,
                  line.menuitem?.imageUrl,
                  menuItems
                );

                return (
                  <li
                    key={line.id}
                    className="flex items-center gap-3 py-1"
                  >
                    <div className="size-12 shrink-0 rounded-md overflow-hidden bg-zinc-100">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="size-full flex items-center justify-center">
                          <UtensilsCrossed className="size-4 text-zinc-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-800">
                        <span className="font-semibold text-zinc-900">
                          {line.quantity}x
                        </span>{" "}
                        {name}
                      </p>
                      {categoryName && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {categoryName}
                        </p>
                      )}
                      {itemDescription && (
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                          {itemDescription}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/orders"
            className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-md inline-flex")}
          >
            Back to queue
          </Link>
          {isKitchenPendingStatus(order.status) && (
            <Button
              type="button"
              disabled={startingPrep}
              onClick={handleStartPreparing}
              className={cn(btnCreatePage, "h-10 flex-1 rounded-md text-sm gap-2")}
            >
              {startingPrep ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Flame className="size-4" />
              )}
              Start Preparing
            </Button>
          )}
          {order.status === "preparing" && (
            <Button
              type="button"
              disabled={markingReady}
              onClick={handleMarkReady}
              className="h-10 flex-1 rounded-md bg-emerald-600 !text-white hover:bg-emerald-700 hover:!text-white text-sm font-medium border-none gap-2"
            >
              {markingReady ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Mark as Ready
            </Button>
          )}
          {order.status === "ready" && (
            <span className="h-10 flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-semibold">
              <CheckCircle2 className="size-4" />
              Ready for pickup
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
