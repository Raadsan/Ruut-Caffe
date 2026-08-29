"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Trash2, Lock, Edit, Eye, Mail, Phone, RefreshCw, Shield } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { cn } from "@/lib/utils";
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
import { userApi, User } from "@/lib/api/auth/userApi";
import { roleApi, Role } from "@/lib/api/auth/roleApi";
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
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardStatusBadgeClass,
  getTableStatusBadgeClass,
  btnCreatePage,
  dashboardCardClass,
  dashboardControlsRowClass,
  dashboardTableWrapClass,
  dashboardPaginationClass,
  dashboardSelectClass,
  dashboardInputClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
  dashboardLabelClass,
  dashboardTableIdClass,
} from "@/lib/dashboard-ui";

// Module-level in-memory cache to persist between React page transitions
let _usersCache: User[] | null = null;
let _rolesCache: Role[] | null = null;

function isPosRoleName(roleName?: string) {
  return roleName?.toLowerCase() === "pos";
}

export default function UsersPage() {
  const { showToast } = useToast();
  const { canAdd: checkAdd, canEdit: checkEdit, canDelete: checkDelete } = usePermissions();

  const canAdd = checkAdd("/users");
  const canEdit = checkEdit("/users");
  const canDelete = checkDelete("/users");

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPosPin, setFormPosPin] = useState("");
  const [formRoleId, setFormRoleId] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleFilter, setRoleFilter] = useState("all");

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === formRoleId),
    [roles, formRoleId]
  );
  const isPosRole = isPosRoleName(selectedRole?.name);

  const fetchData = async (force = false) => {
    try {
      // Fetch users first from API (background revalidation)
      const userData = await userApi.getAllUsers(force);
      _usersCache = userData;
      setUsers(userData);
      setLoading(false);

      // Fetch roles in the background
      const roleData = await roleApi.getAllRoles(force);
      _rolesCache = roleData;
      setRoles(roleData);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      showToast("Failed to load staff data", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Synchronously seed from cache on mount (client-side only)
    let initialUsers = _usersCache;
    let initialRoles = _rolesCache;

    if (!initialUsers && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("users_list");
        if (raw) {
          initialUsers = JSON.parse(raw) as User[];
          _usersCache = initialUsers;
        }
      } catch { /* ignore */ }
    }

    if (!initialRoles && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("roles_list");
        if (raw) {
          initialRoles = JSON.parse(raw) as Role[];
          _rolesCache = initialRoles;
        }
      } catch { /* ignore */ }
    }

    if (initialUsers) {
      setUsers(initialUsers);
      setLoading(false);
    }
    if (initialRoles) {
      setRoles(initialRoles);
    }

    // Show cached rows immediately, then reconcile with the database so newly
    // seeded or externally-created users are never hidden by stale local data.
    fetchData(true);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(search.toLowerCase())) ||
        (u.phone && u.phone.toLowerCase().includes(search.toLowerCase()));

      const matchesRole = roleFilter === "all" || String(u.roleId) === roleFilter || u.role?.name.toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, roleFilter]);

  const openAddModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormUsername("");
    setFormPosPin("");
    setFormRoleId(roles[0]?.id || 0);
    setFormIsActive(true);
    setIsAddOpen(true);
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setFormName(u.fullName);
    setFormEmail(u.email);
    setFormPhone(u.phone || "");
    setFormPassword("");
    setFormUsername(u.username || "");
    setFormPosPin("");
    setFormRoleId(u.roleId);
    setFormIsActive(u.isActive);
    setIsEditOpen(true);
  };

  const openDeleteModal = (u: User) => {
    setSelectedUser(u);
    setIsDeleteOpen(true);
  };

  const openViewModal = (u: User) => {
    setSelectedUser(u);
    setIsViewOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formRoleId) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    if (isPosRole) {
      if (!formUsername.trim()) {
        showToast("Username is required for POS staff", "error");
        return;
      }
      if (isAddOpen && !/^\d{6}$/.test(formPosPin)) {
        showToast("POS PIN must be exactly 6 digits", "error");
        return;
      }
      if (isEditOpen && formPosPin && !/^\d{6}$/.test(formPosPin)) {
        showToast("POS PIN must be exactly 6 digits", "error");
        return;
      }
    } else {
      if (!formEmail || (isAddOpen && !formPassword)) {
        showToast("Please fill in all required fields", "error");
        return;
      }
    }

    try {
      setSaving(true);
      if (isEditOpen && selectedUser) {
        const updatePayload = {
          fullName: formName,
          phone: formPhone,
          roleId: formRoleId,
          isActive: formIsActive,
          ...(isPosRole
            ? {
                username: formUsername.trim(),
                ...(formPosPin ? { posPin: formPosPin } : {}),
              }
            : {
                email: formEmail,
                username: null,
                posPin: null,
                ...(formPassword ? { password: formPassword } : {}),
              }),
        };
        await userApi.updateUser(selectedUser.id, updatePayload);
        showToast("Staff profile updated", "success");
      } else if (isPosRole) {
        await userApi.createUser({
          fullName: formName,
          phone: formPhone,
          roleId: formRoleId,
          username: formUsername.trim(),
          posPin: formPosPin,
        });
        showToast("New POS staff member registered", "success");
      } else {
        await userApi.createUser({
          fullName: formName,
          email: formEmail,
          phone: formPhone,
          password: formPassword,
          roleId: formRoleId,
        });
        showToast("New staff member registered", "success");
      }
      setIsAddOpen(false);
      setIsEditOpen(false);
      _usersCache = null; // bust cache
      fetchData(true); // force network fetch
    } catch (error: any) {
      console.error("Failed to save user:", error);
      showToast(error.response?.data?.message || "Failed to save user", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      await userApi.deleteUser(selectedUser.id);
      showToast("Staff member removed", "success");
      setIsDeleteOpen(false);
      _usersCache = null; // bust cache
      fetchData(true); // force network fetch
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      showToast(error.response?.data?.message || "Failed to delete record", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      {/* Page Header: Outside the box */}
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>Users management</h1>
      </div>

      {/* Main Container Box */}
      <div className={dashboardCardClass}>
        {/* Controls Row: Inside the box */}
        <div className={dashboardControlsRowClass}>
          <div className="flex items-center gap-4">
            <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
              <span>Show</span>
              <select 
                value={pageSize} 
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={cn("w-16", dashboardSelectClass)}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
              <span>Filter Role</span>
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className={cn("w-40 px-3", dashboardSelectClass)}
              >
                <option value="all">All Roles</option>
                {roles.map(r => (
                  <option key={r.id} value={String(r.id)}>{r.name}</option>
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
                placeholder="Search admins..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={dashboardInputClass}
              />
            </div>

            {canAdd && (
              <Button onClick={openAddModal} className={btnCreatePage}>
                <Plus className="size-4" />
                Add Admin
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>No</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Name</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Email</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Phone</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Role</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(7)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 bg-zinc-100 rounded w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-10 text-center text-muted-foreground dark:text-white/70">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((u) => (
                    <TableRow key={u.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{u.id}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextPrimary}>{u.fullName}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>{u.email}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>{u.phone || "—"}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={cn(dashboardTextSecondary, "capitalize")}>
                          {u.role?.name || "No Role"}
                        </span>
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <span
                          className={cn(
                            dashboardStatusBadgeClass,
                            getTableStatusBadgeClass(u.isActive ? "active" : "inactive")
                          )}
                        >
                          {u.isActive ? "Staff" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewModal(u)}
                            className={actionBtnView}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(u)}
                              className={actionBtnEdit}
                            >
                              <Edit className="size-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteModal(u)}
                              className={actionBtnDelete}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Table Footer / Pagination */}
        <div className={dashboardPaginationClass}>
          <div>
            {Math.min(filteredUsers.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredUsers.length, currentPage * pageSize)} of {filteredUsers.length}
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
        <DialogContent className="sm:max-w-[640px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">User Profile Form</DialogTitle>
          <div className="p-6 border-b border-zinc-100">
            <DialogTitle className="text-xl font-bold text-[#1e293b]">
              {isEditOpen ? "Update Staff Profile" : "Register New Staff Member"}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 mt-1">
              {isEditOpen ? "Modify account details and access permissions." : "Create a new administrative or kitchen account for your staff."}
            </DialogDescription>
          </div>

          <div className="p-8 grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Full Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Mohamed Ali"
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
              />
            </div>

            {!isPosRole && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1E293B]">Email Address *</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="staff@example.com"
                    className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1E293B]">Phone Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+252..."
                    className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
                  />
                </div>
              </>
            )}

            {isPosRole && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">Phone Number</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+252..."
                  className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Access Role *</label>
              <select
                value={formRoleId}
                onChange={(e) => {
                  const nextRoleId = Number(e.target.value);
                  setFormRoleId(nextRoleId);
                  const nextRole = roles.find((r) => r.id === nextRoleId);
                  if (isPosRoleName(nextRole?.name)) {
                    setFormEmail("");
                    setFormPassword("");
                  } else {
                    setFormUsername("");
                    setFormPosPin("");
                  }
                }}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all text-[15px] font-medium appearance-none cursor-pointer"
              >
                <option value={0}>Select a role...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1E293B]">Account Status</label>
              <select
                value={formIsActive ? "active" : "inactive"}
                onChange={(e) => setFormIsActive(e.target.value === "active")}
                className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 transition-all text-[15px] font-medium appearance-none cursor-pointer"
              >
                <option value="active">Active (Grant Access)</option>
                <option value="inactive">Inactive (Revoke Access)</option>
              </select>
            </div>

            {isPosRole ? (
              <>
                <div className="col-span-2 space-y-2 pt-2 border-t border-zinc-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    POS login credentials
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1E293B]">Username *</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="e.g. mohamed.pos"
                    autoComplete="off"
                    className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1E293B]">
                    {isEditOpen ? "New PIN (optional, 6 digits)" : "PIN (6 digits) *"}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={formPosPin}
                    onChange={(e) => setFormPosPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={isEditOpen ? "Leave blank to keep current" : "123456"}
                    autoComplete="off"
                    className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium tracking-[0.3em]"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-bold text-[#1E293B]">
                  {isEditOpen ? "Update Password (Optional)" : "Account Password *"}
                </label>
                <div className="relative group">
                  <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={isEditOpen ? "Leave blank to keep current" : "Min. 6 characters"}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/5 transition-all text-[15px] font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="rounded-md font-bold px-6 h-11" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-md font-bold border-none px-8 h-11 shadow-lg shadow-primary/20" disabled={saving}>
              {saving ? "Processing..." : isEditOpen ? "Update Account" : "Register User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW MODAL */}
      <Dialog open={isViewOpen} onOpenChange={(open) => { if (!open) setIsViewOpen(false); }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Staff Member Details</DialogTitle>
          <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-bold text-[#1E293B]">{selectedUser?.fullName}</h3>
                <p className="text-sm font-medium text-primary mt-1 uppercase tracking-wider">
                  {selectedUser?.role?.name || "Staff Member"}
                </p>
              </div>
              <span
                className={cn(
                  dashboardStatusBadgeClass,
                  getTableStatusBadgeClass(selectedUser?.isActive ? "active" : "inactive")
                )}
              >
                {selectedUser?.isActive ? "Staff" : "Inactive"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex gap-4">
                <div className="flex-1 p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center gap-3 group hover:border-primary/30 transition-colors">
                  <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm group-hover:text-primary shrink-0">
                    <Mail className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Email Address</p>
                    <p className="text-sm font-medium text-zinc-700 truncate">{selectedUser?.email}</p>
                  </div>
                </div>

                <div className="flex-1 p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center gap-3 group hover:border-primary/30 transition-colors">
                  <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm group-hover:text-primary shrink-0">
                    <Phone className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Phone Number</p>
                    <p className="text-sm font-medium text-zinc-700 truncate">{selectedUser?.phone || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm text-zinc-400 shrink-0">
                    <RefreshCw className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Created At</p>
                    <p className="text-sm font-medium text-zinc-700">
                      {selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm text-zinc-400 shrink-0">
                    <Shield className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Last Update</p>
                    <p className="text-sm font-medium text-zinc-700">
                      {selectedUser?.updatedAt ? new Date(selectedUser.updatedAt).toLocaleDateString() : "Just Now"}
                    </p>
                  </div>
                </div>
              </div>

              {isPosRoleName(selectedUser?.role?.name) && selectedUser?.username && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4">
                  <div className="size-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-primary">
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-primary font-bold uppercase tracking-wider">POS Username</p>
                    <p className="text-sm font-medium text-[#1E293B]">{selectedUser.username}</p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4">
                <div className="size-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-primary">
                  <Lock className="size-5" />
                </div>
                <div>
                  <p className="text-[11px] text-primary font-bold uppercase tracking-wider">Security Access</p>
                  <p className="text-sm font-medium text-[#1E293B]">
                    Restricted to {selectedUser?.role?.name} Panel
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-8 pt-6 border-t border-zinc-100 px-0 pb-0">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsViewOpen(false);
                    if (selectedUser) openEditModal(selectedUser);
                  }}
                  className="rounded-md font-bold px-6 h-11 mr-2"
                >
                  <Edit className="size-4 mr-2" />
                  Edit
                </Button>
              )}
              <Button
                onClick={() => setIsViewOpen(false)}
                className="flex-1 bg-primary !text-white hover:bg-primary/90 hover:!text-white rounded-md font-bold border-none h-12 shadow-lg shadow-primary/20"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) setIsDeleteOpen(false); }}>
        <DialogContent className="sm:max-w-[500px] bg-white border-zinc-100 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Delete Confirmation</DialogTitle>
          <div className="p-8 flex items-start gap-6">
            <div className="w-14 h-14 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <Trash2 className="size-6 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#1E293B] mb-2">Remove Staff Account?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-[#1E293B]">"{selectedUser?.fullName}"</span> from the system?
                This action is permanent and they will lose all access immediately.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-md font-bold px-6 h-11" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 !text-white hover:!text-white rounded-md font-bold border-none px-8 h-11 shadow-lg shadow-rose-600/10" disabled={saving}>
              {saving ? "Deleting..." : "Yes, Remove User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
