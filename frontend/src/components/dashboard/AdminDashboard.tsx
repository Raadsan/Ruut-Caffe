import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { reportApi } from "@/lib/api/restaurant/reportApi";
import { accountingDashboardApi, type AccountingDashboardData } from "@/lib/api/accounting/accountingDashboardApi";
import {
  DollarSign,
  Users,
  Store,
  Clock,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Search,
  Filter,
  Landmark,
  ReceiptText,
  WalletCards,
  Banknote
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Order } from "@/lib/api/restaurant/orderApi";
import {
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardStatIconClass,
  chartPrimary,
  chartPrimaryVariants,
  chartTooltipStyle,
  chartAxisTick,
  dashboardTableIdClass,
  dashboardStatusBadgeClass,
  getOrderStatusBadgeClass,
  formatStatusLabel,
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";

interface DashboardData {
  totalOrders: number;
  totalCustomers: number;
  totalTables: number;
  totalPaidPayments: number;
  totalPendingPayments: number;
  totalRevenue: number;
}

const EMPTY_WEEKLY_DATA = [
  { name: "Mon", revenue: 0, orders: 0 },
  { name: "Tue", revenue: 0, orders: 0 },
  { name: "Wed", revenue: 0, orders: 0 },
  { name: "Thu", revenue: 0, orders: 0 },
  { name: "Fri", revenue: 0, orders: 0 },
  { name: "Sat", revenue: 0, orders: 0 },
  { name: "Sun", revenue: 0, orders: 0 },
];

type WeeklyPoint = { name: string; revenue: number; orders: number };
type CategoryPoint = { name: string; value: number };
type TopSellingItem = {
  category?: string | null;
  totalQuantitySold?: number;
};

const COLORS = [...chartPrimaryVariants];

function categorySalesFromTopItems(items: TopSellingItem[]): CategoryPoint[] {
  const byCategory = new Map<string, number>();
  items.forEach((item) => {
    const name = item.category?.trim() || "Uncategorized";
    byCategory.set(name, (byCategory.get(name) || 0) + Number(item.totalQuantitySold || 0));
  });
  return [...byCategory.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function AdminDashboard({
  data,
  recentOrders,
  weeklyData: weeklyDataProp,
  dashboardMode = "restaurant",
}: {
  data: DashboardData | null;
  recentOrders: Order[];
  weeklyData?: WeeklyPoint[] | null;
  dashboardMode?: "main" | "restaurant";
}) {
  const router = useRouter();
  const [fetchedWeeklyData, setFetchedWeeklyData] = useState<WeeklyPoint[]>(EMPTY_WEEKLY_DATA);
  const [accountingData, setAccountingData] = useState<AccountingDashboardData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryPoint[]>([]);
  const weeklyData = weeklyDataProp?.length ? weeklyDataProp : fetchedWeeklyData;

  useEffect(() => {
    if (weeklyDataProp?.length) {
      return;
    }

    reportApi
      .getWeeklyAnalytics()
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setFetchedWeeklyData(res.data);
        }
      })
      .catch(() => {
        setFetchedWeeklyData(EMPTY_WEEKLY_DATA);
      });
  }, [weeklyDataProp]);

  useEffect(() => {
    if (dashboardMode !== "main") return;
    accountingDashboardApi.getSummary().then(setAccountingData).catch((error) => {
      console.error("Failed to load accounting dashboard summary", error);
    });
  }, [dashboardMode]);

  useEffect(() => {
    reportApi
      .getTopSellingItems({ limit: 100 })
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data as TopSellingItem[] : [];
        setCategoryData(categorySalesFromTopItems(rows));
      })
      .catch(() => setCategoryData([]));
  }, []);

  const statCards = [
    {
      title: "Total Orders",
      value: data?.totalOrders || 0,
      icon: Briefcase,
      trend: "+12.5%",
      trendUp: true
    },
    {
      title: "Gross Revenue",
      value: `$${(data?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      trend: "+8.2%",
      trendUp: true
    },
    {
      title: "Pending Orders",
      value: data?.totalPendingPayments || 0,
      icon: Clock,
      trend: "-2.4%",
      trendUp: false
    },
    {
      title: "Total Customers",
      value: data?.totalCustomers || 0,
      icon: Users,
      trend: "+15.1%",
      trendUp: true
    },
    {
      title: "Active Tables",
      value: data?.totalTables || 0,
      icon: Store,
      trend: "Stable",
      trendUp: null
    },
  ];

  return (
    <div className={cn(dashboardPageClass, "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700")} style={dashboardPageStyle}>

      {/* Header Section */}
      <div className={cn(pageHeaderWrapperClass, "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between")}>
        <div>
          <h1 className={pageHeaderTitleClass}>
            {dashboardMode === "main" ? "Main Dashboard" : "Restaurant Dashboard"}
          </h1>
        </div>
      </div>

      {dashboardMode === "main" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Accounting</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push("/accounting/dashboard")}>
              Open Accounting <ArrowUpRight className="ml-1 size-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {[
              { label: "Total Revenue", value: accountingData?.totalRevenue, change: "Live", trendUp: true, icon: DollarSign, line: "M1 27 L17 27 L29 22 L41 25 L53 6 L70 27" },
              { label: "Expenses", value: accountingData?.expenses, change: "Live", trendUp: false, icon: ReceiptText, line: "M1 27 L18 27 L27 7 L36 26 L45 4 L54 10 L70 28" },
              { label: "Net Profit", value: accountingData?.netProfit, change: "Live", trendUp: (accountingData?.netProfit || 0) >= 0, icon: Banknote, line: "M1 27 L17 27 L29 22 L41 25 L53 6 L70 27" },
              { label: "Cash Balance", value: accountingData?.cashBalance, change: "Live", trendUp: (accountingData?.cashBalance || 0) >= 0, icon: WalletCards, line: "M1 27 L17 27 L29 22 L41 25 L53 6 L70 27" },
              { label: "Bank Balance", value: accountingData?.bankBalance, change: "Live", trendUp: (accountingData?.bankBalance || 0) >= 0, icon: Landmark, line: "M1 27 L17 27 L29 22 L41 25 L53 6 L70 27" },
            ].map((item, index) => (
              <article key={item.label} className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      index === 1 ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10" : "bg-primary/8 text-primary"
                    )}>
                      <item.icon className="size-4" />
                    </span>
                    <p className="truncate text-xs font-medium text-muted-foreground">{item.label}</p>
                  </div>
                  <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-5 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[1.35rem] font-bold tracking-tight tabular-nums">
                      {item.value === undefined ? "Loading..." : `$${item.value.toLocaleString()}`}
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      {item.trendUp
                        ? <ArrowUpRight className="size-3 text-emerald-600" />
                        : <ArrowDownRight className="size-3 text-rose-500" />}
                      <span className={item.trendUp ? "font-semibold text-emerald-600" : "font-semibold text-rose-500"}>
                        {item.change}
                      </span>
                      <span>database</span>
                    </div>
                  </div>
                  <svg viewBox="0 0 72 32" className="h-8 w-[72px] shrink-0 overflow-visible" aria-hidden="true">
                    <path
                      d={item.line}
                      fill="none"
                      stroke={item.trendUp ? "var(--primary)" : "#f05268"}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          {dashboardMode === "main" && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Restaurant</p>}
        </div>
        {dashboardMode === "main" && (
          <Button variant="outline" size="sm" onClick={() => router.push("/restaurant/dashboard")}>
            Open Restaurant <ArrowUpRight className="ml-1 size-3.5" />
          </Button>
        )}
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="trezo-card p-6 flex flex-col justify-between group hover:border-primary/30 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className={dashboardStatIconClass(i)}>
                <stat.icon className="size-5 text-white" />
              </div>
              {stat.trendUp !== null && (
                <div className={cn("flex items-center text-[10px] font-black uppercase tracking-widest", stat.trendUp ? "text-emerald-500" : "text-rose-500")}>
                  {stat.trendUp ? <ArrowUpRight className="size-3 mr-0.5" /> : <ArrowDownRight className="size-3 mr-0.5" />}
                  {stat.trend}
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{stat.title}</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart Section */}
        <div className="lg:col-span-2 trezo-card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Revenue Analytics</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Weekly earnings report</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-4">
                <div className="size-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Revenue</span>
              </div>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
                <MoreHorizontal className="size-4" />
              </button>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={chartAxisTick}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={chartAxisTick}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  itemStyle={{ color: "#ffffff" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={chartPrimary}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Volume Chart */}
        <div className="trezo-card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Order Volume</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Orders by weekday</p>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={chartAxisTick}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(91, 16, 23, 0.06)' }}
                  contentStyle={chartTooltipStyle}
                  itemStyle={{ color: "#ffffff" }}
                />
                <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartPrimaryVariants[index % chartPrimaryVariants.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table Section */}
        <div className="lg:col-span-2 trezo-card overflow-hidden">
          <div className="px-8 py-4 flex flex-wrap items-center justify-between border-b border-border">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight text-foreground">Recent Orders</h3>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">Last 5 activities</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-48 group">
                <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full h-9 pl-9 pr-3 bg-muted/30 border border-border rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-xs font-medium text-foreground"
                />
              </div>
              <Button variant="ghost" size="sm" className="h-9 px-3 bg-muted/30 border border-border text-muted-foreground hover:text-primary hover:border-primary/30">
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
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Table</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-card">
                {recentOrders.length > 0 ? recentOrders.map((order) => (
                  <TableRow key={order.id} className={dashboardTableBodyRowClass}>
                  <TableCell className={dashboardTableCellClass}>
                    <span className={dashboardTableIdClass}>{order.id}</span>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-zinc-700">{order.customerName || "Walk-in Guest"}</span>
                      <span className="text-[11px] text-zinc-500">{order.customerPhone || "No Phone"}</span>
                    </div>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <span className="text-[13px] font-medium text-zinc-600">
                      Table {order.table?.number || order.tableId}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableCellClass}>
                    <span className={cn(dashboardStatusBadgeClass, getOrderStatusBadgeClass(order.status))}>
                      {formatStatusLabel(order.status)}
                    </span>
                  </TableCell>
                  <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                    <span className="text-[13px] font-bold text-zinc-700">${order.total.toLocaleString()}</span>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                    No recent orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-5 border-t border-border bg-card text-center">
          <button className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary hover:underline transition-all">
            View All Transactions
          </button>
        </div>
        </div>

        {/* Sales by Category Pie Chart */}
        <div className="trezo-card p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Sales by Category</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Distribution of items</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full relative">
            {categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 700
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                  {categoryData.map((entry, index) => (
                    <div key={`legend-${entry.name}`} className="flex items-center gap-1.5">
                      <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs font-semibold text-muted-foreground">
                No category sales yet
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
