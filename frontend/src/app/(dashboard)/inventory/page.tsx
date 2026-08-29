"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  History
} from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
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
} from "@/lib/dashboard-ui";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ingredientApi, Ingredient } from "@/lib/api/restaurant/ingredientApi";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

export default function InventoryPage() {
  const { showToast } = useToast();
  const { canAdd: checkAdd, canEdit: checkEdit, canDelete: checkDelete } = usePermissions();
  
  const canAdd = checkAdd("/inventory");
  const canEdit = checkEdit("/inventory");
  const canDelete = checkDelete("/inventory");

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formCost, setFormCost] = useState<number>(0);

  const fetchIngredients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ingredientApi.getAllIngredients();
      setIngredients(data);
    } catch (error) {
      console.error("Failed to fetch ingredients:", error);
      showToast("Failed to load stock data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchIngredients(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchIngredients]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchesSearch = ing.name.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [ingredients, search]);

  const totalPages = Math.ceil(filteredIngredients.length / pageSize);
  const paginatedIngredients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIngredients.slice(start, start + pageSize);
  }, [filteredIngredients, currentPage, pageSize]);

  const openAddModal = () => {
    setFormName("");
    setFormUnit("");
    setFormCost(0);
    setIsAddOpen(true);
  };

  const openEditModal = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    setFormName(ing.name);
    setFormUnit(ing.unit);
    setFormCost(ing.costPerUnit || 0);
    setIsEditOpen(true);
  };

  const openDeleteModal = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    setIsDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formUnit) {
      showToast("Name and unit are required", "error");
      return;
    }

    try {
      setSaving(true);
      if (isEditOpen && selectedIngredient) {
        await ingredientApi.updateIngredient(selectedIngredient.id, {
          name: formName,
          unit: formUnit,
          costPerUnit: formCost
        });
        showToast("Ingredient updated successfully", "success");
      } else {
        await ingredientApi.createIngredient({
          name: formName,
          unit: formUnit,
          stockQuantity: 0,
          minStockLevel: 0,
          costPerUnit: formCost
        });
        showToast("Ingredient added successfully", "success");
      }
      setIsAddOpen(false);
      setIsEditOpen(false);
      fetchIngredients();
    } catch (error) {
      console.error("Failed to save ingredient:", error);
      showToast("Failed to save ingredient", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedIngredient) return;
    try {
      setSaving(true);
      await ingredientApi.deleteIngredient(selectedIngredient.id);
      showToast("Ingredient deleted successfully", "success");
      setIsDeleteOpen(false);
      fetchIngredients();
    } catch (error) {
      console.error("Failed to delete ingredient:", error);
      showToast("Failed to delete ingredient", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Ingredients</h1>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden w-full">
        {/* Table Controls Row */}
        <div className="px-10 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-3 text-[13px] text-zinc-500 font-medium">
              <span>Show</span>
              <select 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="w-24 px-3 py-1.5 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer shadow-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries</span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 md:flex-none justify-end">
            <div className="relative group w-full md:w-80">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search..." 
                className="w-full pl-10 pr-4 py-2.5 text-[13px] bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/20 transition-all placeholder:text-zinc-400 shadow-sm" 
              />
            </div>
            <div className="flex items-center gap-3">
              <Link href="/inventory/movements">
                <Button variant="outline" className="h-10 px-6 rounded-md border-zinc-200 hover:bg-zinc-50 text-[11px] font-black uppercase tracking-widest text-[#64748B] shadow-sm">
                  <History className="mr-2 size-4 text-primary" /> Movements
                </Button>
              </Link>
              {canAdd && (
                <Button onClick={openAddModal} className="h-10 px-8 rounded-md bg-primary !text-white hover:bg-primary/90 hover:!text-white font-medium border-none flex items-center gap-2 transition-all active:scale-95 shrink-0">
                  <Plus className="size-4" /> Add New Item
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mx-4 mb-6 border border-zinc-100 rounded-xl overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Name</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Unit</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Cost</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="h-14 animate-pulse">
                    {[...Array(4)].map((_, j) => (
                      <TableCell key={j} className="px-6 py-4">
                        <div className="h-4 bg-zinc-100 rounded w-full"></div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedIngredients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-10 text-center text-zinc-500">
                    No ingredients found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedIngredients.map((ing) => {
                  return (
                    <TableRow key={ing.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="px-6 py-3 text-sm text-zinc-700">{ing.name}</TableCell>
                      <TableCell className="px-6 py-3 text-sm text-zinc-700">{ing.unit}</TableCell>
                      <TableCell className="px-6 py-3 text-sm text-zinc-700 text-right">£{Number(ing.costPerUnit || 0).toFixed(2)}</TableCell>
                      <TableCell className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditModal(ing)} 
                              className={actionBtnEdit}
                            >
                              <Edit className="size-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openDeleteModal(ing)} 
                              className={actionBtnDelete}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
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

        {/* Table Footer / Pagination */}
        <div className="py-4 px-10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-zinc-400">
          <div>
            {Math.min(filteredIngredients.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredIngredients.length, currentPage * pageSize)} of {filteredIngredients.length}
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
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => { if(!open) { setIsAddOpen(false); setIsEditOpen(false); } }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <div className="p-6 border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold">
              {isEditOpen ? "Update Ingredient" : "Add New Ingredient"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {isEditOpen ? "Update the ingredient details." : "Add an ingredient for use in purchases."}
            </DialogDescription>
          </div>
          
          <div className="p-6 grid grid-cols-2 gap-5">
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Tomato, Flour, Milk"
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-sm font-medium"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Unit *</label>
              <input
                type="text"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                placeholder="e.g. kg, pcs, litters"
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-sm font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Cost *</label>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={formCost}
                onChange={(e) => setFormCost(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="rounded-lg font-bold px-6 h-11" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-lg font-bold border-none px-8 h-11" disabled={saving}>
              {saving ? "Saving..." : isEditOpen ? "Update Item" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if(!open) setIsDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-[440px] bg-white border-zinc-100">
          <DialogTitle className="sr-only">Delete Ingredient</DialogTitle>
          <div className="p-6 flex flex-col items-center text-center pt-10">
            <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <Trash2 className="size-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Delete Item?</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-bold text-foreground">&quot;{selectedIngredient?.name}&quot;</span> from inventory?
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="p-6 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-lg font-bold px-6 h-11" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none px-6 h-11" disabled={saving}>
              {saving ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
