"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
  UtensilsCrossed,
  Loader2,
  Smartphone,
  Wallet,
  CheckCircle2,
  Printer,
  Search,
  User,
  Phone,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { categoryApi, Category } from "@/lib/api/restaurant/categoryApi";
import { menuItemApi, MenuItem } from "@/lib/api/restaurant/menuItemApi";
import { tableApi, Table as RestaurantTable } from "@/lib/api/restaurant/tableApi";
import { orderApi, Order } from "@/lib/api/restaurant/orderApi";
import { paymentApi, PaymentMethod } from "@/lib/api/restaurant/paymentApi";
import { receiptSettingsApi, ReceiptSettings } from "@/lib/api/restaurant/receiptSettingsApi";
import { ReceiptBody, ReceiptSnapshot } from "@/components/receipt/ReceiptBody";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  btnCreateSubmit,
} from "@/lib/dashboard-ui";

interface CartLine {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  tax: number;
}

type OrderPaymentMethod = Extract<PaymentMethod, "evc_plus" | "edahab" | "premier_wallet">;

const PAYMENT_METHODS: {
  id: OrderPaymentMethod;
  name: string;
  icon: typeof Smartphone;
  providerName: string;
}[] = [
  { id: "evc_plus", name: "Merchant", icon: Smartphone, providerName: "Merchant" },
  { id: "edahab", name: "eDahab", icon: Smartphone, providerName: "eDahab" },
  { id: "premier_wallet", name: "Premier Wallet", icon: Wallet, providerName: "Premier Wallet" },
];

const formInputClass =
  "w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium";

const formSelectClass =
  "w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium appearance-none cursor-pointer";

const ORDER_DRAFT_KEY = "waiter-create-order-draft";

interface OrderDraft {
  cart: CartLine[];
  customerName: string;
  customerPhone: string;
  notes: string;
  paymentMethod: OrderPaymentMethod;
  paymentPhone: string;
  selectedCategoryId: number | "all" | "";
  formTableId: number | "";
  pendingOrderId: number | null;
}

function readOrderDraft(): OrderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ORDER_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OrderDraft) : null;
  } catch {
    return null;
  }
}

function saveOrderDraft(draft: OrderDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

function clearOrderDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ORDER_DRAFT_KEY);
}

function isTableSelectable(table: RestaurantTable) {
  return table.status !== "inactive";
}

export default function WaiterCreateOrderPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [formTableId, setFormTableId] = useState<number | "">("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("evc_plus");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const submittingRef = useRef(false);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptSnapshot | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    const draft = readOrderDraft();
    if (draft) {
      if (draft.cart?.length) setCart(draft.cart);
      if (draft.customerName) setCustomerName(draft.customerName);
      if (draft.customerPhone) setCustomerPhone(draft.customerPhone);
      if (draft.notes) setNotes(draft.notes);
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      if (draft.paymentPhone) setPaymentPhone(draft.paymentPhone);
      if (
        draft.selectedCategoryId === "all" ||
        typeof draft.selectedCategoryId === "number"
      ) {
        setSelectedCategoryId(draft.selectedCategoryId);
      }
      if (draft.formTableId) setFormTableId(draft.formTableId);
      if (draft.pendingOrderId) setPendingOrderId(draft.pendingOrderId);
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    saveOrderDraft({
      cart,
      customerName,
      customerPhone,
      notes,
      paymentMethod,
      paymentPhone,
      selectedCategoryId,
      formTableId,
      pendingOrderId,
    });
  }, [
    draftLoaded,
    cart,
    customerName,
    customerPhone,
    notes,
    paymentMethod,
    paymentPhone,
    selectedCategoryId,
    formTableId,
    pendingOrderId,
  ]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, items, settings, tablesData] = await Promise.all([
          categoryApi.getAllCategories(),
          menuItemApi.getAllMenuItems(),
          receiptSettingsApi.getSettings(),
          tableApi.getAllTables(),
        ]);
        const available = (items || []).filter(i => i.isAvailable && i.isSellable !== false);
        setCategories(cats || []);
        setMenuItems(available);
        setReceiptSettings(settings);
        setTables(tablesData || []);
      } catch {
        showToast("Failed to load menu", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

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

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesCategory =
        selectedCategoryId === "all" || item.categoryId === selectedCategoryId;
      const matchesSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategoryId, search]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(l => l.menuItemId === item.id);
      if (existing) {
        return prev.map(l =>
          l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          tax: item.tax ?? 0,
        },
      ];
    });
  };

  const updateQty = (menuItemId: number, delta: number) => {
    setCart(prev =>
      prev
        .map(l =>
          l.menuItemId === menuItemId ? { ...l, quantity: l.quantity + delta } : l
        )
        .filter(l => l.quantity > 0)
    );
  };

  const removeLine = (menuItemId: number) => {
    setCart(prev => prev.filter(l => l.menuItemId !== menuItemId));
  };

  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const tax = cart.reduce(
    (s, l) => s + l.price * l.quantity * (l.tax / 100),
    0
  );
  const total = subtotal + tax;

  const selectedPayment = PAYMENT_METHODS.find(m => m.id === paymentMethod)!;

  const locationLabel = selectedTable
    ? `Table ${selectedTable.number}`
    : "";

  const clearPendingOrder = () => {
    setPendingOrderId(null);
    setPendingOrder(null);
  };

  const resetForm = () => {
    setCart([]);
    setFormTableId("");
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setPaymentPhone("");
    setPaymentMethod("evc_plus");
    clearPendingOrder();
    clearOrderDraft();
  };

  const openCheckout = () => {
    if (cart.length === 0) {
      showToast("Add at least one menu item", "error");
      return;
    }
    setIsCheckoutOpen(true);
  };

  const validateCheckout = (): boolean => {
    if (!formTableId) {
      showToast("Please select a table", "error");
      return false;
    }
    const payPhone = paymentPhone.trim() || customerPhone.trim();
    if (paymentMethod === "premier_wallet" && !payPhone) {
      showToast("Enter payment mobile number for Premier Wallet", "error");
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (submittingRef.current) return;
    if (!validateCheckout()) return;

    const payPhone = paymentPhone.trim() || customerPhone.trim();

    submittingRef.current = true;
    setSubmitting(true);

    let order: Order | null = pendingOrder;
    let checkoutResult: Awaited<ReturnType<typeof orderApi.posCheckout>> | null = null;

    try {
      if (pendingOrderId) {
        if (!order || order.id !== pendingOrderId) {
          try {
            order = await orderApi.getOrderById(pendingOrderId);
            setPendingOrder(order);
          } catch {
            clearPendingOrder();
            showToast("Previous unpaid order not found — creating a new one", "error");
            order = null;
          }
        }
      }

      if (!order) {
        checkoutResult = await orderApi.posCheckout({
          type: "dine-in",
          tableId: Number(formTableId),
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          notes: notes.trim() || undefined,
          items: cart.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
          paymentMethod,
          ...(payPhone ? { paymentPhone: payPhone } : {}),
          providerName: selectedPayment.providerName,
          source: "dashboard",
        });
      } else if (paymentMethod === "premier_wallet") {
        await paymentApi.processWaafiPayment(order.id, payPhone);
      } else {
        await paymentApi.createPayment({
          orderId: order.id.toString(),
          amount: order.total,
          method: paymentMethod,
          ...(payPhone ? { phone: payPhone } : {}),
          providerName: selectedPayment.providerName,
        });
      }

      const receiptOrderId = checkoutResult?.id ?? order!.id;
      const receiptSubtotal = checkoutResult?.subTotal ?? order!.subTotal ?? subtotal;
      const receiptTax = checkoutResult?.taxAmount ?? order!.taxAmount ?? tax;
      const receiptTotal = checkoutResult?.total ?? order!.total;

      setReceiptData({
        orderId: receiptOrderId,
        customerName: customerName.trim() || "Guest",
        customerPhone: customerPhone.trim() || payPhone || undefined,
        paymentMethod: selectedPayment.providerName,
        orderTypeLabel: "Dine-in",
        locationLabel: locationLabel || undefined,
        items: cart.map(l => ({
          menuItemId: l.menuItemId,
          name: l.name,
          price: l.price,
          quantity: l.quantity,
        })),
        subtotal: receiptSubtotal,
        tax: receiptTax,
        total: receiptTotal,
        createdAt: new Date().toISOString(),
      });
      setIsCheckoutOpen(false);
      setIsReceiptOpen(true);
      showToast("Order placed successfully", "success");
      resetForm();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to place order";

      if (pendingOrderId || order?.id) {
        const id = order?.id ?? pendingOrderId;
        showToast(
          `Payment failed for order #${id}. Tap "Retry Payment" — no duplicate order will be created.`,
          "error"
        );
      } else {
        showToast(message, "error");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className="px-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-primary mb-2 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Orders
          </Link>
          <h1 className={pageHeaderTitleClass}>Create Order</h1>
        </div>
      </div>

      <div className="mx-4 mb-6 flex flex-col lg:flex-row h-[calc(100vh-200px)] min-h-[520px] max-h-[calc(100vh-180px)] rounded-xl border border-zinc-100 bg-white overflow-hidden shadow-sm">
        {/* Menu panel — left scrolls independently */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 border-b lg:border-b-0 lg:border-r border-zinc-100">
          <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-zinc-50 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("all")}
                className={cn(
                  "px-4 sm:px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all whitespace-nowrap",
                  selectedCategoryId === "all"
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50"
                )}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={cn(
                    "px-4 sm:px-5 py-2 rounded-full text-sm font-semibold border-2 transition-all whitespace-nowrap",
                    selectedCategoryId === cat.id
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-zinc-50">
            <div className="relative max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-primary text-sm"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-48 sm:h-52 rounded-2xl bg-zinc-100 animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="text-center text-zinc-500 py-16">No menu items found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToCart(item)}
                    className="bg-white rounded-2xl border border-zinc-100 shadow-sm hover:border-primary/40 hover:shadow-md transition-all p-3 sm:p-4 flex flex-col items-center text-center group active:scale-[0.98]"
                  >
                    <div className="size-20 sm:size-24 rounded-full bg-zinc-50 border border-zinc-100 overflow-hidden flex items-center justify-center mb-3 group-hover:border-primary/20">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <UtensilsCrossed className="size-8 text-zinc-300" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-zinc-800 line-clamp-2 min-h-[2.5rem]">
                      {item.name}
                    </p>
                    <p className="text-sm font-black text-primary mt-1">
                      ${item.price.toFixed(2)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart sidebar — header & footer fixed, items scroll inside */}
        <aside className="w-full lg:w-[380px] flex flex-col min-h-0 bg-zinc-50/60 shrink-0 max-lg:max-h-[42vh] lg:h-full">
          <div className="shrink-0 p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/60">
            <h2 className="text-base font-bold text-zinc-800">Current Order</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {cart.reduce((s, l) => s + l.quantity, 0)} item(s)
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
            {cart.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">
                Tap menu items to add them here
              </p>
            ) : (
              cart.map(line => (
                <div
                  key={line.menuItemId}
                  className="flex items-center gap-3 bg-white rounded-xl border border-zinc-100 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 truncate">{line.name}</p>
                    <p className="text-xs text-zinc-500">${line.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQty(line.menuItemId, -1)}
                      className="size-7 rounded-md border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(line.menuItemId, 1)}
                      className="size-7 rounded-md border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.menuItemId)}
                      className="size-7 rounded-md text-rose-500 hover:bg-rose-50 flex items-center justify-center ml-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 p-4 sm:p-5 border-t border-zinc-100 bg-zinc-50/60 space-y-4">
            <div className="rounded-xl bg-white border border-zinc-100 p-4 space-y-1.5">
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-sm text-zinc-600">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-primary pt-1 border-t border-zinc-100">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <Button
              onClick={openCheckout}
              disabled={cart.length === 0}
              className={cn(btnCreateSubmit, "w-full h-12 gap-2")}
            >
              <ChevronRight className="size-4" />
              Proceed to Checkout
            </Button>
          </div>
        </aside>
      </div>

      {/* Checkout modal: table, customer, payment */}
      <Dialog
        open={isCheckoutOpen}
        onOpenChange={open => {
          if (!open && !submitting) setIsCheckoutOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[520px] bg-white border-zinc-100 p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogTitle className="sr-only">Checkout</DialogTitle>
          <div className="p-6 border-b border-zinc-100 shrink-0">
            <DialogTitle className="text-xl font-bold text-zinc-800">Checkout</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Select table, add customer details, then pay.
            </DialogDescription>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {pendingOrderId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Unpaid order #{pendingOrderId}</p>
                <p className="text-xs mt-1 text-amber-800">
                  Payment did not complete. Tap &quot;Retry Payment&quot; below — a new order will not be created.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    clearPendingOrder();
                    showToast("Unpaid order link cleared — next submit creates a new order", "success");
                  }}
                  className="text-xs font-bold text-amber-900 underline mt-2 hover:text-primary"
                >
                  Start new order instead
                </button>
              </div>
            )}

            {/* Order summary */}
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Order summary
              </p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {cart.map(line => (
                  <div key={line.menuItemId} className="flex justify-between text-sm">
                    <span className="text-zinc-700 truncate pr-2">
                      {line.quantity}× {line.name}
                    </span>
                    <span className="font-semibold text-zinc-800 shrink-0">
                      ${(line.price * line.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-black text-primary mt-3 pt-3 border-t border-zinc-200">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Table */}
            <section className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                Location *
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-zinc-800">Table</label>
                <select
                  value={formTableId}
                  onChange={e =>
                    setFormTableId(e.target.value ? Number(e.target.value) : "")
                  }
                  className={formSelectClass}
                >
                  <option value="">Select table</option>
                  {selectableTables.map(table => (
                    <option key={table.id} value={table.id}>
                      {table.name || `Table ${table.number}`}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTable && (
                <p className="text-xs text-primary font-medium px-1">
                  Table {selectedTable.number}
                </p>
              )}
            </section>

            {/* Customer optional */}
            <section className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                Customer (optional)
              </p>
              <div className="relative">
                <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className={cn(formInputClass, "pl-10")}
                />
              </div>
              <div className="relative">
                <Phone className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => {
                    setCustomerPhone(e.target.value);
                    if (!paymentPhone) setPaymentPhone(e.target.value);
                  }}
                  placeholder="Phone number"
                  className={cn(formInputClass, "pl-10")}
                />
              </div>
            </section>

            {/* Payment */}
            <section className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                Payment *
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(method => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border-2 transition-all text-[10px] font-bold",
                        paymentMethod === method.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-zinc-200 text-zinc-500 hover:border-primary/30"
                      )}
                    >
                      <Icon className="size-4" />
                      {method.name}
                    </button>
                  );
                })}
              </div>
              <label className="text-sm font-bold text-[#1E293B]">
                Payment mobile number
                {paymentMethod === "premier_wallet" ? " *" : (
                  <span className="text-zinc-400 font-normal"> (optional)</span>
                )}
              </label>
              <input
                type="tel"
                value={paymentPhone}
                onChange={e => setPaymentPhone(e.target.value)}
                placeholder={
                  paymentMethod === "premier_wallet"
                    ? "Required for Premier Wallet"
                    : "Optional — e.g. 61XXXXXXX"
                }
                className={formInputClass}
              />
            </section>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className={cn(formInputClass, "resize-none")}
            />
          </div>

          <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCheckoutOpen(false)}
              disabled={submitting}
              className="rounded-lg font-bold px-6 h-11"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={handlePlaceOrder}
              disabled={submitting}
              className={cn(btnCreateSubmit, "px-8 h-11 gap-2")}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : pendingOrderId ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Retry Payment
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Confirm &amp; Pay
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
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
            <DialogTitle className="text-xl font-bold text-zinc-800">Order Confirmed</DialogTitle>
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
              onClick={() => window.print()}
              className="bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-lg font-bold px-8 h-11 gap-2"
            >
              <Printer className="size-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {receiptData && (
        <div id="printable-receipt" className="hidden print:block bg-white">
          <ReceiptBody data={receiptData} settings={receiptSettings} />
        </div>
      )}
    </div>
  );
}
