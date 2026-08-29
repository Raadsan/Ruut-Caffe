"use client";

import React, { useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Customer } from "@/lib/api/restaurant/customerApi";
import { cn } from "@/lib/utils";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

interface PosCustomerPhoneComboboxProps {
  value: string;
  options: Customer[];
  selectedCustomerId: number | null;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  onSelect: (customerId: string) => void;
  placeholder?: string;
  className?: string;
}

export default function PosCustomerPhoneCombobox({
  value,
  options,
  selectedCustomerId,
  onValueChange,
  onBlur,
  onSelect,
  placeholder = "Type number or select customer",
  className,
}: PosCustomerPhoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = value.trim();
    if (!q) return options;
    const digits = normalizePhone(q);
    const lower = q.toLowerCase();
    return options.filter(c => {
      if (digits && normalizePhone(c.phone).includes(digits)) return true;
      if (c.fullName?.toLowerCase().includes(lower)) return true;
      return c.phone.toLowerCase().includes(lower);
    });
  }, [value, options]);

  const showList = open && filtered.length > 0;

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      onBlur();
    }, 150);
  };

  const handleFocus = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setOpen(true);
  };

  const handleSelect = (customer: Customer) => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    onSelect(String(customer.id));
    setOpen(false);
  };

  const fieldClass =
    "w-full h-11 px-3 pr-9 bg-white border border-zinc-200 rounded-lg text-sm font-medium text-zinc-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-zinc-400";

  return (
    <div className={cn("relative", className)}>
      <input
        type="tel"
        value={value}
        onChange={e => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={fieldClass}
        autoComplete="tel"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
      />
      {selectedCustomerId && (
        <CheckCircle2
          className="absolute right-8 top-1/2 -translate-y-1/2 size-4 text-primary pointer-events-none"
          aria-hidden
        />
      )}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(prev => !prev)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-600"
        aria-label="Show saved customers"
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {showList && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filtered.map(c => (
            <li key={c.id} role="option" aria-selected={selectedCustomerId === c.id}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 transition-colors",
                  selectedCustomerId === c.id && "bg-primary/5 text-primary font-medium"
                )}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(c)}
              >
                <span className="font-medium text-zinc-800">{c.fullName || "Customer"}</span>
                <span className="text-zinc-500"> — {c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
