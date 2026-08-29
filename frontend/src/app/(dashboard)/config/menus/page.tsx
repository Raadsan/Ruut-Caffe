"use client";

import React, { useEffect, useState, useMemo } from "react";
import { menuApi, Menu, SubMenu } from "@/lib/api/restaurant/menuApi";
import { WORKSPACE_KEYS, type WorkspaceKey } from "@/lib/workspaces";
import {
  Plus,
  Edit,
  Trash2,
  PlusCircle,
  LayoutGrid,
  Search,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  getLucideIcon,
  searchLucideIconNames,
  LUCIDE_ICON_NAMES,
} from "@/lib/lucide-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  actionBtnEdit,
  actionBtnDelete,
  btnConfirmDelete,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableHeadClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardStatusBadgeClass,
  getTableStatusBadgeClass,
  btnCreatePage,
} from "@/lib/dashboard-ui";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MenuManagementPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMenu, setEditingMenu] = useState<Partial<Menu> | null>(null);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [hasSubmenus, setHasSubmenus] = useState(false);
  const [menuSubmenus, setMenuSubmenus] = useState<
    { id?: number; title: string; url: string; order: number; isActive?: boolean }[]
  >([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: number;
    type: "menu" | "submenu";
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [iconSearch, setIconSearch] = useState("");
  const { showToast } = useToast();

  const fetchMenus = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const data = await menuApi.getAllMenus(forceRefresh);
      setMenus(data);
    } catch (error) {
      console.error("Failed to fetch menus:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const notifySidebarRefresh = () => {
    const allMenus = menuApi.peekAllMenus();
    window.dispatchEvent(
      new CustomEvent("sidebar-menu-updated", { detail: { allMenus } })
    );
  };

  const buildOptimisticMenu = (
    menuId: number | undefined,
    payload: {
      title: string;
      url: string;
      icon?: string;
      order?: number;
      isActive?: boolean;
      moduleKey: WorkspaceKey;
    },
    subs: typeof menuSubmenus
  ): Menu => ({
    id: menuId ?? -Date.now(),
    title: payload.title!,
    url: payload.url!,
    icon: payload.icon || "LayoutDashboard",
    order: payload.order ?? menus.length + 1,
    isActive: payload.isActive !== false,
    moduleKey: payload.moduleKey,
    permissions: {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
    },
    items: hasSubmenus
      ? subs
          .filter((sm) => sm.title && sm.url)
          .map((sm, i) => ({
            id: sm.id ?? -(i + 1),
            title: sm.title,
            url: sm.url,
            order: i + 1,
            isActive: sm.isActive !== false,
            permissions: {
              canView: true,
              canAdd: true,
              canEdit: true,
              canDelete: true,
            },
          }))
      : [],
  });

  const handleSaveMenu = async () => {
    if (!editingMenu?.title || !editingMenu?.url || !editingMenu?.moduleKey) {
      showToast("Title, URL, and Module / Workspace are required", "error");
      return;
    }

    const snapshot = [...menus];
    const menuId = editingMenu.id;
    const bundlePayload = {
      title: editingMenu.title,
      url: editingMenu.url,
      icon: editingMenu.icon,
      order: editingMenu.order,
      isActive: editingMenu.isActive,
      moduleKey: editingMenu.moduleKey,
      hasSubmenus,
      submenus: menuSubmenus,
    };

    const optimistic = buildOptimisticMenu(menuId, bundlePayload, menuSubmenus);
    const nextMenus = menuId
      ? menus.map((m) => (m.id === menuId ? optimistic : m))
      : [...menus, optimistic];
    setMenus(nextMenus.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    menuApi.setAllMenusCache(nextMenus);

    setIsMenuDialogOpen(false);
    setEditingMenu(null);
    showToast(
      `Menu ${menuId ? "updated" : "created"} successfully`,
      "success"
    );
    notifySidebarRefresh();

    try {
      await menuApi.saveMenuBundle(menuId, bundlePayload);
      const fresh = menuApi.peekAllMenus();
      if (fresh) setMenus(fresh);
      notifySidebarRefresh();
    } catch (error) {
      console.error("Failed to save menu:", error);
      setMenus(snapshot);
      menuApi.setAllMenusCache(snapshot);
      notifySidebarRefresh();
      showToast("Failed to save menu — changes reverted", "error");
    }
  };

  const sortedMenus = useMemo(
    () => [...menus].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [menus]
  );

  const handleMoveMenu = async (menuId: number, direction: "up" | "down") => {
    const sorted = [...sortedMenus];
    const idx = sorted.findIndex((m) => m.id === menuId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const current = sorted[idx];
    const target = sorted[swapIdx];
    const reordered = sorted.map((m) => {
      if (m.id === current.id) return { ...m, order: target.order };
      if (m.id === target.id) return { ...m, order: current.order };
      return m;
    });

    setMenus(reordered);
    menuApi.patchAllMenusCache(() => reordered);
    notifySidebarRefresh();
    setReorderingId(menuId);
    try {
      await menuApi.reorderMenus(
        reordered.map((m) => ({ id: m.id, order: m.order }))
      );
    } catch (error) {
      console.error("Failed to reorder menus:", error);
      showToast("Failed to update menu order", "error");
      fetchMenus(true);
    } finally {
      setReorderingId(null);
    }
  };

  const moveSubmenu = (idx: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= menuSubmenus.length) return;
    const next = [...menuSubmenus];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setMenuSubmenus(
      next.map((sm, i) => ({ ...sm, order: i + 1 }))
    );
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const snapshot = [...menus];
    setIsDeleting(true);

    if (itemToDelete.type === "menu") {
      setMenus((prev) => prev.filter((m) => m.id !== itemToDelete.id));
      menuApi.patchAllMenusCache((prev) =>
        prev.filter((m) => m.id !== itemToDelete.id)
      );
    }
    notifySidebarRefresh();
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);

    try {
      if (itemToDelete.type === "menu") {
        await menuApi.deleteMenu(itemToDelete.id);
        showToast("Menu deleted successfully", "success");
      } else {
        await menuApi.deleteSubMenu(itemToDelete.id);
        showToast("Submenu deleted successfully", "success");
        fetchMenus(false);
      }
      notifySidebarRefresh();
    } catch (error) {
      console.error("Failed to delete:", error);
      setMenus(snapshot);
      menuApi.setAllMenusCache(snapshot);
      notifySidebarRefresh();
      showToast("Failed to delete item", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredMenus = useMemo(
    () =>
      sortedMenus.filter((m) => {
        const matchesSearch =
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.url.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && m.isActive !== false) ||
          (statusFilter === "inactive" && m.isActive === false);
        const matchesModule = moduleFilter === 'all' || m.moduleKey === moduleFilter;
        return matchesSearch && matchesStatus && matchesModule;
      }),
    [sortedMenus, searchQuery, statusFilter, moduleFilter]
  );

  const totalPages = Math.ceil(filteredMenus.length / pageSize) || 1;
  const paginatedMenus = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMenus.slice(start, start + pageSize);
  }, [filteredMenus, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, moduleFilter, pageSize]);

  const filteredIcons = useMemo(
    () => searchLucideIconNames(iconSearch, iconSearch.trim() ? 120 : 64),
    [iconSearch]
  );

  const iconSearchTotal = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return LUCIDE_ICON_NAMES.length;
    return LUCIDE_ICON_NAMES.filter((name) => name.toLowerCase().includes(q)).length;
  }, [iconSearch]);

  const openNew = () => {
    setEditingMenu({
      title: "",
      url: "",
      icon: "LayoutDashboard",
      order: menus.length + 1,
      isActive: true,
      moduleKey: "RESTAURANT",
    });
    setHasSubmenus(false);
    setMenuSubmenus([{ title: "", url: "", order: 1, isActive: true }]);
    setIconSearch("");
    setIsMenuDialogOpen(true);
  };

  const openEdit = (menu: Menu) => {
    setEditingMenu(menu);
    const subms = menu.items || [];
    setHasSubmenus(subms.length > 0);
    setMenuSubmenus(
      subms.length > 0
        ? subms.map((s) => ({ ...s }))
        : [{ title: "", url: "", order: 1, isActive: true }]
    );
    setIconSearch("");
    setIsMenuDialogOpen(true);
  };

  const selectedIcon = editingMenu?.icon || "LayoutDashboard";
  const SelectedIconComp = getLucideIcon(selectedIcon);

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <div>
          <h1 className={pageHeaderTitleClass}>Menu Configuration</h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Set sidebar order with the arrows. Saving here does not change role permissions.
          </p>
        </div>
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
                </select>
              </div>
              <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
                <span>Module</span>
                <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="w-40 h-[42px] px-3 border border-zinc-200 rounded-md bg-white text-sm text-zinc-600">
                  <option value="all">All Modules</option>
                  {WORKSPACE_KEYS.map((key) => <option key={key} value={key}>{key.replace('_', ' ')}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2 text-[13px] text-zinc-400 font-normal shrink-0">
                <span>Filter Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-32 h-[42px] px-3 border border-zinc-200 rounded-md outline-none focus:border-primary transition-colors bg-white cursor-pointer text-sm font-normal text-zinc-600"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
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
                  placeholder="Search menus..."
                  className="w-full h-[42px] pl-10 pr-4 bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all text-sm font-normal text-zinc-600"
                />
              </div>

              <Button onClick={openNew} className={btnCreatePage}>
                <Plus className="size-4" />
                Add Menu
              </Button>
            </div>
          </div>

          <div className="border-t border-zinc-100 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left w-16")}>No</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left w-20")}>Order</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Menu</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>URL</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Module</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Sub-Modules</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-center w-24")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right w-24")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse bg-zinc-50/40">
                      <TableCell colSpan={7} />
                    </TableRow>
                  ))
                ) : paginatedMenus.length > 0 ? (
                  paginatedMenus.map((menu, index) => {
                    const globalIdx = sortedMenus.findIndex((m) => m.id === menu.id);
                    const canMoveUp = globalIdx > 0;
                    const canMoveDown = globalIdx >= 0 && globalIdx < sortedMenus.length - 1;
                    return (
                      <TableRow
                        key={menu.id}
                        className={dashboardTableBodyRowClass}
                      >
                        <TableCell className={dashboardTableCellClass}>
                          <span className="text-[13px] font-bold text-primary">
                            {(currentPage - 1) * pageSize + index + 1}
                          </span>
                        </TableCell>

                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex items-center gap-1">
                            <GripVertical className="size-3.5 text-zinc-300 shrink-0" />
                            <span className="text-[12px] font-bold text-zinc-600 min-w-[1.25rem]">
                              {menu.order ?? globalIdx + 1}
                            </span>
                            <div className="flex flex-col">
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!canMoveUp || reorderingId === menu.id}
                                onClick={() => handleMoveMenu(menu.id, "up")}
                                className="h-6 w-6 text-zinc-400 hover:text-primary"
                              >
                                <ChevronUp className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!canMoveDown || reorderingId === menu.id}
                                onClick={() => handleMoveMenu(menu.id, "down")}
                                className="h-6 w-6 text-zinc-400 hover:text-primary"
                              >
                                <ChevronDown className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className={dashboardTableCellClass}>
                          <span className="text-[13px] font-medium text-zinc-800">
                            {menu.title}
                          </span>
                        </TableCell>

                        <TableCell className={dashboardTableCellClass}>
                          <span className="text-[11px] font-mono font-medium text-zinc-500">
                            {menu.url}
                          </span>
                        </TableCell>

                        <TableCell className={dashboardTableCellClass}>
                          <span className="rounded bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                            {menu.moduleKey?.replace('_', ' ')}
                          </span>
                        </TableCell>

                        <TableCell className={dashboardTableCellClass}>
                          {menu.items && menu.items.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {menu.items.map((sub, idx) => (
                                <span
                                  key={idx}
                                  className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                                >
                                  {sub.title}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-400 text-[11px] font-medium">N/A</span>
                          )}
                        </TableCell>

                        <TableCell className={cn(dashboardTableCellClass, "text-center")}>
                          <span className={cn(
                            dashboardStatusBadgeClass,
                            getTableStatusBadgeClass(menu.isActive !== false ? "active" : "inactive")
                          )}>
                            {menu.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </TableCell>

                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(menu)}
                              className={actionBtnEdit}
                            >
                              <Edit className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setItemToDelete({
                                  id: menu.id,
                                  type: "menu",
                                  name: menu.title,
                                });
                                setIsDeleteDialogOpen(true);
                              }}
                              className={actionBtnDelete}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <LayoutGrid className="size-10 text-zinc-100" />
                        <p className="text-zinc-400 font-black uppercase text-[11px] tracking-widest">
                          No menu configurations found
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </div>

          {filteredMenus.length > 0 && (
            <div className="px-8 py-3 border-t border-zinc-100 flex items-center justify-between text-[12px] text-zinc-500">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredMenus.length)} of {filteredMenus.length}
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

      {/* ─── ADD / EDIT MODAL ─── */}
      <Dialog
        open={isMenuDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIsMenuDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[640px] bg-white border-none p-0 overflow-hidden rounded-2xl shadow-2xl">
          <div className="p-7 border-b border-zinc-100 bg-gradient-to-r from-primary/5 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-[#1e293b] uppercase tracking-tight">
                {editingMenu?.id ? "Edit Menu Module" : "New Menu Module"}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-sm mt-1">
                Configure navigation link, icon, order and sub-modules.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[75vh] overflow-y-auto px-7 py-6 space-y-5">
              {/* Row 1: Title + URL */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                    Menu Title *
                  </label>
                  <input
                    type="text"
                    value={editingMenu?.title || ""}
                    onChange={(e) =>
                      setEditingMenu((prev) => ({
                        ...prev!,
                        title: e.target.value,
                      }))
                    }
                    placeholder="e.g. Finance"
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-[14px] font-medium placeholder:text-zinc-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                    URL Path *
                  </label>
                  <input
                    type="text"
                    value={editingMenu?.url || ""}
                    onChange={(e) =>
                      setEditingMenu((prev) => ({
                        ...prev!,
                        url: e.target.value,
                      }))
                    }
                    placeholder="e.g. /finance"
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-[14px] font-mono font-medium placeholder:text-zinc-300"
                  />
                </div>
              </div>

              {/* Row 2: Order + Status */}
              <div className="grid grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Module / Workspace *</label>
                  <select value={editingMenu?.moduleKey || ''} onChange={(e) => setEditingMenu((prev) => ({ ...prev!, moduleKey: e.target.value as WorkspaceKey }))} className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-[14px] font-medium">
                    <option value="" disabled>Select workspace</option>
                    <option value="CORE">Core Modules</option>
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="ACCOUNTING">Accounting</option>
                    <option value="ACCESS_CONTROL">Access Control</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingMenu?.order || 0}
                    onChange={(e) =>
                      setEditingMenu((prev) => ({
                        ...prev!,
                        order: parseInt(e.target.value),
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary transition-all text-[14px] font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                    Status
                  </label>
                  <select
                    value={editingMenu?.isActive ? "active" : "inactive"}
                    onChange={(e) =>
                      setEditingMenu((prev) => ({
                        ...prev!,
                        isActive: e.target.value === "active",
                      }))
                    }
                    className="w-full px-4 py-2.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary transition-all text-[14px] font-medium appearance-none cursor-pointer"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Icon picker */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                  Icon
                </label>
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  {/* Current selection banner */}
                  <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
                      <SelectedIconComp className="size-4 text-white" strokeWidth={1.8} />
                    </div>
                    <div>
                      <div className="text-[12px] font-bold text-zinc-700">
                        {selectedIcon}
                      </div>
                      <div className="text-[10px] text-zinc-400">Selected icon</div>
                    </div>
                  </div>

                  {/* Search + manual name */}
                  <div className="px-3 pt-3 space-y-2">
                    <div className="relative">
                      <Search className="size-3 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        placeholder="Search all Lucide icons (e.g. door, user, home)..."
                        className="w-full h-8 pl-8 pr-3 bg-zinc-50 border border-zinc-200 rounded-lg text-[12px] outline-none focus:border-primary transition-all"
                      />
                    </div>
                    <input
                      type="text"
                      value={selectedIcon}
                      onChange={(e) =>
                        setEditingMenu((prev) => ({
                          ...prev!,
                          icon: e.target.value,
                        }))
                      }
                      placeholder="Or type icon name exactly (e.g. DoorOpen)"
                      className="w-full h-8 px-3 bg-white border border-zinc-200 rounded-lg text-[12px] font-mono outline-none focus:border-primary transition-all"
                    />
                    <p className="text-[10px] text-zinc-400 px-0.5">
                      Showing {filteredIcons.length} of {iconSearchTotal} icons
                      {LUCIDE_ICON_NAMES.length > 0 && ` · ${LUCIDE_ICON_NAMES.length} total available`}
                    </p>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-8 gap-1 p-3 max-h-44 overflow-y-auto">
                    {filteredIcons.map((iconName) => {
                      const IconComp = getLucideIcon(iconName);
                      const isSelected = selectedIcon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          title={iconName}
                          onClick={() =>
                            setEditingMenu((prev) => ({
                              ...prev!,
                              icon: iconName,
                            }))
                          }
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                            isSelected
                              ? "bg-primary shadow-sm shadow-primary/20"
                              : "hover:bg-zinc-100"
                          )}
                        >
                          <IconComp
                            className={cn(
                              "size-4",
                              isSelected ? "text-white" : "text-zinc-500"
                            )}
                            strokeWidth={1.8}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sub-modules section */}
              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setHasSubmenus(!hasSubmenus)}
                  >
                    <div
                      className={cn(
                        "size-5 rounded border-2 flex items-center justify-center transition-all",
                        hasSubmenus
                          ? "bg-primary border-primary"
                          : "border-zinc-300"
                      )}
                    >
                      {hasSubmenus && (
                        <svg
                          className="size-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-widest text-zinc-600">
                      Enable Sub-modules
                    </span>
                  </div>
                  {hasSubmenus && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setMenuSubmenus([
                          ...menuSubmenus,
                          {
                            title: "",
                            url: "",
                            order: menuSubmenus.length + 1,
                            isActive: true,
                          },
                        ])
                      }
                      className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                    >
                      <PlusCircle className="size-3 mr-1.5" />
                      Add Sub-module
                    </Button>
                  )}
                </div>

                {hasSubmenus && (
                  <div className="space-y-2">
                    {menuSubmenus.map((sm, idx) => (
                      <div
                        key={sm.id ?? `new-${idx}`}
                        className="flex items-center gap-2 bg-zinc-50/60 p-3 rounded-xl border border-zinc-100 group hover:border-primary/20 transition-all"
                      >
                        <div className="flex flex-col shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === 0}
                            onClick={() => moveSubmenu(idx, "up")}
                            className="h-6 w-6 text-zinc-400 hover:text-primary"
                          >
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === menuSubmenus.length - 1}
                            onClick={() => moveSubmenu(idx, "down")}
                            className="h-6 w-6 text-zinc-400 hover:text-primary"
                          >
                            <ChevronDown className="size-3" />
                          </Button>
                        </div>
                        <div className="w-5 h-5 rounded bg-zinc-200 flex items-center justify-center shrink-0">
                          <span className="text-[9px] font-black text-zinc-500">{idx + 1}</span>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Sub-module title"
                            value={sm.title}
                            onChange={(e) => {
                              const n = [...menuSubmenus];
                              n[idx].title = e.target.value;
                              setMenuSubmenus(n);
                            }}
                            className="px-3 py-2 bg-white border border-zinc-200 rounded-lg text-[12px] font-medium text-zinc-800 outline-none focus:border-primary transition-all placeholder:text-zinc-300"
                          />
                          <input
                            type="text"
                            placeholder="/url-path"
                            value={sm.url}
                            onChange={(e) => {
                              const n = [...menuSubmenus];
                              n[idx].url = e.target.value;
                              setMenuSubmenus(n);
                            }}
                            className="px-3 py-2 bg-white border border-zinc-200 rounded-lg text-[12px] font-mono text-zinc-800 outline-none focus:border-primary transition-all placeholder:text-zinc-300"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const n = [...menuSubmenus];
                            n.splice(idx, 1);
                            if (n.length === 0) setHasSubmenus(false);
                            setMenuSubmenus(n);
                          }}
                          className="h-9 w-9 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>

          <DialogFooter className="px-7 py-5 bg-zinc-50/50 border-t border-zinc-100 flex items-center sm:justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsMenuDialogOpen(false)}
              className="px-6 h-10 rounded-lg font-bold text-zinc-500 text-[12px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMenu}
              className="px-8 h-10 rounded-lg font-bold bg-primary !text-white hover:bg-primary/90 hover:!text-white shadow-lg shadow-primary/20 border-none text-[12px]"
            >
              {editingMenu?.id ? "Update Module" : "Create Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRM MODAL ─── */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIsDeleteDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[460px] bg-white border-none p-0 overflow-hidden rounded-2xl shadow-xl">
          <DialogTitle className="sr-only">Remove Module</DialogTitle>
          <div className="p-8 flex items-start gap-5 pt-10">
            <div className="w-12 h-12 shrink-0 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
              <Trash2 className="size-5 text-rose-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-[#1E293B] mb-2">Remove Module?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-[#1E293B]">
                  "{itemToDelete?.name}"
                </span>
                ? This will also remove it from all role permissions.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50/50 border-t border-zinc-100 gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-lg font-bold px-6 h-10 text-zinc-500 text-[12px]"
              disabled={isDeleting}
            >
              Go Back
            </Button>
            <Button
              onClick={confirmDelete}
              className={cn(btnConfirmDelete, "px-8 h-10 text-[12px]")}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
