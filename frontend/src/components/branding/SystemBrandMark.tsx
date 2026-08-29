"use client";

import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

type SystemBrandMarkProps = {
  logoUrl?: string | null;
  systemName?: string;
  size?: "sm" | "md";
  /** plain = no box, border, or background — logo only */
  variant?: "boxed" | "plain";
  /** width = fill horizontal space first (good for wide logos in sidebar) */
  fit?: "contain" | "width";
  className?: string;
};

export default function SystemBrandMark({
  logoUrl,
  systemName = "Restaurant",
  size = "md",
  variant = "boxed",
  fit = "contain",
  className,
}: SystemBrandMarkProps) {
  const box =
    size === "sm"
      ? "w-8 h-8 rounded-lg"
      : "h-10 w-10 rounded-lg ml-1 group-data-[collapsible=icon]:ml-0";

  if (variant === "plain") {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={systemName}
          className={cn(
            fit === "width"
              ? "block w-full max-w-full h-auto object-contain object-center"
              : "object-contain",
            className
          )}
        />
      );
    }

    return (
      <UtensilsCrossed
        className={cn(
          "text-primary shrink-0",
          size === "sm" ? "size-8" : "size-10",
          className
        )}
      />
    );
  }

  if (logoUrl) {
    return (
      <div
        className={cn(
          box,
          "shrink-0 overflow-hidden border border-border bg-white dark:bg-[#161616] shadow-sm",
          className
        )}
      >
        <img
          src={logoUrl}
          alt={systemName}
          className="w-full h-full object-contain p-0.5"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        box,
        "shrink-0 flex items-center justify-center bg-primary text-white shadow-lg shadow-primary/20 font-bold",
        size === "md" ? "text-lg" : "text-sm",
        className
      )}
    >
      <UtensilsCrossed className={size === "sm" ? "size-4" : "size-5"} />
    </div>
  );
}
