"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orderApi, Order, OrderStatus } from "@/lib/api/restaurant/orderApi";
import { MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { useToast } from "@/components/ui/toast";
import { btnCreatePage, dashboardInputClass, dashboardLabelClass } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

type CartLine = {
  menuItemId: number;
  name: string;
  quantity: number;
};

type PosOrderEditDialogProps = {
  order: Order | null;
  menuItems: MenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void | Promise<void>;
};

export default function PosOrderEditDialog({
  order,
  menuItems,
  open,
  onOpenChange,
  onSaved,
}: PosOrderEditDialogProps) {
  const { showToast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("pending");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order || !open) return;
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.customerPhone || "");
    setNotes(order.notes || "");
    setStatus(order.status);
    setLines(
      (order.orderitem || []).map(line => ({
        menuItemId: line.menuItemId,
        name: line.menuitem?.name || menuItems.find(m => m.id === line.menuItemId)?.name || "Item",
        quantity: line.quantity,
      }))
    );
  }, [order, open, menuItems]);

  const updateQty = (menuItemId: number, delta: number) => {
    setLines(prev =>
      prev
        .map(line =>
          line.menuItemId === menuItemId
            ? { ...line, quantity: line.quantity + delta }
            : line
        )
        .filter(line => line.quantity > 0)
    );
  };

  const handleSave = async () => {
    if (!order) return;
    if (lines.length === 0) {
      showToast("Order must have at least one item", "error");
      return;
    }

    setSaving(true);
    try {
      await orderApi.updateOrder(order.id, {
        tableId: order.tableId,
        type: order.orderType || "dine-in",
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lines.map(line => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
        })),
      });

      if (status !== order.status) {
        await orderApi.updateStatus(order.id, status);
      }

      showToast(`Order #${order.id} updated`, "success");
      await onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update order";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!order) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg p-0" />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b border-zinc-100 shrink-0">
          <DialogTitle className="text-lg font-bold">Edit Order #{order.id}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={dashboardLabelClass}>Customer</label>
              <input
                className={cn(dashboardInputClass, "w-full mt-1")}
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className={dashboardLabelClass}>Phone</label>
              <input
                className={cn(dashboardInputClass, "w-full mt-1")}
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Phone"
              />
            </div>
          </div>

          <div>
            <label className={dashboardLabelClass}>Status</label>
            <select
              className={cn(dashboardInputClass, "w-full mt-1")}
              value={status}
              onChange={e => setStatus(e.target.value as OrderStatus)}
            >
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="served">Served</option>
            </select>
          </div>

          <div>
            <label className={dashboardLabelClass}>Notes</label>
            <textarea
              className={cn(dashboardInputClass, "w-full mt-1 min-h-[72px] resize-none")}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Order notes"
            />
          </div>

          <div>
            <label className={dashboardLabelClass}>Items</label>
            <ul className="mt-2 space-y-2">
              {lines.map(line => (
                <li
                  key={line.menuItemId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-zinc-800 truncate flex-1">
                    {line.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(line.menuItemId, -1)}
                      className="size-7 rounded-md border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(line.menuItemId, 1)}
                      className="size-7 rounded-md border border-zinc-200 bg-white flex items-center justify-center hover:bg-zinc-50"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-zinc-100 gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className={btnCreatePage}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
