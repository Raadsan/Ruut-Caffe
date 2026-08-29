"use client";

import Link from "next/link";
import {
  ChefHat,
  CircleDollarSign,
  History,
  LogOut,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATIC_APP_LOGO } from "@/lib/branding";

type PosSidebarNavProps = {
  pathname: string;
  cartCount: number;
  kitchenCount: number;
  onLogout?: () => void;
};

function SideNavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  badgeColor,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: number;
  badgeColor?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative w-full flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 transition-all",
        active
          ? "bg-white/15 text-white border-r-2 border-white"
          : "text-white/55 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
      <span className="text-[9px] font-bold text-center leading-tight tracking-wider uppercase">
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "absolute top-2 right-2 min-w-[16px] h-[16px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center",
            badgeColor ?? "bg-white text-primary"
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

/** Vertical POS sidebar — logo aligned with header, nav with icon + centered label */
export default function PosSidebarNav({
  pathname,
  cartCount,
  kitchenCount,
  onLogout,
}: PosSidebarNavProps) {
  return (
    <aside
      aria-label="POS navigation"
      className="w-[72px] shrink-0 flex flex-col bg-primary border-r border-primary/80 shadow-xl z-50"
    >
      {/* Logo — same height as top header (h-14) */}
      <div className="shrink-0 h-14 flex items-center justify-center border-b border-white/15 bg-primary">
        <Link href="/pos-terminal" className="hover:opacity-90 transition-opacity">
          <img
            src={STATIC_APP_LOGO}
            alt="POS"
            className="h-8 w-8 object-contain brightness-0 invert"
          />
        </Link>
      </div>

      {/* Main nav */}
      <div className="flex flex-col flex-1 min-h-0 pt-2">
        <SideNavLink
          href="/pos-terminal"
          label="POS"
          icon={ShoppingCart}
          active={pathname === "/pos-terminal"}
          badge={cartCount}
        />
        <SideNavLink
          href="/kitchen"
          label="Kitchen"
          icon={ChefHat}
          active={pathname === "/kitchen"}
          badge={kitchenCount}
          badgeColor="bg-orange-400 text-white"
        />
        <SideNavLink
          href="/ready-orders"
          label="History"
          icon={History}
          active={pathname === "/ready-orders"}
        />
        <SideNavLink
          href="/my-sales"
          label="Sales"
          icon={CircleDollarSign}
          active={pathname === "/my-sales"}
        />
      </div>

      {/* Bottom — logout */}
      <div className="shrink-0 flex flex-col border-t border-white/15 pb-1">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            className="w-full flex flex-col items-center justify-center gap-1.5 py-3 px-1 text-white/50 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={2} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}
