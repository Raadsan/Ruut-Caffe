"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Plus,
  Eye,
  Edit,
  Trash2,
  X,
  Search,
  CheckCheck,
  Eraser,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleApi, Role } from "@/lib/api/auth/roleApi";
import { menuApi, Menu } from "@/lib/api/restaurant/menuApi";
import { authApi } from "@/lib/api/auth/authApi";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";

interface PermissionState {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

type RolePermissionsMap = Record<
  number,
  Record<
    number,
    {
      menu: PermissionState;
      submenus: Record<number, PermissionState>;
    }
  >
>;

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [rolePermissionsMap, setRolePermissionsMap] = useState<RolePermissionsMap>({});
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [modalPermissions, setModalPermissions] = useState<
    Record<
      number,
      {
        menu: PermissionState;
        submenus: Record<number, PermissionState>;
      }
    >
  >({});
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModalModule, setSelectedModalModule] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const sortedAllMenus = useMemo(
    () => [...allMenus].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [allMenus]
  );

  // Initial Data Fetching
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [rolesData, menusData] = await Promise.all([
          roleApi.getAllRoles(),
          menuApi.getAllMenus(),
        ]);

        const activeMenus = (menusData || [])
          .filter((m: any) => m.isActive !== false)
          .map((m: any) => ({
            ...m,
            items: (m.items || []).filter((sm: any) => sm.isActive !== false),
          }));

        setRoles(rolesData || []);
        setAllMenus(activeMenus);

        // Fetch permissions for all roles for card summary metrics
        if (rolesData && rolesData.length > 0) {
          const map: RolePermissionsMap = {};
          await Promise.all(
            rolesData.map(async (role) => {
              try {
                const roleMenus = await menuApi.getRolePermissions(role.id);
                const rolePermState: Record<
                  number,
                  { menu: PermissionState; submenus: Record<number, PermissionState> }
                > = {};

                activeMenus.forEach((m: Menu) => {
                  const roleMenu = roleMenus?.find((rm) => rm.id === m.id);
                  const subMap: Record<number, PermissionState> = {};

                  (m.items || []).forEach((sm) => {
                    const roleSub = roleMenu?.items?.find((rsm) => rsm.id === sm.id);
                    subMap[sm.id] = {
                      canView: roleSub?.permissions?.canView || false,
                      canAdd: roleSub?.permissions?.canAdd || false,
                      canEdit: roleSub?.permissions?.canEdit || false,
                      canDelete: roleSub?.permissions?.canDelete || false,
                    };
                  });

                  rolePermState[m.id] = {
                    menu: {
                      canView: roleMenu?.permissions?.canView || false,
                      canAdd: roleMenu?.permissions?.canAdd || false,
                      canEdit: roleMenu?.permissions?.canEdit || false,
                      canDelete: roleMenu?.permissions?.canDelete || false,
                    },
                    submenus: subMap,
                  };
                });

                map[role.id] = rolePermState;
              } catch (err) {
                console.error(`Failed loading role ${role.id} perms:`, err);
              }
            })
          );
          setRolePermissionsMap(map);
        }
      } catch (error) {
        console.error("Initialization error:", error);
        showToast("Failed to load roles and permissions", "error");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Compute counts per role
  const roleMetrics = useMemo(() => {
    const metrics: Record<
      number,
      { totalCount: number; hasAdd: boolean; hasView: boolean; hasEdit: boolean; hasDelete: boolean }
    > = {};

    roles.forEach((role) => {
      let count = 0;
      let hasAdd = false;
      let hasView = false;
      let hasEdit = false;
      let hasDelete = false;

      const rolePerms = rolePermissionsMap[role.id];
      if (rolePerms) {
        Object.values(rolePerms).forEach((p) => {
          if (p.menu.canView) {
            count += 1;
            hasView = true;
          }
          if (p.menu.canAdd) {
            count += 1;
            hasAdd = true;
          }
          if (p.menu.canEdit) {
            count += 1;
            hasEdit = true;
          }
          if (p.menu.canDelete) {
            count += 1;
            hasDelete = true;
          }

          Object.values(p.submenus).forEach((sp) => {
            if (sp.canView) {
              count += 1;
              hasView = true;
            }
            if (sp.canAdd) {
              count += 1;
              hasAdd = true;
            }
            if (sp.canEdit) {
              count += 1;
              hasEdit = true;
            }
            if (sp.canDelete) {
              count += 1;
              hasDelete = true;
            }
          });
        });
      }

      metrics[role.id] = {
        totalCount: count,
        hasAdd,
        hasView,
        hasEdit,
        hasDelete,
      };
    });

    return metrics;
  }, [roles, rolePermissionsMap]);

  // Open Edit Modal for specific role
  const openEditModal = async (role: Role) => {
    setEditingRole(role);
    setIsModalOpen(true);
    setSearchQuery("");
    setSelectedModalModule("ALL");
    setModalLoading(true);

    try {
      const roleMenus = await menuApi.getRolePermissions(role.id);
      const newPerms: Record<
        number,
        { menu: PermissionState; submenus: Record<number, PermissionState> }
      > = {};

      sortedAllMenus.forEach((m) => {
        const roleMenu = roleMenus?.find((rm) => rm.id === m.id);
        const subMap: Record<number, PermissionState> = {};

        (m.items || []).forEach((sm) => {
          const roleSub = roleMenu?.items?.find((rsm) => rsm.id === sm.id);
          subMap[sm.id] = {
            canView: roleSub?.permissions?.canView || false,
            canAdd: roleSub?.permissions?.canAdd || false,
            canEdit: roleSub?.permissions?.canEdit || false,
            canDelete: roleSub?.permissions?.canDelete || false,
          };
        });

        newPerms[m.id] = {
          menu: {
            canView: roleMenu?.permissions?.canView || false,
            canAdd: roleMenu?.permissions?.canAdd || false,
            canEdit: roleMenu?.permissions?.canEdit || false,
            canDelete: roleMenu?.permissions?.canDelete || false,
          },
          submenus: subMap,
        };
      });

      setModalPermissions(newPerms);
    } catch (error) {
      console.error("Error loading role permissions for modal:", error);
      showToast("Error loading role permissions", "error");
    } finally {
      setModalLoading(false);
    }
  };

  // Flattened modules list for the 2-column modal grid
  const flattenedModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result: Array<{
      key: string;
      menuId: number;
      submenuId?: number;
      title: string;
      isSubmenu: boolean;
      perms: PermissionState;
    }> = [];

    sortedAllMenus.forEach((m) => {
      const modKey = String(m.moduleKey || "CORE").toUpperCase();
      if (selectedModalModule !== "ALL" && modKey !== selectedModalModule) {
        return;
      }

      const mPerms = modalPermissions[m.id]?.menu || {
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      };

      const hasSubmenus = (m.items || []).length > 0;

      // Only display parent menu if it does NOT have submenus
      if (!hasSubmenus) {
        const menuMatches = !q || m.title.toLowerCase().includes(q);
        if (menuMatches) {
          result.push({
            key: `m-${m.id}`,
            menuId: m.id,
            title: m.title,
            isSubmenu: false,
            perms: mPerms,
          });
        }
      }

      // Display submenus with clean titles
      (m.items || []).forEach((sm) => {
        const smPerms = modalPermissions[m.id]?.submenus[sm.id] || {
          canView: false,
          canAdd: false,
          canEdit: false,
          canDelete: false,
        };

        const subMatches =
          !q || sm.title.toLowerCase().includes(q) || m.title.toLowerCase().includes(q);

        if (subMatches) {
          result.push({
            key: `sm-${m.id}-${sm.id}`,
            menuId: m.id,
            submenuId: sm.id,
            title: sm.title,
            isSubmenu: true,
            perms: smPerms,
          });
        }
      });
    });

    return result;
  }, [sortedAllMenus, modalPermissions, searchQuery, selectedModalModule]);

  // Toggle permission item inside modal
  const toggleModalPerm = (
    item: { menuId: number; submenuId?: number; isSubmenu: boolean },
    type: keyof PermissionState
  ) => {
    setModalPermissions((prev) => {
      const next = { ...prev };
      const current = next[item.menuId] || {
        menu: { canView: false, canAdd: false, canEdit: false, canDelete: false },
        submenus: {},
      };

      if (!item.isSubmenu) {
        // Parent menu toggle
        const curPerm = current.menu;
        const newVal = !curPerm[type];
        const newMenu = { ...curPerm, [type]: newVal };

        if (newVal && type !== "canView") {
          newMenu.canView = true;
        }
        if (type === "canView" && !newVal) {
          newMenu.canAdd = false;
          newMenu.canEdit = false;
          newMenu.canDelete = false;
        }

        next[item.menuId] = { ...current, menu: newMenu };
      } else if (item.submenuId) {
        // Submenu toggle
        const sm = current.submenus[item.submenuId] || {
          canView: false,
          canAdd: false,
          canEdit: false,
          canDelete: false,
        };
        const newVal = !sm[type];
        const newSm = { ...sm, [type]: newVal };

        if (newVal && type !== "canView") {
          newSm.canView = true;
        }
        if (type === "canView" && !newVal) {
          newSm.canAdd = false;
          newSm.canEdit = false;
          newSm.canDelete = false;
        }

        const newSubmenus = { ...current.submenus, [item.submenuId]: newSm };
        const parentNeedsView = Object.values(newSubmenus).some((s) => s.canView);

        next[item.menuId] = {
          ...current,
          menu: {
            ...current.menu,
            canView: parentNeedsView ? true : current.menu.canView,
          },
          submenus: newSubmenus,
        };
      }

      return { ...next };
    });
  };

  // Check all / Clear all in modal
  const handleCheckAllModal = () => {
    setModalPermissions((prev) => {
      const next = { ...prev };
      sortedAllMenus.forEach((m) => {
        const allTrue = { canView: true, canAdd: true, canEdit: true, canDelete: true };
        next[m.id] = {
          menu: { ...allTrue },
          submenus: Object.fromEntries(
            (m.items || []).map((sm) => [sm.id, { ...allTrue }])
          ),
        };
      });
      return next;
    });
  };

  const handleClearAllModal = () => {
    setModalPermissions((prev) => {
      const next = { ...prev };
      sortedAllMenus.forEach((m) => {
        const allFalse = { canView: false, canAdd: false, canEdit: false, canDelete: false };
        next[m.id] = {
          menu: { ...allFalse },
          submenus: Object.fromEntries(
            (m.items || []).map((sm) => [sm.id, { ...allFalse }])
          ),
        };
      });
      return next;
    });
  };

  // Save changes from modal
  const handleSaveModal = async () => {
    if (!editingRole) return;
    try {
      setSaving(true);
      const payload = Object.entries(modalPermissions)
        .filter(([, data]) => {
          const menuActive =
            data.menu.canView ||
            data.menu.canAdd ||
            data.menu.canEdit ||
            data.menu.canDelete;
          const subActive = Object.values(data.submenus).some(
            (s) => s.canView || s.canAdd || s.canEdit || s.canDelete
          );
          return menuActive || subActive;
        })
        .map(([mId, data]) => ({
          menuId: Number(mId),
          ...data.menu,
          submenus: Object.entries(data.submenus)
            .filter(
              ([, sData]) =>
                sData.canView ||
                sData.canAdd ||
                sData.canEdit ||
                sData.canDelete
            )
            .map(([smId, sData]) => ({
              submenuId: Number(smId),
              ...sData,
            })),
        }));

      await menuApi.updatePermissions(editingRole.id, payload);
      menuApi.clearMenuCache(editingRole.id);

      // Update local role permissions map for main page cards
      setRolePermissionsMap((prev) => ({
        ...prev,
        [editingRole.id]: modalPermissions,
      }));

      showToast("Role permissions saved successfully", "success");
      setIsModalOpen(false);

      const currentUser = authApi.getCachedUser();
      if (currentUser?.roleId === editingRole.id) {
        window.dispatchEvent(
          new CustomEvent("sidebar-menu-updated", {
            detail: { roleId: editingRole.id },
          })
        );
      }
    } catch (error) {
      console.error("Save error:", error);
      showToast("Failed to save permissions", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={dashboardPageClass} style={dashboardPageStyle}>
      {/* Header Banner */}
      <div className={pageHeaderWrapperClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-[#012e67]/10 dark:bg-[#012e67]/30 border border-[#012e67]/20 flex items-center justify-center text-[#012e67] dark:text-[#022d71] shadow-sm">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className={pageHeaderTitleClass}>Role Permissions</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                Manage access privileges and module permissions for system roles.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-44 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse"
              />
            ))
          : roles.map((role) => {
              const m = roleMetrics[role.id] || {
                totalCount: 0,
                hasAdd: false,
                hasView: false,
                hasEdit: false,
                hasDelete: false,
              };

              return (
                <div
                  key={role.id}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Top: Icon + Name */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="size-11 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-[#012e67] dark:text-[#022d71] border border-sky-100 dark:border-sky-900/50 flex items-center justify-center shrink-0 shadow-2xs">
                      <Shield className="size-5" />
                    </div>
                    <div className="truncate">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 capitalize truncate">
                        {role.name}
                      </h3>
                      <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">
                        {role.description || `${role.name} system role`}
                      </p>
                    </div>
                  </div>

                  {/* Middle: 4 Icon Badges + Total Count */}
                  <div className="flex items-center gap-2 mb-5">
                    {/* Add (+) */}
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                        m.hasAdd
                          ? "bg-[#012e67] text-white shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                      )}
                      title="Create Permission"
                    >
                      <Plus className="size-3.5" />
                    </div>

                    {/* View (Eye) */}
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                        m.hasView
                          ? "bg-[#012e67] text-white shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                      )}
                      title="View Permission"
                    >
                      <Eye className="size-3.5" />
                    </div>

                    {/* Edit (Pencil) */}
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                        m.hasEdit
                          ? "bg-[#012e67] text-white shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                      )}
                      title="Edit Permission"
                    >
                      <Edit className="size-3.5" />
                    </div>

                    {/* Delete (Trash) */}
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                        m.hasDelete
                          ? "bg-[#012e67] text-white shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                      )}
                      title="Delete Permission"
                    >
                      <Trash2 className="size-3.5" />
                    </div>

                    <span className="text-xs font-semibold text-zinc-400 ml-2">
                      {m.totalCount} total
                    </span>
                  </div>

                  {/* Bottom: Edit Permissions Button */}
                  <button
                    type="button"
                    onClick={() => openEditModal(role)}
                    className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-[#012e67] hover:text-white hover:border-[#012e67] font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Edit className="size-3.5" />
                    Edit Permissions
                  </button>
                </div>
              );
            })}
      </div>

      {/* Edit Role Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Edit Role
                </h2>
                <p className="text-xs text-zinc-500 font-medium mt-0.5 flex items-center gap-1.5">
                  <span>Role Access</span>
                  <span className="text-zinc-300 dark:text-zinc-600">—</span>
                  <span className="text-[#012e67] dark:text-[#022d71] font-bold capitalize">
                    {editingRole?.name}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={handleCheckAllModal}
                  className="h-8 px-4 rounded-lg bg-[#012e67] text-white hover:bg-[#022d71] text-xs font-semibold cursor-pointer shadow-xs border-none"
                >
                  Check all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearAllModal}
                  className="h-8 px-4 rounded-lg border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Clear all
                </Button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="size-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto max-h-[65vh]">
              {/* Search & Module Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search modules..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium outline-none focus:border-[#012e67] focus:ring-2 focus:ring-[#012e67]/10 transition-all"
                  />
                </div>

                {/* Module Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 shrink-0">
                  {[
                    { id: "ALL", label: "All" },
                    { id: "CORE", label: "Core" },
                    { id: "RESTAURANT", label: "Restaurant" },
                    { id: "ACCOUNTING", label: "Accounting" },
                    { id: "ACCESS_CONTROL", label: "Access Control" },
                  ].map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setSelectedModalModule(mod.id)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap",
                        selectedModalModule === mod.id
                          ? "bg-[#012e67] text-white shadow-2xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      )}
                    >
                      {mod.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2-Column Grid of Module Cards */}
              {modalLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {flattenedModules.map((item) => (
                    <div
                      key={item.key}
                      className="p-3.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                    >
                      <div className="truncate pr-2">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
                          {item.title}
                        </span>
                      </div>

                      {/* 4 Icon Buttons: +, View, Edit, Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Create (+) */}
                        <button
                          type="button"
                          disabled={!item.perms.canView}
                          onClick={() => toggleModalPerm(item, "canAdd")}
                          className={cn(
                            "size-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer",
                            !item.perms.canView
                              ? "opacity-30 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed text-zinc-400"
                              : item.perms.canAdd
                              ? "bg-[#012e67] text-white shadow-xs"
                              : "bg-white dark:bg-zinc-800 text-[#012e67] dark:text-[#022d71] border border-zinc-200 dark:border-zinc-700 hover:bg-[#012e67]/10"
                          )}
                          title="Create"
                        >
                          <Plus className="size-3.5" />
                        </button>

                        {/* View (Eye) */}
                        <button
                          type="button"
                          onClick={() => toggleModalPerm(item, "canView")}
                          className={cn(
                            "size-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer",
                            item.perms.canView
                              ? "bg-[#012e67] text-white shadow-xs"
                              : "bg-white dark:bg-zinc-800 text-[#012e67] dark:text-[#022d71] border border-zinc-200 dark:border-zinc-700 hover:bg-[#012e67]/10"
                          )}
                          title="View"
                        >
                          <Eye className="size-3.5" />
                        </button>

                        {/* Edit (Pencil) */}
                        <button
                          type="button"
                          disabled={!item.perms.canView}
                          onClick={() => toggleModalPerm(item, "canEdit")}
                          className={cn(
                            "size-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer",
                            !item.perms.canView
                              ? "opacity-30 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed text-zinc-400"
                              : item.perms.canEdit
                              ? "bg-[#012e67] text-white shadow-xs"
                              : "bg-white dark:bg-zinc-800 text-[#012e67] dark:text-[#022d71] border border-zinc-200 dark:border-zinc-700 hover:bg-[#012e67]/10"
                          )}
                          title="Edit"
                        >
                          <Edit className="size-3.5" />
                        </button>

                        {/* Delete (Trash) */}
                        <button
                          type="button"
                          disabled={!item.perms.canView}
                          onClick={() => toggleModalPerm(item, "canDelete")}
                          className={cn(
                            "size-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer",
                            !item.perms.canView
                              ? "opacity-30 border border-zinc-200 dark:border-zinc-800 cursor-not-allowed text-zinc-400"
                              : item.perms.canDelete
                              ? "bg-[#012e67] text-white shadow-xs"
                              : "bg-white dark:bg-zinc-800 text-[#012e67] dark:text-[#022d71] border border-zinc-200 dark:border-zinc-700 hover:bg-[#012e67]/10"
                          )}
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-10 px-6 rounded-xl border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveModal}
                disabled={saving}
                className="h-10 px-6 rounded-xl bg-[#012e67] text-white hover:bg-[#022d71] text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm border-none"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
