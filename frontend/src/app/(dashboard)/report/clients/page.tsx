"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Calendar,
  Search,
  RefreshCw,
  Filter,
  DollarSign,
  ShoppingBag,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import {
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
  chartPrimaryVariants,
  chartTooltipStyle,
  chartAxisTick,
} from "@/lib/dashboard-ui";

function formatLabel(value: string) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ClientStat {
  id: number;
  fullName: string;
  phone: string;
  totalSpent: number;
  orderCount: number;
  primarySource: string;
  lastOrder: string | null;
}

interface ClientsReportData {
  totalClients: number;
  topClients: ClientStat[];
  fullStats: ClientStat[];
}

export default function ClientsReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClientsReportData | null>(null);
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
      const res = await reportApi.getClientsReport(dateRange);
      if (res.success) {
        setData(res.data);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("Failed to fetch clients report:", error);
      showToast("Error loading client data", "error");
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

  const totals = useMemo(() => {
    const stats = data?.fullStats ?? [];
    const totalSpent = stats.reduce((s, c) => s + c.totalSpent, 0);
    const totalOrders = stats.reduce((s, c) => s + c.orderCount, 0);
    const avgSpent = stats.length > 0 ? totalSpent / stats.length : 0;
    return { totalSpent, totalOrders, avgSpent };
  }, [data?.fullStats]);

  const topSpendersChart = useMemo(() => {
    if (!data?.topClients) return [];
    return data.topClients.slice(0, 5).map((c) => ({
      name: c.fullName.split(" ")[0] || c.fullName,
      spent: c.totalSpent,
    }));
  }, [data?.topClients]);

  const sourceChartData = useMemo(() => {
    if (!data?.fullStats) return [];
    const map: Record<string, number> = {};
    data.fullStats.forEach((c) => {
      const key = c.primarySource || "pos";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name: formatLabel(name),
      value,
    }));
  }, [data?.fullStats]);

  const filteredClients = useMemo(() => {
    const list = data?.fullStats ?? [];
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.primarySource.toLowerCase().includes(q)
    );
  }, [data?.fullStats, search]);

  const statCards = [
    { title: "Active Clients", value: data?.totalClients ?? 0, icon: Users },
    { title: "Total Spent", value: formatCurrency(totals.totalSpent), icon: DollarSign },
    { title: "Avg per Client", value: formatCurrency(totals.avgSpent), icon: TrendingUp },
    { title: "Total Orders", value: totals.totalOrders, icon: ShoppingBag },
    {
      title: "Top Source",
      value: sourceChartData[0]?.name ?? "—",
      icon: Smartphone,
    },
  ];

  return (
    <div
      className={cn(dashboardPageClass, "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700")}
      style={dashboardPageStyle}
    >
      <div className={cn(pageHeaderWrapperClass, "flex flex-col md:flex-row md:items-end justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Clients Report</h1>
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
                  <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1 truncate">
                    {stat.value}
                  </h3>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
            <div className="trezo-card p-6">
              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                  Top Spenders
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Highest total spending
                </p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSpendersChart} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="hsl(var(--border))"
                      opacity={0.5}
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={chartAxisTick}
                      width={72}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(91, 16, 23, 0.06)" }}
                      contentStyle={chartTooltipStyle}
                      itemStyle={{ color: "#ffffff" }}
                      formatter={(v) => formatCurrency(Number(v ?? 0))}
                    />
                    <Bar dataKey="spent" radius={[0, 4, 4, 0]}>
                      {topSpendersChart.map((_, index) => (
                        <Cell
                          key={`spender-${index}`}
                          fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 trezo-card overflow-hidden">
              <div className="px-8 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">
                    Client Leaderboard
                  </h3>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">
                    All clients in selected period
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-48 group">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="Search clients..."
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
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Rank</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Client</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Source</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Orders</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Last Order</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Total Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-card">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client, index) => (
                        <TableRow key={client.id} className={dashboardTableBodyRowClass}>
                          <TableCell className={dashboardTableCellClass}>
                            <span className={dashboardTableIdClass}>{index + 1}</span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[13px] font-medium text-zinc-700 dark:text-white">
                                {client.fullName}
                              </span>
                              <span className="text-[11px] text-zinc-500 dark:text-white/70">
                                {client.phone}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[10px] font-bold text-primary dark:text-white bg-primary/5 px-2 py-0.5 rounded uppercase tracking-wider">
                              {formatLabel(client.primarySource)}
                            </span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[13px] font-medium text-zinc-600 dark:text-white/90">
                              {client.orderCount}
                            </span>
                          </TableCell>
                          <TableCell className={dashboardTableCellClass}>
                            <span className="text-[12px] text-zinc-500 dark:text-white/70">
                              {client.lastOrder
                                ? new Date(client.lastOrder).toLocaleDateString()
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                            <span className="text-[13px] font-bold text-zinc-700 dark:text-white tabular-nums">
                              {formatCurrency(client.totalSpent)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                          No clients found for this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="px-4">
            <div className="trezo-card p-6 max-w-md">
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
                  Clients by Source
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Primary order channel
                </p>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {sourceChartData.map((_, index) => (
                        <Cell
                          key={`src-${index}`}
                          fill={chartPrimaryVariants[index % chartPrimaryVariants.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} itemStyle={{ color: "#ffffff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {sourceChartData.map((entry, index) => (
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
          </div>
        </>
      )}
    </div>
  );
}
