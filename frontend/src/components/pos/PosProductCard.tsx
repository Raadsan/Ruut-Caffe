"use client";

import { cn } from "@/lib/utils";
import PosMenuItemImage from "@/components/pos/PosMenuItemImage";

type PosProductCardProps = {
  name: string;
  categoryLabel: string;
  imageUrl?: string | null;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  hasDiscount?: boolean;
  outOfStock?: boolean;
  selected?: boolean;
  isComposite?: boolean;
  comboLabel?: string;
  onClick?: () => void;
  children?: React.ReactNode;
};

/** Compact product tile — short image area, price/discount badges, title + stock line. */
export default function PosProductCard({
  name,
  categoryLabel,
  imageUrl,
  price,
  originalPrice,
  discountPercent,
  hasDiscount,
  outOfStock,
  selected,
  isComposite,
  comboLabel,
  onClick,
  children,
}: PosProductCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick?.()}
      className={cn(
        "bg-white rounded-xl overflow-hidden cursor-pointer transition-all border group",
        selected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-zinc-100 shadow-sm hover:shadow-md hover:border-primary/20",
        outOfStock && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="relative h-[108px] bg-zinc-100 overflow-hidden">
        <PosMenuItemImage
          src={imageUrl}
          alt={name}
          className="rounded-none h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-0.5">
          {isComposite && (
            <span className="bg-primary text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase leading-tight shadow-sm">
              Combo
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-0.5">
          <span className="bg-primary text-white px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm tabular-nums leading-tight">
            ${price.toFixed(2)}
          </span>
          {hasDiscount && discountPercent != null && discountPercent > 0 && (
            <span className="bg-secondary text-white px-1.5 py-0.5 rounded-md text-[9px] font-bold shadow-sm leading-tight">
              {discountPercent}%
            </span>
          )}
        </div>
        {outOfStock && (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold uppercase tracking-wider">Out of stock</span>
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <h3 className="text-[11px] font-bold text-zinc-900 uppercase tracking-tight truncate leading-tight">
          {name}
        </h3>
        <p
          className={cn(
            "text-[10px] mt-0.5 truncate",
            outOfStock ? "text-destructive font-medium" : "text-zinc-400"
          )}
        >
          {outOfStock ? "Out of stock" : isComposite && comboLabel ? comboLabel : categoryLabel}
        </p>
        {hasDiscount && originalPrice != null && (
          <p className="text-[9px] text-zinc-400 line-through mt-0.5">${originalPrice.toFixed(2)}</p>
        )}
        {children}
      </div>
    </div>
  );
}
