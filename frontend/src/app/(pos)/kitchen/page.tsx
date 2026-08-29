"use client";

import React, { useCallback, useEffect, useState } from "react";
import PosKitchenView from "@/components/orders/PosKitchenView";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { menuItemApi, MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { useToast } from "@/components/ui/toast";
import { onDebouncedEvent, ORDERS_CHANGED, MENU_CHANGED, POS_SOFT_REFRESH } from "@/lib/live-updates";

export default function PosKitchenPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "week" | "last-month" | "custom">("today");
  const [dateRange, setDateRange] = useState(() => getPresetRange("today"));

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [orderData, items] = await Promise.all([
        orderApi.getAllOrders({
          kitchenQueue: true,
          includeServed: true,
          startDate: new Date(`${dateRange.startDate}T00:00:00`).toISOString(),
          endDate: new Date(`${dateRange.endDate}T23:59:59.999`).toISOString(),
        }, force),
        menuItemApi.getAllMenuItems(),
      ]);
      setOrders(orderData || []);
      setMenuItems(items || []);
    } catch {
      showToast("Failed to load kitchen queue", "error");
    } finally {
      setLoading(false);
    }
  }, [dateRange, showToast]);

  const applyDatePreset = (preset: typeof datePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") setDateRange(getPresetRange(preset));
  };

  useEffect(() => {
    fetchData(false);
    const removeOrders = onDebouncedEvent(ORDERS_CHANGED, () => fetchData(true), 700);
    const removePos = onDebouncedEvent(POS_SOFT_REFRESH, () => fetchData(true), 400);
    const removeMenu = onDebouncedEvent(MENU_CHANGED, async () => {
      menuItemApi.clearPosMenuCache();
      try {
        const items = await menuItemApi.getPosMenuCatalog(true);
        setMenuItems(items || []);
      } catch {
        /* keep current menu */
      }
    }, 400);
    return () => {
      removeOrders();
      removePos();
      removeMenu();
    };
  }, [fetchData]);

  return (
    <PosKitchenView
      orders={orders}
      loading={loading}
      menuItems={menuItems}
      onRefresh={fetchData}
      datePreset={datePreset}
      dateRange={dateRange}
      onDatePresetChange={applyDatePreset}
      onDateRangeChange={setDateRange}
    />
  );
}

function formatDateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().split("T")[0];
}

function getPresetRange(preset: "today" | "yesterday" | "week" | "last-month") {
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
