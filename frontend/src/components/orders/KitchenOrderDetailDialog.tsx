"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  MapPin,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { useToast } from "@/components/ui/toast";
import { btnCreatePage } from "@/lib/dashboard-ui";
import {
  getElapsedLabel,
  getLineImage,
  getOrderMeta,
  getOrderSourceLabel,
  isKitchenPendingStatus,
} from "@/lib/kitchen-order-utils";
import { cn } from "@/lib/utils";

type KitchenOrderDetailDialogProps = {
  order: Order | null;
  menuItems: MenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdated?: (order: Order) => void | Promise<void>;
  onStartedPreparing?: () => void;
  onMarkedReady?: () => void;
  onMarkedServed?: () => void;
  allowMarkServed?: boolean;
  readOnly?: boolean;
};

export default function KitchenOrderDetailDialog({
  order,
  menuItems,
  open,
  onOpenChange,
  onOrderUpdated,
  onStartedPreparing,
  onMarkedReady,
  onMarkedServed,
  allowMarkServed = false,
  readOnly = false,
}: KitchenOrderDetailDialogProps) {
  const { showToast } = useToast();
  const [startingPrep, setStartingPrep] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [markingServed, setMarkingServed] = useState(false);

  if (!order) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden" />
      </Dialog>
    );
  }

  const customerLabel =
    order.user?.fullName || order.customerName || "Walk-in guest";
  const lines = order.orderitem ?? [];

  const handleStartPreparing = async () => {
    setStartingPrep(true);
    try {
      const updated = await orderApi.updateStatus(order.id, "preparing");
      await onOrderUpdated?.(updated);
      showToast(`Order #${order.id} is now preparing`, "success");
      onStartedPreparing?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to start preparing";
      showToast(message, "error");
    } finally {
      setStartingPrep(false);
    }
  };

  const handleMarkReady = async () => {
    setMarkingReady(true);
    try {
      const updated = await orderApi.updateStatus(order.id, "ready");
      await onOrderUpdated?.(updated);
      showToast(`Order #${order.id} is ready for pickup`, "success");
      onMarkedReady?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to mark order ready";
      showToast(message, "error");
    } finally {
      setMarkingReady(false);
    }
  };

  const handleMarkServed = async () => {
    setMarkingServed(true);
    try {
      const updated = await orderApi.updateStatus(order.id, "served");
      await onOrderUpdated?.(updated);
      showToast(`Order #${order.id} marked as served`, "success");
      onMarkedServed?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to mark order served";
      showToast(message, "error");
    } finally {
      setMarkingServed(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] bg-white dark:bg-[#161616] border-none p-0 gap-0 overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader className="shrink-0 px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/40 dark:bg-[#1a1a1a] space-y-1 text-left">
          <DialogTitle className="text-lg font-semibold text-[#1e293b] dark:text-white">
            Order #{order.id}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            {order.status === "preparing"
              ? "Preparing — read all items below"
              : order.status === "ready"
                ? "Ready for pickup"
                : "Review the order, then start preparing"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
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
            <p>
              <span className="text-zinc-400">Placed via:</span>{" "}
              {getOrderSourceLabel(order)}
              {order.user?.fullName && (
                <span className="text-zinc-400"> · {order.user.fullName}</span>
              )}
            </p>
            {order.notes && (
              <p className="pt-1">
                <span className="text-zinc-400">Note:</span> {order.notes}
              </p>
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-[#2a2a2a] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-3">
              Items to prepare
            </p>

            {lines.length === 0 ? (
              <p className="text-sm text-zinc-500">No items in this order.</p>
            ) : (
              <ul className="space-y-3">
                {lines.map(line => {
                  const menuDetail = menuItems.find(m => m.id === line.menuItemId);
                  const name = line.menuitem?.name || menuDetail?.name || "Item";
                  const categoryName = menuDetail?.category?.name;
                  const itemDescription =
                    menuDetail?.description || line.menuitem?.description;
                  const imageUrl = getLineImage(
                    line.menuItemId,
                    line.menuitem?.imageUrl,
                    menuItems
                  );

                  return (
                    <li key={line.id} className="flex items-start gap-3">
                      <div className="size-12 shrink-0 rounded-md overflow-hidden bg-zinc-100 dark:bg-[#1a1a1a]">
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
                        <p className="text-sm text-zinc-800 dark:text-zinc-200">
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {line.quantity}x
                          </span>{" "}
                          {name}
                        </p>
                        {categoryName && (
                          <p className="text-xs text-zinc-400 mt-0.5">{categoryName}</p>
                        )}
                        {itemDescription && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
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
        </div>

        <DialogFooter className="shrink-0 m-0 px-6 py-4 border-t border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/50 dark:bg-[#1a1a1a] flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 px-5 text-sm font-medium rounded-lg"
          >
            Close
          </Button>
          {!readOnly && isKitchenPendingStatus(order.status) && (
            <Button
              type="button"
              disabled={startingPrep}
              onClick={handleStartPreparing}
              className={cn(btnCreatePage, "h-9 px-5 text-sm gap-2 rounded-lg")}
            >
              {startingPrep ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Flame className="size-4" />
              )}
              Start preparing
            </Button>
          )}
          {!readOnly && order.status === "preparing" && (
            <Button
              type="button"
              disabled={markingReady}
              onClick={handleMarkReady}
              className="h-9 px-5 rounded-lg bg-emerald-600 !text-white hover:bg-emerald-700 hover:!text-white text-sm font-medium border-none gap-2"
            >
              {markingReady ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Mark as ready
            </Button>
          )}
          {!readOnly && order.status === "ready" && allowMarkServed && (
            <Button
              type="button"
              disabled={markingServed}
              onClick={handleMarkServed}
              className={cn(btnCreatePage, "h-9 px-5 text-sm gap-2 rounded-lg")}
            >
              {markingServed ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Mark as served
            </Button>
          )}
          {order.status === "ready" && !allowMarkServed && (
            <span className="h-9 px-5 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-semibold">
              <CheckCircle2 className="size-4" />
              Ready for pickup
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
