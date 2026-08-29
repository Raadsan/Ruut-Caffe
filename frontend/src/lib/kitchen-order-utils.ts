import { formatDistanceToNow } from "date-fns";
import { Order } from "@/lib/api/restaurant/orderApi";
import { MenuItem } from "@/lib/api/restaurant/menuItemApi";

export function getOrderTitle(order: Order) {
  const names = order.orderitem?.map(i => i.menuitem?.name).filter(Boolean) as string[];
  if (names.length === 0) return `Order #${order.id}`;
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1} more`;
}

export function getOrderMeta(order: Order) {
  const parts: string[] = [];
  if (order.table?.number) parts.push(`Table ${order.table.number}`);
  const type = order.orderType || (order.table ? "dine-in" : "takeaway");
  parts.push(type.replace("-", " "));
  return parts.join(" | ");
}

export function getLineImage(
  menuItemId: number,
  lineImage?: string,
  menuItems: MenuItem[] = []
): string | undefined {
  if (lineImage) return lineImage;
  return menuItems.find(m => m.id === menuItemId)?.imageUrl;
}

export function getOrderCoverImage(order: Order, menuItems: MenuItem[] = []) {
  for (const line of order.orderitem || []) {
    const img = getLineImage(line.menuItemId, line.menuitem?.imageUrl, menuItems);
    if (img) return img;
  }
  return undefined;
}

export function getElapsedLabel(createdAt?: string) {
  if (!createdAt) return "Just now";
  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: false }) + " ago";
  } catch {
    return "Just now";
  }
}

/** Kitchen queue — new tickets (includes paid orders awaiting prep). */
export function isKitchenPendingStatus(status: string) {
  return status === "pending" || status === "paid";
}

export function isKitchenActiveStatus(status: string) {
  return isKitchenPendingStatus(status) || status === "preparing" || status === "ready";
}

export function getOrderCreatorName(order: Order) {
  return order.user?.fullName || order.customerName || "Walk-in guest";
}

export function getOrderCreatorRole(order: Order) {
  const roleName = order.user?.role?.name?.trim();
  if (roleName) return roleName;
  return getOrderSourceLabel(order);
}

/** Who placed the order: admin, waiter, POS, client app, etc. */
export function getOrderSourceLabel(order: Order) {
  const role = order.user?.role?.name?.toLowerCase();
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "waiter") return "Waiter";
  if (role === "kitchen") return "Kitchen";

  const source = (order.source || "pos").toLowerCase();
  if (source === "mobile" || source === "client" || source === "qr") return "Client";
  if (source === "pos") return "POS";
  if (source === "dashboard") return "Dashboard";
  return source.charAt(0).toUpperCase() + source.slice(1);
}
