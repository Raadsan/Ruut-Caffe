"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Search, ChevronDown, LogOut, User as UserIcon, FileText, Settings2 } from "lucide-react";
import { authApi, AuthUser } from "@/lib/api/auth/authApi";
import { notificationApi, Notification } from "@/lib/api/restaurant/notificationApi";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionProvider } from "@/context/PermissionContext";
import { pageHeaderBarTitleClass } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardSwitcher } from "@/components/dashboard/DashboardSwitcher";
import {
  onDebouncedEvent,
  REFRESH_NOTIFICATIONS,
  NOTIFICATION_READ,
  NOTIFICATIONS_MARKED_ALL_READ,
} from "@/lib/live-updates";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(() => authApi.getCachedUser());
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const pageTitle = (() => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/orders/create") return "Create Order";
    if (pathname.startsWith("/orders")) return "Orders";
    if (pathname.startsWith("/users")) return "Users";
    if (pathname.startsWith("/clients")) return "Clients";
    if (pathname.startsWith("/tables")) return "Tables";
    if (pathname.startsWith("/composites")) return "Menu Combos";
    if (pathname.startsWith("/menus")) return "Menu Items";
    if (pathname.startsWith("/categories")) return "Categories";
    if (pathname.startsWith("/pos")) return "POS Terminal";
    if (pathname.startsWith("/profile")) return "Profile";
    return "Dashboard";
  })();

  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setNotificationsLoading(true);
      const data = await notificationApi.getMyNotifications(silent);
      setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      if (!silent) setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await authApi.getMe();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to load user session", error);
      }
    };

    fetchUser();

    const notifTimer = window.setTimeout(() => {
      fetchNotifications(true);
    }, 1500);

    const handleProfileUpdate = () => {
      fetchUser();
    };

    window.addEventListener('profile_updated', handleProfileUpdate);

    const onNotificationRead = (e: Event) => {
      const id = (e as CustomEvent<{ id: number }>).detail.id;
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    };

    const onAllNotificationsRead = () => {
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    };

    window.addEventListener(NOTIFICATION_READ, onNotificationRead);
    window.addEventListener(NOTIFICATIONS_MARKED_ALL_READ, onAllNotificationsRead);

    const removeNotificationListener = onDebouncedEvent(
      REFRESH_NOTIFICATIONS,
      () => fetchNotifications(true),
      800
    );

    return () => {
      window.clearTimeout(notifTimer);
      window.removeEventListener('profile_updated', handleProfileUpdate);
      window.removeEventListener(NOTIFICATION_READ, onNotificationRead);
      window.removeEventListener(NOTIFICATIONS_MARKED_ALL_READ, onAllNotificationsRead);
      removeNotificationListener();
    };
  }, [fetchNotifications]);

  return (
    <SidebarProvider defaultOpen={true} style={{ "--sidebar-width": "17rem", "--sidebar-width-icon": "5.5rem" } as React.CSSProperties}>
      <PermissionProvider>
        <AppSidebar />

        <SidebarInset className="bg-[#F8F9FA] dark:bg-[#161616]">
          {/* Top Header */}
          <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-white/80 dark:bg-[#161616]/95 backdrop-blur-md transition-all duration-300">
            <div className="flex h-14 lg:h-[72px] items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6">
              {/* Left: menu + page title on tablet/desktop compact */}
              <div className="flex min-w-0 items-center gap-2 sm:gap-3 shrink-0">
                <SidebarTrigger className="size-10 shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-muted-foreground shadow-sm hover:text-primary hover:border-primary/30 transition-colors lg:size-9 lg:border-0 lg:bg-transparent lg:dark:bg-transparent lg:shadow-none" />
                <h1 className={cn(pageHeaderBarTitleClass, "truncate lg:hidden max-w-[120px] sm:max-w-[180px]")}>
                  {pageTitle}
                </h1>
                <h1 className={cn(pageHeaderBarTitleClass, "hidden lg:block whitespace-nowrap")}>
                  {pageTitle}
                </h1>
              </div>

              {/* Search — desktop only (full width center) */}
              <div className="hidden lg:flex flex-1 justify-center max-w-xl xl:max-w-2xl mx-auto min-w-0 px-4">
                <div className="relative w-full group">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Search anything... (Cmd + K)"
                    className="w-full h-9 pl-9 pr-4 text-xs bg-muted/40 border border-transparent focus:border-primary/20 focus:bg-background rounded-full focus:outline-none transition-all shadow-none focus:shadow-sm"
                  />
                </div>
              </div>

              {/* Spacer pushes actions right when search is hidden */}
              <div className="flex-1 lg:hidden" />

              {/* Right actions */}
              <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-3 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-9 w-9 rounded-full"
                  onClick={() => setMobileSearchOpen(v => !v)}
                  aria-label="Toggle search"
                >
                  <Search className="size-4 text-muted-foreground" />
                </Button>

                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open) fetchNotifications(true);
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full group">
                      <Bell className="w-4.5 h-4.5 text-muted-foreground dark:text-white group-hover:text-foreground dark:group-hover:text-white group-hover:scale-110 transition-all" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 px-0.5 bg-primary text-[8px] font-bold text-white rounded-full ring-2 ring-background flex items-center justify-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 mt-2 rounded-xl shadow-2xl border-border/50 p-0 overflow-hidden" align="end">
                    <div className="bg-muted/50 p-4 border-b border-border flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-[9px] font-bold text-white bg-primary px-2 py-0.5 rounded-full uppercase">
                          {unreadCount} New
                        </span>
                      )}
                    </div>
                    <div className="max-h-[300px] overflow-auto">
                      {notificationsLoading ? (
                        <div className="p-8 text-center">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Loading...</p>
                        </div>
                      ) : notifications.length > 0 ? (
                        notifications.slice(0, 8).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${n.isRead ? "opacity-60" : "bg-primary/5"}`}
                            onClick={() => {
                              if (!n.isRead) {
                                setNotifications((prev) =>
                                  prev.map((item) =>
                                    item.id === n.id ? { ...item, isRead: true } : item
                                  )
                                );
                                notificationApi.markNotificationRead(n.id).catch((error) => {
                                  console.error("Failed to mark notification read", error);
                                  fetchNotifications(true);
                                });
                              }
                            }}
                          >
                            <p className="text-[11px] font-bold uppercase tracking-tight text-foreground">{n.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            {n.createdAt && (
                              <p className="text-[9px] text-muted-foreground/70 mt-1 uppercase">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell className="size-8 text-muted-foreground/10 mx-auto mb-2" />
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No new notifications</p>
                        </div>
                      )}
                    </div>
                    <DropdownMenuSeparator className="m-0" />
                    <Link href="/config/notifications" className="block p-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:bg-muted transition-colors">
                      View All Notifications
                    </Link>
                  </DropdownMenuContent>
                </DropdownMenu>

                <ThemeToggle />

                <div className="hidden sm:block h-4 w-px bg-border/60 mx-0.5 lg:mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 pl-0.5 cursor-pointer group outline-none shrink-0">
                      <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-[15px] font-medium shadow-sm shadow-primary/20 transition-all group-hover:ring-2 group-hover:ring-primary/20 overflow-hidden shrink-0">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          user?.fullName?.charAt(0) || "U"
                        )}
                      </div>
                      <div className="hidden xl:flex flex-col items-start gap-0.5 text-left min-w-0">
                        <span className="text-[12px] font-bold uppercase tracking-tight text-foreground leading-tight truncate max-w-[140px]">{user?.fullName}</span>
                        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-tight">{user?.role}</span>
                      </div>
                      <ChevronDown className="hidden xl:block w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 mt-2 rounded-xl shadow-2xl border-border/50" align="end">
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-2 py-2.5 text-left text-sm">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white font-medium text-[15px] overflow-hidden">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          user?.fullName?.charAt(0) || "U"
                        )}
                      </div>
                      <div className="grid flex-1 text-left text-xs leading-tight">
                        <span className="truncate font-medium uppercase tracking-tight">{user?.fullName}</span>
                        <span className="truncate text-[11.5px] font-normal uppercase tracking-widest text-muted-foreground">{user?.role}</span>
                        <span className="truncate text-[10.5px] font-normal text-muted-foreground/80">{user?.email}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex w-full items-center text-xs font-bold uppercase tracking-widest py-2.5 cursor-pointer">
                        <UserIcon className="mr-2 size-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    {user?.role?.toLowerCase() === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/receipt-settings" className="flex w-full items-center text-xs font-bold uppercase tracking-widest py-2.5 cursor-pointer">
                          <Settings2 className="mr-2 size-4" />
                          Receipt Settings
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-xs font-bold uppercase tracking-widest py-2.5 cursor-pointer">
                      <FileText className="mr-2 size-4" />
                      Policy
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs font-bold uppercase tracking-widest text-destructive dark:text-white py-2.5 cursor-pointer"
                    onClick={async () => {
                      authApi.logout();
                    }}
                  >
                    <LogOut className="mr-2 size-4 dark:text-white" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>

            {/* Mobile / tablet search row */}
            {mobileSearchOpen && (
              <div className="lg:hidden border-t border-zinc-100 dark:border-zinc-800 px-3 sm:px-4 py-2.5">
                <div className="relative w-full group">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Search..."
                    autoFocus
                    className="w-full h-10 pl-9 pr-4 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:border-primary/30 focus:bg-white dark:focus:bg-zinc-900 rounded-lg focus:outline-none transition-all dark:text-zinc-100"
                  />
                </div>
              </div>
            )}
          </header>

          {/* Page Content */}
          <main className="dashboard-scope flex-1 overflow-auto">
            <div className="py-4 px-2 md:px-3 lg:px-4">
              <div className="w-full mx-auto">
                <div className="mb-4 px-2">
                  <DashboardSwitcher />
                </div>
                {children}
              </div>
            </div>
          </main>
        </SidebarInset>
      </PermissionProvider>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{<DashboardLayoutContent>{children}</DashboardLayoutContent>}</ProtectedRoute>;
}
