"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Eye, Search, Trash2 } from "lucide-react";
import { Order, OrderStatus } from "@/lib/api/restaurant/orderApi";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardStatusBadgeClass,
  actionBtnView,
  actionBtnDelete,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { getOrderTitle } from "@/lib/kitchen-order-utils";

const HISTORY_STATUSES: OrderStatus[] = ["served", "paid", "cancelled"];

function getOrderType(order: Order) {
  return order.orderType || (order.table ? "dine-in" : "takeaway");
}

function getOrderTypeLabel(order: Order) {
  const type = getOrderType(order);
  if (type === "dine-in") return "Dine-in";
  if (type === "delivery") return "Delivery";
  return "Takeaway";
}

function getLocationLabel(order: Order) {
  const type = getOrderType(order);
  if (type === "dine-in" && order.table) {
    return `Table ${order.table.number}`;
  }
  if (type === "delivery" && order.address) {
    return [order.address.street, order.address.district].filter(Boolean).join(", ");
  }
  if (type === "takeaway") return "Takeaway";
  return "—";
}

function formatOrderDate(order: Order) {
  const d = order.updatedAt || order.createdAt;
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, yyyy · h:mm a");
  } catch {
    return "—";
  }
}

const STATUS_STYLE: Record<string, string> = {
  served: "bg-zinc-100 text-zinc-700",
  paid: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-rose-50 text-rose-700",
};

interface OrdersHistoryPanelProps {
  orders: Order[];
  loading: boolean;
  onView: (order: Order) => void;
  onDelete?: (order: Order) => void;
  canDelete?: boolean;
  title?: string;
}

export default function OrdersHistoryPanel({
  orders,
  loading,
  onView,
  onDelete,
  canDelete = false,
  title = "Past Orders",
}: OrdersHistoryPanelProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      const matchesStatus =
        statusFilter === "all" || o.status === statusFilter;
      const orderType = getOrderType(o);
      const matchesType =
        typeFilter === "all" || orderType === typeFilter;
      const matchesSearch =
        !q ||
        String(o.id).includes(q) ||
        (o.customerName ?? "").toLowerCase().includes(q) ||
        (o.customerPhone ?? "").includes(q) ||
        getLocationLabel(o).toLowerCase().includes(q) ||
        getOrderTitle(o).toLowerCase().includes(q);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [orders, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter, pageSize]);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden mx-4 mb-8">
      <div className="px-8 py-4 flex flex-wrap items-center gap-6 border-b border-zinc-50">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="w-16 h-[42px] px-2 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
            <span>Filter Status</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-36 h-[42px] px-3 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
            >
              <option value="all">All Status</option>
              {HISTORY_STATUSES.map(s => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
            <span>Filter Type</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-36 h-[42px] px-3 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
            >
              <option value="all">All Types</option>
              <option value="dine-in">Dine-in</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>
        </div>

        <div className="flex-1" />

        <div className="relative w-64 group">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search order #, customer, table..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600"
          />
        </div>
      </div>

      <div className="px-8 py-3 border-b border-zinc-50 flex items-center gap-2">
        <h2 className="text-base font-bold text-[#1e293b]">{title}</h2>
        <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">
          {filtered.length}
        </span>
      </div>

      <div className="border-t border-zinc-100 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Order</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Customer</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Type</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Location</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Items</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Total</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Date</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="h-14 animate-pulse">
                    {[...Array(10)].map((_, j) => (
                      <TableCell key={j} className="px-6 py-4">
                        <div className="h-4 bg-zinc-100 rounded w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="px-6 py-10 text-center text-zinc-500">
                    No history orders found
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((order, idx) => {
                  const rowNo = (currentPage - 1) * pageSize + idx + 1;
                  const itemCount =
                    order.orderitem?.reduce((s, i) => s + i.quantity, 0) || 0;
                  return (
                    <TableRow key={order.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-bold text-primary">{rowNo}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-bold text-primary">#{order.id}</span>
                        <p className="text-[12px] text-zinc-500 mt-0.5 truncate max-w-[160px]">
                          {getOrderTitle(order)}
                        </p>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-700">
                          {order.customerName || "Guest"}
                        </span>
                        {order.customerPhone && (
                          <p className="text-[12px] text-zinc-400">{order.customerPhone}</p>
                        )}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] text-zinc-600">
                          {getOrderTypeLabel(order)}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] text-zinc-600 truncate max-w-[180px] block">
                          {getLocationLabel(order)}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] text-zinc-600">{itemCount}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-semibold text-zinc-800">
                          ${order.total.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span
                          className={cn(
                            dashboardStatusBadgeClass,
                            STATUS_STYLE[order.status] ?? "bg-zinc-100 text-zinc-600"
                          )}
                        >
                          {order.status}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[12px] text-zinc-500">
                          {formatOrderDate(order)}
                        </span>
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(order)}
                            className={actionBtnView}
                            title="View order"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canDelete && onDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(order)}
                              className={actionBtnDelete}
                              title="Delete order"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="py-2 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-zinc-400 border-t border-zinc-100 bg-zinc-50/30">
        <div>
          {filtered.length === 0
            ? "0 orders"
            : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            &lt;
          </button>
          <div className="px-3 py-1 border border-zinc-200 rounded-md text-zinc-400">
            {currentPage} of {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
