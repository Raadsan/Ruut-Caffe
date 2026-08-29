"use client";

import Link from "next/link";
import {
  Bell,
  ChefHat,
  CircleDollarSign,
  Printer,
  RotateCw,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dispatchPosSoftRefresh } from "@/lib/live-updates";

type PosNavBarProps = {
  pathname: string;
  cartCount: number;
  kitchenCount: number;
  readyCount: number;
  onRefresh?: () => void;
};

type NavTone = "default" | "primary" | "orange" | "green";

function NavBadge({
  count,
  tone,
  inverted,
}: {
  count: number;
  tone: NavTone;
  inverted?: boolean;
}) {
  if (count <= 0) return null;

  const toneClass =
    tone === "orange"
      ? "bg-orange-500 text-white"
      : tone === "green"
        ? "bg-emerald-500 text-white"
        : inverted
          ? "bg-white text-primary"
          : "bg-primary text-white";

  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none shadow-sm",
        toneClass
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function navCircleClass(active: boolean, tone: NavTone, hasAlert: boolean) {
  if (active && tone === "primary") {
    return "bg-primary text-white border-2 border-primary shadow-md";
  }
  if (active && tone === "orange") {
    return "bg-orange-500 text-white border-2 border-orange-500 shadow-md";
  }
  if (active && tone === "green") {
    return "bg-emerald-500 text-white border-2 border-emerald-500 shadow-md";
  }
  if (tone === "orange" && hasAlert) {
    return "bg-white text-orange-500 border-2 border-orange-400 hover:bg-orange-50";
  }
  if (tone === "green" && hasAlert) {
    return "bg-white text-emerald-600 border-2 border-emerald-400 hover:bg-emerald-50";
  }
  return "bg-white text-zinc-400 border-2 border-zinc-200 hover:border-zinc-300 hover:text-zinc-600 dark:bg-[#1a1a1a] dark:border-zinc-700 dark:text-zinc-500";
}

function NavCircleLink({
  href,
  label,
  icon: Icon,
  active,
  tone = "default",
  badge,
  badgeTone,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  tone?: NavTone;
  badge?: number;
  badgeTone?: NavTone;
}) {
  const hasAlert = (badge ?? 0) > 0;

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative size-10 rounded-full flex items-center justify-center transition-all shrink-0",
        navCircleClass(active, tone, hasAlert)
      )}
    >
      <Icon className="size-[18px]" strokeWidth={2} />
      {badge !== undefined && (
        <NavBadge count={badge} tone={badgeTone ?? tone} inverted={active && tone === "primary"} />
      )}
    </Link>
  );
}

function NavCircleButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "size-10 rounded-full flex items-center justify-center transition-all shrink-0",
        "bg-white text-zinc-400 border-2 border-zinc-200 hover:border-zinc-300 hover:text-zinc-600",
        "dark:bg-[#1a1a1a] dark:border-zinc-700 dark:text-zinc-500"
      )}
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </button>
  );
}

/** Circular icon navigation bar for POS header (cart, sales, kitchen, ready, print, refresh). */
export default function PosNavBar({
  pathname,
  cartCount,
  kitchenCount,
  readyCount,
  onRefresh,
}: PosNavBarProps) {
  const isTerminal = pathname === "/pos-terminal";
  const isSales = pathname === "/my-sales";
  const isKitchen = pathname === "/kitchen";
  const isReady = pathname === "/ready-orders";

  const handleRefresh = () => {
    dispatchPosSoftRefresh();
    onRefresh?.();
  };

  return (
    <nav
      aria-label="POS navigation"
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-zinc-50/80 border border-zinc-100 dark:bg-[#1f1f1f] dark:border-zinc-800"
    >
      <NavCircleLink
        href="/pos-terminal"
        label="POS Terminal"
        icon={ShoppingCart}
        active={isTerminal}
        tone="primary"
        badge={cartCount}
        badgeTone="primary"
      />

      <NavCircleLink
        href="/my-sales"
        label="My Sales"
        icon={CircleDollarSign}
        active={isSales}
        tone="primary"
      />

      <NavCircleLink
        href="/kitchen"
        label="Kitchen queue"
        icon={ChefHat}
        active={isKitchen}
        tone="orange"
        badge={kitchenCount}
        badgeTone="orange"
      />

      <NavCircleLink
        href="/ready-orders"
        label="Ready orders"
        icon={Bell}
        active={isReady}
        tone="green"
        badge={readyCount}
        badgeTone="green"
      />

      <NavCircleButton label="Print" icon={Printer} onClick={() => window.print()} />

      <NavCircleButton label="Refresh data" icon={RotateCw} onClick={handleRefresh} />
    </nav>
  );
}
