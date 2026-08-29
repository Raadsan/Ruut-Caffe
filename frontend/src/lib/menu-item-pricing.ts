import { MenuItem } from "@/lib/api/restaurant/menuItemApi";

export type MenuItemDiscountType = "percentage" | "fixed";

type PricedItem = Pick<MenuItem, "price" | "discountType" | "discountValue">;

export function getMenuItemDiscountAmount(item: PricedItem): number {
  const value = Number(item.discountValue) || 0;
  const price = Number(item.price) || 0;
  if (value <= 0 || !item.discountType) return 0;

  if (item.discountType === "percentage") {
    return Math.min(price, (price * value) / 100);
  }
  if (item.discountType === "fixed") {
    return Math.min(price, value);
  }
  return 0;
}

export function getMenuItemEffectivePrice(item: PricedItem): number {
  const price = Number(item.price) || 0;
  return Math.max(0, price - getMenuItemDiscountAmount(item));
}

export function menuItemHasDiscount(item: PricedItem): boolean {
  return getMenuItemDiscountAmount(item) > 0;
}

export function getMenuItemDiscountLabel(item: PricedItem): string {
  const value = Number(item.discountValue) || 0;
  if (!menuItemHasDiscount(item)) return "";
  if (item.discountType === "percentage") return `-${value}%`;
  return `-$${value.toFixed(2)}`;
}

export function getMenuItemDiscountPercent(item: PricedItem): number {
  const price = Number(item.price) || 0;
  if (!menuItemHasDiscount(item) || price <= 0) return 0;
  if (item.discountType === "percentage") return valueOrZero(item.discountValue);
  return Math.round((getMenuItemDiscountAmount(item) / price) * 100);
}

function valueOrZero(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
