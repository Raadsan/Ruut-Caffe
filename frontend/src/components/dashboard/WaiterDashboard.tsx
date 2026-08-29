import React, { useMemo } from "react";
import Link from "next/link";
import {
  ClipboardList,
  CheckCircle,
  Clock,
  TrendingUp,
  MoreHorizontal,
  Filter,
  Plus,
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
  Cell
} from "recharts";
import { Order } from "@/lib/api/restaurant/orderApi";
import { isToday, isThisMonth, format, subDays, subMonths } from "date-fns";
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
  dashboardStatIconClass,
  chartPrimary,
  chartPrimaryMid,
  chartPrimaryLight,
  chartPrimaryVariants,
  chartTooltipStyle,
  chartAxisTickSm,
  dashboardTableIdClass,
  dashboardStatusBadgeClass,
  getOrderStatusBadgeClass,
  formatStatusLabel,
} from "@/lib/dashboard-ui";

export default function WaiterDashboard({ orders }: { orders: Order[] }) {
  const stats = useMemo(() => {
    const todayOrders = orders.filter(o => isToday(o.createdAt ? new Date(o.createdAt) : new Date()));
    const thisMonthOrders = orders.filter(o => isThisMonth(o.createdAt ? new Date(o.createdAt) : new Date()));

    const lastMonthDate = subMonths(new Date(), 1);
    const lastMonthOrders = orders.filter(o => {
      const d = o.createdAt ? new Date(o.createdAt) : new Date();
      return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
    });

    const successOrders = orders.filter(o => o.status === 'served' || o.status === 'paid' || o.status === 'completed');
    const pendingOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));

    let growth = "+0.0%";
    if (lastMonthOrders.length > 0) {
      const g = ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100;
      growth = `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`;
    } else if (thisMonthOrders.length > 0) {
      growth = "+100.0%";
    }

    return {
      daily: todayOrders.length,
      success: successOrders.length,
      pending: pendingOrders.length,
      growth
    };
  }, [orders]);

  const weeklyData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayName = format(date, 'EEE');
      const dateStr = format(date, 'yyyy-MM-dd');

      const count = orders.filter(o => format(o.createdAt ? new Date(o.createdAt) : new Date(), 'yyyy-MM-dd') === dateStr).length;
      days.push({ name: dayName, orders: count });
    }
    return days;
  }, [orders]);

  const statusBarData = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending').length;
    const preparing = orders.filter(o => o.status === 'preparing' || o.status === 'ready').length;
    const success = orders.filter(o => ['served', 'paid', 'completed'].includes(o.status)).length;

    return [
      { name: 'Pending', count: pending, fill: chartPrimary },
      { name: 'In Progress', count: preparing, fill: chartPrimaryMid },
      { name: 'Success', count: success, fill: chartPrimaryLight }
    ];
  }, [orders]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  const statCards = [
    {
      title: "Daily Orders",
      value: stats.daily,
      icon: ClipboardList,
      trend: "Today",
    },
    {
      title: "Success Orders",
      value: stats.success,
      icon: CheckCircle,
      trend: "Completed",
    },
    {
      title: "Pending Orders",
      value: stats.pending,
      icon: Clock,
      trend: "Active",
    },
    {
      title: "Monthly Growth",
      value: stats.growth,
      icon: TrendingUp,
      trend: "vs last month",
    }
  ];

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className="space-y-8">
        {/* Page Header — matches Rooms page */}
        <div className={cn(pageHeaderWrapperClass, "flex flex-col sm:flex-row sm:items-center justify-between gap-4")}>
          <div>
            <h1 className={pageHeaderTitleClass}>Waiter Dashboard</h1>
          </div>
          <Link
            href="/orders/create"
            className="inline-flex h-[42px] px-6 bg-primary !text-white hover:bg-primary/90 rounded-md items-center gap-2 font-medium text-sm shadow-sm shrink-0 transition-colors"
          >
            <Plus className="size-4" />
            Create Order
          </Link>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
          {statCards.map((stat, i) => (
            <div key={i} className="trezo-card p-6 flex flex-col justify-between group hover:border-primary/30 transition-all hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className={dashboardStatIconClass(i)}>
                  <stat.icon className="size-5 text-white" />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {stat.trend}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[12px] text-zinc-500 uppercase tracking-wider font-medium">{stat.title}</p>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground mt-1">{stat.value}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
          {/* Weekly Orders Area Chart */}
          <div className="lg:col-span-2 trezo-card p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-sm font-semibold text-foreground capitalize tracking-tight">Weekly Orders</h3>
                <p className="text-[12px] text-zinc-500 uppercase tracking-wider mt-1 font-medium">Your activity over the last 7 days</p>
              </div>
              <button className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors">
                <MoreHorizontal className="size-4" />
              </button>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="waiterColorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={chartAxisTickSm}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={chartAxisTickSm}
                  />
                  <Tooltip
                    contentStyle={{
                      ...chartTooltipStyle,
                      boxShadow: "0 10px 15px -3px rgb(91 16 23 / 0.2)"
                    }}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke={chartPrimary}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#waiterColorOrders)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Bar Chart */}
          <div className="trezo-card p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-sm font-semibold text-foreground capitalize tracking-tight">Order Status</h3>
                <p className="text-[12px] text-zinc-500 uppercase tracking-wider mt-1 font-medium">Pending vs success</p>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={chartAxisTickSm}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(91, 16, 23, 0.06)' }}
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: "#ffffff" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Orders Table */}
        <div className="px-4">
          <div className="trezo-card overflow-hidden">
            <div className="px-8 py-4 flex flex-wrap items-center justify-between border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground capitalize tracking-tight">Recent Orders</h3>
                <p className="text-[12px] text-zinc-500 uppercase tracking-wider mt-1 font-medium">Your last 5 orders</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="h-9 px-3 bg-primary/5 border border-primary/15 text-primary hover:bg-primary/10 hover:!text-primary">
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
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-card">
                  {recentOrders.length > 0 ? recentOrders.map((order) => (
                    <TableRow key={order.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{order.id}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="text-[13px] font-medium text-zinc-700">{order.customerName || "Walk-in Guest"}</span>
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
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="px-6 py-10 text-center text-zinc-500">
                        No orders yet — create one from the orders page
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
