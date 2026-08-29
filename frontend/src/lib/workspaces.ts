export const WORKSPACE_KEYS = ['CORE', 'RESTAURANT', 'ACCOUNTING', 'ACCESS_CONTROL'] as const;
export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];

const POS_RESTAURANT_ROUTES = new Set([
  '/pos-terminal',
  '/kitchen',
  '/ready-orders',
  '/my-sales',
  '/my-profile',
]);

export function workspaceFromPath(pathname: string): WorkspaceKey {
  if (POS_RESTAURANT_ROUTES.has(pathname)) return 'RESTAURANT';
  if (pathname.startsWith('/restaurant/')) return 'RESTAURANT';
  if (pathname.startsWith('/accounting/')) return 'ACCOUNTING';
  if (pathname.startsWith('/access-control/') || pathname.startsWith('/config/')) return 'ACCESS_CONTROL';
  return 'CORE';
}

export function workspaceHref(url: string, workspace: WorkspaceKey) {
  if (workspace === 'RESTAURANT' && !url.startsWith('/restaurant/')) return `/restaurant${url}`;
  if (workspace === 'ACCESS_CONTROL' && !url.startsWith('/config/')) return `/config${url}`;
  if (workspace === 'ACCOUNTING' && !url.startsWith('/accounting/')) return `/accounting${url}`;
  return url;
}

export function isModuleAdmin(role?: string) {
  const normalized = role?.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized === 'admin' || normalized === 'super_admin';
}
