"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Layers,
  ChevronDown,
  X,
  Minus,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Category } from "@/lib/api/restaurant/categoryApi";
import { MenuItem } from "@/lib/api/restaurant/menuItemApi";
import {
  compositeApi,
  CompositeMenuItem,
  CompositeComponentInput,
} from "@/lib/api/restaurant/compositeApi";
import {
  getMenuItemEffectivePrice,
  menuItemHasDiscount,
} from "@/lib/menu-item-pricing";
import { compressImageFile } from "@/lib/compress-image";
import { dispatchMenuChanged } from "@/lib/live-updates";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  actionBtnEdit,
  actionBtnDelete,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardStatusBadgeClass,
  getTableStatusBadgeClass,
  btnCreatePage,
  btnCreateSubmit,
  btnModalCancel,
  dashboardCardClass,
  dashboardControlsRowClass,
  dashboardTableWrapClass,
  dashboardPaginationClass,
  dashboardLabelClass,
  dashboardSelectClass,
  dashboardInputClass,
} from "@/lib/dashboard-ui";

const formLabelClass = "text-xs font-medium text-[#1e293b] dark:text-zinc-200";
const formInputClass =
  "w-full px-3 py-2 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm font-medium dark:text-white placeholder:text-zinc-400";

type ComponentRow = CompositeComponentInput & { key: string; categoryId: number };

function newComponentRow(categoryId = 0, menuItemId = 0, quantity = 1): ComponentRow {
  return { key: `${Date.now()}-${Math.random()}`, categoryId, menuItemId, quantity };
}

function itemsForCategory(simpleItems: MenuItem[], categoryId: number) {
  if (!categoryId) return [];
  return simpleItems.filter((item) => item.categoryId === categoryId);
}

function buildOptimisticCombo(
  payload: {
    name: string;
    description?: string;
    categoryId: number;
    compositePricing: "sum" | "fixed";
    price?: number;
    tax: number;
    discountType: "" | "percentage" | "fixed" | null;
    discountValue: number;
    isAvailable: boolean;
    imageUrl?: string;
    components: { menuItemId: number; quantity: number }[];
  },
  simpleItems: MenuItem[],
  existingId?: number
): CompositeMenuItem {
  const pricedRows = payload.components.map((c) => ({
    quantity: c.quantity,
    componentItem: simpleItems.find((i) => i.id === c.menuItemId)!,
  }));
  const componentsTotal = sumComponentsTotal(
    payload.components.map((c) => ({
      ...c,
      key: "x",
      categoryId: simpleItems.find((i) => i.id === c.menuItemId)?.categoryId || 0,
    })),
    simpleItems
  );
  const price =
    payload.compositePricing === "sum"
      ? componentsTotal
      : Math.max(0, Number(payload.price) || 0);
  const base = {
    id: existingId ?? -Date.now(),
    name: payload.name,
    description: payload.description,
    categoryId: payload.categoryId,
    price,
    tax: payload.tax,
    discountType: payload.discountType || null,
    discountValue: payload.discountValue,
    isAvailable: payload.isAvailable,
    isRecommended: false,
    imageUrl: payload.imageUrl,
    isComposite: true as const,
    compositePricing: payload.compositePricing,
  };
  const enriched = getMenuItemEffectivePrice({
    price,
    discountType: payload.discountType || undefined,
    discountValue: payload.discountValue,
  });
  return {
    ...base,
    components: pricedRows.map((row) => ({
      menuItemId: row.componentItem.id,
      name: row.componentItem.name,
      quantity: row.quantity,
      unitPrice: getMenuItemEffectivePrice(row.componentItem),
      lineTotal:
        Math.round(
          getMenuItemEffectivePrice(row.componentItem) * row.quantity * 100
        ) / 100,
    })),
    componentsTotal,
    effectivePrice: enriched,
    savings:
      payload.compositePricing === "fixed" && componentsTotal > enriched
        ? Math.round((componentsTotal - enriched) * 100) / 100
        : 0,
  };
}

function sumComponentsTotal(
  rows: ComponentRow[],
  simpleItems: MenuItem[]
): number {
  return rows.reduce((sum, row) => {
    const item = simpleItems.find((i) => i.id === row.menuItemId);
    if (!item) return sum;
    return sum + getMenuItemEffectivePrice(item) * Math.max(1, row.quantity);
  }, 0);
}

export default function CompositesPage() {
  const { showToast } = useToast();
  const [composites, setComposites] = useState<CompositeMenuItem[]>([]);
  const [simpleItems, setSimpleItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOptionsLoading, setFormOptionsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [saving, setSaving] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<CompositeMenuItem | null>(null);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPricing, setFormPricing] = useState<"sum" | "fixed">("fixed");
  const [formPrice, setFormPrice] = useState("");
  const [formTax, setFormTax] = useState("0");
  const [formDiscountType, setFormDiscountType] = useState<"" | "percentage" | "fixed">("");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formComponents, setFormComponents] = useState<ComponentRow[]>([
    newComponentRow(),
  ]);

  const componentsSum = useMemo(
    () => sumComponentsTotal(formComponents, simpleItems),
    [formComponents, simpleItems]
  );

  const computedPrice =
    formPricing === "sum"
      ? componentsSum
      : Math.max(0, Number(formPrice) || 0);

  const finalPrice = getMenuItemEffectivePrice({
    price: computedPrice,
    discountType: formDiscountType || undefined,
    discountValue: Number(formDiscountValue || 0),
  });

  const fetchComposites = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const comboData = await compositeApi.getAll(forceRefresh);
      setComposites(comboData || []);
    } catch {
      showToast("Failed to load combos", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadFormOptions = useCallback(async (forceRefresh = false) => {
    try {
      setFormOptionsLoading(true);
      const { categories: cats, menuItems: items } =
        await compositeApi.getFormData(forceRefresh);
      setCategories(cats || []);
      setSimpleItems(items || []);
    } catch {
      showToast("Failed to load menu options", "error");
    } finally {
      setFormOptionsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchComposites();
    void loadFormOptions();
  }, [fetchComposites, loadFormOptions]);

  useEffect(() => {
    if (!isFormOpen || !selected || simpleItems.length === 0) return;
    setFormComponents((prev) => {
      const needsCategory = prev.some((r) => r.menuItemId > 0 && !r.categoryId);
      if (!needsCategory) return prev;
      return (selected.components || []).map((c) => {
        const menuItem = simpleItems.find((i) => i.id === c.menuItemId);
        return newComponentRow(menuItem?.categoryId || 0, c.menuItemId, c.quantity);
      });
    });
  }, [isFormOpen, selected, simpleItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return composites.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.components?.some((x) => x.name.toLowerCase().includes(q));
      const matchesCategory =
        categoryFilter === "all" || String(c.categoryId) === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && c.isAvailable) ||
        (statusFilter === "hidden" && !c.isAvailable);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [composites, search, categoryFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, pageSize]);

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormPricing("fixed");
    setFormPrice("");
    setFormTax("0");
    setFormDiscountType("");
    setFormDiscountValue("");
    setFormIsAvailable(true);
    setFormImageUrl("");
    setFormComponents([newComponentRow()]);
    setSelected(null);
  };

  const openCreate = () => {
    resetForm();
    setIsFormOpen(true);
    if (categories.length === 0) void loadFormOptions();
  };

  const openEdit = (item: CompositeMenuItem) => {
    setSelected(item);
    setFormName(item.name);
    setFormDesc(item.description || "");
    setFormPricing(item.compositePricing || "fixed");
    setFormPrice(String(item.price));
    setFormTax(String(item.tax || 0));
    setFormDiscountType(
      item.discountType === "percentage" || item.discountType === "fixed"
        ? item.discountType
        : ""
    );
    setFormDiscountValue(
      item.discountValue && item.discountValue > 0 ? String(item.discountValue) : ""
    );
    setFormIsAvailable(item.isAvailable);
    setFormImageUrl(item.imageUrl || "");
    setFormComponents(
      (item.components || []).map((c) => {
        const menuItem = simpleItems.find((i) => i.id === c.menuItemId);
        return newComponentRow(menuItem?.categoryId || 0, c.menuItemId, c.quantity);
      })
    );
    if (!item.components?.length) setFormComponents([newComponentRow()]);
    setIsFormOpen(true);
    if (categories.length === 0) void loadFormOptions();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size should be less than 5MB", "error");
      return;
    }
    try {
      setFormImageUrl(await compressImageFile(file));
    } catch {
      showToast("Failed to process image", "error");
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast("Combo name is required", "error");
      return;
    }
    const components = formComponents
      .filter((r) => r.menuItemId > 0)
      .map(({ menuItemId, quantity }) => ({
        menuItemId,
        quantity: Math.max(1, quantity),
      }));
    if (components.length === 0) {
      showToast("Add at least one menu item to the combo", "error");
      return;
    }
    const incompleteRow = formComponents.some(
      (r) => (r.categoryId > 0 && !r.menuItemId) || (!r.categoryId && r.menuItemId > 0)
    );
    if (incompleteRow) {
      showToast("Select both category and menu item on each row", "error");
      return;
    }
    const firstMenuItem = simpleItems.find((i) => i.id === components[0].menuItemId);
    if (!firstMenuItem?.categoryId) {
      showToast("Each row needs a category and menu item", "error");
      return;
    }
    if (formPricing === "fixed" && (!formPrice || Number(formPrice) <= 0)) {
      showToast("Enter a bundle price for fixed pricing", "error");
      return;
    }

    setSaving(true);
    const payload = {
      name: formName.trim(),
      description: formDesc.trim() || undefined,
      categoryId: firstMenuItem.categoryId,
      compositePricing: formPricing,
      price: formPricing === "fixed" ? Number(formPrice) : undefined,
      tax: Number(formTax || 0),
      discountType: formDiscountType || null,
      discountValue: formDiscountValue ? Number(formDiscountValue) : 0,
      isAvailable: formIsAvailable,
      imageUrl: formImageUrl || undefined,
      components,
    };

    const previousComposites = composites;
    const optimistic = buildOptimisticCombo(
      payload,
      simpleItems,
      selected?.id
    );

    setIsFormOpen(false);
    resetForm();
    showToast(selected ? "Combo updated" : "Combo created", "success");
    setComposites((prev) =>
      selected
        ? prev.map((c) => (c.id === selected.id ? optimistic : c))
        : [optimistic, ...prev]
    );
    dispatchMenuChanged();

    try {
      const saved = selected
        ? await compositeApi.update(selected.id, payload)
        : await compositeApi.create(payload);
      setComposites((prev) =>
        prev.map((c) => {
          if (selected && c.id === selected.id) return saved;
          if (!selected && c.id === optimistic.id) return saved;
          return c;
        })
      );
    } catch (err: unknown) {
      setComposites(previousComposites);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Save failed";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await compositeApi.delete(selected.id);
      setComposites((prev) => prev.filter((c) => c.id !== selected.id));
      dispatchMenuChanged();
      showToast("Combo deleted", "success");
      setIsDeleteOpen(false);
      resetForm();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(message || "Delete failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Menu Combos</h1>
      </div>

      <div className={dashboardCardClass}>
        <div className={dashboardControlsRowClass}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span className={dashboardLabelClass}>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={cn(dashboardSelectClass, "w-16 px-2")}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={dashboardLabelClass}>Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={cn(dashboardSelectClass, "w-40 px-3")}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={dashboardLabelClass}>Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(dashboardSelectClass, "w-36 px-3")}
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64 group">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search combos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(dashboardInputClass, "w-64")}
              />
            </div>

            <Button variant="outline" asChild className="h-[42px] px-4 rounded-md font-medium text-sm">
              <Link href="/menus">Single Items</Link>
            </Button>

            <Button onClick={openCreate} className={btnCreatePage}>
              <Plus className="size-4" />
              New Combo
            </Button>
          </div>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Combo</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Category</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Components</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Pricing</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Price</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 bg-zinc-100 rounded w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-10 text-center text-zinc-500">
                      <Layers className="size-8 mx-auto mb-2 opacity-40" />
                      No combos found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item, index) => {
                    const rowNo = (currentPage - 1) * pageSize + index + 1;
                    const effective = getMenuItemEffectivePrice(item);
                    const hasDisc = menuItemHasDiscount(item);
                    const categoryName =
                      categories.find((c) => c.id === item.categoryId)?.name || "—";
                    return (
                      <TableRow
                        key={item.id}
                        className="border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                      >
                        <TableCell className="px-6 py-3 text-[13px] text-zinc-500 font-medium">
                          {rowNo}
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center shrink-0 border border-zinc-100 bg-zinc-50">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="size-4 text-zinc-300" />
                              )}
                            </div>
                            <span className="text-[13px] font-medium text-zinc-700 leading-tight">
                              {item.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-[13px] text-zinc-600">
                          {categoryName}
                        </TableCell>
                        <TableCell className="px-6 py-3 text-[13px] text-zinc-600 max-w-[240px]">
                          <span className="line-clamp-2">
                            {(item.components || [])
                              .map((c) => `${c.quantity}× ${c.name}`)
                              .join(", ") || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-[13px] capitalize text-zinc-600">
                          {item.compositePricing === "sum" ? "Sum of items" : "Fixed bundle"}
                          {item.savings != null && item.savings > 0 && (
                            <span className="block text-emerald-600 font-medium text-[11px]">
                              Save ${item.savings.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right tabular-nums">
                          <span className="text-[13px] font-semibold text-primary">
                            ${effective.toFixed(2)}
                          </span>
                          {hasDisc && (
                            <span className="block text-[11px] text-zinc-400 line-through">
                              ${Number(item.price).toFixed(2)}
                            </span>
                          )}
                          {item.componentsTotal != null && item.compositePricing === "fixed" && (
                            <span className="block text-[10px] text-zinc-400">
                              Items total: ${item.componentsTotal.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right">
                          <span
                            className={cn(
                              dashboardStatusBadgeClass,
                              getTableStatusBadgeClass(item.isAvailable ? "active" : "inactive")
                            )}
                          >
                            {item.isAvailable ? "Available" : "Hidden"}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(item)}
                              className={actionBtnEdit}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelected(item);
                                setIsDeleteOpen(true);
                              }}
                              className={actionBtnDelete}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filtered.length === 0
              ? "0 of 0"
              : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              &lt;
            </button>
            <div className="px-3 py-1 border border-zinc-200 rounded-md text-zinc-400">
              {currentPage} of {totalPages || 1}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={(o) => !o && setIsFormOpen(false)}>
        <DialogContent className="sm:max-w-[720px] max-h-[92vh] bg-white dark:bg-[#161616] border-none p-0 gap-0 overflow-hidden rounded-2xl shadow-xl flex flex-col">
          <div className="shrink-0 px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/40 dark:bg-[#1a1a1a]">
            <DialogHeader className="space-y-0.5">
              <DialogTitle className="text-lg font-semibold text-[#1e293b] dark:text-white">
                {selected ? "Edit combo" : "New combo"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs">
                Bundle menu items with sum or fixed pricing. Optional image and discount.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/30 dark:bg-[#1a1a1a]/50">
              <p className={cn(formLabelClass, "mb-2 flex items-center gap-1.5")}>
                <ImageIcon className="size-3.5 text-zinc-400" />
                Combo image
              </p>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shrink-0 flex items-center justify-center">
                  {formImageUrl ? (
                    <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="size-6 text-zinc-300" />
                  )}
                </div>
                <input
                  type="text"
                  value={formImageUrl.startsWith("data:") ? "" : formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="Paste image URL..."
                  className={cn(formInputClass, "flex-1")}
                />
                <label className="cursor-pointer shrink-0">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <span className="inline-flex h-9 px-4 items-center rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/15 transition-colors">
                    Upload
                  </span>
                </label>
                {formImageUrl && (
                  <button
                    type="button"
                    onClick={() => setFormImageUrl("")}
                    className="shrink-0 size-9 rounded-lg border border-zinc-200 dark:border-[#2a2a2a] flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

          <div className="space-y-4 px-6 py-4">
            <div className="space-y-1">
              <label className={formLabelClass}>Combo name *</label>
              <input
                className={formInputClass}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Family Meal"
              />
            </div>

            <div className="space-y-1">
              <label className={formLabelClass}>Description</label>
              <textarea
                className={cn(formInputClass, "min-h-[60px] resize-none")}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className={formLabelClass}>Included items *</label>
                <div className="flex items-center gap-2">
                  {formOptionsLoading && (
                    <span className="text-[11px] text-zinc-400">Updating menu list…</span>
                  )}
                  <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() =>
                    setFormComponents((prev) => [...prev, newComponentRow()])
                  }
                >
                  <Plus className="size-3.5 mr-1" />
                  Add row
                </Button>
                </div>
              </div>

              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_88px_36px] gap-2 px-0.5">
                <span className={cn(formLabelClass, "text-[10px] uppercase tracking-wide")}>
                  Category
                </span>
                <span className={cn(formLabelClass, "text-[10px] uppercase tracking-wide")}>
                  Menu item
                </span>
                <span className={cn(formLabelClass, "text-[10px] uppercase tracking-wide")}>
                  Qty
                </span>
                <span />
              </div>

              {formComponents.map((row, idx) => {
                const rowItems = itemsForCategory(simpleItems, row.categoryId);
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_88px_36px] gap-2 items-center"
                  >
                    <div className="space-y-1 sm:space-y-0">
                      <span className={cn(formLabelClass, "sm:hidden text-[10px]")}>
                        Category
                      </span>
                      <select
                        className={cn(formInputClass, "appearance-none cursor-pointer")}
                        value={row.categoryId || ""}
                        onChange={(e) => {
                          const categoryId = Number(e.target.value);
                          setFormComponents((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, categoryId, menuItemId: 0 }
                                : r
                            )
                          );
                        }}
                      >
                        <option value="">Select category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 sm:space-y-0">
                      <span className={cn(formLabelClass, "sm:hidden text-[10px]")}>
                        Menu item
                      </span>
                      <select
                        className={cn(
                          formInputClass,
                          "appearance-none cursor-pointer",
                          !row.categoryId && "opacity-60"
                        )}
                        value={row.menuItemId || ""}
                        disabled={!row.categoryId}
                        onChange={(e) => {
                          const menuItemId = Number(e.target.value);
                          setFormComponents((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, menuItemId } : r
                            )
                          );
                        }}
                      >
                        <option value="">
                          {row.categoryId ? "Select menu item" : "Select category first"}
                        </option>
                        {rowItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 sm:space-y-0">
                      <span className={cn(formLabelClass, "sm:hidden text-[10px]")}>
                        Qty
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={cn(formInputClass, "w-full sm:w-[88px]")}
                        value={row.quantity}
                        onChange={(e) => {
                          const qty = Math.max(1, Number(e.target.value) || 1);
                          setFormComponents((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, quantity: qty } : r))
                          );
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="size-9 shrink-0 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-red-500 self-end sm:self-auto"
                      onClick={() =>
                        setFormComponents((prev) =>
                          prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)
                        )
                      }
                      aria-label="Remove row"
                    >
                      <Minus className="size-4" />
                    </button>
                  </div>
                );
              })}
              <p className="text-xs text-zinc-500">
                Components total: <strong>${componentsSum.toFixed(2)}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={formLabelClass}>Pricing mode</label>
                <select
                  className={formInputClass}
                  value={formPricing}
                  onChange={(e) =>
                    setFormPricing(e.target.value as "sum" | "fixed")
                  }
                >
                  <option value="fixed">Fixed bundle price</option>
                  <option value="sum">Sum of component prices</option>
                </select>
              </div>
              {formPricing === "fixed" && (
                <div className="space-y-1">
                  <label className={formLabelClass}>Bundle price ($) *</label>
                  <input
                    type="number"
                    step="1"
                    className={formInputClass}
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder={componentsSum.toFixed(2)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className={formLabelClass}>Discount type</label>
                <select
                  className={formInputClass}
                  value={formDiscountType}
                  onChange={(e) => {
                    const v = e.target.value as "" | "percentage" | "fixed";
                    setFormDiscountType(v);
                    if (!v) setFormDiscountValue("");
                  }}
                >
                  <option value="">None</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Discount value</label>
                <input
                  type="number"
                  step="0.01"
                  className={formInputClass}
                  disabled={!formDiscountType}
                  value={formDiscountValue}
                  onChange={(e) => setFormDiscountValue(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Customer pays</label>
                <div className={cn(formInputClass, "bg-primary/5 text-primary font-bold")}>
                  ${finalPrice.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={formLabelClass}>Tax (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className={formInputClass}
                  value={formTax}
                  onChange={(e) => setFormTax(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className={formLabelClass}>Availability</label>
                <select
                  className={formInputClass}
                  value={formIsAvailable ? "yes" : "no"}
                  onChange={(e) => setFormIsAvailable(e.target.value === "yes")}
                >
                  <option value="yes">Available</option>
                  <option value="no">Hidden</option>
                </select>
              </div>
            </div>

            </div>
          </div>

          <DialogFooter className="shrink-0 px-6 py-4 border-t border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/30 dark:bg-[#1a1a1a]/50">
            <Button variant="outline" className={btnModalCancel} onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button className={btnCreateSubmit} onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : selected ? "Update combo" : "Create combo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete combo?</DialogTitle>
            <DialogDescription>
              &quot;{selected?.name}&quot; will be removed from POS and customer menu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
