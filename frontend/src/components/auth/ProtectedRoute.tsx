"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authApi } from "@/lib/api/auth/authApi";
import { menuApi, Menu } from "@/lib/api/restaurant/menuApi";
import { isModuleAdmin, workspaceFromPath, workspaceHref, type WorkspaceKey } from "@/lib/workspaces";

const ACCOUNT_ROUTES = new Set(["/profile", "/my-profile"]);
const POS_ROUTES = new Set(["/pos-terminal", "/kitchen", "/ready-orders", "/my-sales", "/my-profile"]);

function hasRouteAccess(menus: Menu[], pathname: string, workspace: WorkspaceKey) {
  let best: { length: number; canView: boolean } | null = null;
  for (const menu of menus) {
    const entries = [menu, ...(menu.items || [])];
    for (const entry of entries) {
      const url = workspaceHref(entry.url, workspace);
      if (!url || (pathname !== url && !pathname.startsWith(`${url}/`))) continue;
      if (!best || url.length > best.length) {
        best = { length: url.length, canView: entry.isActive !== false && !!entry.permissions?.canView };
      }
    }
  }
  return best?.canView === true;
}

export function ProtectedRoute({
  children,
  loginPath = "/login",
}: {
  children: React.ReactNode;
  loginPath?: string;
}) {
  const pathname = usePathname();
  const [allowedPath, setAllowedPath] = useState<string | null>(null);

  useEffect(() => {
    const isLogoutLocked = () => document.cookie.split(";").some(
      (part) => part.trim() === "restaurant_logout=1"
    );
    const hideProtectedPage = () => {
      document.documentElement.style.visibility = "hidden";
    };
    const handlePageShow = () => {
      if (isLogoutLocked()) {
        hideProtectedPage();
        window.location.replace(loginPath);
      } else {
        document.documentElement.style.visibility = "";
      }
    };

    if (isLogoutLocked()) {
      hideProtectedPage();
      window.location.replace(loginPath);
      return;
    }

    window.addEventListener("pagehide", hideProtectedPage);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", hideProtectedPage);
      window.removeEventListener("pageshow", handlePageShow);
      document.documentElement.style.visibility = "";
    };
  }, [loginPath]);

  useEffect(() => {
    let active = true;

    async function validate() {
      try {
        // Browser profiles keep cookies and localStorage independently. Always
        // reconcile the cached user with the server session before authorizing a
        // workspace, otherwise an old auth_user can be checked against a
        // different session cookie and produce a misleading 403.
        const user = await authApi.getMe(true);
        const workspace = workspaceFromPath(pathname);
        const role = user.role?.trim().toLowerCase().replace(/[\s-]+/g, '_');
        const isPosSessionRoute = user.authContext === 'pos' && POS_ROUTES.has(pathname);
        const assignedMenus = user.roleId && !isPosSessionRoute && !ACCOUNT_ROUTES.has(pathname)
          ? await menuApi.getMenusByRole(user.roleId, false, workspace)
          : [];
        const roleHome = (() => {
          if (role === 'accountant' || role === 'accounting') return '/accounting/dashboard';
          if (['restaurant', 'manager'].includes(role)) return '/restaurant/dashboard';
          if (['pos', 'cashier', 'waiter'].includes(role)) return '/pos-terminal';
          if (workspace === 'CORE') {
            const moduleEntry = assignedMenus.find((menu) =>
              ['/restaurant/dashboard', '/accounting/dashboard', '/access-control/users', '/pos-terminal'].includes(menu.url)
            );
            if (moduleEntry) return moduleEntry.url;
          }
          return '/dashboard';
        })();
        const redirectDeniedRoute = () => {
          const isWorkspaceRole = ['accountant', 'accounting', 'restaurant', 'manager', 'pos', 'cashier', 'waiter'].includes(role);
          const destination = roleHome !== pathname
            ? roleHome
            : !isWorkspaceRole && pathname !== '/dashboard'
              ? '/dashboard'
              : null;
          if (destination) {
            window.location.replace(destination);
          } else {
            authApi.logout(loginPath);
          }
        };
        const workspaceAllowed = isModuleAdmin(user.role) || assignedMenus.length > 0 ||
          (isPosSessionRoute && ['pos', 'cashier', 'waiter', 'manager'].includes(role)) ||
          (workspace === 'RESTAURANT' && ['restaurant', 'manager', 'pos', 'cashier', 'waiter'].includes(role)) ||
          (workspace === 'ACCOUNTING' && ['accounting', 'accountant'].includes(role));
        if (!workspaceAllowed) {
          redirectDeniedRoute();
          return;
        }
        // Page access always comes from this role's database menu permissions.
        // Admin is not an automatic bypass: it must also have canView assigned.
        const canEnter = (user.authContext === "pos" && POS_ROUTES.has(pathname)) ||
          ACCOUNT_ROUTES.has(pathname) || pathname === '/accounting/dashboard' ||
          (pathname === '/dashboard' && isModuleAdmin(user.role)) ||
          (pathname.startsWith('/config/') && isModuleAdmin(user.role)) || (
          // Menu permissions have a short-lived cache and are also enforced by
          // the backend. Avoid forcing the same remote query on every route.
          !!user.roleId && hasRouteAccess(assignedMenus, pathname, workspace)
        );
        if (!canEnter) {
          redirectDeniedRoute();
          return;
        }
        if (active) setAllowedPath(pathname);
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          authApi.logout(loginPath);
          return;
        }
        if (status === 403) {
          if (pathname !== "/dashboard") window.location.replace("/dashboard");
          return;
        }
        // Network/server errors do not invalidate an existing authenticated
        // session. Keep the persistent shell mounted and let server-protected
        // API requests continue enforcing authorization.
        if (active) setAllowedPath((current) => current ?? pathname);
      }
    }

    void validate();
    return () => { active = false; };
  }, [pathname, loginPath]);

  // Show the full-page session loader only on the first protected render.
  // Once the session has been validated, keep the persistent layout mounted
  // while a new workspace route is checked so the sidebar and header do not
  // disappear during client-side dashboard switching.
  if (allowedPath === null) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950"
        aria-label="Validating session"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  return children;
}
