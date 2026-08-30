"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { receiptSettingsApi, ReceiptSettings } from "@/lib/api/restaurant/receiptSettingsApi";
import { ReceiptBody, ReceiptSnapshot } from "@/components/receipt/ReceiptBody";
import { Loader2, AlertCircle } from "lucide-react";

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    if (protocol === "https:" || (!host.includes("localhost") && !host.includes("127.0.0.1") && !/^\d+\.\d+\.\d+\.\d+$/.test(host))) {
      return `${protocol}//${host}/api`;
    }
    return `${protocol}//${host}:7005/api`;
  }
  return "http://localhost:7005/api";
};

const API_URL = getApiUrl();

export default function OrderTicketPage() {
  const params = useParams();
  const orderId = params?.id as string;

  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);
  const [settings, setSettings] = useState<ReceiptSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const [orderRes, sett] = await Promise.all([
          fetch(`${API_URL}/orders/ticket/${orderId}`).then((r) => r.json()),
          receiptSettingsApi.getSettings().catch(() => null),
        ]);

        if (!orderRes.success) throw new Error(orderRes.message || "Order not found");

        const o = orderRes.data;
        const items = (o.orderitem || []).map((oi: any) => ({
          menuItemId: oi.menuItemId ?? oi.id,
          name: oi.menuitem?.name || oi.name || "Item",
          price: Number(oi.unitPrice ?? oi.menuitem?.price ?? 0),
          quantity: oi.quantity,
        }));
        const subtotal = Number(o.subTotal ?? o.subtotal ?? 0);
        const tax = Number(o.taxAmount ?? o.tax ?? 0);
        const total = Number(o.total ?? o.orderTotal ?? 0);

        setReceipt({
          orderId: o.id,
          customerName: o.customer?.name || o.customerName || "Guest",
          customerPhone: o.customer?.phone || undefined,
          paymentMethod: o.paymentMethod || "Cash",
          orderTypeLabel: o.orderType
            ? o.orderType.charAt(0).toUpperCase() + o.orderType.slice(1)
            : "Takeaway",
          locationLabel: o.deliveryAddress || o.table?.name || undefined,
          items,
          subtotal,
          tax,
          discount: Number(o.discountAmount ?? 0),
          total,
          createdAt: o.createdAt,
        });
        setSettings(sett);
      } catch (e: any) {
        setError(e.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="animate-spin size-8 text-zinc-400" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-50 text-zinc-600 p-6">
        <AlertCircle className="size-10 text-red-400" />
        <p className="text-sm font-medium">{error || "Order not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-start justify-center py-8 px-4">
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden w-full max-w-sm">
        <ReceiptBody data={receipt} settings={settings} />
        <div className="text-center pb-6">
          <button
            onClick={() => window.print()}
            className="mt-3 px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow hover:opacity-90 transition"
          >
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
