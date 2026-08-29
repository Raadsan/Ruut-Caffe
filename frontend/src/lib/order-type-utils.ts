import { Order } from "@/lib/api/restaurant/orderApi";

export type OrderChannel = "dine-in" | "takeaway" | "delivery";

export function resolveOrderChannel(order: Order): OrderChannel {
  const type = order.orderType?.toLowerCase();
  if (type === "dine-in" || type === "takeaway" || type === "delivery") {
    return type;
  }
  if (order.table?.number || order.tableId) return "dine-in";
  if (order.address) return "delivery";
  return "takeaway";
}

export function matchesReadyAudience(
  order: Order,
  audience: "waiter" | "pos"
): boolean {
  const channel = resolveOrderChannel(order);
  return audience === "waiter" ? channel === "dine-in" : channel !== "dine-in";
}
