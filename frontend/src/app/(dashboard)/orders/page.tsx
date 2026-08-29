/* Orders Management Page - Cleaned Version */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Phone,
  AlertCircle,
  PackageOpen,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Clock,
  Loader2,
  Smartphone,
  Wallet,
  Printer,
  Eye,
  Edit,
  Pencil,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { orderApi, Order, OrderStatus } from "@/lib/api/restaurant/orderApi";
import { tableApi, Table as RestaurantTable } from "@/lib/api/restaurant/tableApi";
import { menuItemApi, MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { categoryApi, Category } from "@/lib/api/restaurant/categoryApi";
import { customerApi, Customer } from "@/lib/api/restaurant/customerApi";
import { PaymentMethod } from "@/lib/api/restaurant/paymentApi";
import { receiptSettingsApi, ReceiptSettings } from "@/lib/api/restaurant/receiptSettingsApi";
import { ReceiptBody, ReceiptSnapshot } from "@/components/receipt/ReceiptBody";
import { authApi } from "@/lib/api/auth/authApi";
import api from "@/lib/api/axios";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/context/PermissionContext";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  actionBtnEdit,
  actionBtnDelete,
  btnConfirmDelete,
  btnCreatePage,
  btnCreateSubmit,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { isKitchenPendingStatus } from "@/lib/kitchen-order-utils";
import KitchenOrdersView from "@/components/orders/KitchenOrdersView";
import OrdersHistoryPanel from "@/components/orders/OrdersHistoryPanel";
import { onDebouncedEvent, ORDERS_CHANGED, OrderSocketPayload } from "@/lib/live-updates";

interface CartLine {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

type OrderType = "dine-in" | "takeaway" | "delivery";

const ORDER_TYPES: { id: OrderType; label: string; description: string }[] = [
  { id: "dine-in", label: "Dine-in", description: "Customer eats at a table" },
  { id: "takeaway", label: "Takeaway", description: "Customer picks up the order" },
  { id: "delivery", label: "Delivery", description: "Order delivered to customer" }
];

const formSelectClass =
  "w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium appearance-none cursor-pointer";

const formInputClass =
  "w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium";

type OrderPaymentMethod = Extract<
  PaymentMethod,
  "evc_plus" | "edahab" | "premier_wallet"
>;

const ORDER_PAYMENT_METHODS: {
  id: OrderPaymentMethod;
  name: string;
  icon: typeof Smartphone;
  providerName: string;
}[] = [
  { id: "evc_plus", name: "Merchant", icon: Smartphone, providerName: "Merchant" },
  { id: "edahab", name: "eDahab", icon: Smartphone, providerName: "eDahab" },
  { id: "premier_wallet", name: "Premier Wallet", icon: Wallet, providerName: "Premier Wallet" },
];

function getOrderLocationLabel(
  orderType: OrderType,
  table: RestaurantTable | null,
  deliveryStreet: string,
  deliveryDistrict: string
): string | undefined {
  if (orderType === "dine-in" && table) {
    return `Table ${table.number}`;
  }
  if (orderType === "delivery" && deliveryStreet.trim()) {
    return deliveryDistrict.trim()
      ? `${deliveryStreet.trim()}, ${deliveryDistrict.trim()}`
      : deliveryStreet.trim();
  }
  if (orderType === "takeaway") return "Takeaway";
  return undefined;
}

const LIVE_STATUSES = ["pending", "preparing", "ready"] as const;
const HISTORY_STATUSES = ["paid", "served", "cancelled"] as const;
type OrderViewTab = "pending" | "preparing" | "ready" | "history";
type DatePreset = "today" | "yesterday" | "week" | "last-month" | "custom";
const ORDER_VIEW_TABS: OrderViewTab[] = ["pending", "preparing", "ready", "history"];

function formatDateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().split("T")[0];
}

function getPresetRange(preset: Exclude<DatePreset, "custom">) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === "today") return { startDate: formatDateInput(today), endDate: formatDateInput(today) };
  if (preset === "yesterday") {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return { startDate: formatDateInput(date), endDate: formatDateInput(date) };
  }
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { startDate: formatDateInput(start), endDate: formatDateInput(today) };
  }
  return {
    startDate: formatDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    endDate: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
}

function isLiveStatus(status: OrderStatus) {
  return (LIVE_STATUSES as readonly OrderStatus[]).includes(status);
}

function isHistoryStatus(status: OrderStatus) {
  return (HISTORY_STATUSES as readonly OrderStatus[]).includes(status);
}

function matchesOrderViewTab(status: OrderStatus, tab: OrderViewTab) {
  if (tab === "pending") return isKitchenPendingStatus(status) || status === "held";
  if (tab === "preparing") return status === "preparing";
  if (tab === "ready") return status === "ready";
  return isHistoryStatus(status);
}

const VIEW_TAB_CONFIG: Record<
  OrderViewTab,
  { label: string; sectionTitle: string; emptyTitle: string; emptyHint: string }
> = {
  pending: {
    label: "Pending",
    sectionTitle: "Pending Orders",
    emptyTitle: "No pending orders",
    emptyHint: "New orders will appear here.",
  },
  preparing: {
    label: "Preparing",
    sectionTitle: "Preparing Orders",
    emptyTitle: "Nothing preparing",
    emptyHint: "Orders being prepared will show here.",
  },
  ready: {
    label: "Ready",
    sectionTitle: "Ready Orders",
    emptyTitle: "No orders ready",
    emptyHint: "Orders marked ready will appear here.",
  },
  history: {
    label: "History",
    sectionTitle: "Past Orders",
    emptyTitle: "No past orders",
    emptyHint: "Completed and cancelled orders appear here.",
  },
};

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; badge: string }
> = {
  pending: { label: "Pending", bg: "bg-orange-100", text: "text-orange-700", badge: "bg-amber-500" },
  preparing: { label: "Preparing", bg: "bg-blue-100", text: "text-blue-700", badge: "bg-blue-500" },
  ready: { label: "Ready", bg: "bg-green-100", text: "text-green-700", badge: "bg-emerald-500" },
  paid: { label: "Paid", bg: "bg-emerald-100", text: "text-emerald-700", badge: "bg-emerald-600" },
  served: { label: "Served", bg: "bg-zinc-100", text: "text-zinc-700", badge: "bg-zinc-500" },
  cancelled: { label: "Cancelled", bg: "bg-rose-100", text: "text-rose-700", badge: "bg-rose-500" },
  held: { label: "Held", bg: "bg-zinc-100", text: "text-zinc-600", badge: "bg-zinc-400" },
  completed: { label: "Completed", bg: "bg-emerald-100", text: "text-emerald-700", badge: "bg-emerald-600" },
};

function getCustomerInitial(name?: string) {
  const n = (name || "Guest").trim();
  return n.charAt(0).toUpperCase();
}

function CustomerAvatar({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const isGuest = !name?.trim();
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/10 shrink-0",
        className
      )}
    >
      {isGuest ? (
        <User className="size-[45%]" strokeWidth={2} />
      ) : (
        getCustomerInitial(name)
      )}
    </div>
  );
}

function formatTimeAgo(dateStr?: string) {
  if (!dateStr) return "Just now";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getOrderTypeLabel(order: Order) {
  const type = order.orderType || (order.table ? "dine-in" : "takeaway");
  if (type === "dine-in") return "Dine-in";
  if (type === "delivery") return "Delivery";
  return "Takeaway";
}

function isTableSelectable(table: RestaurantTable) {
  return table.status !== "inactive";
}

function getOrderLocation(order: Order): string | null {
  const type = order.orderType || (order.table ? "dine-in" : "takeaway");
  if (type === "dine-in" && order.table) {
    return `Table ${order.table.number}`;
  }
  if (type === "delivery" && order.address) {
    const parts = [order.address.street, order.address.district].filter(Boolean);
    return parts.join(", ") || order.address.name;
  }
  return null;
}

export default function AllOrdersPage() {
  const { showToast } = useToast();
  const { isAdmin, canAdd: checkAdd, canEdit: checkEdit, canDelete: checkDelete } = usePermissions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewTab, setViewTab] = useState<OrderViewTab>("pending");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dateRange, setDateRange] = useState(() => getPresetRange("today"));
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [userRole, setUserRole] = useState("");

  // modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState<OrderStatus>("pending");
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("evc_plus");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptSnapshot | null>(null);

  // create form state
  const [orderType, setOrderType] = useState<OrderType>("dine-in");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [formTableId, setFormTableId] = useState<number | "">("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "">("");
  const [formNotes, setFormNotes] = useState("");
  const [cartItems, setCartItems] = useState<CartLine[]>([]);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const isWaiter = userRole === "waiter";
  const isKitchen = userRole === "kitchen";
  const canCreateOrder =
    !isWaiter && (isAdmin || userRole === "manager" || checkAdd("/orders"));

  const canEditOrder =
    isAdmin || userRole === "manager" || checkEdit("/orders");

  const canDeleteOrder =
    isAdmin ||
    userRole === "manager" ||
    userRole === "waiter" ||
    checkDelete("/orders");

  const orderRangeParams = useMemo(() => ({
    startDate: new Date(`${dateRange.startDate}T00:00:00`).toISOString(),
    endDate: new Date(`${dateRange.endDate}T23:59:59.999`).toISOString(),
  }), [dateRange]);

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") setDateRange(getPresetRange(preset));
  };

  // fetch data
  const fetchOrders = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await orderApi.getAllOrders({ limit: 200, ...orderRangeParams }, forceRefresh);
      setOrders(data || []);
    } catch (err) {
      console.error("Failed to fetch orders", err);
      showToast("Error loading orders", "error");
    } finally {
      setLoading(false);
    }
  }, [orderRangeParams, showToast]);

  const fetchHistoryOrders = useCallback(async (force = false) => {
    if (userRole !== "waiter") return;
    setHistoryLoading(true);
    try {
      const data = await orderApi.getAllOrders({ waiterHistory: true, limit: 200, ...orderRangeParams }, force);
      setHistoryOrders(data || []);
    } catch (err) {
      console.error("Failed to fetch pickup history", err);
      showToast("Error loading pickup history", "error");
    } finally {
      setHistoryLoading(false);
    }
  }, [orderRangeParams, showToast, userRole]);

  const fetchTables = async () => {
    try {
      const data = await tableApi.getAllTables();
      setTables(data || []);
    } catch (err) {
      console.error("Failed to fetch tables", err);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const data = await menuItemApi.getAllMenuItems();
      setMenuItems((data || []).filter(item => item.isAvailable && item.isSellable !== false));
    } catch (err) {
      console.error("Failed to fetch menu items", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getAllCategories();
      setCategories(data || []);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const data = await customerApi.getAllCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error("Failed to fetch customers", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "live") {
      setViewTab("pending");
      return;
    }
    if (tab && ORDER_VIEW_TABS.includes(tab as OrderViewTab)) {
      setViewTab(tab as OrderViewTab);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchTables();
    fetchMenuItems();
    fetchCategories();
    fetchCustomers();
    receiptSettingsApi.getSettings().then(setReceiptSettings).catch(() => {});
    authApi.getMe().then(user => setUserRole(user.role?.toLowerCase() ?? ""));

    const removeOrdersListener = onDebouncedEvent<OrderSocketPayload>(ORDERS_CHANGED, (detail) => {
      fetchOrders(true);
      if (detail?.status === "served" || detail?.action === "update") {
        fetchHistoryOrders(true);
      }
    }, 300);

    return () => removeOrdersListener();
  }, [fetchOrders, fetchHistoryOrders]);

  useEffect(() => {
    if (viewTab === "history" && userRole === "waiter") {
      fetchHistoryOrders(false);
    }
  }, [viewTab, userRole, fetchHistoryOrders]);

  const historySource = useMemo(() => {
    if (isWaiter) return historyOrders;
    return orders.filter(o => isHistoryStatus(o.status));
  }, [isWaiter, historyOrders, orders]);

  const resetCreateForm = () => {
    setOrderType("dine-in");
    setSelectedCustomerId("");
    setGuestName("");
    setGuestPhone("");
    setFormTableId("");
    setDeliveryStreet("");
    setDeliveryDistrict("");
    setSelectedCategoryId("");
    setFormNotes("");
    setCartItems([]);
    setIsPaymentOpen(false);
    setPaymentMethod("evc_plus");
    setPaymentPhone("");
    setFormMode("create");
    setEditingOrderId(null);
    setEditStatus("pending");
  };

  const populateFormFromOrder = (order: Order) => {
    const type = (order.orderType || (order.table ? "dine-in" : "takeaway")) as OrderType;
    setOrderType(type);
    setEditStatus(order.status);

    const matchedCustomer = customers.find(
      c => c.phone === order.customerPhone || c.fullName === order.customerName
    );
    if (matchedCustomer) {
      setSelectedCustomerId(matchedCustomer.id);
      setGuestName("");
      setGuestPhone("");
    } else {
      setSelectedCustomerId("");
      setGuestName(order.customerName || "");
      setGuestPhone(order.customerPhone || "");
    }

    setFormTableId(order.tableId ?? order.table?.id ?? "");

    if (order.address) {
      setDeliveryStreet(order.address.street || "");
      setDeliveryDistrict(order.address.district || "");
    } else {
      setDeliveryStreet("");
      setDeliveryDistrict("");
    }

    setFormNotes(order.notes || "");
    setCartItems(
      (order.orderitem || []).map(item => ({
        menuItemId: item.menuItemId,
        name: item.menuitem?.name || `Item #${item.menuItemId}`,
        price: item.unitPrice,
        quantity: item.quantity,
      }))
    );
    setSelectedCategoryId("");
  };

  const selectableTables = useMemo(
    () =>
      tables
        .filter(t => isTableSelectable(t))
        .sort((a, b) => a.number - b.number),
    [tables]
  );

  const selectedTable = useMemo(
    () => tables.find(t => t.id === formTableId) ?? null,
    [tables, formTableId]
  );

  const activeCategories = useMemo(
    () => categories.filter(c => c.isActive !== false),
    [categories]
  );

  const categoryMenuItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    return menuItems.filter(item => item.categoryId === selectedCategoryId);
  }, [menuItems, selectedCategoryId]);

  const selectedCategory = useMemo(
    () => activeCategories.find(c => c.id === selectedCategoryId) ?? null,
    [activeCategories, selectedCategoryId]
  );

  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    setFormTableId("");
    setDeliveryStreet("");
    setDeliveryDistrict("");
  };

  const handleCustomerSelect = (value: string) => {
    if (!value) {
      setSelectedCustomerId("");
      return;
    }
    setSelectedCustomerId(Number(value));
    setGuestName("");
    setGuestPhone("");
  };

  const openCreateModal = () => {
    resetCreateForm();
    setFormMode("create");
    setIsAddOpen(true);
  };

  const openEditModal = (order: Order) => {
    resetCreateForm();
    setFormMode("edit");
    setEditingOrderId(order.id);
    populateFormFromOrder(order);
    setIsAddOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrderId || !validateCreateForm()) return;

    try {
      setSaving(true);
      const customerName = selectedCustomer
        ? selectedCustomer.fullName
        : guestName.trim();
      const customerPhone = selectedCustomer?.phone || guestPhone.trim();

      await orderApi.updateOrder(editingOrderId, {
        tableId: orderType === "dine-in" ? Number(formTableId) : undefined,
        type: orderType,
        customerName,
        customerPhone,
        notes: formNotes.trim() || undefined,
        items: cartItems.map(line => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
        })),
      });

      if (editStatus) {
        await orderApi.updateStatus(editingOrderId, editStatus);
      }

      showToast("Order updated successfully", "success");
      setIsAddOpen(false);
      resetCreateForm();
      fetchOrders();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update order";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCartItems(prev => {
      const existing = prev.find(line => line.menuItemId === item.id);
      if (existing) {
        return prev.map(line =>
          line.menuItemId === item.id
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }
      ];
    });
  };

  const updateCartQuantity = (menuItemId: number, delta: number) => {
    setCartItems(prev =>
      prev
        .map(line =>
          line.menuItemId === menuItemId
            ? { ...line, quantity: line.quantity + delta }
            : line
        )
        .filter(line => line.quantity > 0)
    );
  };

  const removeFromCart = (menuItemId: number) => {
    setCartItems(prev => prev.filter(line => line.menuItemId !== menuItemId));
  };

  const orderSubtotal = cartItems.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0
  );

  const orderTax = useMemo(() => {
    return cartItems.reduce((sum, line) => {
      const item = menuItems.find(m => m.id === line.menuItemId);
      const taxRate = item?.tax ?? 0;
      return sum + line.price * line.quantity * (taxRate / 100);
    }, 0);
  }, [cartItems, menuItems]);

  const orderGrandTotal = orderSubtotal + orderTax;

  const selectedPaymentMethod = ORDER_PAYMENT_METHODS.find(m => m.id === paymentMethod)!;

  const validateCreateForm = (): boolean => {
    if (cartItems.length === 0) {
      showToast("Add at least one menu item", "error");
      return false;
    }
    if (orderType === "dine-in") {
      if (!formTableId) {
        showToast("Please select a table", "error");
        return false;
      }
    }
    if (orderType === "delivery") {
      if (!selectedCustomer) {
        showToast("Select a client for delivery orders", "error");
        return false;
      }
      if (!deliveryStreet.trim()) {
        showToast("Enter delivery street address", "error");
        return false;
      }
    }
    if (!selectedCustomer) {
      if (!guestName.trim()) {
        showToast("Enter guest full name", "error");
        return false;
      }
      if (!guestPhone.trim()) {
        showToast("Enter guest phone number", "error");
        return false;
      }
    }
    return true;
  };

  const handleOpenPayment = () => {
    if (!validateCreateForm()) return;
    setPaymentPhone(selectedCustomer?.phone || guestPhone.trim());
    setPaymentMethod("evc_plus");
    setIsPaymentOpen(true);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleConfirmPayment = async () => {
    const payPhone = paymentPhone.trim();
    if (paymentMethod === "premier_wallet" && !payPhone) {
      showToast("Enter the mobile number for Premier Wallet payment", "error");
      return;
    }

    const locationLabel = getOrderLocationLabel(
      orderType,
      selectedTable,
      deliveryStreet,
      deliveryDistrict
    );
    const orderTypeLabel = ORDER_TYPES.find(t => t.id === orderType)?.label || orderType;

    try {
      setCreating(true);
      const customerName = selectedCustomer
        ? selectedCustomer.fullName
        : guestName.trim();
      const customerPhone = selectedCustomer?.phone || guestPhone.trim();

      let addressId: number | undefined;
      if (orderType === "delivery" && selectedCustomer) {
        const addrRes = await api.post("/addresses", {
          customerId: selectedCustomer.id,
          name: "Delivery",
          district: deliveryDistrict.trim() || "N/A",
          street: deliveryStreet.trim(),
          phone: selectedCustomer.phone,
          isDefault: false
        });
        addressId = addrRes.data.data?.id;
      }

      const order = await orderApi.posCheckout({
        tableId: orderType === "dine-in" ? Number(formTableId) : undefined,
        addressId,
        type: orderType,
        customerName,
        customerPhone,
        notes: formNotes.trim() || undefined,
        items: cartItems.map(line => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity
        })),
        paymentMethod,
        ...(payPhone ? { paymentPhone: payPhone } : {}),
        providerName: selectedPaymentMethod.providerName,
        source: "dashboard",
      });

      setReceiptData({
        orderId: order.id,
        customerName: customerName || "Guest",
        customerPhone: customerPhone || payPhone || undefined,
        paymentMethod: selectedPaymentMethod.providerName,
        orderTypeLabel,
        locationLabel,
        items: cartItems.map(line => ({ ...line })),
        subtotal: order.subTotal ?? orderSubtotal,
        tax: order.taxAmount ?? orderTax,
        total: order.total,
        createdAt: new Date().toISOString(),
      });

      showToast("Payment successful — receipt is ready", "success");
      setIsPaymentOpen(false);
      setIsAddOpen(false);
      resetCreateForm();
      setIsReceiptOpen(true);
      void fetchOrders(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create order or process payment";
      showToast(message, "error");
    } finally {
      setCreating(false);
    }
  };

  const isActiveOrdersTab = viewTab !== "history";

  // search / tab filter
  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchesTab = matchesOrderViewTab(o.status, viewTab);
      const matchesSearch =
        search === "" ||
        String(o.id).includes(search) ||
        (o.customerName ?? "").toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [orders, viewTab, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, viewTab, dateRange]);

  const openViewModal = (order: Order) => {
    setSelectedOrder(order);
    setIsViewOpen(true);
  };

  const openDeleteModal = (order: Order) => {
    setSelectedOrder(order);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedOrder) return;
    try {
      await orderApi.deleteOrder(selectedOrder.id);
      showToast("Order deleted", "success");
      fetchOrders();
      fetchHistoryOrders(true);
      setIsDeleteOpen(false);
    } catch (err) {
      showToast("Failed to delete order", "error");
    }
  };

  const totalPages = Math.ceil(filtered.length / pageSize);

  const OrderCard = ({ order }: { order: Order }) => {
    const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
    const itemTags = (order.orderitem || []).map(
      i => i.menuitem?.name || `Item #${i.menuItemId}`
    );
    const itemCount = (order.orderitem || []).reduce((s, i) => s + i.quantity, 0);
    const typeLabel = getOrderTypeLabel(order);
    const location = getOrderLocation(order);

    return (
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-[0_4px_20px_rgba(15,23,42,0.06)] p-5 flex flex-col h-full hover:shadow-[0_8px_28px_rgba(15,23,42,0.09)] transition-all duration-200">
        <div className="flex gap-3.5">
          <div className="shrink-0 flex flex-col items-center gap-2">
            <CustomerAvatar name={order.customerName} className="size-[52px] text-lg" />
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap",
                cfg.bg,
                cfg.text
              )}
            >
              {cfg.label}
            </span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[13px] text-zinc-500 font-medium">
              Order #{order.id} · {typeLabel}
            </p>
            <h3 className="font-bold text-[#1e293b] text-[15px] leading-tight truncate mt-1">
              {order.customerName || "Walk-in Guest"}
            </h3>
            {order.customerPhone && (
              <p className="text-[13px] text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
                <Phone className="size-3 text-zinc-400 shrink-0" />
                {order.customerPhone}
              </p>
            )}
          </div>
        </div>

        {location && (
          <div className="mt-3 flex items-center gap-1.5 text-[13px] text-zinc-600">
            <MapPin className="size-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
          <span>
            <span className="font-semibold text-zinc-700">{itemCount}</span> items
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3 text-zinc-400" />
            <span className="font-semibold text-zinc-700">{formatTimeAgo(order.createdAt)}</span>
          </span>
        </div>

        {/* Menu item tags */}
        {itemTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {itemTags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-medium truncate max-w-[120px]"
              >
                {tag}
              </span>
            ))}
            {itemTags.length > 3 && (
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-semibold">
                +{itemTags.length - 3}
              </span>
            )}
          </div>
        )}

        {order.notes && (
          <p className="mt-2 text-[11px] text-zinc-400 italic line-clamp-1" title={order.notes}>
            Note: {order.notes}
          </p>
        )}

        {/* Footer: total + action */}
        <div className="mt-4 pt-4 border-t border-zinc-50 flex items-end justify-between gap-3">
          <div>
            <p className="text-[22px] font-bold text-[#1e293b] leading-none">
              ${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wide">
              {order.subTotal != null ? `Sub $${order.subTotal.toFixed(2)}` : typeLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={() => openViewModal(order)}
              className={cn(btnCreatePage, "h-9 px-4 text-xs")}
              title="View order"
            >
              <Eye className="size-4" />
              View
            </Button>
            {isActiveOrdersTab && canEditOrder && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openEditModal(order)}
                className={actionBtnEdit}
                title="Edit order"
              >
                <Edit className="size-4" />
              </Button>
            )}
            {canDeleteOrder && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => openDeleteModal(order)}
                className={actionBtnDelete}
                title="Delete order"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // stats for tab buttons
  const stats = useMemo(() => {
    const tabCounts = ORDER_VIEW_TABS.reduce(
      (acc, tab) => {
        if (tab === "history") {
          acc[tab] = isWaiter
            ? historyOrders.length
            : orders.filter(o => isHistoryStatus(o.status)).length;
        } else {
          acc[tab] = orders.filter(o => matchesOrderViewTab(o.status, tab)).length;
        }
        return acc;
      },
      {} as Record<OrderViewTab, number>
    );
    const todayRevenue = orders
      .filter(o => o.status === "paid" || o.status === "served")
      .reduce((sum, o) => sum + o.total, 0);
    return { tabCounts, todayRevenue };
  }, [orders, historyOrders, isWaiter]);

  if (isKitchen) {
    return (
      <KitchenOrdersView
        orders={orders}
        loading={loading}
        menuItems={menuItems}
        onRefresh={fetchOrders}
      />
    );
  }


  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      {/* Header */}
      <div className={cn(pageHeaderWrapperClass, "flex flex-col md:flex-row md:items-center justify-between gap-4")}>
        <div>
          <h1 className={pageHeaderTitleClass}>Orders Management</h1>
        </div>
        <div className="flex items-center gap-3">
          {isActiveOrdersTab && (
          <div className="relative w-80 group">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search ID or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600"
            />
          </div>
          )}
          {isActiveOrdersTab && canCreateOrder && (
            <Button onClick={openCreateModal} className={btnCreatePage}>
              <Plus className="size-4" />
              Create Order
            </Button>
          )}
        </div>
      </div>

      {/* Tabs and date filters */}
      <div className="px-4 mb-2 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {ORDER_VIEW_TABS.map(tab => (
            <Button
              key={tab}
              variant={viewTab === tab ? "default" : "outline"}
              onClick={() => setViewTab(tab)}
              className="rounded-full h-10 px-5"
            >
              {VIEW_TAB_CONFIG[tab].label} ({stats.tabCounts[tab]})
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm xl:ml-auto">
          <div className="flex items-center gap-1 rounded-lg bg-zinc-50 p-1 overflow-x-auto max-w-full">
            {([['today', 'Today'], ['yesterday', 'Yesterday'], ['week', '1 Week'], ['last-month', 'Last Month'], ['custom', 'Custom']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyDatePreset(value)}
                className={cn("h-8 px-3 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors", datePreset === value ? "bg-primary text-white shadow-sm" : "text-zinc-500 hover:bg-white hover:text-primary")}
              >
                {label}
              </button>
            ))}
          </div>
          {datePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-2 px-2">
              <Calendar className="size-3.5 text-zinc-400" />
              <input aria-label="Start date" type="date" value={dateRange.startDate} max={dateRange.endDate} onChange={event => setDateRange(previous => ({ ...previous, startDate: event.target.value }))} className="bg-transparent text-xs font-semibold text-zinc-700 outline-none" />
              <span className="text-xs text-zinc-400">to</span>
              <input aria-label="End date" type="date" value={dateRange.endDate} min={dateRange.startDate} onChange={event => setDateRange(previous => ({ ...previous, endDate: event.target.value }))} className="bg-transparent text-xs font-semibold text-zinc-700 outline-none" />
            </div>
          )}
          <Button type="button" onClick={() => { fetchOrders(true); if (viewTab === "history" && isWaiter) fetchHistoryOrders(true); }} disabled={loading || historyLoading} className="h-9 gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold !text-white hover:bg-primary/90">
            <RefreshCw className={cn("size-3.5", (loading || historyLoading) && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Live cards or History table */}
      {viewTab === "history" ? (
        <OrdersHistoryPanel
          orders={historySource}
          loading={isWaiter ? historyLoading : loading}
          onView={openViewModal}
          onDelete={openDeleteModal}
          canDelete={canDeleteOrder}
          title={isWaiter ? "Pickup History" : "Past Orders"}
        />
      ) : (
      <div className="px-4 pt-0 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-[#1e293b]">{VIEW_TAB_CONFIG[viewTab].sectionTitle}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-xs font-semibold">
              {filtered.length}
            </span>
          </div>
          {totalPages > 1 && (
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 text-[13px] font-medium text-zinc-500 hover:text-primary disabled:opacity-40 transition-colors"
            >
              See more
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[280px] bg-zinc-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-zinc-500 bg-white rounded-2xl border border-zinc-100">
            <PackageOpen className="size-14 text-zinc-200" />
            <p className="mt-4 text-sm font-semibold text-zinc-600">{VIEW_TAB_CONFIG[viewTab].emptyTitle}</p>
            <p className="text-xs text-zinc-400 mt-1">{VIEW_TAB_CONFIG[viewTab].emptyHint}</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginated.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
      )}

      {/* Pagination — live tab only */}
      {isActiveOrdersTab && (
      <div className="flex items-center justify-between px-4 py-3 mt-2 text-xs text-zinc-400">
        <div>
          {filtered.length === 0
            ? "0 orders"
            : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            &lt;
          </button>
          <div className="px-3 py-1 border border-zinc-200 rounded-md text-zinc-400">
            {currentPage} of {totalPages || 1}
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            &gt;
          </button>
        </div>
      </div>
      )}

      {/* View Order Modal */}
      <Dialog open={isViewOpen} onOpenChange={open => { if (!open) setIsViewOpen(false); }}>
        <DialogContent className="sm:max-w-[540px] bg-white border-zinc-100 p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Order Details</DialogTitle>
          {selectedOrder && (
            <div className="p-6">
              <div className="flex justify-between items-start gap-4 mb-5">
                <div className="flex items-center gap-4 min-w-0">
                  <CustomerAvatar
                    name={selectedOrder.customerName}
                    className="size-16 text-2xl"
                  />
                  <h3 className="text-xl font-bold text-[#1E293B]">
                    Order #{selectedOrder.id}
                  </h3>
                </div>
                <span
                  className={cn(
                    "px-3 py-1 rounded-md text-[12px] font-black uppercase tracking-widest shrink-0",
                    STATUS_CONFIG[selectedOrder.status]?.bg ?? "bg-zinc-100",
                    STATUS_CONFIG[selectedOrder.status]?.text ?? "text-zinc-600"
                  )}
                >
                  {selectedOrder.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-zinc-400 font-black tracking-widest text-[10px] uppercase mb-1">Customer</p>
                  <p className="font-bold text-zinc-800 truncate">
                    {selectedOrder.customerName || "Guest"}
                  </p>
                  {selectedOrder.customerPhone && (
                    <p className="text-zinc-400 text-xs">{selectedOrder.customerPhone}</p>
                  )}
                </div>
                <div>
                  <p className="text-zinc-400 font-black tracking-widest text-[10px] uppercase mb-1">Location</p>
                  <p className="font-bold text-zinc-800">
                    {getOrderLocation(selectedOrder) ?? getOrderTypeLabel(selectedOrder)}
                  </p>
                  {getOrderLocation(selectedOrder) && (
                    <p className="text-zinc-400 text-xs">{getOrderTypeLabel(selectedOrder)}</p>
                  )}
                </div>
                <div>
                  <p className="text-zinc-400 font-black tracking-widest text-[10px] uppercase mb-1">Created by</p>
                  <p className="font-bold text-zinc-800 truncate">
                    {selectedOrder.user?.fullName || "System"}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
                    {selectedOrder.user?.role?.name || "Staff"}
                  </span>
                </div>
                <div>
                  <p className="text-zinc-400 font-black tracking-widest text-[10px] uppercase mb-1">Created at</p>
                  <p className="font-bold text-zinc-800">
                    {selectedOrder.createdAt
                      ? new Date(selectedOrder.createdAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
              {(selectedOrder.orderitem?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-100">
                  <p className="text-zinc-400 font-black tracking-widest text-[10px] uppercase mb-2">Items</p>
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedOrder.orderitem.map(item => (
                      <li key={item.id} className="flex justify-between text-sm">
                        <span className="text-zinc-700">
                          {item.quantity}x {item.menuitem?.name || `Item #${item.menuItemId}`}
                        </span>
                        <span className="font-semibold text-zinc-800">
                          ${(item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-4 border-t border-zinc-100 flex justify-between items-center mt-4">
                <span className="text-sm font-black text-zinc-400 uppercase tracking-widest">Total Amount</span>
                <span className="text-2xl font-black text-primary">
                  ${selectedOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <DialogFooter className="mt-6 gap-2 sm:gap-3 flex-wrap">
                {canEditOrder && isLiveStatus(selectedOrder.status) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsViewOpen(false);
                      openEditModal(selectedOrder);
                    }}
                    className={cn(actionBtnEdit, "h-10 w-10")}
                    title="Edit order"
                  >
                    <Edit className="size-4" />
                  </Button>
                )}
                {canDeleteOrder && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsViewOpen(false);
                      openDeleteModal(selectedOrder);
                    }}
                    className={cn(actionBtnDelete, "h-10 w-10")}
                    title="Delete order"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsViewOpen(false)}
                  className="rounded-xl font-bold text-sm flex-1 sm:flex-none sm:ml-auto px-6 h-11"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={open => { if (!open) setIsDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Delete Confirmation</DialogTitle>
          <div className="p-8 flex items-start gap-6">
            <div className="w-14 h-14 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <Trash2 className="size-7 text-rose-600" />
            </div>
            <div className="pt-1">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Delete Order?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to delete order #{selectedOrder?.id}? This action cannot be undone.
              </p>
            </div>
          </div>
          <DialogFooter className="px-8 py-5 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="rounded-xl font-bold border-zinc-200 px-6 h-11 text-[11px] uppercase tracking-widest hover:bg-white"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className={btnConfirmDelete}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Yes, Delete Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Order Modal */}
      <Dialog
        open={isAddOpen}
        onOpenChange={open => {
          if (!open) {
            setIsAddOpen(false);
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[820px] bg-white border-zinc-100 p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogTitle className="sr-only">
            {formMode === "edit" ? "Edit Order" : "Create New Order"}
          </DialogTitle>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (formMode === "edit") {
                handleUpdateOrder();
              } else {
                handleOpenPayment();
              }
            }}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="p-6 border-b border-zinc-100 shrink-0">
              <DialogTitle className="text-xl font-bold text-[#1e293b]">
                {formMode === "edit" ? "Edit Order" : "Create New Order"}
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 mt-1">
                {formMode === "edit"
                  ? "Update order details, items, and status."
                  : "Fill in all details below and add menu items — one form, no steps."}
              </DialogDescription>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Order type + customer */}
              <section className="space-y-4">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Order & Customer</h3>

                {formMode === "edit" && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1E293B]">Order Status</label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value as OrderStatus)}
                      className={formSelectClass}
                    >
                      <option value="pending">Pending</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="served">Served</option>
                      <option value="paid">Paid</option>
                      <option value="held">Held</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1E293B]">Order Type *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {ORDER_TYPES.map(type => {
                      const Icon = type.id === "dine-in" ? UtensilsCrossed : type.id === "takeaway" ? ShoppingBag : Truck;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => handleOrderTypeChange(type.id)}
                          className={cn(
                            "p-3 rounded-xl border-2 text-left transition-all",
                            orderType === type.id
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-zinc-200 hover:border-primary/30"
                          )}
                        >
                          <Icon className={cn("size-4 mb-1.5", orderType === type.id ? "text-primary" : "text-zinc-400")} />
                          <p className="text-sm font-bold text-zinc-800">{type.label}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{type.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1E293B]">Client</label>
                  <div className="relative">
                    <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10" />
                    <select
                      value={selectedCustomerId}
                      onChange={e => handleCustomerSelect(e.target.value)}
                      className={cn(formSelectClass, "pl-10")}
                    >
                      <option value="">Walk-in guest (no registered client)</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!selectedCustomer && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#1E293B]">Full Name *</label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Guest full name"
                        className={formInputClass}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#1E293B]">Phone *</label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={e => setGuestPhone(e.target.value)}
                        placeholder="e.g. 61XXXXXXX"
                        className={formInputClass}
                        required
                      />
                    </div>
                  </div>
                )}

                {selectedCustomer && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-2">Selected client</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Name</p>
                        <p className="font-bold text-zinc-800">{selectedCustomer.fullName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-zinc-400">Phone</p>
                        <p className="font-bold text-zinc-800">{selectedCustomer.phone}</p>
                      </div>
                      {selectedCustomer.email && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-zinc-400">Email</p>
                          <p className="font-bold text-zinc-800 truncate">{selectedCustomer.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Location */}
              <section className="space-y-4 pt-2 border-t border-zinc-100">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Location</h3>

                {orderType === "dine-in" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#1E293B]">Table *</label>
                      <select
                        value={formTableId}
                        onChange={e => setFormTableId(e.target.value ? Number(e.target.value) : "")}
                        className={formSelectClass}
                        required
                      >
                        <option value="">Select a table</option>
                        {selectableTables.map(table => (
                          <option key={table.id} value={table.id}>
                            {table.name || `Table ${table.number}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedTable && (
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm">
                        <p className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Table details</p>
                        <p className="font-semibold text-zinc-800">
                          Table {selectedTable.number}
                          {selectedTable.name ? ` (${selectedTable.name})` : ""}
                        </p>
                        {selectedTable.description && (
                          <p className="text-zinc-500 text-xs mt-1">{selectedTable.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {orderType === "takeaway" && (
                  <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50 flex items-center gap-3">
                    <ShoppingBag className="size-8 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Takeaway</p>
                      <p className="text-xs text-emerald-600">No table required — customer picks up the order.</p>
                    </div>
                  </div>
                )}

                {orderType === "delivery" && (
                  <div className="space-y-4">
                    {!selectedCustomer ? (
                      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
                        <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">Select a registered client above — delivery requires a customer on file.</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-[#1E293B]">Delivery Street *</label>
                            <input
                              type="text"
                              value={deliveryStreet}
                              onChange={e => setDeliveryStreet(e.target.value)}
                              placeholder="Street address"
                              className={formInputClass}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-[#1E293B]">District / Area</label>
                            <input
                              type="text"
                              value={deliveryDistrict}
                              onChange={e => setDeliveryDistrict(e.target.value)}
                              placeholder="e.g. Hodan, Waberi"
                              className={formInputClass}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* Menu items */}
              <section className="space-y-4 pt-2 border-t border-zinc-100">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Menu Items</h3>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1E293B]">Category *</label>
                  <select
                    value={selectedCategoryId}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedCategoryId(val ? Number(val) : "");
                    }}
                    className={formSelectClass}
                  >
                    <option value="">Select a category</option>
                    {activeCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {selectedCategory?.description && (
                    <p className="text-xs text-zinc-500 px-1">{selectedCategory.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto border border-zinc-100 rounded-lg p-2">
                  {!selectedCategoryId ? (
                    <p className="col-span-full text-center text-xs text-zinc-400 py-6">Select a category to browse items</p>
                  ) : categoryMenuItems.length === 0 ? (
                    <p className="col-span-full text-center text-xs text-zinc-400 py-6">No available items in this category</p>
                  ) : (
                    categoryMenuItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addToCart(item)}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-zinc-100 hover:border-primary/30 hover:bg-primary/5 text-left transition-colors"
                      >
                        <span className="text-sm font-medium text-zinc-800 truncate">{item.name}</span>
                        <span className="text-xs font-bold text-primary shrink-0">${item.price.toFixed(2)}</span>
                      </button>
                    ))
                  )}
                </div>

                {cartItems.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1E293B]">Order Summary</label>
                    <div className="border border-zinc-100 rounded-lg divide-y divide-zinc-50">
                      {cartItems.map(line => (
                        <div key={line.menuItemId} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-800 truncate">{line.name}</p>
                            <p className="text-xs text-zinc-400">${line.price.toFixed(2)} each</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => updateCartQuantity(line.menuItemId, -1)} className="size-7 rounded-md border border-zinc-200 flex items-center justify-center hover:bg-zinc-50">
                              <Minus className="size-3.5" />
                            </button>
                            <span className="text-sm font-bold w-6 text-center">{line.quantity}</span>
                            <button type="button" onClick={() => updateCartQuantity(line.menuItemId, 1)} className="size-7 rounded-md border border-zinc-200 flex items-center justify-center hover:bg-zinc-50">
                              <Plus className="size-3.5" />
                            </button>
                            <button type="button" onClick={() => removeFromCart(line.menuItemId)} className="size-7 rounded-md text-rose-500 hover:bg-rose-50 flex items-center justify-center">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-zinc-800 w-16 text-right shrink-0">
                            ${(line.price * line.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-sm font-bold text-zinc-500">Subtotal</span>
                      <span className="text-lg font-black text-primary">${orderSubtotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Notes */}
              <section className="space-y-2 pt-2 border-t border-zinc-100">
                <label className="text-sm font-bold text-[#1E293B]">Comments (optional)</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Special instructions, allergies, etc."
                  rows={2}
                  className={cn(formInputClass, "resize-none")}
                />
              </section>
            </div>

            <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false);
                  resetCreateForm();
                }}
                className="rounded-lg font-bold px-6 h-11"
                disabled={creating || saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || saving}
                className={cn(btnCreateSubmit, "px-8 h-11 gap-2")}
              >
                {formMode === "edit" ? (
                  saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Save Changes
                    </>
                  )
                ) : creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Wallet className="size-4" />
                    Proceed to Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog
        open={isPaymentOpen}
        onOpenChange={open => {
          if (!open && !creating) setIsPaymentOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Payment</DialogTitle>
          <div className="p-6 border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Payment</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Choose how the customer pays before the order is sent to the kitchen.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Amount to pay</p>
                <p className="text-2xl font-black text-primary mt-1">${orderGrandTotal.toFixed(2)}</p>
                {orderTax > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">Includes ${orderTax.toFixed(2)} tax</p>
                )}
              </div>
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="size-6 text-primary" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-[#1E293B]">Payment method *</label>
              <div className="grid grid-cols-3 gap-2">
                {ORDER_PAYMENT_METHODS.map(method => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 h-20 rounded-xl border-2 transition-all",
                        paymentMethod === method.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-zinc-200 text-zinc-500 hover:border-primary/30"
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="text-[11px] font-bold">{method.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">
                Mobile number
                {paymentMethod === "premier_wallet" ? " *" : (
                  <span className="text-zinc-400 font-normal"> (optional)</span>
                )}
              </label>
              <input
                type="tel"
                value={paymentPhone}
                onChange={e => setPaymentPhone(e.target.value)}
                placeholder="e.g. 61XXXXXXX"
                className={formInputClass}
              />
              <p className="text-xs text-zinc-500">
                {paymentMethod === "premier_wallet"
                  ? "Premier Wallet will send a payment request to this number."
                  : "Optional. Leave empty if not needed for this payment."}
              </p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPaymentOpen(false)}
              className="rounded-lg font-bold px-6 h-11"
              disabled={creating}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPayment}
              disabled={creating}
              className="bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-lg font-bold px-8 h-11 gap-2 disabled:opacity-70"
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Confirm & Pay
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <Dialog
        open={isReceiptOpen}
        onOpenChange={open => {
          if (!open) {
            setIsReceiptOpen(false);
            setReceiptData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Receipt</DialogTitle>
          <div className="p-6 border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Receipt</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Payment confirmed. Review and print the receipt for the customer.
            </DialogDescription>
          </div>

          {receiptData && (
            <div className="p-6">
              <div className="mx-auto max-w-[320px] rounded-lg border border-zinc-200 bg-white p-5 shadow-inner">
                <ReceiptBody data={receiptData} settings={receiptSettings} />
              </div>
            </div>
          )}

          <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsReceiptOpen(false);
                setReceiptData(null);
              }}
              className="rounded-lg font-bold px-6 h-11"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handlePrintReceipt}
              className="bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-lg font-bold px-8 h-11 gap-2"
            >
              <Printer className="size-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden printable receipt */}
      {receiptData && (
        <div id="printable-receipt" className="hidden print:block bg-white">
          <ReceiptBody data={receiptData} settings={receiptSettings} />
        </div>
      )}
    </div>
  );
}
