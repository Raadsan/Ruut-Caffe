"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { useToast } from "@/components/ui/toast";
import {
  ClipboardList,
  DollarSign,
  TrendingUp,
  Wallet,
  Search,
  RefreshCw,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  dashboardStatIconClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableIdClass,
  dashboardStatusBadgeClass,
  getOrderStatusBadgeClass,
  formatStatusLabel,
  chartPrimary,
  chartPrimaryVariants,
  chartTooltipStyle,
  chartAxisTick,
} from "@/lib/dashboard-ui";

type DatePreset = "today" | "yesterday" | "week" | "last-month" | "custom";

function formatDateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().split("T")[0];
}

function getPresetRange(preset: Exclude<DatePreset, "custom">) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === "today") return { startDate: formatDateInput(today), endDate: formatDateInput(today) };
  if (preset === "yesterday") {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return { startDate: formatDateInput(date), endDate: formatDateInput(date) };
  }
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { startDate: formatDateInput(start), endDate: formatDateInput(today) };
  }
  return {
    startDate: formatDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    endDate: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
}

function getDayName(dateStr: string) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(dateStr).getDay()];
}

export default function MySalesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dateRange, setDateRange] = useState(() => getPresetRange("today"));
  const { showToast } = useToast();

  const fetchMyOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orderApi.getAllOrders({ onlyMine: true });
      setOrders(data.filter((o) => o.status !== "held"));
    } catch {
      showToast("Failed to fetch your sales", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyOrders();
  }, [fetchMyOrders]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val || 0);

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") setDateRange(getPresetRange(preset));
  };

  const rangeOrders = useMemo(() => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    end.setHours(23, 59, 59, 999);
    return orders.filter((o) => {
      if (!o.createdAt) return true;
      const d = new Date(o.createdAt as unknown as string);
      return d >= start && d <= end;
    });
  }, [orders, dateRange]);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rangeOrders.filter((o) => {
      const matchSearch =
        !q ||
        o.id.toString().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.status || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rangeOrders, search, statusFilter]);

  const paginatedOrders = useMemo(
    () => filteredOrders.slice(0, pageSize),
    [filteredOrders, pageSize]
  );

  const totalSales = rangeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = rangeOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const highestSale = totalOrders > 0 ? Math.max(...rangeOrders.map((o) => o.total || 0)) : 0;
  const servedCount = rangeOrders.filter((o) => o.status === "served").length;

  // All unique statuses for the filter dropdown
  const allStatuses = useMemo(() => {
    const s = new Set(orders.map((o) => o.status).filter(Boolean));
    return Array.from(s).sort();
  }, [orders]);

  const statCards = [
    { title: "Total Orders", value: totalOrders, icon: ClipboardList },
    { title: "Total Sales", value: formatCurrency(totalSales), icon: DollarSign },
    { title: "Avg Order", value: formatCurrency(avgOrderValue), icon: TrendingUp },
    { title: "Highest Sale", value: formatCurrency(highestSale), icon: Wallet },
    // { title: "Served", value: servedCount, icon: CheckCircle2 },
  ];

  // Area chart — orders by weekday
  const weeklyData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const map: Record<string, { orders: number; revenue: number }> = {};
    days.forEach((d) => (map[d] = { orders: 0, revenue: 0 }));
    rangeOrders.forEach((o) => {
      if (!o.createdAt) return;
      const day = getDayName(o.createdAt as unknown as string);
      if (map[day]) {
        map[day].orders += 1;
        map[day].revenue += o.total || 0;
      }
    });
    return days.map((name) => ({ name, ...map[name] }));
  }, [rangeOrders]);

  // Pie chart — status breakdown
  const statusChartData = useMemo(() => {
    const map: Record<string, number> = {};
    rangeOrders.forEach((o) => {
      const label = formatStatusLabel(o.status);
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [rangeOrders]);

  return (
    <div className="h-full overflow-y-auto">
    <div
      className={cn(dashboardPageClass, "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700")}
      style={dashboardPageStyle}
    >
      {/* ── Header ─────────────────────────────── */}
      <div className={cn(pageHeaderWrapperClass, "flex flex-col md:flex-row md:items-end justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>My Sales</h1>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-1 font-medium">
            Your personal sales analytics &amp; history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 trezo-card p-2">
          <div className="flex items-center gap-1 p-1 rounded-md bg-muted/40 overflow-x-auto max-w-full">
            {([["today", "Today"], ["yesterday", "Yesterday"], ["week", "1 Week"], ["last-month", "Last Month"], ["custom", "Custom"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => applyDatePreset(value)} className={cn("h-8 px-2.5 rounded text-[11px] font-bold whitespace-nowrap transition-colors", datePreset === value ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-background")}>
                {label}
              </button>
            ))}
          </div>
          <div className={cn("items-center gap-2 px-2", datePreset === "custom" ? "flex" : "hidden")}>
            <Calendar className="size-3.5 text-muted-foreground" />
            <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))} className="text-xs font-semibold bg-transparent outline-none border-none cursor-pointer text-foreground" />
            <span className="text-muted-foreground">to</span>
            <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))} className="text-xs font-semibold bg-transparent outline-none border-none cursor-pointer text-foreground" />
          </div>          <Button
            type="button"
            onClick={fetchMyOrders}
            disabled={loading}
            className="bg-primary !text-white hover:bg-primary/90 h-9 px-4 rounded-lg text-xs font-bold gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {loading && !orders.length ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 px-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="trezo-card h-28 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Stat Cards ─────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
            {statCards.map((stat, i) => (
              <div
                key={stat.title}
                className="trezo-card p-6 flex flex-col justify-between group hover:border-primary/30 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className={dashboardStatIconClass(i)}>
                    <stat.icon className="size-5 text-white" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                    {stat.title}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* ── Charts Row: Area (2/3) + Pie (1/3) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
            {/* Area chart */}
            <div className="lg:col-span-2 trezo-card p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Sales Trend</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Weekly order volume
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Orders
                  </span>
                </div>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMySales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                    <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      stroke={chartPrimary}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorMySales)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Order Status Pie — now in the charts row */}
            <div className="trezo-card p-6">
              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Order Status</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Fulfillment breakdown
                </p>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusChartData.map((_, index) => (
                        <Cell
                          key={`status-${index}`}
                          fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {statusChartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: chartPrimaryVariants[index % chartPrimaryVariants.length] }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                    <span className="text-foreground">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Table (full width) ─────────────── */}
          <div className="px-4">
            <div className="trezo-card overflow-hidden">
              {/* Toolbar */}
              <div className="px-8 py-4 flex flex-wrap items-center gap-4 border-b border-border">
                {/* Left: Show entries + Status filter */}
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-normal shrink-0">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="w-16 h-[38px] px-2 border border-border rounded-md outline-none focus:border-primary transition-colors bg-background cursor-pointer text-sm font-normal text-foreground"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>entries</span>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-[38px] px-3 border border-border rounded-md outline-none focus:border-primary transition-colors bg-background cursor-pointer text-sm font-semibold text-foreground"
                >
                  <option value="all">All Statuses</option>
                  {allStatuses.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </select>

                {/* Right: title + search */}
                <div className="flex-1" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">Order Activity</h3>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                    Your orders in selected period
                  </p>
                </div>
                <div className="relative w-52 group">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-muted/30 border border-border rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-xs font-medium text-foreground"
                  />
                </div>
              </div>

              <div className="border-t border-border overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className={dashboardTableHeaderClass}>
                    <TableRow className={dashboardTableHeadRowClass}>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Date &amp; Time</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Customer</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-card">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i} className="h-14 animate-pulse">
                          {[...Array(5)].map((_, j) => (
                            <TableCell key={j} className="px-6 py-3">
                              <div className="h-4 bg-muted rounded w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : paginatedOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-40">
                            <ClipboardList className="size-10 text-muted-foreground" />
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                              No sales found
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedOrders.map((order) => (
                        <TableRow key={order.id} className={dashboardTableBodyRowClass}>
                          <TableCell className={dashboardTableCellClass}>
                            <span className={dashboardTableIdClass}>{order.id}</span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[12px] font-medium text-zinc-600 dark:text-white/90">
                              {order.createdAt
                                ? new Date(order.createdAt as unknown as string).toLocaleString()
                                : "N/A"}
                            </span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[13px] font-medium text-zinc-700 dark:text-white">
                              {order.customerName || "Walk-in Guest"}
                            </span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className={cn(dashboardStatusBadgeClass, getOrderStatusBadgeClass(order.status))}>
                              {formatStatusLabel(order.status)}
                            </span>
                          </TableCell>
                          <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                            <span className="text-[13px] font-bold text-zinc-700 dark:text-white tabular-nums">
                              {formatCurrency(order.total)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Table Footer */}
              <div className="px-8 py-3 flex items-center justify-between bg-muted/20 border-t border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Showing {paginatedOrders.length} of {filteredOrders.length} records
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Filtered Total:
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
    </div>
  );
}
