"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Utensils,
  ShoppingBag,
  Truck,
  Search,
  Plus,
  Minus,
  Loader2,
  CheckCircle2,
  Smartphone,
  Wallet,
  X,
  LayoutGrid,
  List,
  Pencil,
  ChevronRight,
  ChevronDown,
  Percent,
  Copy,
  History,
  Printer,
  Layers,
  Eraser,
  User,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryApi, Category } from "@/lib/api/restaurant/categoryApi";
import { menuItemApi, MenuItem, parseMenuItemOptions } from "@/lib/api/restaurant/menuItemApi";
import { compositeApi, CompositeMenuItem } from "@/lib/api/restaurant/compositeApi";
import {
  getMenuItemEffectivePrice,
  menuItemHasDiscount,
  getMenuItemDiscountPercent,
} from "@/lib/menu-item-pricing";
import { tableApi, Table } from "@/lib/api/restaurant/tableApi";
import { orderApi } from "@/lib/api/restaurant/orderApi";
import api from "@/lib/api/axios";
import { PaymentMethod } from "@/lib/api/restaurant/paymentApi";
import { customerApi, Customer } from "@/lib/api/restaurant/customerApi";
import { receiptSettingsApi, ReceiptSettings } from "@/lib/api/restaurant/receiptSettingsApi";
import { ReceiptBody, ReceiptSnapshot } from "@/components/receipt/ReceiptBody";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { btnCreatePage } from "@/lib/dashboard-ui";
import { onDebouncedEvent, MENU_CHANGED } from "@/lib/live-updates";
import PosCustomerPhoneCombobox from "@/components/pos/PosCustomerPhoneCombobox";
import PosMenuItemImage from "@/components/pos/PosMenuItemImage";
import PosProductCard from "@/components/pos/PosProductCard";
import { usePosSearch } from "@/context/PosSearchContext";
import { STATIC_APP_LOGO } from "@/lib/branding";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

type ViewMode = "grid" | "list";
type PosOrderType = "dine-in" | "takeaway" | "delivery";



type TakeawayTiming = "now" | "later";

interface PosOrderMeta {
  orderType: PosOrderType;
  takeawayTiming: TakeawayTiming;
  pickupDate: string;
  pickupTime: string;
  deliveryStreet: string;
  deliveryDistrict: string;
  customerPhone: string;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function findCustomerByPhone(phone: string, customers: Customer[]) {
  const digits = normalizePhone(phone);
  if (digits.length < 6) return null;
  return (
    customers.find(c => {
      const stored = normalizePhone(c.phone);
      return (
        stored === digits ||
        stored.endsWith(digits) ||
        digits.endsWith(stored)
      );
    }) ?? null
  );
}

interface DbPaymentMethod {
  id: number;
  name: string;
  code: string;
  payment_type?: string;
  is_active?: boolean;
}

function getPaymentMethodIcon(code: string, name: string) {
  const str = (code + " " + name).toLowerCase();
  if (str.includes("edahab") || str.includes("mobile") || str.includes("evc") || str.includes("zaad") || str.includes("sahal")) return Smartphone;
  if (str.includes("wallet") || str.includes("premier")) return Wallet;
  return Store;
}

const POS_PAYMENT_METHODS: {
  id: string;
  name: string;
  icon?: any;
  providerName: string;
}[] = [
  { id: "evc_plus", name: "Merchant", icon: Store, providerName: "Merchant" },
  { id: "edahab", name: "eDahab", icon: Smartphone, providerName: "eDahab" },
  { id: "premier_wallet", name: "Premier Wallet", icon: Wallet, providerName: "Premier Wallet" },
];

const formInputClass =
  "w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium";

const priceAmountClass = "text-primary dark:text-white";
const summaryAmountClass = "font-semibold text-foreground dark:text-white";

/** Virtual POS category — shows composite / combo menu items */
const POS_COMBOS_CATEGORY = "combos" as const;
type PosCategoryFilter = string | number | typeof POS_COMBOS_CATEGORY;

function mergeCatalogWithComposites(
  catalog: MenuItem[],
  composites: CompositeMenuItem[]
): MenuItem[] {
  const byId = new Map<number, MenuItem>();
  for (const item of catalog) byId.set(item.id, item);
  for (const combo of composites) {
    const existing = byId.get(combo.id);
    byId.set(combo.id, {
      ...(existing || {}),
      ...combo,
      isComposite: true,
    });
  }
  return Array.from(byId.values());
}

interface ProductOpts {
  variant?: string;
}

interface CartLine {
  key: string;
  id: number;
  name: string;
  price: number;
  tax: number;
  quantity: number;
  imageUrl?: string;
  categoryName?: string;
  variant?: string;
  lineNote?: string;
  lineDiscount: number;
  isComposite?: boolean;
}

type LineEditField = "quantity" | "price" | "discount" | "tax";
interface LineEditDraft {
  quantity: string;
  price: string;
  discount: string;
  tax: string;
  note: string;
}

function cartLineKey(id: number, variant?: string): string {
  return `${id}-${variant || "default"}`;
}

function normalizeCartLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = Number(item.id ?? item.menuItemId);
  if (!id) return null;
  const variant = item.variant as string | undefined;
  return {
    key: String(item.key || cartLineKey(id, variant)),
    id,
    name: String(item.name || "Item"),
    price: Number(item.price) || 0,
    tax: Number(item.tax) || 0,
    quantity: Number(item.quantity) || 1,
    imageUrl: item.imageUrl as string | undefined,
    categoryName: item.categoryName as string | undefined,
    variant,
    lineNote: item.lineNote as string | undefined,
    lineDiscount: Math.max(0, Number(item.lineDiscount) || 0),
    isComposite: Boolean(item.isComposite),
  };
}

function optionChip(active: boolean) {
  return cn(
    "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all",
    active
      ? "bg-zinc-200 border-zinc-300 text-foreground"
      : "bg-white border-border text-muted-foreground hover:border-zinc-300"
  );
}

export default function PosTerminalPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<PosCategoryFilter>("All");
  const { query: searchQuery, setQuery: setSearchQuery } = usePosSearch();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<PosOrderType>("takeaway");
  const [takeawayTiming, setTakeawayTiming] = useState<TakeawayTiming>("now");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [dbPaymentMethods, setDbPaymentMethods] = useState<DbPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("evc_plus");

  const paymentMethodsList = useMemo(() => {
    if (dbPaymentMethods.length > 0) {
      return dbPaymentMethods.map(m => ({
        id: m.code || String(m.id),
        name: m.name,
        icon: getPaymentMethodIcon(m.code || "", m.name),
        providerName: m.name,
      }));
    }
    return POS_PAYMENT_METHODS;
  }, [dbPaymentMethods]);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [activeHeldOrderId, setActiveHeldOrderId] = useState<number | null>(null);
  const [draftSeq, setDraftSeq] = useState(1);

  const [productOptions, setProductOptions] = useState<Record<number, ProductOpts>>({});
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [lineEditDraft, setLineEditDraft] = useState<LineEditDraft | null>(null);
  const [lineEditField, setLineEditField] = useState<LineEditField>("quantity");

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptSnapshot | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isRecentOrdersOpen, setIsRecentOrdersOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [discount, setDiscount] = useState(0);
  const [tempDiscount, setTempDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const { showToast } = useToast();
  const cartSyncReady = useRef(false);
  const phoneLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("pos-cart");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown[];
        setCart(parsed.map(normalizeCartLine).filter(Boolean) as CartLine[]);
      } catch {
        /* ignore */
      }
    }
    const savedMeta = localStorage.getItem("pos-order-meta");
    if (savedMeta) {
      try {
        const parsed = JSON.parse(savedMeta) as Partial<PosOrderMeta>;
        if (
          parsed.orderType === "dine-in" ||
          parsed.orderType === "takeaway" ||
          parsed.orderType === "delivery"
        ) {
          setOrderType(parsed.orderType);
        }
        if (parsed.takeawayTiming === "now" || parsed.takeawayTiming === "later") {
          setTakeawayTiming(parsed.takeawayTiming);
        }
        if (typeof parsed.pickupDate === "string") setPickupDate(parsed.pickupDate);
        if (typeof parsed.pickupTime === "string") setPickupTime(parsed.pickupTime);
        if (typeof parsed.deliveryStreet === "string") setDeliveryStreet(parsed.deliveryStreet);
        if (typeof parsed.deliveryDistrict === "string") setDeliveryDistrict(parsed.deliveryDistrict);
        if (typeof parsed.customerPhone === "string") setCustomerPhone(parsed.customerPhone);
      } catch {
        /* ignore */
      }
    }
    const savedDiscount = localStorage.getItem("pos-discount");
    if (savedDiscount) {
      try {
        const parsed = JSON.parse(savedDiscount) as {
          discount?: number;
          discountType?: "percentage" | "fixed";
        };
        if (typeof parsed.discount === "number") setDiscount(parsed.discount);
        if (parsed.discountType === "percentage" || parsed.discountType === "fixed") {
          setDiscountType(parsed.discountType);
        }
        setTempDiscount(String(parsed.discount ?? 0));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pos-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(
      "pos-discount",
      JSON.stringify({ discount, discountType })
    );
  }, [discount, discountType]);

  useEffect(() => {
    const meta: PosOrderMeta = {
      orderType,
      takeawayTiming,
      pickupDate,
      pickupTime,
      deliveryStreet,
      deliveryDistrict,
      customerPhone,
    };
    localStorage.setItem("pos-order-meta", JSON.stringify(meta));
  }, [
    orderType,
    takeawayTiming,
    pickupDate,
    pickupTime,
    deliveryStreet,
    deliveryDistrict,
    customerPhone,
  ]);

  useEffect(() => {
    const count = cart.reduce((sum, i) => sum + i.quantity, 0);
    if (!cartSyncReady.current) {
      cartSyncReady.current = true;
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: count }));
      });
      return;
    }
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: count }));
  }, [cart]);

  const fetchData = useCallback(async (options?: { silent?: boolean; menuOnly?: boolean; forceMenu?: boolean }) => {
    const silent = options?.silent ?? false;
    const menuOnly = options?.menuOnly ?? false;
    const forceMenu = options?.forceMenu ?? false;

    if (!silent) setLoading(true);
    try {
      if (forceMenu) {
        menuItemApi.clearPosMenuCache();
        categoryApi.clearCategoryCache();
        compositeApi.clearCompositeCache();
      }
      const [cats, items, composites] = await Promise.all([
        categoryApi.getAllCategories(forceMenu),
        menuItemApi.getPosMenuCatalog(forceMenu),
        compositeApi.getAll(forceMenu),
      ]);
      setCategories((cats || []).filter(c => c.isActive !== false));
      setProducts(mergeCatalogWithComposites(items || [], composites || []));
    } catch {
      if (!silent) showToast("Failed to load POS menu", "error");
    } finally {
      if (!silent) setLoading(false);
    }

    if (menuOnly) return;
  }, [showToast]);

  const ensureOrderDialogData = useCallback(async () => {
    try {
      const [tbls, custs, pmRes] = await Promise.allSettled([
        tableApi.getAllTables(),
        customerApi.getPosCustomers(),
        api.get("/payment-methods"),
      ]);
      if (tbls.status === "fulfilled") setTables(tbls.value);
      if (custs.status === "fulfilled") setCustomers(custs.value);
      if (pmRes.status === "fulfilled" && pmRes.value.data?.data) {
        const methods: DbPaymentMethod[] = pmRes.value.data.data;
        const active = methods.filter(m => m.is_active !== false);
        if (active.length > 0) setDbPaymentMethods(active);
      }
    } catch {
      // non-blocking — dialog can still open
    }
  }, []);

  const ensureReceiptSettings = useCallback(async () => {
    if (receiptSettings) return;
    try {
      const sett = await receiptSettingsApi.getSettings();
      setReceiptSettings(sett);
    } catch {
      // receipt can still render with defaults
    }
  }, [receiptSettings]);

  const openOrderDialog = useCallback(() => {
    void ensureOrderDialogData();
    setIsCheckoutOpen(true);
  }, [ensureOrderDialogData]);

  useEffect(() => {
    fetchData({ silent: false });
    void ensureOrderDialogData();
    const removeMenuListener = onDebouncedEvent(
      MENU_CHANGED,
      () => fetchData({ silent: true, menuOnly: true, forceMenu: true }),
      400
    );
    return () => {
      removeMenuListener();
    };
  }, [fetchData, ensureOrderDialogData]);

  // Load receipt settings once on mount — kept in a separate effect
  // to avoid changing the dependency array size of the main effect.
  useEffect(() => {
    receiptSettingsApi.getSettings()
      .then(setReceiptSettings)
      .catch(() => { /* render with defaults if unavailable */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryName = useCallback(
    (id: number) => categories.find(c => c.id === id)?.name || "Menu",
    [categories]
  );

  const comboCount = useMemo(
    () => products.filter(p => p.isComposite).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory =
        selectedCategory === "All"
          ? true
          : selectedCategory === POS_COMBOS_CATEGORY
            ? Boolean(p.isComposite)
            : Number(p.categoryId) === Number(selectedCategory);
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const selectedTableRecord = useMemo(
    () => tables.find(t => t.id === selectedTable) ?? null,
    [tables, selectedTable]
  );

  const activeTables = useMemo(
    () =>
      tables
        .filter(t => t.status === "active")
        .sort((a, b) => a.number - b.number),
    [tables]
  );

  const orderLocationLabel = useMemo(() => {
    if (orderType === "dine-in") {
      if (selectedTableRecord) {
        return `Table ${selectedTableRecord.number}`;
      }
      return "Select table";
    }
    if (orderType === "takeaway") {
      if (takeawayTiming === "later" && (pickupDate || pickupTime)) {
        if (pickupDate && pickupTime) return `Takeaway · Pickup ${pickupDate} ${pickupTime}`;
        if (pickupDate) return `Takeaway · Pickup ${pickupDate}`;
        return `Takeaway · Pickup ${pickupTime}`;
      }
      return "Takeaway · Now";
    }
    if (deliveryStreet.trim()) {
      return deliveryDistrict.trim()
        ? `Delivery · ${deliveryStreet.trim()}, ${deliveryDistrict.trim()}`
        : `Delivery · ${deliveryStreet.trim()}`;
    }
    return "Delivery — add address";
  }, [
    orderType,
    selectedTableRecord,
    takeawayTiming,
    pickupDate,
    pickupTime,
    deliveryStreet,
    deliveryDistrict,
  ]);

  const orderTypeLabel =
    orderType === "delivery" ? "Delivery" : orderType === "dine-in" ? "Dine-in" : "Takeaway";

  const customersByPhone = useMemo(
    () => [...customers].sort((a, b) => a.phone.localeCompare(b.phone)),
    [customers]
  );

  const selectPhoneOptions = customersByPhone;

  useEffect(() => {
    return () => {
      if (phoneLookupTimer.current) clearTimeout(phoneLookupTimer.current);
    };
  }, []);

  const applyCustomer = (customer: Customer) => {
    setSelectedCustomer(customer.id);
    setCustomerPhone(customer.phone);
    setCustomerName(customer.fullName);
  };

  const lookupCustomerByPhone = async (phone: string) => {
    const trimmed = phone.trim();
    if (!trimmed) return;

    const local = findCustomerByPhone(trimmed, customers);
    if (local) {
      applyCustomer(local);
      return;
    }

    const remote = await customerApi.getCustomerByPhone(trimmed);
    if (remote) applyCustomer(remote);
  };

  const handleSelectCustomerById = (customerId: string) => {
    if (!customerId) {
      setSelectedCustomer(null);
      setCustomerPhone("");
      setCustomerName("");
      return;
    }
    const match = customers.find(c => c.id === Number(customerId));
    if (match) applyCustomer(match);
  };

  const handleCustomerPhoneChange = (value: string) => {
    setCustomerPhone(value);

    if (!value.trim()) {
      setSelectedCustomer(null);
      setCustomerName("");
      return;
    }

    const match = findCustomerByPhone(value, customers);
    if (match) {
      applyCustomer(match);
      return;
    }

    setSelectedCustomer(null);

    if (phoneLookupTimer.current) clearTimeout(phoneLookupTimer.current);
    const digits = normalizePhone(value);
    if (digits.length < 6) return;

    phoneLookupTimer.current = setTimeout(() => {
      void lookupCustomerByPhone(value);
    }, 400);
  };

  const handleCustomerPhoneBlur = () => {
    if (phoneLookupTimer.current) {
      clearTimeout(phoneLookupTimer.current);
      phoneLookupTimer.current = null;
    }
    if (!selectedCustomer && customerPhone.trim()) {
      void lookupCustomerByPhone(customerPhone);
    }
  };

  const handleTakeawayTimingChange = (timing: TakeawayTiming) => {
    setTakeawayTiming(timing);
    if (timing === "now") {
      setPickupDate("");
      setPickupTime("");
    }
  };

  const handleOrderTypeChange = (type: PosOrderType) => {
    setOrderType(type);
    if (type !== "takeaway") {
      setTakeawayTiming("now");
      setPickupDate("");
      setPickupTime("");
    }
    if (type !== "delivery") {
      setDeliveryStreet("");
      setDeliveryDistrict("");
    }
    if (type !== "dine-in") {
      setSelectedTable(null);
    }
  };

  const draftOrderId = `#${String(draftSeq).padStart(3, "0")}`;

  const addToCart = (product: MenuItem) => {
    if (!product.isAvailable) return;
    if (product.isComposite && product.components?.some(c => c.isAvailable === false)) {
      showToast("This combo has unavailable items", "error");
      return;
    }
    const itemOptions = parseMenuItemOptions(product);
    const variant = productOptions[product.id]?.variant;
    if (!product.isComposite && itemOptions.length > 0 && !variant) {
      showToast("Select an option first", "error");
      return;
    }
    setActiveProductId(product.id);
    const key = cartLineKey(product.id, variant);
    const comboNote =
      product.isComposite && product.components?.length
        ? product.components.map(c => `${c.quantity}× ${c.name}`).join(", ")
        : undefined;

    setCart(prev => {
      const existing = prev.find(item => item.key === key);
      if (existing) {
        return prev.map(item =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          key,
          id: product.id,
          name: product.name,
          price: getMenuItemEffectivePrice(product),
          tax: product.tax || 0,
          quantity: 1,
          imageUrl: product.imageUrl,
          categoryName: categoryName(product.categoryId),
          variant,
          isComposite: product.isComposite,
          lineNote: comboNote,
          lineDiscount: 0,
        },
      ];
    });
  };

  const removeFromCart = (key: string) => {
    setCart(prev => prev.filter(item => item.key !== key));
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.key !== key) return item;
          const qty = item.quantity + delta;
          return qty < 1 ? null : { ...item, quantity: qty };
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const openLineEditor = (item: CartLine) => {
    setEditingLineKey(item.key);
    setLineEditDraft({
      quantity: String(item.quantity),
      price: item.price.toFixed(2),
      discount: item.lineDiscount.toFixed(2),
      tax: item.tax.toFixed(2),
      note: item.lineNote || "",
    });
    setLineEditField("quantity");
  };

  const closeLineEditor = () => {
    setEditingLineKey(null);
    setLineEditDraft(null);
  };

  const updateLineDraft = (field: LineEditField, value: string) => {
    setLineEditDraft(current => current ? { ...current, [field]: value } : current);
  };

  const pressLineKey = (key: string) => {
    if (!lineEditDraft) return;
    const current = lineEditDraft[lineEditField];
    if (key === "C") {
      updateLineDraft(lineEditField, "");
      return;
    }
    if (key === "backspace") {
      updateLineDraft(lineEditField, current.slice(0, -1));
      return;
    }
    if (key === "." && current.includes(".")) return;
    updateLineDraft(lineEditField, `${current}${key}`);
  };

  const saveLineEditor = () => {
    if (!editingLineKey || !lineEditDraft) return;
    const quantity = Math.max(1, Math.floor(Number(lineEditDraft.quantity) || 1));
    const price = Math.max(0, Number(lineEditDraft.price) || 0);
    const tax = Math.min(100, Math.max(0, Number(lineEditDraft.tax) || 0));
    const discount = Math.min(price * quantity, Math.max(0, Number(lineEditDraft.discount) || 0));
    setCart(current => current.map(item => item.key === editingLineKey
      ? { ...item, quantity, price, tax, lineDiscount: discount, lineNote: lineEditDraft.note.trim() || undefined }
      : item
    ));
    closeLineEditor();
  };

  const isInCart = (productId: number) => cart.some(c => c.id === productId);

  const lineNet = (item: CartLine) =>
    Math.max(0, item.price * item.quantity - item.lineDiscount);
  const subtotal = cart.reduce((sum, item) => sum + lineNet(item), 0);
  const taxAmount = cart.reduce(
    (sum, item) => sum + lineNet(item) * (Math.max(0, item.tax) / 100),
    0
  );
  const discountAmount =
    discountType === "percentage" ? (subtotal * discount) / 100 : discount;
  const total = Math.max(0, subtotal + taxAmount - discountAmount);

  const setProductVariant = (productId: number, value: string) => {
    setProductOptions(prev => ({
      ...prev,
      [productId]: {
        variant: prev[productId]?.variant === value ? undefined : value,
      },
    }));
  };

  const formatCartOptions = (item: CartLine) =>
    item.variant ? `Option: ${item.variant}` : "";

  const resetOrderDetails = () => {
    setOrderType("takeaway");
    setSelectedTable(null);
    setSelectedCustomer(null);
    setCustomerName("");
    setCustomerPhone("");
    setTakeawayTiming("now");
    setPickupDate("");
    setPickupTime("");
    setDeliveryStreet("");
    setDeliveryDistrict("");
  };

  const resetTransaction = () => {
    setCart([]);
    setOrderNote("");
    setDiscount(0);
    setTempDiscount("0");
    setDiscountType("percentage");
    setDraftSeq(s => s + 1);
    setActiveProductId(null);
    setActiveHeldOrderId(null);
  };

  const getDiscountPayload = () =>
    discountAmount > 0
      ? {
          discountAmount: Number(discountAmount.toFixed(2)),
          discountType,
          discountValue: Number(discount.toFixed(2)),
        }
      : {};

  const getCustomerNamePayload = () => {
    const name = customerName.trim();
    if (!name || name === "Walk-in Guest") return undefined;
    return name;
  };

  const buildOrderNotes = (fallback?: string) => {
    const parts: string[] = [];
    if (orderNote.trim()) parts.push(orderNote.trim());
    if (orderType === "takeaway" && takeawayTiming === "later" && (pickupDate || pickupTime)) {
      parts.push(`Pickup: ${[pickupDate, pickupTime].filter(Boolean).join(" ")}`);
    }
    return parts.join(" | ") || fallback;
  };

  const validateOrderDetails = (): boolean => {
    if (orderType === "takeaway" && takeawayTiming === "later" && (!pickupDate || !pickupTime)) {
      showToast("Select pickup date and time", "error");
      openOrderDialog();
      return false;
    }
    if (orderType === "delivery" && !deliveryStreet.trim()) {
      showToast("Enter delivery address", "error");
      openOrderDialog();
      return false;
    }
    if (orderType === "delivery" && !selectedCustomer && !customerPhone.trim()) {
      showToast("Enter customer phone for delivery", "error");
      openOrderDialog();
      return false;
    }
    return true;
  };

  const resolveDeliveryAddressId = async (): Promise<number | undefined> => {
    if (orderType !== "delivery") return undefined;
    let customerId = selectedCustomer;
    let cust = customers.find(c => c.id === customerId);
    const phone = cust?.phone || customerPhone.trim() || "N/A";

    if (!customerId) {
      const existingCustomer = await customerApi.getCustomerByPhone(phone);
      cust = existingCustomer || await customerApi.createCustomer({
        fullName: getCustomerNamePayload() || "Delivery Guest",
        phone,
      });
      customerId = cust.id;
      setSelectedCustomer(cust.id);
      setCustomers(current => current.some(item => item.id === cust!.id) ? current : [...current, cust!]);
    }

    const res = await api.post("/addresses", {
      customerId,
      name: "Delivery",
      district: deliveryDistrict.trim() || "N/A",
      street: deliveryStreet.trim(),
      phone,
      isDefault: false,
    });
    return res.data.data?.id;
  };

  const buildOrderPayload = async (status?: string) => {
    const cust = customers.find(c => c.id === selectedCustomer);
    const phone = cust?.phone || customerPhone.trim() || undefined;
    const addressId = await resolveDeliveryAddressId();

    return {
      tableId: orderType === "dine-in" ? selectedTable ?? undefined : undefined,
      addressId,
      type: orderType,
      status,
      customerName: getCustomerNamePayload(),
      customerPhone: phone,
      notes: buildOrderNotes(status === "held" ? "Held Order" : undefined),
      items: cart.map(i => ({
        menuItemId: i.id,
        quantity: i.quantity,
        unitPrice: i.price,
        tax: i.tax,
        discountAmount: i.lineDiscount,
      })),
      ...getDiscountPayload(),
    };
  };

  const refreshHeldOrders = async (openModal = false) => {
    const orders = await orderApi.getAllOrders({ status: "held", onlyMine: true });
    setRecentOrders(orders);
    setHeldCount(orders.length);
    if (openModal) setIsRecentOrdersOpen(true);
  };

  const clearLoadedHeldOrders = async (ids: number[], syncList = false) => {
    if (ids.length === 0) return;
    await Promise.allSettled(ids.map(id => orderApi.deleteOrder(id)));
    if (syncList) {
      await refreshHeldOrders(false);
    }
  };

  const saveCurrentOrderAsHeld = async (): Promise<boolean> => {
    if (cart.length === 0) return true;
    if (!validateOrderDetails()) return false;
    const idToDelete = activeHeldOrderId;
    try {
      await orderApi.createOrder(await buildOrderPayload("held"));
      setActiveHeldOrderId(null);
      setHeldCount(c => Math.max(0, c + 1 - (idToDelete ? 1 : 0)));
      if (idToDelete) {
        void clearLoadedHeldOrders([idToDelete]);
      }
      return true;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to save order";
      showToast(message, "error");
      return false;
    }
  };

  const handleHoldOrder = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    const saved = await saveCurrentOrderAsHeld();
    if (saved) {
      resetTransaction();
      resetOrderDetails();
      showToast("Order saved", "success");
    }
    setIsProcessing(false);
  };

  const handleClearOrder = () => {
    resetTransaction();
    resetOrderDetails();
    showToast("Transaction cleared", "success");
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      showToast("Please fill all fields", "error");
      return;
    }
    try {
      const created = await customerApi.createCustomer({
        fullName: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      });
      setCustomers(prev => [...prev, created]);
      applyCustomer(created);
      setIsAddCustomerDialogOpen(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      showToast("Customer added successfully", "success");
    } catch (err) {
      showToast("Failed to add customer", "error");
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === "C") {
      setTempDiscount("0");
    } else if (val === ".") {
      if (!tempDiscount.includes(".")) {
        setTempDiscount(prev => prev + ".");
      }
    } else {
      setTempDiscount(prev => {
        if (prev === "0") {
          return val;
        }
        const newVal = prev + val;
        if (discountType === "percentage" && parseFloat(newVal) > 100) {
          return "100";
        }
        return newVal;
      });
    }
  };

  const fetchRecentOrders = async () => {
    try {
      await refreshHeldOrders(true);
    } catch {
      showToast("Failed to fetch saved orders", "error");
    }
  };

  useEffect(() => {
    refreshHeldOrders(false).catch(() => {});
  }, []);

  useEffect(() => {
    const handleOpenHeld = () => fetchRecentOrders();
    window.addEventListener("open-held-orders", handleOpenHeld);
    return () => window.removeEventListener("open-held-orders", handleOpenHeld);
  }, []);

  const applyHeldOrderMeta = (order: any) => {
    if (order.tableId) {
      setSelectedTable(order.tableId);
    } else {
      setSelectedTable(null);
    }
    const resumedType = (order.orderType || "takeaway") as string;
    setOrderType(
      resumedType === "delivery"
        ? "delivery"
        : resumedType === "dine-in"
          ? "dine-in"
          : "takeaway"
    );
    setSelectedCustomer(order.customerId);
    if (order.customerName) setCustomerName(order.customerName);
    if (order.customerPhone) setCustomerPhone(order.customerPhone);
    if (order.notes && order.notes !== "Held Order") {
      const pickupMatch = order.notes.match(/Pickup:\s*([^|]+)/);
      if (pickupMatch) {
        setTakeawayTiming("later");
        const pickupParts = pickupMatch[1].trim().split(/\s+/);
        if (pickupParts.length >= 2) {
          setPickupDate(pickupParts[0]);
          setPickupTime(pickupParts.slice(1).join(" "));
        } else if (pickupParts.length === 1) {
          setPickupDate(pickupParts[0]);
        }
        setOrderNote(
          order.notes.replace(/\s*\|\s*Pickup:[^|]+/, "").replace(/Pickup:[^|]+/, "").trim()
        );
      } else {
        setTakeawayTiming("now");
        setOrderNote(order.notes);
      }
    }
    if (order.address) {
      setDeliveryStreet(order.address.street || "");
      setDeliveryDistrict(order.address.district || "");
    }
    if (order.discountAmount && order.discountAmount > 0) {
      const type =
        order.discountType === "fixed" || order.discountType === "percentage"
          ? order.discountType
          : "fixed";
      const value = order.discountValue ?? order.discountAmount;
      setDiscountType(type);
      setDiscount(value);
      setTempDiscount(String(value));
    } else {
      setDiscount(0);
      setTempDiscount("0");
      setDiscountType("percentage");
    }
  };

  const resumeOrder = async (order: any) => {
    const incoming: CartLine[] = order.orderitem.map((oi: any) => {
      const m = oi.menuitem;
      return {
        key: cartLineKey(m.id),
        id: m.id,
        name: m.name,
        price: oi.unitPrice ?? getMenuItemEffectivePrice(m),
        tax: oi.tax ?? (m.tax || 0),
        lineDiscount: 0,
        quantity: oi.quantity,
        imageUrl: m.imageUrl,
      };
    });

    setCart(incoming);
    applyHeldOrderMeta(order);
    setActiveHeldOrderId(order.id);
    setIsRecentOrdersOpen(false);

    try {
      await refreshHeldOrders(false);
      showToast("Order loaded", "success");
    } catch {
      showToast("Order loaded", "success");
    }
  };

  const selectedPaymentMethod =
    paymentMethodsList.find(m => m.id === paymentMethod) ||
    paymentMethodsList[0] || {
      id: "evc_plus",
      name: "Merchant",
      icon: Store,
      providerName: "Merchant",
    };

  const handleOpenPayment = () => {
    if (cart.length === 0) {
      showToast("Your cart is empty", "error");
      return;
    }
    openOrderDialog();
  };


  const closeCheckout = (force = false) => {
    if (!force && isProcessing) return;
    setIsCheckoutOpen(false);
  };

  const resolvePaymentPhone = () => {
    const trimmed = paymentPhone.trim();
    if (trimmed) return trimmed;
    const cust = customers.find(c => c.id === selectedCustomer);
    return cust?.phone || customerPhone.trim() || "";
  };

  const getReceiptCustomerName = () => {
    const cust = customers.find(c => c.id === selectedCustomer);
    if (cust) return cust.fullName;
    const name = customerName.trim();
    return name && name !== "Walk-in Guest" ? name : "Guest";
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast("Your cart is empty", "error");
      return;
    }

    if (!validateOrderDetails()) return;

    const payPhone = resolvePaymentPhone();
    if (paymentMethod === "premier_wallet" && !payPhone) {
      showToast("Enter mobile number for Premier Wallet payment", "error");
      return;
    }

    const receiptSnapshot: ReceiptSnapshot = {
      orderId: 0,
      customerName: getReceiptCustomerName(),
      customerPhone: payPhone || customerPhone.trim(),
      paymentMethod: selectedPaymentMethod.providerName,
      orderTypeLabel,
      locationLabel: orderLocationLabel,
      items: cart.map(item => ({
        menuItemId: item.id,
        name: item.variant ? `${item.name} (${item.variant})` : item.name,
        price: item.quantity > 0 ? lineNet(item) / item.quantity : 0,
        quantity: item.quantity,
      })),
      subtotal,
      tax: taxAmount,
      total,
      createdAt: new Date().toISOString(),
    };

    try {
      setIsProcessing(true);
      const result = await orderApi.posCheckout({
        ...(await buildOrderPayload()),
        ...(payPhone ? { customerPhone: payPhone } : {}),
        paymentMethod,
        ...(payPhone ? { paymentPhone: payPhone } : {}),
        providerName: selectedPaymentMethod.providerName,
      });

      showToast("Payment successful!", "success");
      const idToDelete = activeHeldOrderId;
      setActiveHeldOrderId(null);
      setHeldCount(c => Math.max(0, c - (idToDelete ? 1 : 0)));
      if (idToDelete) {
        void clearLoadedHeldOrders([idToDelete]);
      }

      setReceiptData({
        ...receiptSnapshot,
        orderId: result.id,
        subtotal: result.subTotal ?? receiptSnapshot.subtotal,
        tax: result.taxAmount ?? receiptSnapshot.tax,
        total: result.total ?? receiptSnapshot.total,
      });
      // Always fetch fresh receipt settings before opening the receipt popup
      try {
        const freshSettings = await receiptSettingsApi.getSettings();
        setReceiptSettings(freshSettings);
      } catch { /* use cached settings if fetch fails */ }
      resetTransaction();
      closeCheckout(true);
      setIsReceiptOpen(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Payment failed. Please try again.";
      showToast(message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyOrderId = () => {
    navigator.clipboard?.writeText(draftOrderId);
    showToast("Order ID copied", "success");
  };

  const handleNewOrder = async () => {
    const hadItems = cart.length > 0;
    if (hadItems) {
      setIsProcessing(true);
      const saved = await saveCurrentOrderAsHeld();
      setIsProcessing(false);
      if (!saved) return;
    }
    resetTransaction();
    resetOrderDetails();
    setProductOptions({});
    showToast(
      hadItems ? "Order saved — new order started" : "New order started",
      "success"
    );
  };

  return (
    <div className="flex h-full min-h-0 bg-[#eef1f7]">
      {/* ── CATALOG ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden p-4 md:p-5">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide shrink-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className={cn(
              "shrink-0 px-5 py-2 rounded-full text-sm font-semibold border transition-all",
              selectedCategory === "All"
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                : "bg-white/90 text-muted-foreground border-border hover:border-primary/30 hover:text-primary"
            )}
          >
            All Menus
          </button>
          {comboCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory(POS_COMBOS_CATEGORY)}
              className={cn(
                "shrink-0 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border whitespace-nowrap transition-all",
                selectedCategory === POS_COMBOS_CATEGORY
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-white/90 text-muted-foreground border-border hover:border-primary/30 hover:text-primary"
              )}
            >
              <Layers className="size-4 shrink-0" />
              Combos
              <span className="text-[10px] font-bold opacity-80">({comboCount})</span>
            </button>
          )}
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "shrink-0 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold border whitespace-nowrap transition-all",
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-white/90 text-muted-foreground border-border hover:border-primary/30 hover:text-primary"
              )}
            >
              {cat.imageUrl ? (
                <img src={cat.imageUrl} alt="" className="size-5 rounded-full object-cover shrink-0" />
              ) : null}
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
          {/* Search bar — prominent & full-width on left */}
          <div className="relative flex-1 min-w-[180px] max-w-[340px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 shadow-sm"
            />
          </div>

          <p className="text-xs font-semibold text-muted-foreground shrink-0 hidden md:block">
            {filteredProducts.length} items
          </p>

          {/* View toggle */}
          <div className="flex items-center gap-1 ml-auto">
            {(["grid", "list"] as ViewMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "size-9 rounded-lg border flex items-center justify-center transition-all",
                  viewMode === mode
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white border-zinc-200 text-zinc-400 hover:border-primary/30"
                )}
              >
                {mode === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </button>
            ))}
          </div>

          {/* New Order button */}
          <button
            type="button"
            onClick={handleNewOrder}
            className="h-9 px-3.5 rounded-lg text-xs font-bold border-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/40 flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            <Plus className="size-3.5" />
            New Order
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 pb-2 min-h-0">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-[148px] bg-white/70 rounded-xl animate-pulse border border-zinc-100" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
              <Search className="size-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No products found</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
              {filteredProducts.map(product => {
                const opts = productOptions[product.id] || {};
                const itemOptions = parseMenuItemOptions(product);
                const selected = isInCart(product.id) || activeProductId === product.id;
                const outOfStock = !product.isAvailable;
                const hasDiscount = menuItemHasDiscount(product);
                const effectivePrice = getMenuItemEffectivePrice(product);
                const discountPct = getMenuItemDiscountPercent(product);
                const comboLabel = product.isComposite && product.components?.length
                  ? product.components.map(c => `${c.quantity}× ${c.name}`).join(" + ")
                  : undefined;

                return (
                  <PosProductCard
                    key={product.id}
                    name={product.name}
                    categoryLabel={
                      product.isComposite
                        ? "Combo"
                        : categoryName(product.categoryId)
                    }
                    imageUrl={product.imageUrl}
                    price={effectivePrice}
                    originalPrice={hasDiscount ? product.price : product.savings ? product.componentsTotal : undefined}
                    discountPercent={discountPct}
                    hasDiscount={hasDiscount || (product.savings != null && product.savings > 0)}
                    outOfStock={outOfStock}
                    selected={selected}
                    isComposite={product.isComposite}
                    comboLabel={comboLabel}
                    onClick={() => !outOfStock && addToCart(product)}
                  >
                    {!outOfStock && !product.isComposite && itemOptions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                        {itemOptions.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setProductVariant(product.id, opt)}
                            className={optionChip(opts.variant === opt)}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </PosProductCard>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  type="button"
                  disabled={!product.isAvailable}
                  onClick={() => addToCart(product)}
                  className="flex items-center gap-4 bg-white rounded-xl border border-zinc-100 p-3 text-left hover:border-primary/30 hover:shadow-sm disabled:opacity-50"
                >
                  <div className="size-14 rounded-xl overflow-hidden bg-zinc-100 shrink-0">
                    <PosMenuItemImage src={product.imageUrl} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{product.name}</p>
                    <p className="text-xs text-zinc-400">
                      {product.isComposite ? "Combo" : categoryName(product.categoryId)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn("text-sm font-bold block", priceAmountClass)}>
                      ${getMenuItemEffectivePrice(product).toFixed(2)}
                    </span>
                    {menuItemHasDiscount(product) && (
                      <span className="text-[10px] text-zinc-400 line-through">
                        ${product.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <Plus className="size-4 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── ORDER SIDEBAR ── */}
      <aside className="w-full max-w-[460px] shrink-0 bg-white border-l border-border flex flex-col shadow-[-10px_0_32px_rgba(91,16,23,0.07)]">
        <div className="px-5 py-4 border-b border-border/60 space-y-4 bg-zinc-50/50">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <ShoppingBag className="size-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-zinc-900 dark:text-white leading-none">Point of Sale</h1>
                <p className="text-[10px] text-zinc-400 mt-1">New transaction</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground bg-white border border-border px-2 py-1 rounded-md font-medium flex items-center gap-1 shadow-sm">
                Items <span className="font-bold bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </span>
              <button
                type="button"
                onClick={fetchRecentOrders}
                className="relative size-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-primary transition-all shadow-sm"
                title="View saved orders"
              >
                <History className="size-4" />
                {heldCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-primary text-white animate-pulse border border-white">
                    {heldCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleClearOrder}
                className="size-8 rounded-lg border border-border bg-white flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-primary transition-all shadow-sm"
                title="Clear current transaction"
              >
                <Eraser className="size-4" />
              </button>
            </div>
          </div>

          {/* Customer Selection Row */}
          <div className="border-t border-border/40 pt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">CUSTOMER</span>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => handleSelectCustomerById("")}
                  className="text-[10px] text-destructive hover:underline font-semibold"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PosCustomerPhoneCombobox
                  value={customerPhone}
                  options={selectPhoneOptions}
                  selectedCustomerId={selectedCustomer}
                  onValueChange={handleCustomerPhoneChange}
                  onBlur={handleCustomerPhoneBlur}
                  onSelect={handleSelectCustomerById}
                  placeholder="Select Customer"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomerDialogOpen(true)}
                className="size-11 rounded-lg border border-primary/20 bg-primary/5 text-primary flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all shrink-0 shadow-sm"
                title="Add new customer"
              >
                <User className="size-4" />
              </button>
            </div>
            {customerName && (
              <div className="text-[11px] text-zinc-500 font-medium px-1 flex items-center gap-1.5">
                <User className="size-3 text-zinc-400" />
                Selected: <span className="font-semibold text-zinc-700">{customerName}</span>
              </div>
            )}
          </div>

        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <div className="size-16 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                <Utensils className="size-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">No items yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Tap a product to add</p>
            </div>
          ) : (
            cart.map(item => {
              const optionLabel = formatCartOptions(item);
              const lineLabel = [
                `${item.quantity}x ${item.name}`,
                optionLabel,
                item.lineNote,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={item.key}
                  className="flex items-center gap-2 bg-white border border-zinc-100 rounded-lg px-2.5 py-2 shadow-sm"
                >
                  <div className="size-8 rounded-md overflow-hidden bg-zinc-50 border border-zinc-100 shrink-0">
                    <PosMenuItemImage src={item.imageUrl} iconClassName="size-4 m-2" />
                  </div>
                  <button
                    type="button"
                    onClick={() => openLineEditor(item)}
                    className="flex-1 min-w-0 text-left text-xs font-medium text-foreground truncate hover:text-primary"
                    title={lineLabel}
                  >
                    {lineLabel}
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, -1)}
                      className="size-6 rounded border border-zinc-200 bg-white text-muted-foreground flex items-center justify-center hover:border-primary hover:text-primary"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="text-xs font-semibold min-w-[1rem] text-center dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, 1)}
                      className="size-6 rounded border border-zinc-200 bg-white text-muted-foreground flex items-center justify-center hover:border-primary hover:text-primary"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-bold shrink-0 w-14 text-right tabular-nums",
                      priceAmountClass
                    )}
                  >
                    ${lineNet(item).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openLineEditor(item)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition hover:bg-primary/10 hover:text-primary"
                    aria-label={`Edit ${item.name}`}
                    title="Edit item"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.key)}
                    className="shrink-0 text-muted-foreground/50 hover:text-destructive p-0.5"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <div className="px-5 pb-2">
            <textarea
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
              placeholder="Notes (e.g. 1 item no sugar)"
              rows={2}
              className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg outline-none focus:border-primary resize-none"
            />
          </div>
        )}

        <div className="shrink-0 border-t border-border/60 bg-white p-5 space-y-3">
          <button
            type="button"
            onClick={() => setSummaryOpen(o => !o)}
            className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground"
          >
            Order Summary
            <ChevronDown className={cn("size-4 transition-transform", summaryOpen && "rotate-180")} />
          </button>

          {summaryOpen && (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Line Total</span>
                <span className={summaryAmountClass}>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax / VAT</span>
                <span className={summaryAmountClass}>${taxAmount.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-destructive dark:text-white">
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-end justify-between pt-1">
            <span className="text-sm font-semibold text-muted-foreground">Total Bill</span>
            <span className={cn("text-xl font-bold tabular-nums", priceAmountClass)}>
              $ {total.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleHoldOrder}
              disabled={cart.length === 0 || isProcessing}
              className="flex-1 h-10 rounded-md bg-zinc-50 hover:bg-zinc-100 text-foreground border-zinc-200 font-medium text-xs shadow-sm"
            >
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : "Save Order"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDiscountModalOpen(true)}
              disabled={cart.length === 0}
              className="h-10 px-3 rounded-md border-zinc-200 text-primary font-medium text-xs gap-1 shrink-0"
            >
              <Percent className="size-3.5" />
              Discount
            </Button>
            <Button
              type="button"
              onClick={handleOpenPayment}
              disabled={cart.length === 0}
              className={cn(btnCreatePage, "flex-1 h-10 rounded-md text-xs gap-1")}
            >
              Payment
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Cart line update */}
      <Dialog open={!!editingLineKey && !!lineEditDraft} onOpenChange={open => !open && closeLineEditor()}>
        <DialogContent className="sm:max-w-[500px] gap-0 overflow-hidden rounded-xl border-zinc-200 bg-white p-0 [&>button]:hidden">
          <DialogClose asChild>
            <button
              type="button"
              className="absolute right-4 top-4 z-20 flex size-6 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
              aria-label="Close item editor"
            >
              <X className="size-3.5" />
            </button>
          </DialogClose>

          <div className="border-b border-zinc-200 px-5 py-4 pr-12">
            <DialogTitle className="text-lg font-bold text-zinc-900">
              Update {cart.find(item => item.key === editingLineKey)?.name || "Item"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Update quantity, price, discount, tax rate, and item note.
            </DialogDescription>
          </div>

          {lineEditDraft && (
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                {([
                  { key: "tax", label: "Tax Rate", suffix: "%" },
                  { key: "quantity", label: "Quantity" },
                  { key: "price", label: "Rate" },
                  { key: "discount", label: "Discount Amount" },
                ] as const).map(field => (
                  <label key={field.key} className="space-y-1.5 text-sm font-medium text-zinc-700">
                    <span>{field.label}</span>
                    <div className="relative">
                      <input
                        type="number"
                        min={field.key === "quantity" ? 1 : 0}
                        max={field.key === "tax" ? 100 : undefined}
                        step={field.key === "quantity" || field.key === "price" ? 1 : 0.01}
                        value={lineEditDraft[field.key]}
                        onFocus={() => setLineEditField(field.key)}
                        onChange={event => updateLineDraft(field.key, event.target.value)}
                        className={cn(
                          "h-11 w-full rounded-md border bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/15",
                          "suffix" in field ? "pr-9" : "",
                          lineEditField === field.key ? "border-primary" : "border-zinc-200"
                        )}
                      />
                      {"suffix" in field && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{field.suffix}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <label className="block space-y-1.5 text-sm font-medium text-zinc-700">
                <span>Item Note</span>
                <input
                  type="text"
                  value={lineEditDraft.note}
                  onChange={event => setLineEditDraft(current => current ? { ...current, note: event.target.value } : current)}
                  placeholder="e.g. no sugar"
                  className="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <div className="grid grid-cols-4 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                {([
                  ["quantity", "Qty"],
                  ["price", "Rate"],
                  ["discount", "Discount"],
                  ["tax", "Tax"],
                ] as const).map(([field, label]) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setLineEditField(field)}
                    className={cn(
                      "h-11 rounded-md border text-xs font-bold transition",
                      lineEditField === field
                        ? "border-primary bg-primary text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-primary/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-200 p-3">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "."].map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pressLineKey(key)}
                    className={cn(
                      "h-12 rounded-md bg-zinc-50 text-lg font-semibold text-zinc-800 transition hover:bg-zinc-100",
                      key === "C" && "bg-amber-400 text-white hover:bg-amber-500"
                    )}
                  >
                    {key}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => pressLineKey("backspace")}
                  className="col-span-3 h-10 rounded-md border border-red-300 text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                  Backspace
                </button>
              </div>
            </div>
          )}

          <DialogFooter className="flex-row justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-4">
            <Button type="button" variant="outline" onClick={closeLineEditor} className="rounded-md">
              Cancel
            </Button>
            <Button type="button" onClick={saveLineEditor} className={cn(btnCreatePage, "rounded-md")}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <Dialog
        open={isCheckoutOpen}
        onOpenChange={open => {
          if (!open) closeCheckout();
        }}
      >
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 gap-0 overflow-hidden rounded-2xl flex flex-col max-h-[92vh] [&>button]:hidden">
          <DialogClose asChild>
            <button type="button" className="absolute right-4 top-4 size-6 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors z-50">
              <X className="size-3.5 text-white" />
            </button>
          </DialogClose>
          <DialogTitle className="sr-only">Checkout</DialogTitle>

          <div className="shrink-0 px-6 py-4 border-b border-zinc-100">
            <DialogTitle className="text-lg font-bold text-zinc-900">Checkout</DialogTitle>
            <DialogDescription className="hidden">
              Confirm order details and complete payment.
            </DialogDescription>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            {/* 1. Order Type Selection */}
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase mb-3 block tracking-wide">
                Order Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {([{ id: "dine-in", label: "Dine In", icon: Utensils }, { id: "takeaway", label: "Takeaway", icon: ShoppingBag }, { id: "delivery", label: "Delivery", icon: Truck }] as const).map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleOrderTypeChange(type.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 h-18 rounded-xl border-2 text-xs font-bold transition-all bg-white",
                        orderType === type.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-zinc-200 text-zinc-500 hover:border-primary/40"
                      )}
                    >
                      <Icon className="size-4.5" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {orderType === "takeaway" && (
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <label className="text-xs font-semibold text-zinc-500 uppercase block tracking-wide">
                  When to pick up
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["now", "later"] as const).map(timing => (
                    <button
                      key={timing}
                      type="button"
                      onClick={() => handleTakeawayTimingChange(timing)}
                      className={cn(
                        "h-10 rounded-lg border-2 text-xs font-bold capitalize transition-all",
                        takeawayTiming === timing
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-zinc-200 text-zinc-500 hover:border-primary/40"
                      )}
                    >
                      {timing}
                    </button>
                  ))}
                </div>

                {takeawayTiming === "later" && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={e => setPickupDate(e.target.value)}
                      aria-label="Pickup date"
                      className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm"
                    />
                    <input
                      type="time"
                      value={pickupTime}
                      onChange={e => setPickupTime(e.target.value)}
                      aria-label="Pickup time"
                      className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* 2. Customer Info (Read Only) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase block tracking-wide">Customer</label>
              <div className="px-4 py-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
                <span className="font-semibold text-zinc-800">{customerName || "Guest"}</span>
                {customerPhone && <span className="text-xs text-zinc-500">{customerPhone}</span>}
              </div>
            </div>

            {/* 2b. Table Selection — only for Dine-in, shown right below Customer */}
            {orderType === "dine-in" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase block tracking-wide flex items-center gap-1.5">
                  <UtensilsCrossed className="size-3.5" />
                  Assign Table
                </label>
                <select
                  id="checkout-pos-table"
                  value={selectedTable ?? ""}
                  onChange={e => setSelectedTable(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-11 px-3 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">Select a table</option>
                  {activeTables.map(table => (
                    <option key={table.id} value={table.id}>
                      Table {table.number}{table.name ? ` — ${table.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. Dine-in / Delivery Details */}
            {/* Table selection moved to popup form below Customer */}

            {orderType === "delivery" && (
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <label className="text-xs font-semibold text-zinc-500 uppercase block tracking-wide">
                  Delivery Address
                </label>
                <input type="text" value={deliveryStreet} onChange={e => setDeliveryStreet(e.target.value)}
                  placeholder="Street address *"
                  className="w-full h-11 px-3 border border-zinc-200 rounded-lg text-sm" />
                <input type="text" value={deliveryDistrict} onChange={e => setDeliveryDistrict(e.target.value)}
                  placeholder="District / area"
                  className="w-full h-11 px-3 border border-zinc-200 rounded-lg text-sm" />
              </div>
            )}

            {/* 4. Payment Method & Details */}
            <div className="border-t border-zinc-100 pt-4 space-y-4">
              {/* Payment Method */}
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase mb-3 block tracking-wide">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethodsList.map(method => {
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 text-[10px] font-bold transition-all bg-white",
                          paymentMethod === method.id
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-zinc-200 text-zinc-500 hover:border-primary/40"
                        )}
                      >
                        <method.icon className="size-4.5" />
                        {method.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile number */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase block tracking-wide">
                  Mobile Number
                  <span className="text-zinc-400 font-normal normal-case ml-1">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={paymentPhone}
                  onChange={e => setPaymentPhone(e.target.value)}
                  placeholder="e.g. 61XXXXXXX"
                  className="w-full h-11 px-3 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-medium"
                />
                <p className="text-xs text-zinc-400">
                  {paymentMethod === "premier_wallet"
                    ? "Required for Premier Wallet payment."
                    : "Optional. Uses customer phone if left empty."}
                </p>
              </div>
            </div>

            {/* 5. Total */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
              <span className="text-sm font-semibold text-zinc-600">Amount to pay</span>
              <span className={cn("text-2xl font-bold tabular-nums", priceAmountClass)}>
                ${total.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="shrink-0 grid grid-cols-2 gap-3 px-6 py-4 bg-zinc-50 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => closeCheckout(true)}
              disabled={isProcessing}
              className="h-11 rounded-lg border-2 border-primary text-primary font-bold text-sm transition-all hover:bg-primary/5 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isProcessing}
              className="h-11 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isProcessing ? (
                <><Loader2 className="size-4 animate-spin" />Processing...</>
              ) : (
                <><CheckCircle2 className="size-4" />Confirm & Pay</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt after payment */}
      <Dialog
        open={isReceiptOpen}
        onOpenChange={open => {
          if (!open) {
            setIsReceiptOpen(false);
            setReceiptData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px] bg-white border-zinc-100 p-0 overflow-hidden rounded-2xl flex flex-col max-h-[92vh] [&>button]:hidden">
          <DialogTitle className="sr-only">Receipt</DialogTitle>

          {/* Fixed header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Receipt</h2>
              <p className="text-xs text-zinc-500">Payment confirmed successfully</p>
            </div>
            <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="size-5 text-emerald-600" />
            </div>
          </div>

          {/* Scrollable receipt body */}
          {receiptData && (
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              <div className="mx-auto max-w-[320px] rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <ReceiptBody data={receiptData} settings={receiptSettings} />
              </div>
            </div>
          )}

          {/* Fixed footer with buttons */}
          <div className="shrink-0 grid grid-cols-2 gap-3 px-6 py-4 bg-zinc-50 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => { setIsReceiptOpen(false); setReceiptData(null); }}
              className="h-11 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-sm transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="h-11 rounded-lg bg-primary hover:bg-primary text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Printer className="size-4" />
              Print Receipt
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount */}
      <Dialog open={isDiscountModalOpen} onOpenChange={setIsDiscountModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl p-6 [&>button]:hidden">
          <DialogClose asChild>
            <button type="button" className="absolute right-4 top-4 size-6 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors z-50">
              <X className="size-3.5 text-white" />
            </button>
          </DialogClose>
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-bold text-zinc-900 leading-tight">Apply Discount</DialogTitle>
            <p className="text-xs text-zinc-400">Header discount applies after line discounts.</p>
          </DialogHeader>
          
          <div className="py-2">
            {/* Tabs grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setDiscountType("percentage")}
                className={cn(
                  "h-11 rounded-lg text-sm font-bold border transition-all",
                  discountType === "percentage"
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white border-primary text-primary hover:bg-primary/5"
                )}
              >
                Percent
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("fixed")}
                className={cn(
                  "h-11 rounded-lg text-sm font-bold border transition-all",
                  discountType === "fixed"
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white border-primary text-primary hover:bg-primary/5"
                )}
              >
                Fixed Amount
              </button>
            </div>

            {/* Presets Row */}
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {[5, 10, 15, 20].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setDiscountType("percentage");
                    setTempDiscount(String(pct));
                  }}
                  className="h-10 rounded-lg border border-primary text-primary font-bold text-xs bg-white hover:bg-zinc-50 transition-all shadow-sm"
                >
                  {pct}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDiscountType("percentage");
                  setTempDiscount("0");
                }}
                className="h-10 rounded-lg border border-primary text-primary font-bold text-xs bg-white hover:bg-zinc-50 transition-all shadow-sm"
              >
                Reset
              </button>
            </div>

            {/* Value display */}
            <div className="space-y-1.5 mb-3">
              <label className="text-xs font-bold text-zinc-600 block">Discount Value</label>
              <input
                type="text"
                readOnly
                value={tempDiscount}
                className="w-full h-12 border border-zinc-200 rounded-lg px-3 text-sm font-bold bg-white text-zinc-800 outline-none"
              />
            </div>

            {/* Messages */}
            <div className="text-xs text-zinc-500 font-medium space-y-1 mb-4">
              <p>Amount After Line Discount: ${subtotal.toFixed(2)}</p>
              <p className={cn(parseFloat(tempDiscount) > 0 ? "text-primary font-bold" : "text-zinc-400 font-medium")}>
                {parseFloat(tempDiscount) === 0
                  ? "No discount applied."
                  : discountType === "percentage"
                  ? `Discount applied: ${tempDiscount}% (-$${((subtotal * parseFloat(tempDiscount)) / 100).toFixed(2)})`
                  : `Discount applied: -$${parseFloat(tempDiscount).toFixed(2)}`}
              </p>
            </div>

            {/* Keypad grid */}
            <div className="grid grid-cols-3 gap-2">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3", "C", "0", "."].map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadPress(key)}
                  className={cn(
                    "h-14 rounded-lg flex items-center justify-center font-bold text-lg border transition-all shadow-sm",
                    key === "C"
                      ? "bg-primary hover:bg-primary border-primary text-white"
                      : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-100 mt-2">
            <DialogClose asChild>
              <button
                type="button"
                className="h-11 rounded-lg border-2 border-primary text-primary font-bold text-sm transition-all hover:bg-primary/5"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={() => {
                setDiscount(parseFloat(tempDiscount) || 0);
                setIsDiscountModalOpen(false);
              }}
              className="h-11 rounded-lg bg-primary hover:bg-primary text-white font-bold text-sm shadow-sm transition-all"
            >
              Apply
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held orders */}
      <Dialog open={isRecentOrdersOpen} onOpenChange={setIsRecentOrdersOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl p-0 overflow-hidden [&>button]:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <History className="size-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold leading-none">Saved Orders</DialogTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">{recentOrders.length} order{recentOrders.length !== 1 ? "s" : ""} on hold</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {recentOrders.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const ids = recentOrders.map(o => o.id);
                    await clearLoadedHeldOrders(ids, true);
                    setActiveHeldOrderId(null);
                    showToast("All saved orders cleared", "success");
                  }}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="size-3" />
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsRecentOrdersOpen(false)}
                className="size-7 rounded-lg border border-border bg-white flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Orders list */}
          <div className="max-h-[400px] overflow-y-auto p-3 space-y-2">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <UtensilsCrossed className="size-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No saved orders</p>
              </div>
            ) : (
              recentOrders.map(order => {
                const isActive = activeHeldOrderId === order.id;
                const typeLabel =
                  order.orderType === "delivery"
                    ? "Delivery"
                    : order.orderType === "takeaway"
                      ? "Takeaway"
                      : order.orderType === "dine-in"
                        ? "Dine-in"
                        : "Saved";
                return (
                  <div
                    key={order.id}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border transition-colors",
                      isActive ? "bg-primary/10 border-primary/40" : "bg-muted/30 border-border"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => resumeOrder(order)}
                      className="flex-1 flex items-center gap-3 p-3 text-left hover:opacity-80 transition-opacity"
                    >
                      <History className="size-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">Order #{order.id}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {typeLabel} · {order.orderitem?.length || 0} items
                          {isActive ? " · In cart" : ""}
                        </p>
                      </div>
                      <span className={cn("text-sm font-bold", priceAmountClass)}>
                        ${order.total?.toFixed(2)}
                      </span>
                    </button>
                    {/* Per-order delete */}
                    <button
                      type="button"
                      title="Remove this saved order"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await clearLoadedHeldOrders([order.id], false);
                        setRecentOrders(prev => prev.filter(o => o.id !== order.id));
                        setHeldCount(c => Math.max(0, c - 1));
                        if (activeHeldOrderId === order.id) setActiveHeldOrderId(null);
                        showToast(`Order #${order.id} removed`, "success");
                      }}
                      className="size-7 rounded-lg mr-2 flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerDialogOpen} onOpenChange={setIsAddCustomerDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 [&>button]:hidden">
          <DialogClose asChild>
            <button type="button" className="absolute right-4 top-4 size-6 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors z-50">
              <X className="size-3.5 text-white" />
            </button>
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">Add Customer</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">Create a new customer profile</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase block">Full Name</label>
              <input
                type="text"
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-zinc-400 font-medium"
                placeholder="Customer Name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase block">Phone Number</label>
              <input
                type="tel"
                value={newCustomerPhone}
                onChange={e => setNewCustomerPhone(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-zinc-400 font-medium"
                placeholder="Phone Number"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-100 mt-2">
            <DialogClose asChild>
              <button
                type="button"
                className="h-11 rounded-lg border-2 border-primary text-primary font-bold text-sm transition-all hover:bg-primary/5"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleAddCustomer}
              className="h-11 rounded-lg bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-sm transition-all"
            >
              Save Customer
            </button>
          </div>
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







