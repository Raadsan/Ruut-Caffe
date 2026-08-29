"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutGrid,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  QrCode,
  Eye,
  Printer,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tableApi, Table as RestaurantTable, TableStatus } from "@/lib/api/restaurant/tableApi";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/context/PermissionContext";
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
  getTableStatusLabel,
} from "@/lib/dashboard-ui";

import { getTableQrImageUrl } from "@/lib/qr-menu-url";

const formSubmitBtnClass =
  "bg-primary !text-white hover:bg-primary/90 hover:!text-white hover:shadow-lg hover:shadow-primary/20 rounded-lg font-bold border-none px-8 h-11 shadow-md shadow-primary/15 disabled:opacity-70 disabled:cursor-not-allowed transition-all";

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { showToast } = useToast();
  const { canAdd: checkAdd, canEdit: checkEdit, canDelete: checkDelete } = usePermissions();
  const canAdd = checkAdd("/tables");
  const canEdit = checkEdit("/tables");
  const canDelete = checkDelete("/tables");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    number: "",
    name: "",
    description: "",
    capacity: "4",
    status: "active" as TableStatus
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchTables = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const tablesData = await tableApi.getAllTables();
      setTables(tablesData || []);
    } catch (error) {
      console.error("Failed to fetch tables:", error);
      showToast("Failed to load tables", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const upsertTableInState = (table: RestaurantTable) => {
    setTables(prev => {
      const idx = prev.findIndex(t => t.id === table.id);
      if (idx === -1) return [...prev, table].sort((a, b) => a.number - b.number);
      const next = [...prev];
      next[idx] = table;
      return next;
    });
    setSelectedTable(prev => (prev?.id === table.id ? table : prev));
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await tableApi.createTable({
        number: parseInt(formData.number),
        name: formData.name || `Table ${formData.number}`,
        description: formData.description.trim(),
        capacity: parseInt(formData.capacity),
        status: formData.status
      });
      upsertTableInState(created);
      showToast("Table created successfully", "success");
      setIsAddOpen(false);
      resetForm();
      await fetchTables(true);
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to create table", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setSubmitting(true);
    try {
      const updated = await tableApi.updateTable(selectedTable.id.toString(), {
        number: parseInt(formData.number),
        name: formData.name,
        description: formData.description.trim(),
        capacity: parseInt(formData.capacity),
        status: formData.status
      });
      upsertTableInState(updated);
      showToast("Table updated successfully", "success");
      setIsEditOpen(false);
      await fetchTables(true);
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to update table", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedTable) return;
    setDeleting(true);
    try {
      await tableApi.deleteTable(selectedTable.id.toString());
      setTables(prev => prev.filter(t => t.id !== selectedTable.id));
      showToast("Table deleted successfully", "success");
      setIsDeleteOpen(false);
      setSelectedTable(null);
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to delete table", "error");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      number: "",
      name: "",
      description: "",
      capacity: "4",
      status: "active"
    });
  };

  const openEditModal = (table: RestaurantTable) => {
    setSelectedTable(table);
    setFormData({
      number: table.number.toString(),
      name: table.name || "",
      description: table.description || "",
      capacity: table.capacity?.toString() || "4",
      status: table.status
    });
    setIsEditOpen(true);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const openViewModal = (table: RestaurantTable) => {
    const latest = tables.find(t => t.id === table.id) ?? table;
    setSelectedTable(latest);
    setIsViewOpen(true);
  };

  const handlePrint = () => {
    if (!selectedTable?.qrCode) return;
    const qrUrl = getTableQrImageUrl(selectedTable.qrCode, 300);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Table QR - ${selectedTable.number}</title>
            <style>
              body { 
                margin: 0; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center; 
                height: 100vh; 
                font-family: 'Inter', sans-serif;
                background-color: white;
              }
              .print-card {
                width: 400px;
                padding: 40px;
                border: 2px solid #f1f5f9;
                border-radius: 32px;
                text-align: center;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
              }
              .logo {
                font-size: 24px;
                font-weight: 900;
                color: #605DFF;
                margin-bottom: 30px;
                text-transform: uppercase;
                letter-spacing: -0.02em;
              }
              .qr-container {
                background: white;
                padding: 20px;
                border-radius: 24px;
                display: inline-block;
                margin-bottom: 25px;
                border: 1px solid #f1f5f9;
              }
              img { width: 250px; height: 250px; display: block; }
              .table-num {
                font-size: 42px;
                font-weight: 900;
                color: #1E293B;
                margin: 0;
                line-height: 1;
              }
              .table-name {
                font-size: 16px;
                font-weight: 600;
                color: #64748B;
                margin: 8px 0 0 0;
                text-transform: uppercase;
                letter-spacing: 0.1em;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                font-weight: 700;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.2em;
              }
              @media print {
                body { background: white; }
                .print-card { border: none; box-shadow: none; }
              }
            </style>
          </head>
          <body>
            <div class="print-card">
              <div class="logo">Restaurant POS</div>
              <div class="qr-container">
                <img src="${qrUrl}" alt="Table QR Code" />
              </div>
              <h1 class="table-num">Table ${selectedTable.number}</h1>
              <p class="table-name">${selectedTable.name || 'Seating Area'}</p>
              <div class="footer">Scan to order</div>
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const filteredTables = useMemo(() => {
    return (tables || []).filter(table => {
      return (
        searchQuery === "" ||
        table.number.toString().includes(searchQuery) ||
        table.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        table.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [tables, searchQuery]);

  const totalPages = Math.ceil(filteredTables.length / pageSize);
  const paginatedTables = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTables.slice(start, start + pageSize);
  }, [filteredTables, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const getStatusInfo = (status: TableStatus | string) => ({
    label: getTableStatusLabel(status),
    color: getTableStatusBadgeClass(status),
  });

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      {/* Page Header: Outside the box */}
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Tables Management</h1>
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
                placeholder="Search tables..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600"
              />
            </div>

            {canAdd && (
              <Button 
                onClick={openAddModal}
                className="h-[42px] px-6 bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-md flex items-center gap-2 transition-all font-medium text-sm shadow-sm hover:shadow-md hover:shadow-primary/20"
              >
                <Plus className="size-4" />
                Add Table
              </Button>
            )}
          </div>
        </div>

        {/* Table - Flush to sides */}
        <div className="border-t border-zinc-100 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table className="w-full">
                  <TableHeader className={dashboardTableHeaderClass}>
                    <TableRow className={dashboardTableHeadRowClass}>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Table No</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Name</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Description</TableHead>
                      <TableHead className={cn(dashboardTableHeadClass, "text-left")}>QR Code</TableHead>
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
                ) : paginatedTables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                      No tables found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTables.map((table) => {
                    const statusInfo = getStatusInfo(table.status);

                    return (
                      <TableRow key={table.id} className="border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                        <TableCell className="px-6 py-3">
                          <span className="text-[13px] font-bold text-primary">{table.number}</span>
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <span className="text-[13px] font-medium text-zinc-700">{table.name || `Table ${table.number}`}</span>
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <span
                            className="text-[13px] text-zinc-600 line-clamp-2 max-w-[220px]"
                            title={table.description || undefined}
                          >
                            {table.description || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <span
                            className="text-[13px] text-zinc-600 truncate max-w-[200px] block"
                            title={table.qrCode || undefined}
                          >
                            {table.qrCode || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right">
                          <span className={cn(dashboardStatusBadgeClass, statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewModal(table)}
                              className={actionBtnView}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(table)}
                                className={actionBtnEdit}
                              >
                                <Edit className="size-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedTable(table); setIsDeleteOpen(true); }}
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
        <div className="py-2 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-zinc-400 border-t border-zinc-100 bg-zinc-50/30">
          <div>
            {Math.min(filteredTables.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredTables.length, currentPage * pageSize)} of {filteredTables.length}
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

      {/* ADD MODAL */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[640px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Table Registration Form</DialogTitle>
          <div className="p-6 border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Register New Table</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Create a new seating table for your restaurant.
            </DialogDescription>
          </div>
          <form onSubmit={handleAddTable} className="p-8 grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Table Number *</label>
              <input
                type="number"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="e.g. 5"
                required
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Capacity *</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="4"
                required
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Display Name (Optional)</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. VIP Booth 1"
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Near window, quiet corner, best for families..."
                rows={3}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium resize-none"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Initial Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TableStatus })}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all text-[15px] font-medium appearance-none cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <DialogFooter className="col-span-2 pt-6 border-t border-zinc-100 mt-4 -mx-8 px-8 bg-zinc-50/50 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                disabled={submitting}
                className="rounded-lg font-bold px-6 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className={formSubmitBtnClass}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Save Table"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) setIsEditOpen(false); }}>
        <DialogContent className="sm:max-w-[640px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Edit Table Details</DialogTitle>
          <div className="p-6 border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">Edit Table #{selectedTable?.number}</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              Update table details and seating availability.
            </DialogDescription>
          </div>
          <form onSubmit={handleUpdateTable} className="p-8 grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Table Number *</label>
              <input
                type="number"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                required
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Capacity *</label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                required
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Display Name</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Table location notes, seating notes..."
                rows={3}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium resize-none"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Current Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TableStatus })}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all text-[15px] font-medium appearance-none cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <DialogFooter className="col-span-2 pt-6 border-t border-zinc-100 mt-4 -mx-8 px-8 bg-zinc-50/50 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={submitting}
                className="rounded-lg font-bold px-6 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className={formSubmitBtnClass}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update Table"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW MODAL */}
      <Dialog open={isViewOpen} onOpenChange={(open) => { if (!open) setIsViewOpen(false); }}>
        <DialogContent className="sm:max-w-[640px] bg-white border-zinc-100 p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Table View Details</DialogTitle>
          {selectedTable && (
            <>
              <div className="px-8 pt-8 pb-5 border-b border-zinc-100">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <LayoutGrid className="size-4 shrink-0" />
                      <span className="text-[11px] font-black uppercase tracking-[0.2em]">Table Details</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[#1E293B] tracking-tight">
                      {selectedTable.name || `Table ${selectedTable.number}`}
                    </h2>
                    <p className="text-[13px] text-zinc-500 mt-1">
                      Table #{selectedTable.number} · ID {selectedTable.id}
                    </p>
                  </div>
                  <span
                    className={cn(dashboardStatusBadgeClass, getStatusInfo(selectedTable.status).color, "shrink-0")}
                  >
                    {getStatusInfo(selectedTable.status).label}
                  </span>
                </div>
              </div>

              <div className="px-8 py-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-8 items-start">
                <div className="space-y-5">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                      Seats
                    </label>
                    <div className="flex items-center gap-2 text-[14px] font-bold text-[#1E293B]">
                      <Users className="size-4 text-primary shrink-0" />
                      {selectedTable.capacity || 4}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                      Description
                    </label>
                    <p className="text-[14px] text-zinc-700 leading-relaxed">
                      {selectedTable.description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-stretch">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-4 self-start">
                      <QrCode className="size-4 text-primary" />
                      <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">
                        Scan QR Code
                      </span>
                    </div>
                    {selectedTable.qrCode ? (
                      <>
                        <div className="rounded-xl border border-zinc-100 bg-white p-3">
                          <img
                            src={getTableQrImageUrl(selectedTable.qrCode, 220)}
                            alt={`QR code for table ${selectedTable.number}`}
                            className="size-[220px] object-contain"
                          />
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-4 text-center uppercase tracking-wider font-semibold">
                          Scan to open menu
                        </p>
                      </>
                    ) : (
                      <div className="size-[220px] rounded-xl border border-dashed border-zinc-200 flex items-center justify-center text-sm text-zinc-400">
                        No QR code
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 bg-zinc-50/50 border-t border-zinc-100 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsViewOpen(false)}
                  className="rounded-xl font-bold border-zinc-200 px-6 h-11 text-[11px] uppercase tracking-widest hover:bg-white"
                >
                  Close
                </Button>
                {selectedTable.qrCode && (
                  <Button
                    onClick={handlePrint}
                    className="bg-primary !text-white hover:bg-primary/90 hover:!text-white hover:shadow-lg hover:shadow-primary/20 rounded-xl font-bold border-none px-8 h-11 text-[11px] uppercase tracking-widest shadow-md shadow-primary/15 flex items-center gap-2"
                  >
                    <Printer className="size-4" />
                    Print QR Code
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) setIsDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Delete Table Confirmation</DialogTitle>
          <div className="p-8 flex items-start gap-6">
            <div className="w-14 h-14 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <Trash2 className="size-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Delete Table?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-[#1E293B]">"Table {selectedTable?.number}"</span>?
                This action cannot be undone.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleting}
              className="rounded-lg font-bold px-6 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteTable}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none px-8 h-11 shadow-lg shadow-rose-600/10 disabled:opacity-70"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Yes, Delete Table"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
