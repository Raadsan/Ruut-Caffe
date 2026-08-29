"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  History,
  MapPin,
  PackageOpen,
  Search,
} from "lucide-react";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { useToast } from "@/components/ui/toast";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
} from "@/lib/dashboard-ui";
import { getOrderTitle } from "@/lib/kitchen-order-utils";
import { cn } from "@/lib/utils";
import { onDebouncedEvent, ORDERS_CHANGED, OrderSocketPayload } from "@/lib/live-updates";

function getPickupLabel(order: Order) {
  if (order.orderType === "delivery" && order.address) {
    return `${order.address.street}, ${order.address.district}`;
  }
  if (order.table?.number) {
    return `Table ${order.table.number}`;
  }
  if (order.orderType === "takeaway") return "Takeaway";
  return order.orderType?.replace("-", " ") || "—";
}

function formatServedAt(order: Order) {
  const d = order.updatedAt || order.createdAt;
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, yyyy · h:mm a");
  } catch {
    return "—";
  }
}

export default function WaiterPickupHistoryView() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchHistory = useCallback(async (force = false) => {
    try {
      const data = await orderApi.getAllOrders({ waiterHistory: true }, force);
      setOrders(data || []);
    } catch {
      showToast("Failed to load pickup history", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchHistory(false);
    const removeListener = onDebouncedEvent<OrderSocketPayload>(ORDERS_CHANGED, (detail) => {
      if (detail?.status === "served" || detail?.action === "update") {
        fetchHistory(true);
      }
    }, 800);
    return () => removeListener();
  }, [fetchHistory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      o =>
        String(o.id).includes(q) ||
        (o.customerName ?? "").toLowerCase().includes(q) ||
        getPickupLabel(o).toLowerCase().includes(q) ||
        getOrderTitle(o).toLowerCase().includes(q)
    );
  }, [orders, search]);

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={cn(pageHeaderWrapperClass, "flex flex-col md:flex-row md:items-center justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Pickup History</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <History className="size-4 text-primary" />
          <span>{filtered.length} served</span>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="relative max-w-md group">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search order #, customer, table..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 text-sm text-zinc-600"
          />
        </div>
      </div>

      <div className="px-4 pb-8">
        {loading ? (
          <div className="h-48 bg-zinc-100 rounded-2xl animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-zinc-500 bg-white rounded-2xl border border-zinc-100">
            <PackageOpen className="size-14 text-zinc-200" />
            <p className="mt-4 text-sm font-semibold text-zinc-600">
              No served orders yet
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Orders you create and mark as served will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className={dashboardTableHeaderClass}>
                  <tr className={dashboardTableHeadRowClass}>
                    <th className={cn(dashboardTableHeadClass, "text-left")}>
                      Order
                    </th>
                    <th className={cn(dashboardTableHeadClass, "text-left")}>
                      Delivered to
                    </th>
                    <th className={cn(dashboardTableHeadClass, "text-left")}>
                      Customer
                    </th>
                    <th className={cn(dashboardTableHeadClass, "text-left")}>
                      Items
                    </th>
                    <th className={cn(dashboardTableHeadClass, "text-left")}>
                      Total
                    </th>
                    <th className={cn(dashboardTableHeadClass, "text-left")}>
                      Served
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filtered.map(order => {
                    const itemCount =
                      order.orderitem?.reduce((s, i) => s + i.quantity, 0) || 0;
                    return (
                      <tr key={order.id} className={dashboardTableBodyRowClass}>
                        <td className={dashboardTableCellClass}>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-primary">
                              #{order.id}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                              <CheckCircle2 className="size-3" />
                              Served
                            </span>
                          </div>
                          <p className="text-[12px] text-zinc-500 mt-0.5 truncate max-w-[180px]">
                            {getOrderTitle(order)}
                          </p>
                        </td>
                        <td className={dashboardTableCellClass}>
                          <span className="text-[13px] text-zinc-700 flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-zinc-400 shrink-0" />
                            {getPickupLabel(order)}
                          </span>
                        </td>
                        <td className={dashboardTableCellClass}>
                          <span className="text-[13px] text-zinc-700">
                            {order.customerName || "Guest"}
                          </span>
                        </td>
                        <td className={dashboardTableCellClass}>
                          <span className="text-[13px] text-zinc-600">
                            {itemCount} items
                          </span>
                        </td>
                        <td className={dashboardTableCellClass}>
                          <span className="text-[13px] font-semibold text-zinc-800">
                            ${order.total.toFixed(2)}
                          </span>
                        </td>
                        <td className={dashboardTableCellClass}>
                          <span className="text-[12px] text-zinc-500">
                            {formatServedAt(order)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
