"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Calendar,
  Search,
  RefreshCw,
  Filter,
  Wallet,
  Receipt,
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
import { formatPaymentMethod } from "@/lib/format-payment-method";
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
  chartPrimary,
  chartPrimaryVariants,
  chartTooltipStyle,
  chartAxisTick,
} from "@/lib/dashboard-ui";

const EMPTY_WEEKLY = [
  { name: "Mon", revenue: 0, orders: 0 },
  { name: "Tue", revenue: 0, orders: 0 },
  { name: "Wed", revenue: 0, orders: 0 },
  { name: "Thu", revenue: 0, orders: 0 },
  { name: "Fri", revenue: 0, orders: 0 },
  { name: "Sat", revenue: 0, orders: 0 },
  { name: "Sun", revenue: 0, orders: 0 },
];

function formatLabel(value: string) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FinanceReportData {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  averageTransaction: number;
  transactionCount: number;
  breakdownByMethod?: Record<string, number>;
  breakdownBySource?: Record<string, number>;
  items?: Array<{
    id: number;
    orderId: number;
    name: string;
    quantity: number;
    profit: number;
    date: string;
    paymentMethod?: string;
    providerName?: string | null;
  }>;
}

export default function FinanceReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceReportData | null>(null);
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
      const [financeRes, weeklyRes] = await Promise.all([
        reportApi.getFinanceReport(dateRange),
        reportApi.getWeeklyAnalytics(),
      ]);
      if (financeRes.success) {
        setData(financeRes.data);
      } else {
        setData(null);
      }
      if (weeklyRes.success && Array.isArray(weeklyRes.data)) {
        setWeeklyData(weeklyRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch finance report:", error);
      showToast("Error loading finance data", "error");
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

  const methodChartData = useMemo(() => {
    if (!data?.breakdownByMethod) return [];
    return Object.entries(data.breakdownByMethod).map(([name, value]) => ({
      name: formatPaymentMethod(name),
      value,
    }));
  }, [data?.breakdownByMethod]);

  const sourceChartData = useMemo(() => {
    if (!data?.breakdownBySource) return [];
    return Object.entries(data.breakdownBySource).map(([name, value]) => ({
      name: formatLabel(name),
      value,
    }));
  }, [data?.breakdownBySource]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.items.slice(0, 50);
    return data.items
      .filter((item) => {
        const method = formatPaymentMethod(item.paymentMethod, item.providerName).toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.orderId.toString().includes(q) ||
          method.includes(q)
        );
      })
      .slice(0, 50);
  }, [data?.items, search]);

  const statCards = [
    { title: "Total Revenue", value: formatCurrency(data?.totalRevenue ?? 0), icon: DollarSign },
    { title: "Net Profit", value: formatCurrency(data?.netProfit ?? 0), icon: TrendingUp },
    { title: "Total Cost", value: formatCurrency(data?.totalCost ?? 0), icon: Wallet },
    {
      title: "Avg Order Value",
      value: formatCurrency(data?.averageTransaction ?? 0),
      icon: Receipt,
    },
    { title: "Transactions", value: data?.transactionCount ?? 0, icon: CreditCard },
  ];

  return (
    <div
      className={cn(dashboardPageClass, "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700")}
      style={dashboardPageStyle}
    >
      <div className={cn(pageHeaderWrapperClass, "flex flex-col md:flex-row md:items-end justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Finance Report</h1>
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
                    Revenue Trends
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Weekly revenue
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Revenue
                  </span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="financeRevenue" x1="0" y1="0" x2="0" y2="1">
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
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={chartAxisTick}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      itemStyle={{ color: "#ffffff" }}
                      formatter={(v) => formatCurrency(Number(v ?? 0))}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={chartPrimary}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#financeRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="trezo-card p-6">
              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                  Payment Methods
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Revenue by method
                </p>
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {methodChartData.map((_, index) => (
                        <Cell
                          key={`method-${index}`}
                          fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      itemStyle={{ color: "#ffffff" }}
                      formatter={(v) => formatCurrency(Number(v ?? 0))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {methodChartData.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between text-[10px] font-bold uppercase"
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor: chartPrimaryVariants[index % chartPrimaryVariants.length],
                        }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <span className="text-foreground tabular-nums">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
            <div className="lg:col-span-2 trezo-card overflow-hidden">
              <div className="px-8 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">
                    Transaction Details
                  </h3>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">
                    Paid items in selected period
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-48 group">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="Search transactions..."
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
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Item</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Order</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Payment</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-card">
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <TableRow key={`${item.id}-${item.orderId}`} className={dashboardTableBodyRowClass}>
                          <TableCell className={dashboardTableCellClass}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[13px] font-medium text-zinc-700 dark:text-white">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-zinc-500 dark:text-white/70">
                                x{item.quantity} · {new Date(item.date).toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className={dashboardTableIdClass}>#{item.orderId}</span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[10px] font-bold text-primary dark:text-white bg-primary/5 px-2 py-0.5 rounded uppercase tracking-wider">
                              {formatPaymentMethod(item.paymentMethod, item.providerName)}
                            </span>
                          </TableCell>
                          <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                            <span
                              className={cn(
                                "text-[12px] font-bold tabular-nums",
                                item.profit >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              )}
                            >
                              {item.profit >= 0 ? "+" : ""}
                              {formatCurrency(item.profit)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="px-6 py-10 text-center text-zinc-500">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="trezo-card p-6">
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                  Channel Revenue
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Performance by source
                </p>
              </div>
              <div className="h-[240px] w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceChartData}>
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
                      formatter={(v) => formatCurrency(Number(v ?? 0))}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {sourceChartData.map((_, index) => (
                        <Cell
                          key={`source-${index}`}
                          fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {sourceChartData.map((entry, index) => (
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
                    <span className="text-sm font-bold text-primary dark:text-white tabular-nums">
                      {formatCurrency(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
