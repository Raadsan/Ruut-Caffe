"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — pickup history lives on Orders Management → History tab */
export default function WaiterPickupHistoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/orders?tab=history");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh] text-sm text-zinc-500">
      Redirecting to order history…
    </div>
  );
}
