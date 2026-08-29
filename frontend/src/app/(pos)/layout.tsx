"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { authApi, AuthUser } from "@/lib/api/auth/authApi";
import {
  LogOut,
  User as UserIcon,
  ChevronDown,
  FileText,
  Settings2,
  Maximize,
  Printer,
  RotateCw,
  ShoppingCart,
  ChefHat,
  History,
  CircleDollarSign,
  X,
  Receipt,
} from "lucide-react";
import { dispatchPosSoftRefresh, onDebouncedEvent, ORDERS_CHANGED, POS_SOFT_REFRESH } from "@/lib/live-updates";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { receiptSettingsApi, ReceiptSettings } from "@/lib/api/restaurant/receiptSettingsApi";
import { ReceiptBody, ReceiptSnapshot } from "@/components/receipt/ReceiptBody";
import { PermissionProvider } from "@/context/PermissionContext";
import PosHeaderNotifications from "@/components/pos/PosHeaderNotifications";
import { PosSearchProvider } from "@/context/PosSearchContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveBrandingImageUrl, STATIC_APP_LOGO } from "@/lib/branding";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { href: "/pos-terminal", label: "POS", icon: ShoppingCart },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/ready-orders", label: "History", icon: History },
  { href: "/my-sales", label: "Sales", icon: CircleDollarSign },
];

function orderToReceiptSnapshot(o: Order): ReceiptSnapshot {
  return {
    orderId: o.id,
    customerName: o.customerName || "Guest",
    customerPhone: o.customerPhone || undefined,
    paymentMethod: "Cash",
    orderTypeLabel: o.orderType
      ? o.orderType.charAt(0).toUpperCase() + o.orderType.slice(1)
      : "Takeaway",
    items: (o.orderitem || []).map((oi) => ({
      menuItemId: oi.menuItemId,
      name: oi.menuitem?.name || "Item",
      price: Number(oi.unitPrice),
      quantity: oi.quantity,
    })),
    subtotal: Number(o.subTotal),
    tax: Number(o.taxAmount),
    discount: Number(o.discountAmount ?? 0),
    total: Number(o.total),
    createdAt: o.createdAt || new Date().toISOString(),
  };
}

function PosLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [kitchenCount, setKitchenCount] = useState(0);
  const [clock, setClock] = useState("");
  const [brandLogo, setBrandLogo] = useState(STATIC_APP_LOGO);
  const [brandName, setBrandName] = useState("Ruut Caffe POS");

  // Recent orders popup
  const [showRecentOrders, setShowRecentOrders] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const syncCounts = useCallback(async () => {
    try {
      const counts = await orderApi.getQueueCounts();
      setKitchenCount(counts.kitchenCount);
    } catch {
      setKitchenCount(0);
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    receiptSettingsApi.getSettings().then(settings => {
      const logo = resolveBrandingImageUrl(settings.logoUrl) || STATIC_APP_LOGO;
      setBrandLogo(logo);
      setBrandName(settings.name ? `${settings.name} POS` : "Ruut Caffe POS");
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const cached = authApi.getCachedUser();
    if (cached) setUser(cached);
    authApi.getMe().then(setUser).catch(() => { window.location.href = "/pos/login"; });

    const handleProfileUpdate = () => authApi.getMe(true).then(setUser).catch(() => {});
    window.addEventListener("profile_updated", handleProfileUpdate);

    const updateCountFromStorage = () => {
      const saved = localStorage.getItem("pos-cart");
      if (saved) {
        try {
          const cart = JSON.parse(saved);
          setCartCount(cart.reduce((sum: number, i: { quantity?: number }) => sum + (i.quantity || 0), 0));
        } catch { setCartCount(0); }
      } else { setCartCount(0); }
    };

    updateCountFromStorage();
    window.addEventListener("cart-updated", (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number") setCartCount(detail);
    });
    window.addEventListener("storage", updateCountFromStorage);

    syncCounts();
    const removeOrdersListener = onDebouncedEvent(ORDERS_CHANGED, syncCounts, 700);
    const removePosRefresh = onDebouncedEvent(POS_SOFT_REFRESH, syncCounts, 400);

    return () => {
      window.removeEventListener("profile_updated", handleProfileUpdate);
      window.removeEventListener("storage", updateCountFromStorage);
      removeOrdersListener();
      removePosRefresh();
    };
  }, [syncCounts]);

  const openRecentOrders = async () => {
    setShowRecentOrders(true);
    setLoadingRecent(true);
    setSelectedOrder(null);
    try {
      const [orders, settings] = await Promise.all([
        orderApi.getAllOrders({ limit: 5, includeServed: true }, true),
        receiptSettingsApi.getSettings(),
      ]);
      // Sort by most recent first, filter out held (not yet served), take top 5
      const sorted = [...orders]
        .filter(o => o.status !== 'held')
        .sort((a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        ).slice(0, 5);
      setRecentOrders(sorted);
      setReceiptSettings(settings);
    } catch {
      setRecentOrders([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  const handlePrintSelected = () => {
    window.print();
  };

  return (
    <PermissionProvider>
      <div className="flex flex-col h-screen bg-[#eef1f7] dark:bg-[#121212] font-sans overflow-hidden">
        {/* ── TOP HEADER ── */}
        <header className="h-16 shrink-0 bg-white text-zinc-800 flex items-center px-4 gap-3 border-b border-zinc-200/80 shadow-sm z-50">
          {/* Logo */}
          <Link href="/pos-terminal" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
            <img src={brandLogo} alt={brandName} className="h-8 w-8 object-contain" />
            <span className="font-bold text-base text-zinc-800 hidden sm:block">{brandName}</span>
          </Link>

          {/* Clock & Online badge */}
          <div className="flex items-center gap-2 ml-1">
            <span className="text-zinc-500 text-sm tabular-nums">{clock}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>

          {/* Spacer to center nav */}
          <div className="flex-1 min-w-0" />

          {/* Centered Nav Links */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              const badge = href === "/pos-terminal" ? cartCount : href === "/kitchen" ? kitchenCount : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden md:block">{label}</span>
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-sm">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right spacer */}
          <div className="flex-1 min-w-0" />

          <PosHeaderNotifications />

          <button
            type="button"
            onClick={() => { dispatchPosSoftRefresh(); syncCounts(); }}
            className="size-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 flex items-center justify-center transition-colors"
            title="Refresh"
          >
            <RotateCw className="size-4" />
          </button>

          {/* Printer → opens recent orders popup */}
          <button
            type="button"
            onClick={openRecentOrders}
            className="size-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 flex items-center justify-center transition-colors"
            title="Recent Receipts"
          >
            <Printer className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) document.documentElement.requestFullscreen();
              else document.exitFullscreen();
            }}
            className="size-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 flex items-center justify-center transition-colors"
            title="Fullscreen"
          >
            <Maximize className="size-4" />
          </button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 cursor-pointer outline-none bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-2 py-1.5 rounded-xl transition-all">
                  <div className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center text-[11px] font-bold overflow-hidden shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.fullName?.charAt(0) || "U"
                    )}
                  </div>
                  <div className="hidden md:flex flex-col items-start text-left">
                    <span className="text-[11px] font-bold text-zinc-800 leading-tight">{user.fullName}</span>
                    <span className="text-[9px] text-zinc-400 uppercase">{user.role}</span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52 rounded-xl" align="end">
                <DropdownMenuLabel className="font-normal text-xs">{user.fullName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/my-profile" className="cursor-pointer">
                      <UserIcon className="mr-2 size-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  {user.role?.toLowerCase() === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/receipt-settings" className="cursor-pointer">
                        <Settings2 className="mr-2 size-4" />
                        Receipt Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <FileText className="mr-2 size-4" />
                    Policy
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 cursor-pointer"
                  onClick={() => authApi.logout("/pos/login")}
                >
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="pos-scope flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>

      {/* ── RECENT ORDERS POPUP ── */}
      {showRecentOrders && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowRecentOrders(false); setSelectedOrder(null); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="size-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900">Recent Receipts</h2>
                  <p className="text-xs text-zinc-400">Last 5 orders — click to view & print</p>
                </div>
              </div>
              <button
                onClick={() => { setShowRecentOrders(false); setSelectedOrder(null); }}
                className="size-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-400 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Left: Order list */}
              <div className="w-[260px] shrink-0 border-r border-zinc-100 overflow-y-auto">
                {loadingRecent ? (
                  <div className="p-6 text-center text-zinc-400 text-sm">Loading...</div>
                ) : recentOrders.length === 0 ? (
                  <div className="p-6 text-center text-zinc-400 text-sm">No recent orders</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {recentOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={cn(
                          "w-full text-left px-3 py-3 rounded-xl transition-all border",
                          selectedOrder?.id === order.id
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-zinc-50 hover:bg-zinc-100 border-transparent text-zinc-800"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">#{order.id}</span>
                          <span className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                            selectedOrder?.id === order.id
                              ? "bg-white/20 text-white"
                              : "bg-zinc-200 text-zinc-600"
                          )}>
                            {order.status}
                          </span>
                        </div>
                        <p className={cn("text-xs truncate", selectedOrder?.id === order.id ? "text-white/80" : "text-zinc-500")}>
                          {order.customerName || "Guest"} • {order.orderType}
                        </p>
                        <p className={cn("text-xs font-bold mt-0.5", selectedOrder?.id === order.id ? "text-white" : "text-zinc-700")}>
                          ${Number(order.total).toFixed(2)}
                        </p>
                        <p className={cn("text-[10px] mt-0.5", selectedOrder?.id === order.id ? "text-white/60" : "text-zinc-400")}>
                          {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Receipt preview */}
              <div className="flex-1 flex flex-col min-h-0">
                {selectedOrder ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div ref={printRef} className="max-w-[320px] mx-auto bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
                        <ReceiptBody
                          data={orderToReceiptSnapshot(selectedOrder)}
                          settings={receiptSettings}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 px-6 py-4 border-t border-zinc-100 flex gap-3 justify-end">
                      <button
                        onClick={() => setSelectedOrder(null)}
                        className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-semibold hover:bg-zinc-50 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={handlePrintSelected}
                        className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow hover:opacity-90 transition-all flex items-center gap-2"
                      >
                        <Printer className="size-4" />
                        Print Receipt
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-300 p-8">
                    <Receipt className="size-12" />
                    <p className="text-sm font-medium">Select an order to preview its receipt</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden printable receipt for recent orders printer */}
      {selectedOrder && (
        <div id="printable-receipt" className="hidden print:block bg-white">
          <ReceiptBody
            data={orderToReceiptSnapshot(selectedOrder)}
            settings={receiptSettings}
          />
        </div>
      )}

      {/* Override printable receipt from page when recent orders is active */}
      {showRecentOrders && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            .pos-scope #printable-receipt {
              display: none !important;
              visibility: hidden !important;
            }
          }
        `}} />
      )}
    </PermissionProvider>
  );
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute loginPath="/pos/login">
      <PosSearchProvider>
        <PosLayoutInner>{children}</PosLayoutInner>
      </PosSearchProvider>
    </ProtectedRoute>
  );
}
