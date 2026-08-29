"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleApi, Role } from "@/lib/api/auth/roleApi";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
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
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  btnCreatePage,
} from "@/lib/dashboard-ui";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const { showToast } = useToast();

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  });

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const data = await roleApi.getAllRoles();
      setRoles(data || []);
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      showToast("Failed to load roles", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await roleApi.createRole({
        name: formData.name,
        description: formData.description
      });
      showToast("Role created successfully", "success");
      setIsAddOpen(false);
      resetForm();
      fetchRoles();
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to create role", "error");
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    try {
      await roleApi.updateRole(selectedRole.id, {
        name: formData.name,
        description: formData.description
      });
      showToast("Role updated successfully", "success");
      setIsEditOpen(false);
      fetchRoles();
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to update role", "error");
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    try {
      await roleApi.deleteRole(selectedRole.id);
      showToast("Role deleted successfully", "success");
      setIsDeleteOpen(false);
      fetchRoles();
    } catch (error: any) {
      showToast(error.response?.data?.message || "Failed to delete role", "error");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: ""
    });
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || ""
    });
    setIsEditOpen(true);
  };

  const filteredRoles = useMemo(() => {
    return (roles || []).filter(role => 
      role.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      role.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [roles, searchQuery]);

  const totalPages = Math.ceil(filteredRoles.length / pageSize) || 1;
  const paginatedRoles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRoles.slice(start, start + pageSize);
  }, [filteredRoles, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Roles</h1>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
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

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="relative w-64 group">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roles..."
                className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600"
              />
            </div>

            <Button
              onClick={() => setIsAddOpen(true)}
              className={btnCreatePage}
            >
              <Plus className="size-4" />
              Create Role
            </Button>
          </div>
        </div>

        <div className="border-t border-zinc-100 overflow-hidden bg-white">
          <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Role Name</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Description</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Creation Date</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="h-14 animate-pulse">
                    {[...Array(5)].map((_, j) => (
                      <TableCell key={j} className="px-6 py-3">
                        <div className="h-4 bg-zinc-100 rounded w-full"></div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedRoles.length > 0 ? (
                paginatedRoles.map((role, index) => (
                  <TableRow key={role.id} className={dashboardTableBodyRowClass}>
                    <TableCell className={dashboardTableCellClass}>
                      <span className="text-[13px] font-bold text-primary">
                        {(currentPage - 1) * pageSize + index + 1}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className="text-[13px] font-medium text-zinc-800 uppercase tracking-tight">{role.name}</span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                       <p className="text-[12.5px] font-medium text-zinc-500 max-w-xs truncate leading-relaxed">
                         {role.description || "—"}
                       </p>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                        <span className="text-[11px] text-zinc-500 font-medium">
                            {role.createdAt ? new Date(role.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                        </span>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex justify-end gap-2">
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             onClick={() => openEditModal(role)}
                             className={actionBtnEdit}
                           >
                             <Edit className="size-4" />
                           </Button>
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             onClick={() => { setSelectedRole(role); setIsDeleteOpen(true); }}
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
                  <TableCell colSpan={5} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Shield className="size-12 text-zinc-100" />
                      <p className="text-zinc-400 font-black uppercase text-[11px] tracking-widest">No roles found in directory</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        {filteredRoles.length > 0 && (
          <div className="px-8 py-3 border-t border-zinc-100 flex items-center justify-between text-[12px] text-zinc-500">
            <span>
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRoles.length)} of {filteredRoles.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <span className="text-xs font-medium">{currentPage} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => { if(!open) { setIsAddOpen(false); setIsEditOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-none p-0 overflow-hidden rounded-2xl shadow-xl">
          <div className="p-8 border-b border-zinc-100 bg-zinc-50/30">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-[#1e293b]">
                {isEditOpen ? "Edit Role" : "Create New Role"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm mt-1">
                Define the identity and purpose of this system role.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <form onSubmit={isEditOpen ? handleUpdateRole : handleAddRole} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1e293b]">Role Name *</label>
              <input 
                type="text"
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Sales Manager"
                required
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium placeholder:text-zinc-400"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1e293b]">Description</label>
              <textarea 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe what this role does..."
                rows={4}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium placeholder:text-zinc-400 resize-none"
              />
            </div>

            <DialogFooter className="pt-6 flex gap-3 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="px-6 h-11 rounded-lg font-bold text-zinc-500">
                Cancel
              </Button>
              <Button type="submit" className="px-8 h-11 rounded-lg font-bold bg-primary !text-white hover:bg-primary/90 hover:!text-white shadow-lg shadow-primary/20 border-none">
                {isEditOpen ? "Update Role" : "Save Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if(!open) setIsDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-[480px] bg-white border-none p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogTitle className="sr-only">Delete Role</DialogTitle>
          <div className="p-8 flex items-start gap-6 pt-10">
            <div className="w-14 h-14 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <Trash2 className="size-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Delete Role?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-[#1E293B]">"{selectedRole?.name}"</span>? 
                This action cannot be undone and may affect staff members assigned to this role.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-lg font-bold px-6 h-11 text-zinc-500">
              Cancel
            </Button>
            <Button onClick={handleDeleteRole} className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-lg font-bold border-none px-8 h-11 shadow-lg shadow-rose-600/10">
              Yes, Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
