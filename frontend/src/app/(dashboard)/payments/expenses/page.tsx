"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Calendar,
  Filter,
  DollarSign,
  Trash2,
  Edit2,
  Loader2,
  ArrowDownCircle,
  MoreVertical,
  Download,
  Eye
} from "lucide-react";
import { expenseApi, Expense } from "@/lib/api/restaurant/expenseApi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
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
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription 
} from "@/components/ui/dialog";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const { showToast } = useToast();

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Expense>>({
    title: "",
    amount: 0,
    category: "General",
    receiver: "",
    date: new Date().toISOString().split('T')[0],
    description: "",
    paymentMethod: "Cash"
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await expenseApi.getAllExpenses();
      setExpenses(data);
    } catch (error) {
      console.error("Failed to fetch expenses", error);
      showToast("Failed to load expenses", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async () => {
    try {
      setIsProcessing(true);
      await expenseApi.createExpense(formData);
      showToast("Expense added successfully", "success");
      setIsAddOpen(false);
      fetchExpenses();
      setFormData({
        title: "",
        amount: 0,
        category: "General",
        receiver: "",
        date: new Date().toISOString().split('T')[0],
        description: "",
        paymentMethod: "Cash"
      });
    } catch (error) {
      showToast("Failed to add expense", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateExpense = async () => {
    if (!selectedExpense) return;
    try {
      setIsProcessing(true);
      await expenseApi.updateExpense(selectedExpense.id, formData);
      showToast("Expense updated successfully", "success");
      setIsEditOpen(false);
      fetchExpenses();
    } catch (error) {
      showToast("Failed to update expense", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!selectedExpense) return;
    try {
      setIsProcessing(true);
      await expenseApi.deleteExpense(selectedExpense.id);
      showToast("Expense deleted successfully", "success");
      setIsDeleteOpen(false);
      fetchExpenses();
    } catch (error) {
      showToast("Failed to delete expense", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = useMemo(() => {
    return expenses.filter(e => 
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.receiver?.toLowerCase().includes(search.toLowerCase())
    );
  }, [expenses, search]);

  const paginated = useMemo(() => {
    return filtered.slice(0, pageSize);
  }, [filtered, pageSize]);

  return (
    <div className={`${dashboardPageClass} space-y-6`} style={dashboardPageStyle}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
        <div>
          <h1 className={pageHeaderTitleClass}>Expenses Management</h1>
        </div>
      </div>

      {/* Main Table Container Box */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden mx-4">
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
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex-1"></div>

          <div className="flex items-center gap-3">
            <div className="relative w-64 group">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search expenses..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary transition-all text-sm font-normal text-zinc-600"
              />
            </div>

            <Button 
              onClick={() => {
                setFormData({
                    title: "",
                    amount: 0,
                    category: "General",
                    receiver: "",
                    date: new Date().toISOString().split('T')[0],
                    description: "",
                    paymentMethod: "Cash"
                });
                setIsAddOpen(true);
              }}
              className="h-[42px] px-6 bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-md flex items-center gap-2 transition-colors font-medium text-sm shadow-sm"
            >
              <Plus className="size-4" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Table - Flush to sides */}
        <div className="overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Expense Details</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Receiver</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Creator</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Date</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Amount</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j} className="px-8 py-4">
                          <div className="h-4 bg-zinc-100 rounded w-full"></div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-8 py-10 text-center text-zinc-500">
                      No expense records found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((e) => (
                    <TableRow key={e.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="px-8 py-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-[#1E293B] uppercase tracking-tight">{e.title}</span>
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">{e.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-8 py-4">
                        <span className="text-[13px] font-medium text-zinc-700">{e.receiver || "N/A"}</span>
                      </TableCell>
                      <TableCell className="px-8 py-4">
                        <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-tight">{e.createdBy?.fullName || "System"}</span>
                      </TableCell>
                      <TableCell className="px-8 py-4">
                        <span className="text-[13px] text-zinc-600 font-medium">
                          {new Date(e.date).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="px-8 py-4 text-right pr-12">
                        <span className="text-[13px] font-bold text-rose-600">
                          -${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="px-8 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedExpense(e);
                              setFormData({
                                title: e.title,
                                amount: e.amount,
                                category: e.category,
                                receiver: e.receiver || "",
                                date: new Date(e.date).toISOString().split('T')[0],
                                description: e.description || "",
                                paymentMethod: e.paymentMethod || "Cash"
                              });
                              setIsEditOpen(true);
                            }}
                            className={actionBtnEdit}
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedExpense(e); setIsDeleteOpen(true); }}
                            className={actionBtnDelete}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Table Footer */}
        <div className="py-3 px-8 flex items-center justify-between bg-zinc-50/30 border-t border-zinc-100">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Showing {paginated.length} of {filtered.length} expenses</p>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Total Expenses:</p>
                    <p className="text-sm font-black text-rose-600">
                        ${filtered.reduce((sum, e) => sum + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setIsEditOpen(false); } }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <DialogTitle className="text-xl font-bold text-[#1E293B]">
              {isEditOpen ? "Update Expense Record" : "Record New Expense"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-medium">
                Enter details to track restaurant operational costs.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Expense Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Monthly Electricity"
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all font-medium text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Receiver (Company or Individual) *</label>
              <input
                type="text"
                value={formData.receiver}
                onChange={(e) => setFormData(prev => ({ ...prev, receiver: e.target.value }))}
                placeholder="e.g. Somnet Corp or Ali Mohamed"
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all font-medium text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">Amount (Cadada) *</label>
                <div className="relative">
                  <DollarSign className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all font-medium text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all font-medium text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all font-medium text-sm appearance-none cursor-pointer"
                >
                  <option>Utilities</option>
                  <option>Rent</option>
                  <option>Salary</option>
                  <option>Inventory</option>
                  <option>Marketing</option>
                  <option>General</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all font-medium text-sm appearance-none cursor-pointer"
                >
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Card</option>
                  <option>EVC Plus</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="rounded-lg font-bold px-6 h-11" disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
                onClick={isEditOpen ? handleUpdateExpense : handleAddExpense} 
                disabled={isProcessing}
                className="bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-lg font-bold border-none px-8 h-11 shadow-lg shadow-primary/20"
            >
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : isEditOpen ? "Update Record" : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Delete Expense</DialogTitle>
          <div className="p-8 flex items-start gap-6">
            <div className="w-14 h-14 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100 text-rose-600">
              <Trash2 className="size-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Delete Expense?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed uppercase tracking-tight">
                Are you sure you want to remove <span className="font-bold text-[#1E293B]">"{selectedExpense?.title}"</span>? This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-lg font-bold px-6 h-11" disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleDeleteExpense} className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none px-8 h-11 shadow-lg shadow-rose-600/10" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="size-4 animate-spin" /> : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
