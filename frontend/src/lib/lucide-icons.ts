import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

const SKIP = new Set([
  "createLucideIcon",
  "default",
  "Icon",
  "LucideIcon",
  "LucideProps",
  "IconNode",
]);

function isLucideIconComponent(value: unknown): value is LucideIcon {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { render?: unknown }).render === "function"
  );
}

export const LUCIDE_ICON_NAMES: string[] = Object.keys(LucideIcons)
  .filter((key) => !SKIP.has(key) && /^[A-Z]/.test(key))
  .filter((key) => !key.endsWith("Icon") && !key.startsWith("Lucide"))
  .filter((key) =>
    isLucideIconComponent((LucideIcons as Record<string, unknown>)[key])
  )
  .sort();

/** Resolve any Lucide icon by PascalCase name (e.g. DoorOpen, Users). */
export function getLucideIcon(name: string | undefined | null): LucideIcon {
  if (!name) return LayoutDashboard;

  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const direct = icons[name];
  if (direct) return direct;

  const match = LUCIDE_ICON_NAMES.find(
    (iconName) => iconName.toLowerCase() === name.toLowerCase()
  );
  if (match) return icons[match];

  return LayoutDashboard;
}

export function searchLucideIconNames(query: string, limit = 96): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return LUCIDE_ICON_NAMES.slice(0, limit);
  return LUCIDE_ICON_NAMES.filter((name) => name.toLowerCase().includes(q)).slice(
    0,
    limit
  );
}

export function isValidLucideIconName(name: string): boolean {
  return LUCIDE_ICON_NAMES.some(
    (iconName) => iconName.toLowerCase() === name.trim().toLowerCase()
  );
}
