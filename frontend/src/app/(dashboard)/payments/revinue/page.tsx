"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  ClipboardList,
  Search,
  Download,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { reportApi } from "@/lib/api/restaurant/reportApi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatPaymentMethod } from "@/lib/format-payment-method";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
} from "@/lib/dashboard-ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FinanceItem {
  id: number;
  orderId: number;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  profit: number;
  date: string;
  paymentMethod?: string;
  providerName?: string | null;
}

interface FinanceReportData {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  transactionCount: number;
  breakdownByMethod?: Record<string, number>;
  items: FinanceItem[];
}

export default function RevenuePage() {
  const [data, setData] = useState<FinanceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const { showToast } = useToast();

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const report = await reportApi.getFinanceReport({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (report.success) {
        setData(report.data);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("Failed to fetch revenue report", error);
      showToast("Failed to load revenue data", "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange.endDate, dateRange.startDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val || 0);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.items;
    return data.items.filter((item) => {
      const methodLabel = formatPaymentMethod(item.paymentMethod, item.providerName).toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.orderId.toString().includes(q) ||
        methodLabel.includes(q)
      );
    });
  }, [data, search]);

  const paginatedItems = useMemo(
    () => filteredItems.slice(0, pageSize),
    [filteredItems, pageSize]
  );

  const methodBreakdown = useMemo(() => {
    if (!data?.breakdownByMethod) return [];
    return Object.entries(data.breakdownByMethod)
      .map(([method, amount]) => ({
        method,
        label: formatPaymentMethod(method),
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data?.breakdownByMethod]);

  const exportCsv = () => {
    if (!filteredItems.length) {
      showToast("No data to export", "error");
      return;
    }
    const header = [
      "Order Item",
      "Order ID",
      "Date",
      "Quantity",
      "Cost Price",
      "Selling Price",
      "Profit",
      "Payment Method",
    ];
    const rows = filteredItems.map((item) => [
      item.name,
      item.orderId,
      new Date(item.date).toLocaleDateString(),
      item.quantity,
      item.costPrice,
      item.sellingPrice,
      item.profit,
      formatPaymentMethod(item.paymentMethod, item.providerName),
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-${dateRange.startDate}-${dateRange.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${dashboardPageClass} space-y-3`} style={dashboardPageStyle}>
      <div className="px-4 mb-1 flex items-start justify-between gap-4">
        <div>
          <h1 className={pageHeaderTitleClass}>Revenue Analytics</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={fetchReport}
          disabled={loading}
          className="h-9 gap-2 text-xs font-bold uppercase tracking-widest shrink-0"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 px-4">
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm hover:border-primary/20 transition-all group flex flex-col gap-4">
          <div className="p-2.5 bg-primary/10 rounded-lg w-fit group-hover:bg-primary transition-colors">
            <DollarSign className="size-4 text-primary group-hover:text-white transition-colors" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              Total Revenue
            </p>
            <h3 className="text-xl font-black text-[#1E293B]">
              {formatCurrency(data?.totalRevenue ?? 0)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm hover:border-primary/20 transition-all group flex flex-col gap-4">
          <div className="p-2.5 bg-primary/10 rounded-lg w-fit group-hover:bg-primary transition-colors">
            <ClipboardList className="size-4 text-primary group-hover:text-white transition-colors" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              Total Orders
            </p>
            <h3 className="text-xl font-black text-[#1E293B]">{data?.transactionCount || 0}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm hover:border-amber-500/20 transition-all group flex flex-col gap-4">
          <div className="p-2.5 bg-amber-50 rounded-lg w-fit group-hover:bg-amber-500 transition-colors">
            <CreditCard className="size-4 text-amber-600 group-hover:text-white transition-colors" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              Total Cost
            </p>
            <h3 className="text-xl font-black text-[#1E293B]">{formatCurrency(data?.totalCost ?? 0)}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm hover:border-emerald-500/20 transition-all group flex flex-col gap-4">
          <div className="p-2.5 bg-emerald-50 rounded-lg w-fit group-hover:bg-emerald-500 transition-colors">
            <TrendingUp className="size-4 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
              Net Profit
            </p>
            <h3 className="text-xl font-black text-emerald-600">
              {formatCurrency(data?.netProfit ?? 0)}
            </h3>
          </div>
        </div>
      </div>

      {methodBreakdown.length > 0 && (
        <div className="mx-4 flex flex-wrap gap-2">
          {methodBreakdown.map((entry) => (
            <div
              key={entry.method}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs"
            >
              <span className="font-semibold text-zinc-600">{entry.label}</span>
              <span className="font-bold text-primary dark:text-white">
                {formatCurrency(entry.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden mx-4">
        <div className="px-8 py-4 flex flex-wrap items-center gap-6 border-b border-zinc-50 bg-white">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-16 h-[38px] px-2 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-zinc-400" />
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                  className="h-[38px] px-3 border border-zinc-200 rounded-md outline-none focus:border-primary transition-all text-sm font-medium text-zinc-600 bg-zinc-50/50"
                />
              </div>
              <span className="text-zinc-300">to</span>
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 text-zinc-400" />
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  className="h-[38px] px-3 border border-zinc-200 rounded-md outline-none focus:border-primary transition-all text-sm font-medium text-zinc-600 bg-zinc-50/50"
                />
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="relative w-64 group">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search items, orders, payment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-[38px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary transition-all text-sm font-normal text-zinc-600"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={exportCsv}
              className="h-[38px] px-4 border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-md flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </div>

        <div className="overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Order Item
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Payment Method
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Quantity
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Cost Price
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Selling Price
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                    Revenue (Profit)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j} className="px-8 py-3">
                          <div className="h-4 bg-zinc-100 rounded w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-8 py-20 text-center text-zinc-400">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <ClipboardList className="size-10" />
                        <p className="text-xs font-bold uppercase tracking-widest">
                          No transactions found
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => (
                    <TableRow
                      key={`${item.id}-${item.orderId}`}
                      className="border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                    >
                      <TableCell className="px-8 py-3">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-[#1E293B] uppercase tracking-tight">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                            Order {item.orderId} • {new Date(item.date).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-8 py-3">
                        <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded border border-zinc-200">
                          {formatPaymentMethod(item.paymentMethod, item.providerName)}
                        </span>
                      </TableCell>
                      <TableCell className="px-8 py-3">
                        <span className="text-[11px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          x{item.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="px-8 py-3">
                        <span className="text-[13px] font-medium text-zinc-600">
                          {formatCurrency(item.costPrice)}
                        </span>
                      </TableCell>
                      <TableCell className="px-8 py-3">
                        <span className="text-[13px] font-medium text-zinc-600">
                          {formatCurrency(item.sellingPrice)}
                        </span>
                      </TableCell>
                      <TableCell className="px-8 py-3 text-right pr-12">
                        <span
                          className={cn(
                            "text-[12px] font-bold px-2 py-1 rounded-md border",
                            item.profit >= 0
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : "bg-rose-50 text-rose-600 border-rose-100"
                          )}
                        >
                          {item.profit >= 0 ? "+" : ""}
                          {formatCurrency(item.profit)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="py-3 px-8 flex items-center justify-between bg-zinc-50/30 border-t border-zinc-100">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            Showing {paginatedItems.length} of {filteredItems.length} records
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                Total Net Profit:
              </p>
              <p className="text-sm font-black text-emerald-600">
                {formatCurrency(data?.netProfit ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
