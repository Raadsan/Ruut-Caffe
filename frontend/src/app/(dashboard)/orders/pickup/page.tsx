"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth/authApi";
import WaiterReadyOrdersView from "@/components/orders/WaiterReadyOrdersView";

export default function WaiterPickupPage() {
  const router = useRouter();

  useEffect(() => {
    authApi.getMe().then(user => {
      const role = user.role?.toLowerCase() ?? "";
      const allowed = role === "waiter" || role === "admin" || role === "manager";
      if (!allowed) router.replace("/dashboard");
    });
  }, [router]);

  return <WaiterReadyOrdersView />;
}
