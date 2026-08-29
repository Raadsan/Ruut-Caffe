"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authApi, AuthUser } from "@/lib/api/auth/authApi";
import { reportApi, peekDashboardInit } from "@/lib/api/restaurant/reportApi";
import { orderApi, Order, peekOrders } from "@/lib/api/restaurant/orderApi";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import WaiterDashboard from "@/components/dashboard/WaiterDashboard";
import KitchenDashboard from "@/components/dashboard/KitchenDashboard";

interface DashboardData {
  totalOrders: number;
  totalCustomers: number;
  totalTables: number;
  totalPaidPayments: number;
  totalPendingPayments: number;
  totalRevenue: number;
}

type WeeklyPoint = { name: string; revenue: number; orders: number };

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-20 bg-muted/20 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 bg-muted/20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[400px] bg-muted/20 rounded-xl" />
        <div className="h-[400px] bg-muted/20 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromCache = () => {
      const cachedUser = authApi.getCachedUser();
      if (cachedUser) setUser(cachedUser);

      const cachedInit = peekDashboardInit();
      if (cachedInit) {
        setData(cachedInit.summary);
        setWeeklyData(cachedInit.weekly);
        if (Array.isArray(cachedInit.recentOrders) && cachedInit.recentOrders.length > 0) {
          setOrders(cachedInit.recentOrders as Order[]);
        }
        setIsLoading(false);
        return;
      }

      const cachedOrders =
        peekOrders({ limit: 10 }) ??
        peekOrders({ onlyMine: true, limit: 50 }) ??
        peekOrders({ limit: 80 });

      if (cachedOrders?.length) {
        setOrders(cachedOrders);
        setIsLoading(false);
        return;
      }

      if (cachedUser) setIsLoading(false);
    };

    hydrateFromCache();

    const fetchAllData = async () => {
      try {
        const currentUser = authApi.getCachedUser() ?? (await authApi.getMe());
        if (cancelled) return;
        setUser(currentUser);

        const role = currentUser?.role?.toLowerCase() || "admin";
        const isAdminOrManager = role === "admin" || role === "manager";

        if (isAdminOrManager) {
          const initRes = await reportApi.getDashboardInit();
          if (cancelled) return;
          setData(initRes.data.summary);
          setWeeklyData(initRes.data.weekly);
          if (Array.isArray(initRes.data.recentOrders)) {
            setOrders(initRes.data.recentOrders as Order[]);
          }
        } else if (role === "waiter") {
          const ordersRes = await orderApi.getAllOrders({ onlyMine: true, limit: 50 });
          if (cancelled) return;
          setOrders(ordersRes);
        } else if (role === "kitchen") {
          const ordersRes = await orderApi.getAllOrders({ limit: 80 });
          if (cancelled) return;
          setOrders(ordersRes);
        } else {
          const ordersRes = await orderApi.getAllOrders({ limit: 20 });
          if (cancelled) return;
          setOrders(ordersRes);
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchAllData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !data && orders.length === 0) {
    return <DashboardSkeleton />;
  }

  const role = user?.role?.toLowerCase() || "admin";
  const recentOrders = orders.slice(0, 5);

  if (role === "waiter") {
    return <WaiterDashboard orders={orders} />;
  }

  if (role === "kitchen") {
    return <KitchenDashboard orders={orders} />;
  }

  return (
    <AdminDashboard
      data={data}
      recentOrders={recentOrders}
      weeklyData={weeklyData}
      dashboardMode={pathname.startsWith("/restaurant/") ? "restaurant" : "main"}
    />
  );
}
