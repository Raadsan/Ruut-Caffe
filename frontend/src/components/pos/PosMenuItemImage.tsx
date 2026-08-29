"use client";

import { useEffect, useMemo, useState } from "react";
import { Utensils } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMenuImageUrl } from "@/lib/branding";

type PosMenuItemImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
};

/** Lazy-loaded menu thumb — skips broken/slow external URLs without blocking POS. */
export default function PosMenuItemImage({
  src,
  alt = "",
  className,
  iconClassName,
}: PosMenuItemImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = useMemo(() => resolveMenuImageUrl(src), [src]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!resolvedSrc || failed) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-muted", className)}>
        <Utensils className={cn("size-5 text-muted-foreground/40", iconClassName)} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
