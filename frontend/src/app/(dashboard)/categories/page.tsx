"use client";

import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Tag, UtensilsCrossed, X, RefreshCw, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { categoryApi, CategoryWithItems } from "@/lib/api/restaurant/categoryApi";
import { menuItemApi } from "@/lib/api/restaurant/menuItemApi";
import { dispatchMenuChanged } from "@/lib/live-updates";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/context/PermissionContext";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  actionBtnEdit,
  actionBtnDelete,
} from "@/lib/dashboard-ui";

const viewLabelClass = "text-xs text-zinc-400 dark:text-zinc-500";
const viewValueClass = "text-[15px] font-medium text-zinc-700 dark:text-zinc-200";
const formLabelClass = "text-xs font-medium text-[#1e293b] dark:text-zinc-200";
const formInputClass =
  "w-full px-3 py-2 bg-white dark:bg-[#161616] border border-zinc-200 dark:border-[#2a2a2a] rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm font-medium dark:text-white placeholder:text-zinc-400";

export default function MenuCategoriesPage() {
  const { showToast } = useToast();
  const { canAdd: checkAdd, canEdit: checkEdit, canDelete: checkDelete } = usePermissions();
  const canAdd = checkAdd("/categories");
  const canEdit = checkEdit("/categories");
  const canDelete = checkDelete("/categories");
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selected, setSelected] = useState<CategoryWithItems | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchCategories = async (forceRefresh = false) => {
    try {
      const data = await categoryApi.getCategoriesWithItems(forceRefresh);
      setCategories(data || []);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const filtered = categories.filter(c =>
    search === "" || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  const openAdd = () => {
    setFormName("");
    setFormDesc("");
    setFormImage("");
    setFormActive(true);
    setIsAddOpen(true);
  };

  const openEdit = (cat: CategoryWithItems) => {
    setSelected(cat);
    setFormName(cat.name);
    setFormDesc(cat.description || "");
    setFormImage(cat.imageUrl || "");
    setFormActive(cat.isActive !== false);
    setIsEditOpen(true);
  };

  const openDelete = (cat: CategoryWithItems) => {
    setSelected(cat);
    setIsDeleteOpen(true);
  };

  const openView = (cat: CategoryWithItems) => {
    setSelected(cat);
    setIsViewOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return showToast("Category name is required", "error");
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim(),
        imageUrl: formImage.trim() || undefined,
        isActive: formActive,
      };

      if (isEditOpen && selected) {
        await categoryApi.updateCategory(selected.id, payload);
        menuItemApi.clearPosMenuCache();
        categoryApi.clearCategoryCache();
        dispatchMenuChanged({ action: "category_update", id: selected.id });
        showToast("Category updated successfully", "success");
      } else {
        const created = await categoryApi.createCategory(payload);
        menuItemApi.clearPosMenuCache();
        categoryApi.clearCategoryCache();
        dispatchMenuChanged({ action: "category_create", id: created.id });
        showToast("Category created successfully", "success");
      }
      await fetchCategories();
      setIsAddOpen(false);
      setIsEditOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save category";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return showToast("Image size should be less than 2MB", "error");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await categoryApi.deleteCategory(selected.id);
      menuItemApi.clearPosMenuCache();
      categoryApi.clearCategoryCache();
      dispatchMenuChanged({ action: "category_delete", id: selected.id });
      showToast("Category deleted successfully", "success");
      await fetchCategories();
      setIsDeleteOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to delete category";
      showToast(msg, "error");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      {/* Standard Pro Header: Title and Button on the same row */}
      <div className="mb-8 px-4 flex items-start justify-between">
        <div>
          <h1 className={pageHeaderTitleClass}>Categories Management</h1>
        </div>

        {canAdd && (
          <Button onClick={openAdd} className="h-[42px] px-6 bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-md flex items-center gap-2 transition-colors font-medium text-sm shadow-md">
            <Plus className="size-4" /> Add Category
          </Button>
        )}
      </div>

      <div className="px-4 min-h-[400px] mt-2">          {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 h-64 animate-pulse"></div>
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center gap-3">
          <div className="size-16 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-100">
            <Tag className="size-8 text-zinc-200" />
          </div>
          <p className="text-zinc-400 font-medium text-sm">No categories found in your catalog.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginated.map((cat) => (
            <div key={cat.id} className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 flex flex-col">
              {/* Category Image Area */}
              <div className="relative h-44 overflow-hidden bg-zinc-100 border-b border-zinc-100">
                {cat.imageUrl ? (
                  <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-300">
                    <ImageIcon className="size-10" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">No Preview</span>
                  </div>
                )}

                {/* Status Badge Over Image */}
                <div className="absolute top-3 right-3">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm bg-white/90 backdrop-blur-sm",
                    cat.isActive !== false ? "text-emerald-600 border-emerald-100" : "text-rose-600 border-rose-100"
                  )}>
                    {cat.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Simple View Details Trigger - No blue overlay */}
                <button
                  onClick={() => openView(cat)}
                  className="absolute inset-0 z-10 w-full h-full bg-transparent"
                />
              </div>

              {/* Category Content */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[15px] font-bold text-zinc-800 leading-tight group-hover:text-primary transition-colors line-clamp-1">{cat.name}</h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
                    <UtensilsCrossed className="size-3 text-zinc-500" />
                    <span className="text-[11px] font-black text-zinc-600">{cat.menuitem?.length || 0}</span>
                  </div>
                </div>

                <p className="text-[12px] text-zinc-500 line-clamp-2 mb-4 h-9 leading-relaxed">
                  {cat.description || "No description provided for this menu category."}
                </p>

                <div className="mt-auto pt-4 border-t border-zinc-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                      <RefreshCw className="size-3 text-primary" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Creator</p>
                      <p className="text-[11px] font-semibold text-zinc-700">Admin System</p>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(cat)}
                        className={actionBtnEdit}
                      >
                        <Edit className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDelete(cat)}
                        className={actionBtnDelete}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>



      {/* ADD / EDIT MODAL */}
      <Dialog
        open={isAddOpen || isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setIsEditOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px] max-h-[92vh] bg-white dark:bg-[#161616] border-none p-0 gap-0 overflow-hidden rounded-2xl shadow-xl flex flex-col">
          <div className="shrink-0 px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/40 dark:bg-[#1a1a1a]">
            <DialogHeader className="space-y-0.5">
              <DialogTitle className="text-lg font-semibold text-[#1e293b] dark:text-white">
                {isEditOpen ? "Edit category" : "Add category"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs">
                {isEditOpen
                  ? "Update name, image, status, and description."
                  : "Create a new menu category with an optional cover image."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/30 dark:bg-[#1a1a1a]/50">
              <p className={cn(formLabelClass, "mb-2 flex items-center gap-1.5")}>
                <ImageIcon className="size-3.5 text-zinc-400" />
                Category image
              </p>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shrink-0 flex items-center justify-center">
                  {formImage ? (
                    <img src={formImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="size-6 text-zinc-300" />
                  )}
                </div>
                <input
                  type="text"
                  value={formImage}
                  onChange={(e) => setFormImage(e.target.value)}
                  placeholder="Paste image URL..."
                  className={cn(formInputClass, "flex-1")}
                />
                <label className="cursor-pointer shrink-0">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <span className="inline-flex h-9 px-4 items-center rounded-lg bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-primary/15 transition-colors">
                    Upload
                  </span>
                </label>
                {formImage && (
                  <button
                    type="button"
                    onClick={() => setFormImage("")}
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
                  <label className={formLabelClass}>Category name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Appetizers, Main Course..."
                    className={formInputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className={formLabelClass}>Status</label>
                  <select
                    value={formActive ? "active" : "inactive"}
                    onChange={(e) => setFormActive(e.target.value === "active")}
                    className={cn(formInputClass, "appearance-none cursor-pointer")}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className={formLabelClass}>Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief description of this category..."
                  rows={3}
                  className={cn(formInputClass, "resize-none min-h-[80px]")}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 m-0 px-6 py-4 bg-zinc-50/50 dark:bg-[#1a1a1a] border-t border-zinc-100 dark:border-[#2a2a2a] flex sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddOpen(false);
                setIsEditOpen(false);
              }}
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
              {saving ? "Saving..." : isEditOpen ? "Update category" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) setIsDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Delete Category Confirmation</DialogTitle>
          <div className="p-8 flex items-start gap-6">
            <div className="w-14 h-14 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <Trash2 className="size-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Delete Category?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-[#1E293B]">"{selected?.name}"</span>?
                This will remove the category and may affect items assigned to it.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-lg font-bold px-6 h-11" disabled={deleting}>
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none px-8 h-11 shadow-lg shadow-rose-600/10" disabled={deleting}>
              {deleting ? "Deleting..." : "Yes, Delete Category"}
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
                Category details
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-sm">
                Full information for this menu category.
              </DialogDescription>
            </DialogHeader>
          </div>

          {selected && (
            <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-[#161616]">
              <div className="w-full border-b border-zinc-100 dark:border-[#2a2a2a] bg-zinc-50/50 dark:bg-[#1a1a1a]">
                {selected.imageUrl ? (
                  <div className="w-full h-52 sm:h-60 overflow-hidden">
                    <img
                      src={selected.imageUrl}
                      alt={selected.name}
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
                    <p className={viewLabelClass}>Category name</p>
                    <p className={viewValueClass}>{selected.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className={viewLabelClass}>Status</p>
                    <p className={viewValueClass}>
                      {selected.isActive !== false ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className={viewLabelClass}>Menu items</p>
                    <p className={viewValueClass}>{selected.menuitem?.length || 0}</p>
                  </div>
                  <div className="space-y-1">
                    <p className={viewLabelClass}>Created</p>
                    <p className={viewValueClass}>
                      {selected.createdAt
                        ? new Date(selected.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className={viewLabelClass}>Description</p>
                    <p className={cn(viewValueClass, "leading-relaxed")}>
                      {selected.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div>
                  <p className={cn(viewLabelClass, "mb-3")}>Items in this category</p>
                  <div className="max-h-[28vh] overflow-y-auto space-y-2 pr-1">
                    {!selected.menuitem?.length ? (
                      <p className="text-center py-8 text-zinc-400 italic text-sm">
                        No items assigned to this category yet.
                      </p>
                    ) : (
                      selected.menuitem.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center py-3 px-4 bg-zinc-50 dark:bg-[#1a1a1a] hover:bg-zinc-100 dark:hover:bg-[#222] transition-colors rounded-lg border border-zinc-100 dark:border-[#2a2a2a]"
                        >
                          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                            {item.name}
                          </span>
                          <span className="text-sm font-bold text-primary">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 m-0 px-6 py-4 bg-zinc-50/50 dark:bg-[#1a1a1a] border-t border-zinc-100 dark:border-[#2a2a2a]">
            <Button
              variant="outline"
              onClick={() => setIsViewOpen(false)}
              className="w-full sm:w-auto h-9 px-6 text-sm font-medium rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
