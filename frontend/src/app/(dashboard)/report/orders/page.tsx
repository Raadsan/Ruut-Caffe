"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Search,
  RefreshCw,
  DollarSign,
  Filter,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { reportApi } from "@/lib/api/restaurant/reportApi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
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

const EMPTY_WEEKLY = [
  { name: "Mon", orders: 0, revenue: 0 },
  { name: "Tue", orders: 0, revenue: 0 },
  { name: "Wed", orders: 0, revenue: 0 },
  { name: "Thu", orders: 0, revenue: 0 },
  { name: "Fri", orders: 0, revenue: 0 },
  { name: "Sat", orders: 0, revenue: 0 },
  { name: "Sun", orders: 0, revenue: 0 },
];

function formatLabel(value: string) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface OrdersReportData {
  totalOrders: number;
  totalAmount: number;
  breakdownByStatus?: Record<string, number>;
  breakdownByType?: Record<string, number>;
  breakdownBySource?: Record<string, number>;
  orders?: Array<{
    id: number;
    customerName?: string;
    customerPhone?: string;
    source?: string;
    orderType?: string;
    status: string;
    total: number;
    table?: { number?: number };
    tableId?: number;
  }>;
}

export default function OrdersReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrdersReportData | null>(null);
  const [weeklyData, setWeeklyData] = useState(EMPTY_WEEKLY);
  const [search, setSearch] = useState("");
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
      const [ordersRes, weeklyRes] = await Promise.all([
        reportApi.getOrdersReport(dateRange),
        reportApi.getWeeklyAnalytics(),
      ]);
      if (ordersRes.success) {
        setData(ordersRes.data);
      } else {
        setData(null);
      }
      if (weeklyRes.success && Array.isArray(weeklyRes.data)) {
        setWeeklyData(weeklyRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch orders report:", error);
      showToast("Error loading orders data", "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange.endDate, dateRange.startDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0);

  const statusChartData = useMemo(() => {
    if (!data?.breakdownByStatus) return [];
    return Object.entries(data.breakdownByStatus).map(([name, value]) => ({
      name: formatStatusLabel(name),
      value,
    }));
  }, [data?.breakdownByStatus]);

  const typeChartData = useMemo(() => {
    if (!data?.breakdownByType) return [];
    return Object.entries(data.breakdownByType).map(([name, value]) => ({
      name: formatLabel(name),
      value,
    }));
  }, [data?.breakdownByType]);

  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.orders;
    return data.orders.filter((o) => {
      return (
        o.id.toString().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.source || "").toLowerCase().includes(q) ||
        (o.orderType || "").toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    });
  }, [data?.orders, search]);

  const statCards = [
    {
      title: "Total Orders",
      value: data?.totalOrders ?? 0,
      icon: ShoppingBag,
    },
    {
      title: "Total Amount",
      value: formatCurrency(data?.totalAmount ?? 0),
      icon: DollarSign,
    },
    {
      title: "Served",
      value: data?.breakdownByStatus?.served ?? 0,
      icon: CheckCircle2,
    },
    {
      title: "Pending",
      value: data?.breakdownByStatus?.pending ?? 0,
      icon: Clock,
    },
    {
      title: "Cancelled",
      value: data?.breakdownByStatus?.cancelled ?? 0,
      icon: XCircle,
    },
  ];

  return (
    <div
      className={cn(dashboardPageClass, "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700")}
      style={dashboardPageStyle}
    >
      <div className={cn(pageHeaderWrapperClass, "flex flex-col md:flex-row md:items-end justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Orders Report</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 trezo-card p-2">
          <div className="flex items-center gap-2 px-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              className="text-xs font-semibold bg-transparent outline-none border-none cursor-pointer text-foreground"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              className="text-xs font-semibold bg-transparent outline-none border-none cursor-pointer text-foreground"
            />
          </div>
          <Button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            className="bg-primary !text-white hover:bg-primary/90 h-9 px-4 rounded-lg text-xs font-bold gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            {loading ? "Updating..." : "Apply"}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 px-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="trezo-card h-28 animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 px-4">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
            <div className="lg:col-span-2 trezo-card p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Order Trends
                  </h3>
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
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                      opacity={0.5}
                    />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} />
                    <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      stroke={chartPrimary}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorOrders)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="trezo-card p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Order Volume
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Orders by weekday
                  </p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                      opacity={0.5}
                    />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={chartAxisTick} dy={10} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: "rgba(91, 16, 23, 0.06)" }}
                      contentStyle={chartTooltipStyle}
                      itemStyle={{ color: "#ffffff" }}
                    />
                    <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                      {weeklyData.map((_, index) => (
                        <Cell
                          key={`bar-${index}`}
                          fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
            <div className="lg:col-span-2 trezo-card overflow-hidden">
              <div className="px-8 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">
                    Order Activity
                  </h3>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">
                    Recent orders in selected period
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-48 group">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 bg-muted/30 border border-border rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-xs font-medium text-foreground"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 bg-muted/30 border border-border text-muted-foreground hover:text-primary hover:border-primary/30"
                  >
                    <Filter className="size-3.5 mr-1.5" />
                    <span className="text-xs font-semibold">Filter</span>
                  </Button>
                </div>
              </div>

              <div className="border-t border-border overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className={dashboardTableHeaderClass}>
                    <TableRow className={dashboardTableHeadRowClass}>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Customer</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Type</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Source</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-card">
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id} className={dashboardTableBodyRowClass}>
                          <TableCell className={dashboardTableCellClass}>
                            <span className={dashboardTableIdClass}>{order.id}</span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[13px] font-medium text-zinc-700 dark:text-white">
                                {order.customerName || "Walk-in Guest"}
                              </span>
                              <span className="text-[11px] text-zinc-500 dark:text-white/70">
                                {order.customerPhone || "No phone"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[12px] font-medium text-zinc-600 dark:text-white/90">
                              {formatLabel(order.orderType || "dine-in")}
                            </span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[10px] font-bold text-primary dark:text-white bg-primary/5 px-2 py-0.5 rounded uppercase tracking-wider">
                              {formatLabel(order.source || "pos")}
                            </span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span
                              className={cn(
                                dashboardStatusBadgeClass,
                                getOrderStatusBadgeClass(order.status)
                              )}
                            >
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
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                          No orders found for this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="trezo-card p-6">
                <div className="mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Order Status
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Fulfillment distribution
                  </p>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
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
                        style={{
                          backgroundColor: chartPrimaryVariants[index % chartPrimaryVariants.length],
                        }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="trezo-card p-6">
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                    Order Type
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Dine-in, takeaway & delivery
                  </p>
                </div>
                <div className="space-y-2">
                  {typeChartData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data</p>
                  ) : (
                    typeChartData.map((entry, index) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: chartPrimaryVariants[index % chartPrimaryVariants.length],
                            }}
                          />
                          <span className="text-xs font-bold text-foreground">{entry.name}</span>
                        </div>
                        <span className="text-sm font-bold text-primary dark:text-white">{entry.value}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
