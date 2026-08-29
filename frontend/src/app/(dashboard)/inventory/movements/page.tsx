"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  History, 
  Filter, 
  ChevronDown,
  Package,
  Trash2
} from "lucide-react";
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
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { stockMovementApi, StockMovement, MovementType } from "@/lib/api/restaurant/stockMovementApi";
import { ingredientApi, Ingredient } from "@/lib/api/restaurant/ingredientApi";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/context/PermissionContext";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  actionBtnDelete,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardStatusBadgeClass,
  getStockStatusBadgeClass,
} from "@/lib/dashboard-ui";

export default function StockMovementsPage() {
  const { showToast } = useToast();
  const { canAdd: checkAdd, canDelete: checkDelete } = usePermissions();
  const canAdd = checkAdd("/inventory/movements");
  const canDelete = checkDelete("/inventory/movements");

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  // Modal states
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

  // Form states
  const [formIngredientId, setFormIngredientId] = useState("");
  const [formType, setFormType] = useState<MovementType>("in");
  const [formQuantity, setFormQuantity] = useState<number>(0);
  const [formNote, setFormNote] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [moveData, ingData] = await Promise.all([
        stockMovementApi.getAllStockMovements(),
        ingredientApi.getAllIngredients()
      ]);
      setMovements(moveData);
      setIngredients(ingData);
    } catch (error) {
      console.error("Failed to fetch stock movements:", error);
      showToast("Failed to load movement data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredMovements = useMemo(() => {
    return movements.filter((move) => {
      const ingredientName = move.ingredient?.name || "";
      const matchesSearch = ingredientName.toLowerCase().includes(search.toLowerCase()) || 
                           (move.note && move.note.toLowerCase().includes(search.toLowerCase()));
      const matchesType = typeFilter === "all" || move.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [movements, search, typeFilter]);

  const openRecordModal = () => {
    setFormIngredientId("");
    setFormType("in");
    setFormQuantity(0);
    setFormNote("");
    setIsRecordOpen(true);
  };

  const handleRecordMovement = async () => {
    if (!formIngredientId || formQuantity <= 0) {
      showToast("Please select an ingredient and valid quantity", "error");
      return;
    }

    try {
      setSaving(true);
      await stockMovementApi.createStockMovement({
        ingredientId: formIngredientId,
        type: formType,
        quantity: formQuantity,
        note: formNote
      });
      showToast("Stock movement recorded successfully", "success");
      setIsRecordOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Failed to record movement:", error);
      showToast(error.response?.data?.message || "Failed to record movement", "error");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (move: StockMovement) => {
    setSelectedMovement(move);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedMovement) return;
    try {
      setSaving(true);
      await stockMovementApi.deleteStockMovement(selectedMovement.id);
      showToast("Movement entry deleted", "success");
      setIsDeleteOpen(false);
      fetchData();
    } catch (error) {
      console.error("Failed to delete movement:", error);
      showToast("Failed to delete entry", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${dashboardPageClass} space-y-6`} style={dashboardPageStyle}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 px-4">
        <div>
          <h1 className={pageHeaderTitleClass}>Stock Movements</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/inventory">
            <Button variant="outline" className="h-[42px] px-4 rounded-lg font-bold border-zinc-100 hover:bg-zinc-50 shadow-sm text-[#64748B]">
              <Package className="mr-2 size-4 text-primary" /> Current Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/30">
          <div>
            <h3 className="text-sm font-bold text-foreground">Movement History Feed</h3>
            <p className="text-[12px] font-medium text-muted-foreground mt-1">Audit log of stock changes</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative group w-full md:w-64">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search history..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-[14.5px] font-medium bg-white border border-zinc-100 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all shadow-sm"
              />
            </div>
            
            <div className="relative">
              <Filter className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none pl-9 pr-9 py-2.5 text-[14px] font-medium bg-white border border-zinc-100 rounded-lg outline-none focus:border-primary/30 shadow-sm cursor-pointer min-w-[140px]"
              >
                <option value="all">All Types</option>
                <option value="in">Stock In</option>
                <option value="out">Stock Out</option>
                <option value="adjustment">Adjustments</option>
              </select>
              <ChevronDown className="size-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            {canAdd && (
              <Button onClick={openRecordModal} className="h-[42px] px-6 rounded-lg bg-primary !text-white hover:bg-primary/90 hover:!text-white font-bold border-none shadow-md whitespace-nowrap text-[14.5px]">
                <History className="mr-2 size-4" /> Record Entry
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100">
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Type</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Ingredient</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Quantity</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Date & Note</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="h-16 animate-pulse">
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j} className="px-6 py-4">
                        <div className="h-4 bg-zinc-50 rounded w-full"></div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <History className="size-12 text-zinc-200 mb-2" />
                      <p className="text-[#64748B] font-bold uppercase text-[11px] tracking-widest">No stock movements found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((move) => {
                  const isIn = move.type === "in";
                  const isOut = move.type === "out";

                  return (
                    <TableRow key={move.id} className="border-zinc-50 hover:bg-zinc-50/30 transition-colors group">
                      <TableCell className="px-6 py-5 text-[13px] font-medium text-[#1E293B]">
                        {move.id}
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className={cn(
                          dashboardStatusBadgeClass,
                          "inline-flex items-center gap-1.5",
                          getStockStatusBadgeClass(isIn ? "in" : isOut ? "out" : "low")
                        )}>
                          {isIn ? <ArrowDownLeft className="size-3" /> : 
                           isOut ? <ArrowUpRight className="size-3" /> : 
                           <RefreshCw className="size-3" />}
                          {move.type}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <p className="font-bold text-[14px] text-[#1E293B] uppercase tracking-tight">
                          {move.ingredient?.name || "Unknown"}
                        </p>
                      </TableCell>
                      <TableCell className="px-6 py-5 text-right">
                        <span className={`font-bold text-[14px] ${
                          isIn ? "text-emerald-600" : 
                          isOut ? "text-rose-600" : 
                          "text-[#1E293B]"
                        }`}>
                          {isIn ? "+" : isOut ? "-" : ""}{move.quantity} <span className="text-[10px] font-medium opacity-70 ml-0.5">{move.ingredient?.unit}</span>
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[12px] font-semibold text-[#1E293B]">
                            {move.createdAt ? new Date(move.createdAt).toLocaleDateString() : "-"}
                          </p>
                          <p className="text-[10px] font-medium text-muted-foreground italic truncate max-w-[150px]">
                            {move.note ? `"${move.note}"` : "Routine entry"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {canDelete && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openDeleteModal(move)} 
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

      {/* RECORD ENTRY MODAL */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <div className="p-6 border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold">Record Stock Movement</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Manually adjust stock levels for specific ingredients.
            </DialogDescription>
          </div>
          
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Select Ingredient *</label>
              <select
                value={formIngredientId}
                onChange={(e) => setFormIngredientId(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all text-sm font-medium appearance-none cursor-pointer"
              >
                <option value="">Choose an item...</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>{ing.name.toUpperCase()} ({ing.unit})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">Movement Type *</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as MovementType)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all text-sm font-medium appearance-none cursor-pointer"
                >
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (-)</option>
                  <option value="adjustment">Direct Adjustment</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(Number(e.target.value))}
                  placeholder="1"
                  className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Reason / Note</label>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="e.g. Weekly replenishment, Expired disposal..."
                className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all text-sm font-medium min-h-[100px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => setIsRecordOpen(false)} className="rounded-lg font-bold px-6 h-11" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleRecordMovement} className="bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-lg font-bold border-none px-8 h-11" disabled={saving}>
              {saving ? "Saving..." : "Record Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[440px] bg-white border-zinc-100">
          <DialogTitle className="sr-only">Delete Entry</DialogTitle>
          <div className="p-6 flex flex-col items-center text-center pt-10">
            <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <Trash2 className="size-8 text-rose-600" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Delete History Entry?</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this movement record? 
              <span className="block mt-2 font-bold text-rose-600 italic text-[11px] uppercase tracking-wider">Note: This does not revert the actual stock level.</span>
            </p>
          </div>
          <DialogFooter className="p-6 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-lg font-bold px-6 h-11" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none px-6 h-11" disabled={saving}>
              {saving ? "Deleting..." : "Yes, Delete Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
