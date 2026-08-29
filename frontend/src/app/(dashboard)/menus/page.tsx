"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  UtensilsCrossed,
  Filter,
  Eye,
  Image as ImageIcon,
  XCircle,
  MoreVertical,
  ChevronDown,
  X,
  Star,
  Upload,
  CheckCircle2,
  Layers,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { dispatchMenuChanged } from "@/lib/live-updates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { menuItemApi, MenuItem, parseMenuItemOptions } from "@/lib/api/restaurant/menuItemApi";
import {
  getMenuItemEffectivePrice,
  menuItemHasDiscount,
  getMenuItemDiscountLabel,
} from "@/lib/menu-item-pricing";
import { categoryApi, Category } from "@/lib/api/restaurant/categoryApi";
import { compressImageFile } from "@/lib/compress-image";
import { useToast } from "@/components/ui/toast";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  actionBtnView,
  actionBtnEdit,
  actionBtnDelete,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardStatusBadgeClass,
  getTableStatusBadgeClass,
} from "@/lib/dashboard-ui";

const viewLabelClass = "text-xs text-zinc-400 dark:text-zinc-500";
const viewValueClass = "text-[15px] font-medium text-zinc-700 dark:text-zinc-200";
const formLabelClass = "text-xs font-medium text-[#1e293b] dark:text-zinc-200";
const formInputClass =
  "w-full px-3 py-2 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm font-medium dark:text-white placeholder:text-zinc-400";

export default function MenuPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formIsSellable, setFormIsSellable] = useState(true);
  const [formIsPurchasable, setFormIsPurchasable] = useState(false);
  const [formIsRecommended, setFormIsRecommended] = useState(false);
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formTax, setFormTax] = useState("5");
  const [formOptions, setFormOptions] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"" | "percentage" | "fixed">("");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk image states
  const [isBulkImageOpen, setIsBulkImageOpen] = useState(false);
  // Map of itemId -> draft imageUrl (only tracks changed ones)
  const [bulkDrafts, setBulkDrafts] = useState<Record<number, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkActiveId, setBulkActiveId] = useState<number | null>(null);
  const [bulkUrlInput, setBulkUrlInput] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const [itemsData, catsData] = await Promise.all([
        menuItemApi.getAllMenuItems(),
        categoryApi.getAllCategories()
      ]);
      setItems((itemsData || []).filter((i) => !i.isComposite));
      setCategories(catsData || []);
    } catch (err) {
      console.error("Failed to fetch menu data", err);
      showToast("Failed to load menu items", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const withCategory = (item: MenuItem, cats: Category[] = categories): MenuItem => {
    const cat = cats.find(c => c.id === item.categoryId);
    return cat ? { ...item, category: { id: cat.id, name: cat.name } } : item;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || String(item.categoryId) === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, pageSize]);

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter(i => i.isAvailable).length;
    const outOfStock = total - available;
    return { total, available, outOfStock };
  }, [items]);

  const openAddModal = () => {
    setFormName("");
    setFormDesc("");
    setFormCostPrice("");
    setFormPrice("");
    setFormCategoryId("");
    setFormIsAvailable(true);
    setFormIsSellable(true);
    setFormIsPurchasable(false);
    setFormIsRecommended(false);
    setFormImageUrl("");
    setFormTax("5");
    setFormOptions("");
    setFormDiscountType("");
    setFormDiscountValue("");
    setIsAddOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setSelectedItem(item);
    setFormName(item.name);
    setFormDesc(item.description || "");
    setFormCostPrice(String(item.costPrice || ""));
    setFormPrice(String(item.price));
    setFormCategoryId(String(item.categoryId));
    setFormIsAvailable(item.isAvailable);
    setFormIsSellable(item.isSellable !== false);
    setFormIsPurchasable(item.isPurchasable === true);
    setFormIsRecommended(item.isRecommended || false);
    setFormImageUrl(item.imageUrl || "");
    setFormTax(String(item.tax || 0));
    setFormOptions(parseMenuItemOptions(item).join(", "));
    setFormDiscountType(
      item.discountType === "percentage" || item.discountType === "fixed"
        ? item.discountType
        : ""
    );
    setFormDiscountValue(
      item.discountValue && item.discountValue > 0 ? String(item.discountValue) : ""
    );
    setIsEditOpen(true);
  };

  const openDeleteModal = (item: MenuItem) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const openViewModal = (item: MenuItem) => {
    setSelectedItem(item);
    setIsViewOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return showToast("Please select an image file", "error");
    }

    if (file.size > 5 * 1024 * 1024) {
      return showToast("Image size should be less than 5MB", "error");
    }

    try {
      const compressed = await compressImageFile(file);
      setFormImageUrl(compressed);
    } catch {
      showToast("Failed to process image", "error");
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return showToast("Item name is required", "error");
    if (!formPrice || isNaN(Number(formPrice))) return showToast("Valid price is required", "error");
    if (!formCategoryId) return showToast("Please select a category", "error");

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        costPrice: formCostPrice ? Number(formCostPrice) : undefined,
        price: Number(formPrice),
        tax: Number(formTax || 0),
        categoryId: Number(formCategoryId),
        isAvailable: formIsAvailable,
        isSellable: formIsSellable,
        isPurchasable: formIsPurchasable,
        isRecommended: formIsRecommended,
        imageUrl: formImageUrl.trim() || undefined,
        options: formOptions.trim()
          ? formOptions.split(",").map(s => s.trim()).filter(Boolean)
          : null,
        discountType: formDiscountType || null,
        discountValue: formDiscountType ? Number(formDiscountValue || 0) : 0,
      };

      if (isEditOpen && selectedItem) {
        const updated = await menuItemApi.updateMenuItem(selectedItem.id, payload);
        const merged = withCategory(updated);
        setItems(prev => prev.map(i => (i.id === merged.id ? merged : i)));
        menuItemApi.clearPosMenuCache();
        categoryApi.clearCategoryCache();
        dispatchMenuChanged({ action: "update", id: merged.id });
        showToast("Menu item updated successfully", "success");
        setIsEditOpen(false);
        setSelectedItem(null);
      } else {
        const created = await menuItemApi.createMenuItem(payload);
        const merged = withCategory(created);
        setItems(prev => [...prev, merged]);
        menuItemApi.clearPosMenuCache();
        categoryApi.clearCategoryCache();
        dispatchMenuChanged({ action: "create", id: merged.id });
        showToast("Menu item created successfully", "success");
        setIsAddOpen(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to save menu item";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      await menuItemApi.deleteMenuItem(selectedItem.id);
      setItems(prev => prev.filter(i => i.id !== selectedItem.id));
      menuItemApi.clearPosMenuCache();
      categoryApi.clearCategoryCache();
      dispatchMenuChanged({ action: "delete", id: selectedItem.id });
      showToast("Menu item deleted", "success");
      setIsDeleteOpen(false);
    } catch (err: any) {
      showToast("Failed to delete item", "error");
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      {/* Page Header: Outside the box */}
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Menu Management</h1>
      </div>

      {/* Main Container Box */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Controls Row: Inside the box */}
        <div className="px-8 py-4 flex flex-wrap items-center gap-6 border-b border-zinc-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-16 h-[42px] px-2 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
              <span>Filter Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-40 h-[42px] px-3 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1"></div>

          <div className="flex items-center gap-3">
            <div className="relative w-64 group">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600"
              />
            </div>

            <Button
              variant="outline"
              asChild
              className="h-[42px] px-4 rounded-md font-medium text-sm"
            >
              <Link href="/composites">Menu Combos</Link>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setBulkDrafts({});
                setBulkActiveId(null);
                setBulkUrlInput("");
                setIsBulkImageOpen(true);
              }}
              className="h-[42px] px-4 rounded-md font-medium text-sm flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Layers className="size-4" />
              Bulk Images
            </Button>

            <Button
              onClick={openAddModal}
              className="h-[42px] px-6 bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-md flex items-center gap-2 transition-colors font-medium text-sm shadow-sm"
            >
              <Plus className="size-4" />
              Add Menu Item
            </Button>
          </div>
        </div>

        {/* Table - Flush to sides */}
        <div className="border-t border-zinc-100 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Item Name</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Cost Price</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Selling Price</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Tax (%)</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 bg-zinc-100 rounded w-full"></div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedItems.length > 0 ? (
                  paginatedItems.map((item) => (
                    <TableRow key={item.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="px-6 py-3 text-[13px] text-zinc-500 font-medium">{item.id}</TableCell>
                      <TableCell className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md overflow-hidden flex items-center justify-center shrink-0 border border-zinc-100 bg-zinc-50">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="size-4 text-zinc-300" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-medium text-zinc-700 leading-tight flex items-center gap-1.5">
                              {item.name}
                              {item.isRecommended && <Star className="size-3 fill-amber-400 text-amber-400" />}
                            </span>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{item.category?.name || "No Category"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-3 text-[13px] font-medium text-zinc-400 text-right">
                        ${(item.costPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="px-6 py-3 text-right">
                        {menuItemHasDiscount(item) ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[13px] font-semibold text-primary">
                              ${getMenuItemEffectivePrice(item).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[11px] text-zinc-400 line-through">
                              ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-emerald-600">{getMenuItemDiscountLabel(item)}</span>
                          </div>
                        ) : (
                          <span className="text-[13px] font-semibold text-primary">
                            ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-3 text-[13px] font-medium text-zinc-500 text-right">
                        {item.tax}%
                      </TableCell>
                      <TableCell className="px-6 py-3 text-right">
                        <span className={cn(
                          dashboardStatusBadgeClass,
                          getTableStatusBadgeClass(item.isAvailable ? "active" : "inactive")
                        )}>
                          {item.isAvailable ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="px-10 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewModal(item)}
                            className={actionBtnView}
                            title="View item"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(item)}
                            className={actionBtnEdit}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteModal(item)}
                            className={actionBtnDelete}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-10 text-center text-zinc-500">
                      No menu items found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Table Footer / Pagination */}
        <div className="py-2 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-zinc-400 border-t border-zinc-100 bg-zinc-50/30">
          <div>
            {Math.min(filteredItems.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredItems.length, currentPage * pageSize)} of {filteredItems.length}
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
      </div>

      {/* ADD / EDIT MODAL */}
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setIsEditOpen(false); } }}>
        <DialogContent className="sm:max-w-[720px] max-h-[92vh] bg-white dark:bg-[#161616] border-none p-0 gap-0 overflow-hidden rounded-2xl shadow-xl flex flex-col">
          <div className="shrink-0 px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/40 dark:bg-[#1a1a1a]">
            <DialogHeader className="space-y-0.5">
              <DialogTitle className="text-lg font-semibold text-[#1e293b] dark:text-white">
                {isEditOpen ? "Edit menu item" : "Add menu item"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs">
                Configure details, pricing, and discount for this entry.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/30 dark:bg-[#1a1a1a]/50">
              <p className={cn(formLabelClass, "mb-2 flex items-center gap-1.5")}>
                <ImageIcon className="size-3.5 text-zinc-400" />
                Item image
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
                  value={formImageUrl}
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

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={formLabelClass}>Item name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Grilled Salmon"
                    className={formInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Category *</label>
                  <div className="relative">
                    <select
                      value={formCategoryId}
                      onChange={(e) => setFormCategoryId(e.target.value)}
                      className={cn(formInputClass, "appearance-none cursor-pointer pr-9")}
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 rounded-lg border border-zinc-200 p-3 dark:border-[#2a2a2a]">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={formIsSellable} onChange={(e) => setFormIsSellable(e.target.checked)} className="size-4 accent-primary" /> Sellable</label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={formIsPurchasable} onChange={(e) => setFormIsPurchasable(e.target.checked)} className="size-4 accent-primary" /> Purchasable</label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={formLabelClass}>Cost price ($)</label>
                  <input
                    type="number"
                    step="1"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    placeholder="0.00"
                    className={cn(formInputClass, "bg-zinc-50 dark:bg-[#1a1a1a]")}
                  />
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Selling price ($) *</label>
                  <input
                    type="number"
                    step="1"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0.00"
                    className={formInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Tax / VAT (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formTax}
                    onChange={(e) => setFormTax(e.target.value)}
                    placeholder="0"
                    className={formInputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={formLabelClass}>Discount type</label>
                  <select
                    value={formDiscountType}
                    onChange={(e) => {
                      const v = e.target.value as "" | "percentage" | "fixed";
                      setFormDiscountType(v);
                      if (!v) setFormDiscountValue("");
                    }}
                    className={cn(formInputClass, "appearance-none cursor-pointer")}
                  >
                    <option value="">No discount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Discount value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={formDiscountType === "percentage" ? 100 : undefined}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(e.target.value)}
                    placeholder={formDiscountType === "percentage" ? "10" : "2.50"}
                    disabled={!formDiscountType}
                    className={cn(formInputClass, "disabled:opacity-50")}
                  />
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Final price</label>
                  <div className={cn(formInputClass, "bg-primary/5 text-primary border-primary/20")}>
                    $
                    {formPrice && !isNaN(Number(formPrice))
                      ? getMenuItemEffectivePrice({
                          price: Number(formPrice),
                          discountType: formDiscountType || undefined,
                          discountValue: Number(formDiscountValue || 0),
                        }).toFixed(2)
                      : "0.00"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={formLabelClass}>Availability</label>
                  <select
                    value={formIsAvailable ? "available" : "unavailable"}
                    onChange={(e) => setFormIsAvailable(e.target.value === "available")}
                    className={cn(formInputClass, "appearance-none cursor-pointer")}
                  >
                    <option value="available">Available</option>
                    <option value="unavailable">Out of stock</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Recommended</label>
                  <select
                    value={formIsRecommended ? "yes" : "no"}
                    onChange={(e) => setFormIsRecommended(e.target.value === "yes")}
                    className={cn(formInputClass, "appearance-none cursor-pointer")}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className={formLabelClass}>POS options</label>
                <input
                  type="text"
                  value={formOptions}
                  onChange={(e) => setFormOptions(e.target.value)}
                  placeholder="Small, Medium, Large"
                  className={formInputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={formLabelClass}>Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Ingredients, prep notes, allergens…"
                  rows={2}
                  className={cn(formInputClass, "resize-none min-h-[64px]")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 m-0 px-6 py-4 bg-zinc-50/50 dark:bg-[#1a1a1a] border-t border-zinc-100 dark:border-[#2a2a2a] flex sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
              className="h-9 px-5 text-sm font-medium rounded-lg"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="h-9 px-6 bg-primary !text-white hover:bg-primary/90 rounded-lg text-sm font-semibold border-none"
              disabled={saving}
            >
              {saving ? "Saving..." : isEditOpen ? "Update item" : "Create item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW MODAL */}
      <Dialog open={isViewOpen} onOpenChange={(open) => { if (!open) setIsViewOpen(false); }}>
        <DialogContent className="sm:max-w-[750px] max-h-[90vh] bg-white dark:bg-[#161616] border-none p-0 gap-0 overflow-hidden rounded-2xl shadow-xl flex flex-col">
          <div className="shrink-0 p-8 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/30 dark:bg-[#1a1a1a]">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-2xl font-semibold text-[#1e293b] dark:text-white">
                Menu item details
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-sm">
                Full information for this menu entry.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-[#161616]">
            <div className="w-full border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/50 dark:bg-[#1a1a1a]">
              {selectedItem?.imageUrl ? (
                <div className="w-full h-52 sm:h-60 overflow-hidden">
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-40 sm:h-48 flex flex-col items-center justify-center gap-2 text-zinc-300 dark:text-zinc-600">
                  <ImageIcon className="size-12" />
                  <p className="text-sm font-medium text-zinc-400">No image</p>
                </div>
              )}
            </div>

            <div className="px-8 py-8 space-y-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <div className="space-y-1">
                <p className={viewLabelClass}>Item name</p>
                <p className={viewValueClass}>{selectedItem?.name || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>Category</p>
                <p className={viewValueClass}>
                  {categories.find(c => String(c.id) === String(selectedItem?.categoryId))?.name ||
                    "Uncategorized"}
                </p>
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>Cost price</p>
                <p className={viewValueClass}>${Number(selectedItem?.costPrice || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>Selling price</p>
                {selectedItem && menuItemHasDiscount(selectedItem) ? (
                  <div className="space-y-0.5">
                    <p className={cn(viewValueClass, "text-primary")}>
                      ${getMenuItemEffectivePrice(selectedItem).toFixed(2)}
                    </p>
                    <p className="text-sm text-zinc-400 line-through">
                      ${Number(selectedItem.price).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <p className={cn(viewValueClass, "text-primary")}>
                    ${Number(selectedItem?.price || 0).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>Discount</p>
                <p className={viewValueClass}>
                  {selectedItem && menuItemHasDiscount(selectedItem)
                    ? getMenuItemDiscountLabel(selectedItem)
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>Tax / VAT</p>
                <p className={viewValueClass}>{selectedItem?.tax ?? 0}%</p>
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>Availability</p>
                <p className={viewValueClass}>
                  {selectedItem?.isAvailable ? "Available" : "Out of stock"}
                </p>
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>Recommended</p>
                <p className={viewValueClass}>
                  {selectedItem?.isRecommended ? "Yes" : "No"}
                </p>
              </div>
              <div className="space-y-1">
                <p className={viewLabelClass}>POS options</p>
                <p className={viewValueClass}>
                  {selectedItem
                    ? parseMenuItemOptions(selectedItem).join(", ") || "—"
                    : "—"}
                </p>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-zinc-100 dark:border-[#2a2a2a]">
              <p className={cn(viewLabelClass, "pt-4")}>Description</p>
              <p className={cn(viewValueClass, "text-zinc-600 dark:text-zinc-300 leading-relaxed")}>
                {selectedItem?.description || "No description provided."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-5 pt-2 border-t border-zinc-100 dark:border-[#2a2a2a]">
              <div className="space-y-1 pt-4">
                <p className={viewLabelClass}>Created</p>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {selectedItem?.createdAt
                    ? new Date(selectedItem.createdAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="space-y-1 pt-4">
                <p className={viewLabelClass}>Last updated</p>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {selectedItem?.updatedAt
                    ? new Date(selectedItem.updatedAt).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 m-0 px-8 py-6 bg-zinc-50/50 dark:bg-[#1a1a1a] border-t border-zinc-100 dark:border-[#2a2a2a] flex sm:justify-end">
            <Button
              onClick={() => setIsViewOpen(false)}
              variant="outline"
              className="text-zinc-500 font-medium px-6 h-11 rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) setIsDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Delete Item Confirmation</DialogTitle>
          <div className="p-8 flex items-start gap-6">
            <div className="w-14 h-14 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <Trash2 className="size-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Delete Menu Item?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-[#1E293B]">"{selectedItem?.name}"</span>?
                This action cannot be undone and will remove the item from all active menus.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-lg font-bold px-6 h-11">
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none px-8 h-11 shadow-lg shadow-rose-600/10">
              Yes, Delete Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK IMAGE MANAGER MODAL */}
      <Dialog open={isBulkImageOpen} onOpenChange={(open) => { if (!open) setIsBulkImageOpen(false); }}>
        <DialogContent className="sm:max-w-[980px] max-h-[92vh] bg-white dark:bg-[#161616] border-none p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="shrink-0 px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/40 dark:bg-[#1a1a1a] flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-semibold text-[#1e293b] dark:text-white flex items-center gap-2">
                <Layers className="size-5 text-primary" />
                Bulk Image Manager
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
                Click any card to assign or upload an image. Save all changes at once.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
              <span className="font-semibold text-primary">
                {Object.keys(bulkDrafts).length}
              </span>
              {Object.keys(bulkDrafts).length === 1 ? "change" : "changes"} pending
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            {items.filter(i => !i.isComposite).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-2">
                <UtensilsCrossed className="size-10 opacity-30" />
                <p className="text-sm">No menu items found</p>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                {items.filter(i => !i.isComposite).map((item) => {
                  const draftImg = bulkDrafts[item.id];
                  const currentImg = draftImg !== undefined ? draftImg : (item.imageUrl || "");
                  const hasChange = draftImg !== undefined;
                  const isActive = bulkActiveId === item.id;
                  const cat = categories.find(c => c.id === item.categoryId);

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setBulkActiveId(item.id);
                        setBulkUrlInput(currentImg);
                      }}
                      className={cn(
                        "relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all group",
                        isActive
                          ? "border-primary ring-2 ring-primary/20 shadow-lg"
                          : hasChange
                            ? "border-emerald-400 shadow-md"
                            : "border-zinc-100 hover:border-primary/30 hover:shadow-md"
                      )}
                    >
                      {/* Image area */}
                      <div className="relative w-full aspect-square bg-zinc-100 overflow-hidden">
                        {currentImg ? (
                          <img
                            src={currentImg}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-zinc-300">
                            <ImageIcon className="size-7" />
                            <span className="text-[10px] text-zinc-400 font-medium">No image</span>
                          </div>
                        )}

                        {/* Hover overlay */}
                        <div className={cn(
                          "absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity",
                          isActive ? "opacity-100 bg-primary/20" : "opacity-0 group-hover:opacity-100 bg-black/30"
                        )}>
                          <Upload className="size-5 text-white drop-shadow" />
                          <span className="text-[10px] text-white font-bold drop-shadow">Edit image</span>
                        </div>

                        {/* Changed badge */}
                        {hasChange && (
                          <div className="absolute top-1.5 right-1.5">
                            <CheckCircle2 className="size-4 text-emerald-500 fill-white drop-shadow" />
                          </div>
                        )}
                      </div>

                      {/* Label */}
                      <div className="px-2 py-1.5 bg-white dark:bg-[#161616]">
                        <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 truncate leading-tight">{item.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{cat?.name || "—"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom editor panel — shows when a card is active */}
          {bulkActiveId !== null && (() => {
            const activeItem = items.find(i => i.id === bulkActiveId);
            if (!activeItem) return null;
            const draftImg = bulkDrafts[activeItem.id];
            const currentImg = draftImg !== undefined ? draftImg : (activeItem.imageUrl || "");

            return (
              <div className="shrink-0 border-t border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/60 dark:bg-[#1a1a1a] px-5 py-4">
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden border border-zinc-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shrink-0 flex items-center justify-center">
                    {currentImg ? (
                      <img src={currentImg} alt={activeItem.name} className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <ImageIcon className="size-6 text-zinc-300" />
                    )}
                  </div>

                  {/* Name */}
                  <div className="shrink-0">
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{activeItem.name}</p>
                    <p className="text-xs text-zinc-400">{categories.find(c => c.id === activeItem.categoryId)?.name || ""}</p>
                  </div>

                  {/* URL input */}
                  <input
                    type="text"
                    value={bulkUrlInput}
                    onChange={(e) => {
                      setBulkUrlInput(e.target.value);
                      setBulkDrafts(prev => ({ ...prev, [bulkActiveId]: e.target.value }));
                    }}
                    placeholder="Paste image URL..."
                    className="flex-1 px-3 py-2 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm font-medium dark:text-white placeholder:text-zinc-400"
                  />

                  {/* Upload file */}
                  <label className="cursor-pointer shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith("image/")) { showToast("Please select an image file", "error"); return; }
                        if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB", "error"); return; }
                        try {
                          const compressed = await compressImageFile(file);
                          setBulkUrlInput(compressed);
                          setBulkDrafts(prev => ({ ...prev, [bulkActiveId]: compressed }));
                        } catch { showToast("Failed to process image", "error"); }
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex h-9 px-4 items-center rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/15 transition-colors gap-1.5">
                      <Upload className="size-3.5" />
                      Upload
                    </span>
                  </label>

                  {/* Clear */}
                  {currentImg && (
                    <button
                      type="button"
                      onClick={() => {
                        setBulkUrlInput("");
                        setBulkDrafts(prev => ({ ...prev, [bulkActiveId]: "" }));
                      }}
                      className="shrink-0 size-9 rounded-lg border border-zinc-200 dark:border-[#2a2a2a] flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                      title="Remove image"
                    >
                      <X className="size-4" />
                    </button>
                  )}

                  {/* Dismiss active */}
                  <button
                    type="button"
                    onClick={() => setBulkActiveId(null)}
                    className="shrink-0 size-9 rounded-lg border border-zinc-200 dark:border-[#2a2a2a] flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-colors"
                    title="Close editor"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 bg-zinc-50/50 dark:bg-[#1a1a1a] border-t border-zinc-100 dark:border-[#2a2a2a] flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-400">
              {Object.keys(bulkDrafts).length > 0
                ? `${Object.keys(bulkDrafts).length} item${Object.keys(bulkDrafts).length === 1 ? '' : 's'} will be updated`
                : "No changes yet — click a card to assign an image"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => { setBulkDrafts({}); setBulkActiveId(null); setBulkUrlInput(""); }}
                disabled={Object.keys(bulkDrafts).length === 0 || bulkSaving}
                className="h-9 px-4 text-sm font-medium rounded-lg"
              >
                Reset changes
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsBulkImageOpen(false)}
                disabled={bulkSaving}
                className="h-9 px-5 text-sm font-medium rounded-lg"
              >
                Close
              </Button>
              <Button
                onClick={async () => {
                  const entries = Object.entries(bulkDrafts);
                  if (entries.length === 0) { setIsBulkImageOpen(false); return; }
                  setBulkSaving(true);
                  let successCount = 0;
                  let failCount = 0;
                  await Promise.allSettled(
                    entries.map(async ([idStr, imageUrl]) => {
                      const id = Number(idStr);
                      try {
                        const updated = await menuItemApi.updateMenuItem(id, { imageUrl: imageUrl || undefined });
                        setItems(prev => prev.map(i => i.id === id ? { ...i, imageUrl: updated.imageUrl } : i));
                        successCount++;
                      } catch {
                        failCount++;
                      }
                    })
                  );
                  menuItemApi.clearPosMenuCache();
                  dispatchMenuChanged({ action: "update" });
                  setBulkSaving(false);
                  setBulkDrafts({});
                  setBulkActiveId(null);
                  setBulkUrlInput("");
                  if (failCount === 0) {
                    showToast(`${successCount} image${successCount === 1 ? '' : 's'} saved successfully`, "success");
                    setIsBulkImageOpen(false);
                  } else {
                    showToast(`${successCount} saved, ${failCount} failed`, "error");
                  }
                }}
                disabled={Object.keys(bulkDrafts).length === 0 || bulkSaving}
                className="h-9 px-6 bg-primary !text-white hover:bg-primary/90 rounded-lg text-sm font-semibold border-none gap-2 flex items-center"
              >
                {bulkSaving ? (
                  <><RefreshCw className="size-3.5 animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle2 className="size-3.5" /> Save {Object.keys(bulkDrafts).length > 0 ? `${Object.keys(bulkDrafts).length} ` : ""}images</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
