"use client";

import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";
import { ReceiptSettings } from "@/lib/api/restaurant/receiptSettingsApi";

export interface ReceiptLineItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

export interface ReceiptSnapshot {
  orderId: number;
  customerName: string;
  customerPhone?: string;
  paymentMethod: string;
  orderTypeLabel: string;
  locationLabel?: string;
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  discount?: number;
  createdAt: string;
  servedBy?: string;
}

// Parse phone JSON array → array of { provider, number }
function parsePhones(phone?: string): { provider?: string; number?: string }[] {
  if (!phone) return [];
  try {
    const parsed = JSON.parse(phone);
    if (Array.isArray(parsed)) return parsed;
  } catch {/* plain string fallback */ }
  return [];
}

export function ReceiptPhones({ phone }: { phone?: string }) {
  const phones = parsePhones(phone);
  if (!phones.length) return null;
  return (
    <>
      {phones.map((p, i) => (
        <p key={i}>
          {p.provider && <span className="font-semibold">{p.provider} </span>}
          {p.number}
        </p>
      ))}
    </>
  );
}

export function ReceiptHeader({ settings }: { settings: ReceiptSettings | null }) {
  return (
    <div className="text-center mb-4">
      {settings?.logoUrl ? (
        <div className="flex justify-center mb-1.5">
          <img
            src={settings.logoUrl}
            alt={settings.name || "Restaurant logo"}
            className="max-h-14 w-auto object-contain mix-blend-multiply"
          />
        </div>
      ) : (
        <h2 className="text-base font-black uppercase tracking-widest text-zinc-900">
          {settings?.name || "RUUT CAFFE"}
        </h2>
      )}
      {/* Address */}
      {settings?.address && (
        <p className="text-[9px] text-zinc-500 leading-snug">{settings.address}</p>
      )}
      {/* Phone numbers & providers — right below address */}
      <div className="text-[11px] text-zinc-500 leading-snug mt-0.5">
        <ReceiptPhones phone={settings?.phone} />
      </div>
    </div>
  );
}

export function ReceiptBody({
  data,
  settings,
  className,
}: {
  data: ReceiptSnapshot;
  settings: ReceiptSettings | null;
  className?: string;
}) {
  // QR points to public ticket page for this order
  const frontendBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:2005");
  const ticketUrl = `${frontendBase}/pos/ticket/${data.orderId}`;

  const dateStr = new Date(data.createdAt).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date(data.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className={cn("font-mono text-[11px] text-zinc-900 bg-white px-5 py-4", className)}>

      {/* ── HEADER: Logo / Name + Address + Phone numbers ── */}
      <ReceiptHeader settings={settings} />

      {/* ── Large Order Number ── */}
      <div className="text-center my-3   ">
        <span className="text-4xl font-light tracking-wider text-zinc-900">{data.orderId}</span>
      </div>

      {/* ── Order meta (Date / Time / Receipt# / Type) ── */}
      <div className="border-t border-dashed border-zinc-300 pt-2 pb-2 mb-2 text-[10px] text-zinc-500 space-y-0.5">
        <div className="flex justify-between">
          <span>Date</span>
          <span>{dateStr}</span>
        </div>
        <div className="flex justify-between">
          <span>Time</span>
          <span>{timeStr}</span>
        </div>
        <div className="flex justify-between">
          <span>Type</span>
          <span>{data.orderTypeLabel}</span>
        </div>
        {data.locationLabel && (
          <div className="flex justify-between">
            <span>Location</span>
            <span>{data.locationLabel}</span>
          </div>
        )}
      </div>

      {/* ── Items ── */}
      <div className="mb-3">
        {/* Column headers */}
        <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase mb-1 pb-1 border-b border-dashed border-zinc-200">
          <span className="w-6">Qty</span>
          <span className="flex-1 px-1">Item</span>
          <span className="w-14 text-right">U.Price</span>
          <span className="w-14 text-right">Total</span>
        </div>
        {/* Rows */}
        {data.items.map((item) => (
          <div key={item.menuItemId} className="flex justify-between items-start py-1">
            <span className="w-6 text-zinc-600">{item.quantity}x</span>
            <span className="flex-1 px-1 font-semibold">{item.name}</span>
            <span className="w-14 text-right text-zinc-500">${item.price.toFixed(2)}</span>
            <span className="w-14 text-right font-semibold">${(item.quantity * item.price).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* ── Totals ── */}
      <div className="border-t border-dashed border-zinc-300 pt-2 space-y-0.5 mb-4">
        <div className="flex justify-between text-zinc-600">
          <span>Subtotal</span>
          <span>${data.subtotal.toFixed(2)}</span>
        </div>
        {(data.discount ?? 0) > 0 && (
          <div className="flex justify-between text-zinc-600">
            <span>Discount</span>
            <span>-${(data.discount ?? 0).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-zinc-600">
          <span>VAT 5%</span>
          <span>${data.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-black text-sm border-t border-dashed border-zinc-300 pt-1 mt-1">
          <span>Total</span>
          <span>${data.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-600">
          <span className="capitalize">{data.paymentMethod || "Cash"}</span>
          <span>${data.total.toFixed(2)}</span>
        </div>
      </div>

      {/* ── QR Code (links to order ticket page) ── */}
      <div className="flex items-center gap-3 mb-4 border-t border-dashed border-zinc-300 pt-3">
        <div className="shrink-0">
          <QRCode value={ticketUrl} size={60} level="L" />
        </div>
        <div className="text-[9px] text-zinc-500 pt-1 space-y-0.5 leading-snug">
          <p className="font-bold text-zinc-900 ">Need an invoice?</p>
          {/* <p className="break-all">{ticketUrl}</p> */}
        </div>
      </div>

      {/* ── Footer: footerText + email + Powered by ── */}
      <div className="text-center border-t border-dashed border-zinc-300 pt-3 space-y-1">
        {settings?.footerText && (
          <p className="text-[10px] italic text-zinc-500 leading-relaxed">
            {settings.footerText}
          </p>
        )}
        {settings?.email && (
          <p className="text-[10px] text-zinc-600 font-semibold">{settings.email}</p>
        )}
        <p className="text-[10px] font-bold text-zinc-800 pt-1">Powered by RaadsanTech</p>
      </div>
    </div>
  );
}
