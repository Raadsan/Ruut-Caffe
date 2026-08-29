"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Key, Landmark, LayoutGrid, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { authApi } from "@/lib/api/auth/authApi";
import { menuApi } from "@/lib/api/restaurant/menuApi";
import { WORKSPACE_KEYS, workspaceFromPath, workspaceHref, type WorkspaceKey } from "@/lib/workspaces";

const workspaceMeta: Record<WorkspaceKey, { label: string; icon: typeof LayoutGrid }> = {
  CORE: { label: "Main Dashboard", icon: LayoutGrid },
  RESTAURANT: { label: "Restaurant Dashboard", icon: Store },
  ACCOUNTING: { label: "Accounting Dashboard", icon: Landmark },
  ACCESS_CONTROL: { label: "Configurations", icon: Key },
};

type DashboardOption = {
  key: WorkspaceKey;
  label: string;
  href: string;
  icon: typeof LayoutGrid;
};

function findDashboardHref(workspace: WorkspaceKey, menus: Awaited<ReturnType<typeof menuApi.getMenusByRole>>) {
  if (workspace === "ACCESS_CONTROL") return "/config/roles";
  const dashboard = menus.find((menu) => menu.isActive !== false && menu.url === "/dashboard")
    ?? menus.find((menu) => menu.isActive !== false && menu.title.toLowerCase().includes("dashboard"));
  return workspaceHref(dashboard?.url || '/dashboard', workspace);
}

export function DashboardSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = workspaceFromPath(pathname);
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboards() {
      try {
        setLoading(true);
        const user = authApi.getCachedUser() ?? await authApi.getMe();
        if (!user?.roleId) {
          if (!cancelled) setDashboards([]);
          return;
        }

        const resolved = await Promise.all(
          WORKSPACE_KEYS.map(async (key) => {
            try {
              const menus = await menuApi.getMenusByRole(user.roleId!, false, key);
              const href = findDashboardHref(key, menus);
              if (!href) return null;
              return { key, href, label: workspaceMeta[key].label, icon: workspaceMeta[key].icon };
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setDashboards(resolved.filter(Boolean) as DashboardOption[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboards();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(() => {
    return dashboards.find((item) => item.key === workspace)
      ?? dashboards.find((item) => item.href === pathname)
      ?? dashboards[0];
  }, [dashboards, pathname, workspace]);

  if (loading || dashboards.length <= 1 || !active) return null;

  const ActiveIcon = active.icon;

  return (
    <div className="flex items-center justify-end gap-3">
      <span className="hidden text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:block">
        Dashboards
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-sm outline-none transition-colors hover:border-primary/30 hover:bg-muted/40 sm:w-auto sm:min-w-[220px]"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ActiveIcon className="size-3.5" />
            </span>
            <span className="flex-1 truncate text-left">{active.label}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5 shadow-xl">
          <DropdownMenuLabel className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Select dashboard
          </DropdownMenuLabel>
          {dashboards.map((option) => {
            const Icon = option.icon;
            const selected = option.key === workspace;
            return (
              <DropdownMenuItem
                key={option.href}
                onSelect={() => router.push(option.href)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5"
              >
                <span className={cn("flex size-8 items-center justify-center rounded-lg", selected ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 text-xs font-semibold">{option.label}</span>
                {selected && <Check className="size-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
