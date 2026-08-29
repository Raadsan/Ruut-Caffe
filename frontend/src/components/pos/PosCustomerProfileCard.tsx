"use client";

import React from "react";
import { CheckCircle2, User } from "lucide-react";
import { Customer } from "@/lib/api/restaurant/customerApi";
import { cn } from "@/lib/utils";
import PosCustomerPhoneCombobox from "@/components/pos/PosCustomerPhoneCombobox";

function getInitial(name?: string) {
  const n = (name || "G").trim();
  return n.charAt(0).toUpperCase();
}

function DetailRow({
  label,
  children,
  value,
}: {
  label: string;
  children?: React.ReactNode;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="font-semibold text-zinc-700 shrink-0">{label}</span>
      {children ? (
        <div className="flex-1 min-w-0 text-right">{children}</div>
      ) : (
        <span className="text-zinc-500 text-right break-all">{value || "—"}</span>
      )}
    </div>
  );
}

interface PosCustomerProfileCardProps {
  variant?: "full" | "compact";
  customerName: string;
  customerPhone: string;
  selectedCustomer: number | null;
  selectPhoneOptions: Customer[];
  orderTypeLabel: string;
  locationLabel: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPhoneBlur: () => void;
  onSelectCustomer: (customerId: string) => void;
  className?: string;
}

export default function PosCustomerProfileCard({
  variant = "full",
  customerName,
  customerPhone,
  selectedCustomer,
  selectPhoneOptions,
  orderTypeLabel,
  locationLabel,
  onNameChange,
  onPhoneChange,
  onPhoneBlur,
  onSelectCustomer,
  className,
}: PosCustomerProfileCardProps) {
  const displayName = customerName.trim() || "Walk-in Guest";
  const isCompact = variant === "compact";
  const fieldClass =
    "w-full h-11 px-3 bg-white border border-zinc-200 rounded-lg text-sm font-medium text-zinc-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-zinc-400";

  if (!isCompact) {
    return (
      <div className={cn("space-y-4", className)}>
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block">
          Customer info
        </label>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Customer name</label>
          <input
            type="text"
            value={customerName}
            onChange={e => onNameChange(e.target.value)}
            placeholder="e.g. Walk-in guest"
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Phone number</label>
          <PosCustomerPhoneCombobox
            value={customerPhone}
            options={selectPhoneOptions}
            selectedCustomerId={selectedCustomer}
            onValueChange={onPhoneChange}
            onBlur={onPhoneBlur}
            onSelect={onSelectCustomer}
            placeholder="Type number or select customer"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-1 text-sm">
          <div>
            <p className="text-xs text-zinc-400 mb-1">Order type</p>
            <p className="font-medium text-zinc-800">{orderTypeLabel}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-1">Location</p>
            <p className="font-medium text-zinc-800 truncate">{locationLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-100 bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="relative shrink-0">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm">
            {customerName.trim() ? getInitial(customerName) : <User className="size-4" />}
          </div>
          {selectedCustomer && (
            <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center">
              <CheckCircle2 className="size-2.5 text-white" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate">{displayName}</p>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{orderTypeLabel}</p>
        </div>
      </div>
      <div className="border-t border-zinc-100 px-4 py-3 space-y-2">
        <DetailRow label="Phone:" value={customerPhone || "—"} />
        <DetailRow label="Location:" value={locationLabel} />
      </div>
    </div>
  );
}
