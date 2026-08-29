import prisma from "../../../../config/db.js";
import { trackingController } from "../../operations/tracking/tracking.controller.js";
import { clearPermissionCache, clearAuthCaches } from "../../../../middlewares/authMiddleware.js";

let createOrderMenuEnsured = false;
let pickupOrdersMenuEnsured = false;
let pickupHistoryMenuEnsured = false;
let discountAdvertisementMenuEnsured = false;
let compositesMenuEnsured = false;
let suppliersMenuEnsured = false;
let purchasesMenuEnsured = false;
let ingredientsMenuEnsured = false;

const roleMenusCache = new Map();
const ROLE_MENUS_CACHE_TTL = 5 * 60 * 1000;
const MENU_MODULE_KEYS = new Set(['CORE', 'RESTAURANT', 'ACCOUNTING', 'ACCESS_CONTROL']);

const normalizeRoleName = (value = '') => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

function canRoleAccessModule(roleName, moduleKey) {
  const role = normalizeRoleName(roleName);
  if (role === 'admin' || role === 'super_admin') return true;
  if (moduleKey === 'CORE') return true;
  if (role === 'accounting' || role === 'accountant') return moduleKey === 'ACCOUNTING';
  if (['restaurant', 'manager', 'pos', 'cashier', 'waiter'].includes(role)) {
    return moduleKey === 'RESTAURANT';
  }
  return false;
}

function getCachedRoleMenus(roleId) {
  const entry = roleMenusCache.get(roleId);
  if (!entry) return null;
  if (entry.data.length === 0) {
    roleMenusCache.delete(roleId);
    return null;
  }
  if (Date.now() - entry.timestamp > ROLE_MENUS_CACHE_TTL) {
    roleMenusCache.delete(roleId);
    return null;
  }
  return entry.data;
}

export function clearRoleMenusCache(roleId) {
  if (roleId !== undefined && roleId !== null) {
    const normalizedRoleId = String(Number(roleId));
    for (const key of roleMenusCache.keys()) {
      const cacheKey = String(key);
      if (cacheKey === normalizedRoleId || cacheKey.startsWith(`${normalizedRoleId}:`)) {
        roleMenusCache.delete(key);
      }
    }
  } else {
    roleMenusCache.clear();
  }
  clearAllMenusCache();
}

let allMenusCache = { data: null, at: 0 };
let allMenusInflight = null;
const ALL_MENUS_TTL_MS = 5 * 60 * 1000;

export function clearAllMenusCache() {
  allMenusCache = { data: null, at: 0 };
  allMenusInflight = null;
}

async function loadAllMenusFromDb() {
  const menus = await prisma.menu.findMany({
    include: {
      submenu: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });
  const formatted = menus.map((m) => ({
    ...m,
    items: m.submenu || [],
  }));
  allMenusCache = { data: formatted, at: Date.now() };
  return formatted;
}

export async function warmAllMenusCache() {
  if (allMenusCache.data && Date.now() - allMenusCache.at < ALL_MENUS_TTL_MS) {
    return allMenusCache.data;
  }
  if (allMenusInflight) return allMenusInflight;
  allMenusInflight = loadAllMenusFromDb()
    .catch((err) => {
      allMenusInflight = null;
      throw err;
    })
    .finally(() => {
      allMenusInflight = null;
    });
  return allMenusInflight;
}

async function fetchMenusForRole(roleId, moduleKey) {
  const cacheKey = moduleKey ? `${roleId}:${moduleKey}` : roleId;
  const cached = getCachedRoleMenus(cacheKey);
  if (cached) return cached;

  const permissions = await prisma.roleMenuAccess.findMany({
    where: {
      roleId,
      canView: true,
      ...(moduleKey ? { menu: { moduleKey } } : {}),
    },
    include: {
      menu: {
        include: {
          submenu: {
            where: { isActive: true },
            orderBy: { order: "asc" },
          },
        },
      },
      roleSubMenuAccess: true,
    },
    orderBy: {
      menu: { order: "asc" },
    },
  });

  const formattedMenus = permissions
    .filter((p) => p.menu.isActive)
    .map((p) => {
      const allowedSubmenus = p.menu.submenu.filter((sm) => {
        const subAccess = p.roleSubMenuAccess.find((rsa) => rsa.subMenuId === sm.id);
        return subAccess && subAccess.canView;
      });

      return {
        id: p.menu.id,
        title: p.menu.title,
        url: p.menu.url,
        icon: p.menu.icon,
        order: p.menu.order,
        moduleKey: p.menu.moduleKey,
        permissions: {
          canView: p.canView,
          canAdd: p.canAdd,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        },
        items: allowedSubmenus.map((sm) => {
          const subAccess = p.roleSubMenuAccess.find((rsa) => rsa.subMenuId === sm.id);
          return {
            id: sm.id,
            title: sm.title,
            url: sm.url,
            order: sm.order,
            permissions: {
              canView: subAccess?.canView || false,
              canAdd: subAccess?.canAdd || false,
              canEdit: subAccess?.canEdit || false,
              canDelete: subAccess?.canDelete || false,
            },
          };
        }),
      };
    });

  roleMenusCache.set(cacheKey, { data: formattedMenus, timestamp: Date.now() });
  return formattedMenus;
}

export const getResolvedMenus = async (req, res) => {
  try {
    const moduleKey = String(req.query.moduleKey || '').toUpperCase();
    if (!MENU_MODULE_KEYS.has(moduleKey)) {
      return res.status(400).json({ success: false, message: 'A valid moduleKey is required' });
    }

    const roleId = Number(req.user?.roleId ?? req.user?.role?.id);
    const roleName = req.user?.role?.name ?? req.user?.role ?? '';
    if (!roleId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const hasAssignedWorkspaceAccess = canRoleAccessModule(roleName, moduleKey) || Boolean(
      await prisma.roleMenuAccess.findFirst({
        where: { roleId, canView: true, menu: { moduleKey, isActive: true } },
        select: { id: true },
      })
    );
    if (!hasAssignedWorkspaceAccess) {
      return res.status(403).json({ success: false, message: 'Workspace access denied' });
    }

    if (req.query.refresh === '1' || req.query.refresh === 'true') {
      clearRoleMenusCache(roleId);
    }
    const data = await fetchMenusForRole(roleId, moduleKey);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error resolving workspace menus:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMenusByRole = async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);

    if (isNaN(roleId)) {
      return res.status(400).json({ success: false, message: "Invalid role ID" });
    }

    if (Number(req.user?.roleId) !== roleId && !['admin', 'super_admin'].includes(normalizeRoleName(req.user?.role?.name ?? req.user?.role))) {
      return res.status(403).json({ success: false, message: 'Role menu access denied' });
    }
    const formattedMenus = await fetchMenusForRole(roleId);
    res.json({ success: true, data: formattedMenus });
  } catch (error) {
    console.error("Error fetching menus by role:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const seedDefaultMenus = async (req, res) => {
  try {
    const defaultMenus = [
      { 
        title: "Dashboard", url: "/dashboard", icon: "LayoutDashboard", order: 1,
        submenus: [] 
      },
      {
        title: "Create Order", url: "/orders/create", icon: "CirclePlus", order: 2,
        submenus: []
      },
      {
        title: "Ready Pickup", url: "/orders/pickup", icon: "BellRing", order: 3,
        submenus: []
      },
      {
        title: "Pickup History", url: "/orders/pickup/history", icon: "History", order: 4,
        submenus: []
      },
      { 
        title: "Order Management", url: "/orders", icon: "ListOrdered", order: 5,
        submenus: [
          { title: "POS System", url: "/pos", order: 1 },
          { title: "Live Orders", url: "/orders", order: 2 },
          { title: "Order History", url: "/orders/history", order: 3 }
        ] 
      },
      { 
        title: "Kitchen & Menu", url: "/menu", icon: "UtensilsCrossed", order: 4,
        submenus: [
          { title: "Categories", url: "/categories", order: 1 },
          { title: "Menu Items", url: "/menus", order: 2 },
          { title: "Table Setup", url: "/tables", order: 3 }
        ] 
      },
      {
        title: "Menu Combos", url: "/composites", icon: "Layers", order: 5,
        submenus: []
      },
      { 
        title: "Inventory & Stock", url: "/inventory", icon: "PackageOpen", order: 6,
        submenus: [
          { title: "Current Stock", url: "/inventory", order: 1 },
          { title: "Stock Movements", url: "/inventory/movements", order: 2 }
        ] 
      },
      { 
        title: "Clients", url: "/clients", icon: "Users", order: 7,
        submenus: [] 
      },
      {
        title: "Suppliers", url: "/suppliers", icon: "Truck", order: 8,
        submenus: []
      },
      { 
        title: "User Management", url: "/users", icon: "Shield", order: 9,
        submenus: [
          { title: "All Staff", url: "/users", order: 1 }
        ] 
      },
      { 
        title: "Configuration", url: "/config", icon: "Settings2", order: 10,
        submenus: [
          { title: "Roles", url: "/config/roles", order: 1 },
          { title: "Permissions", url: "/config/permissions", order: 2 },
          { title: "Sidebar Menus", url: "/config/menus", order: 3 },
          { title: "Tracking", url: "/config/tracking", order: 4 }
        ]
      },
    ];

    // Optional: Deactivate all existing menus before seeding to ensure a clean state
    await prisma.submenu.updateMany({ data: { isActive: false } });
    await prisma.menu.updateMany({ data: { isActive: false } });

    let adminRole = await prisma.role.findFirst({
      where: { 
        name: { 
          contains: "Admin"
        } 
      }
    });

    // If not found, try uppercase
    if (!adminRole) {
      adminRole = await prisma.role.findFirst({
        where: { name: { contains: "ADMIN" } }
      });
    }
    
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { name: "Admin", description: "Administrator with full access", updatedAt: new Date() }
      });
    }

    for (const menuData of defaultMenus) {
      const { submenus, ...menuFields } = menuData;
      menuFields.isActive = true;
      
      let menu = await prisma.menu.findFirst({
        where: { title: menuFields.title }
      });

      if (menu) {
        menu = await prisma.menu.update({
          where: { id: menu.id },
          data: menuFields
        });
      } else {
        menu = await prisma.menu.create({
          data: menuFields
        });
      }

      const roleMenuAccess = await prisma.roleMenuAccess.upsert({
        where: {
          roleId_menuId: {
            roleId: adminRole.id,
            menuId: menu.id
          }
        },
        update: {
          canView: true, canAdd: true, canEdit: true, canDelete: true
        },
        create: {
          roleId: adminRole.id,
          menuId: menu.id,
          canView: true, canAdd: true, canEdit: true, canDelete: true
        }
      });

      // Handle submenus
      for (const smData of submenus) {
        let submenu = await prisma.submenu.findFirst({
          where: { title: smData.title, menuId: menu.id }
        });

        if (submenu) {
          submenu = await prisma.submenu.update({
            where: { id: submenu.id },
            data: { ...smData, menuId: menu.id, isActive: true }
          });
        } else {
          submenu = await prisma.submenu.create({
            data: { ...smData, menuId: menu.id, isActive: true }
          });
        }

        await prisma.roleSubMenuAccess.upsert({
          where: {
            roleMenuAccessId_subMenuId: {
              roleMenuAccessId: roleMenuAccess.id,
              subMenuId: submenu.id
            }
          },
          update: {
            canView: true, canAdd: true, canEdit: true, canDelete: true
          },
          create: {
            roleMenuAccessId: roleMenuAccess.id,
            subMenuId: submenu.id,
            canView: true, canAdd: true, canEdit: true, canDelete: true
          }
        });
      }
    }

    res.json({ success: true, message: "Menus and submenus seeded successfully and permissions granted to Admin" });
  } catch (error) {
    console.error("Error seeding menus:", error);
    res.status(500).json({ success: false, message: "Server error during seeding" });
  }
};

/** Ensures Create Order is a top-level sidebar item (not under Order Management) */
export async function ensureCreateOrderMenuItem() {
  if (createOrderMenuEnsured) return;
  try {
    const orderMenu = await prisma.menu.findFirst({
      where: {
        OR: [{ url: "/orders" }, { title: "Order Management" }]
      }
    });

    if (orderMenu) {
      await prisma.submenu.updateMany({
        where: { url: "/orders/create", menuId: orderMenu.id },
        data: { isActive: false }
      });
    }

    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: "waiter" } },
          { name: { contains: "Waiter" } },
          { name: { contains: "admin" } },
          { name: { contains: "Admin" } },
          { name: { contains: "manager" } },
          { name: { contains: "Manager" } }
        ]
      }
    });

    let createMenu = await prisma.menu.findFirst({
      where: {
        OR: [{ url: "/orders/create" }, { title: "Create Order" }]
      }
    });

    if (createMenu) {
      createMenu = await prisma.menu.update({
        where: { id: createMenu.id },
        data: {
          title: "Create Order",
          url: "/orders/create",
          icon: "CirclePlus",
          order: 2
        }
      });
    } else {
      createMenu = await prisma.menu.create({
        data: {
          title: "Create Order",
          url: "/orders/create",
          icon: "CirclePlus",
          order: 2,
          isActive: true
        }
      });
    }

    for (const role of roles) {
      const roleLower = role.name.toLowerCase();
      const isWaiter = roleLower.includes("waiter");
      const isPrivileged =
        roleLower.includes("admin") || roleLower.includes("manager");

      if (!isWaiter && !isPrivileged) continue;

      const exists = await prisma.roleMenuAccess.findUnique({
        where: {
          roleId_menuId: { roleId: role.id, menuId: createMenu.id }
        }
      });

      if (!exists) {
        await prisma.roleMenuAccess.create({
          data: {
            roleId: role.id,
            menuId: createMenu.id,
            canView: true,
            canAdd: true,
            canEdit: isPrivileged,
            canDelete: false
          }
        });
      }
    }

    createOrderMenuEnsured = true;
  } catch (error) {
    console.error("ensureCreateOrderMenuItem error:", error);
  }
}

/** Ensures Ready Pickup is a top-level sidebar item for waiters */
export async function ensurePickupOrdersMenuItem() {
  if (pickupOrdersMenuEnsured) return;
  try {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: "waiter" } },
          { name: { contains: "Waiter" } },
          { name: { contains: "admin" } },
          { name: { contains: "Admin" } },
          { name: { contains: "manager" } },
          { name: { contains: "Manager" } },
        ],
      },
    });

    let pickupMenu = await prisma.menu.findFirst({
      where: {
        OR: [{ url: "/orders/pickup" }, { title: "Ready Pickup" }],
      },
    });

    if (pickupMenu) {
      pickupMenu = await prisma.menu.update({
        where: { id: pickupMenu.id },
        data: {
          title: "Ready Pickup",
          url: "/orders/pickup",
          icon: "BellRing",
          order: 3,
        },
      });
    } else {
      pickupMenu = await prisma.menu.create({
        data: {
          title: "Ready Pickup",
          url: "/orders/pickup",
          icon: "BellRing",
          order: 3,
          isActive: true,
        },
      });
    }

    for (const role of roles) {
      const roleLower = role.name.toLowerCase();
      const isWaiter = roleLower.includes("waiter");
      const isPrivileged =
        roleLower.includes("admin") || roleLower.includes("manager");

      if (!isWaiter && !isPrivileged) continue;

      const exists = await prisma.roleMenuAccess.findUnique({
        where: {
          roleId_menuId: { roleId: role.id, menuId: pickupMenu.id },
        }
      });

      if (!exists) {
        await prisma.roleMenuAccess.create({
          data: {
            roleId: role.id,
            menuId: pickupMenu.id,
            canView: true,
            canAdd: false,
            canEdit: isWaiter || isPrivileged,
            canDelete: false,
          }
        });
      }
    }

    pickupOrdersMenuEnsured = true;
    clearAuthCaches();
  } catch (error) {
    console.error("ensurePickupOrdersMenuItem error:", error);
  }
}

/** Pickup history — waiter's own served orders */
export async function ensurePickupHistoryMenuItem() {
  if (pickupHistoryMenuEnsured) return;
  try {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: "waiter" } },
          { name: { contains: "Waiter" } },
          { name: { contains: "admin" } },
          { name: { contains: "Admin" } },
          { name: { contains: "manager" } },
          { name: { contains: "Manager" } },
        ],
      },
    });

    let historyMenu = await prisma.menu.findFirst({
      where: {
        OR: [
          { url: "/orders/pickup/history" },
          { title: "Pickup History" },
        ],
      },
    });

    if (historyMenu) {
      historyMenu = await prisma.menu.update({
        where: { id: historyMenu.id },
        data: {
          title: "Pickup History",
          url: "/orders/pickup/history",
          icon: "History",
          order: 4,
        },
      });
    } else {
      historyMenu = await prisma.menu.create({
        data: {
          title: "Pickup History",
          url: "/orders/pickup/history",
          icon: "History",
          order: 4,
          isActive: true,
        },
      });
    }

    for (const role of roles) {
      const roleLower = role.name.toLowerCase();
      const isWaiter = roleLower.includes("waiter");
      const isPrivileged =
        roleLower.includes("admin") || roleLower.includes("manager");

      if (!isWaiter && !isPrivileged) continue;

      const exists = await prisma.roleMenuAccess.findUnique({
        where: {
          roleId_menuId: { roleId: role.id, menuId: historyMenu.id },
        }
      });

      if (!exists) {
        await prisma.roleMenuAccess.create({
          data: {
            roleId: role.id,
            menuId: historyMenu.id,
            canView: true,
            canAdd: false,
            canEdit: false,
            canDelete: false,
          }
        });
      }
    }

    pickupHistoryMenuEnsured = true;
    clearAuthCaches();
  } catch (error) {
    console.error("ensurePickupHistoryMenuItem error:", error);
  }
}

export async function deactivateSystemSettingsMenuItem() {
  try {
    await prisma.menu.updateMany({
      where: {
        OR: [
          { url: '/settings' },
          { title: { contains: 'System settings' } },
          { title: { contains: 'System Settings' } },
        ],
      },
      data: { isActive: false },
    });
    await prisma.submenu.updateMany({
      where: {
        OR: [
          { url: '/settings' },
          { title: { contains: 'System settings' } },
          { title: { contains: 'System Settings' } },
        ],
      },
      data: { isActive: false },
    });
    clearAuthCaches();
  } catch (error) {
    console.warn('deactivateSystemSettingsMenuItem skipped:', error?.message);
  }
}

export async function deactivateRoomsMenuItem() {
  try {
    await prisma.menu.updateMany({
      where: { OR: [{ url: '/rooms' }, { title: 'Rooms' }] },
      data: { isActive: false },
    });
    await prisma.submenu.updateMany({
      where: { title: 'Rooms' },
      data: { isActive: false },
    });
    clearAuthCaches();
  } catch (error) {
    console.warn('deactivateRoomsMenuItem skipped:', error?.message);
  }
}

export async function ensureDiscountAdvertisementMenuItem() {
  if (discountAdvertisementMenuEnsured) return;
  try {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: "admin" } },
          { name: { contains: "Admin" } },
          { name: { contains: "manager" } },
          { name: { contains: "Manager" } }
        ]
      }
    });

    if (roles.length === 0) return;

    let promoMenu = await prisma.menu.findFirst({
      where: {
        OR: [
          { url: "/discount-advertisements" },
          { title: "Promotions" },
          { title: "Discount & Ads" }
        ]
      }
    });

    if (promoMenu) {
      promoMenu = await prisma.menu.update({
        where: { id: promoMenu.id },
        data: {
          title: "Advertisements",
          url: "/discount-advertisements",
          icon: "Megaphone",
          order: promoMenu.order > 0 ? promoMenu.order : 7
        }
      });
    } else {
      promoMenu = await prisma.menu.create({
        data: {
          title: "Advertisements",
          url: "/discount-advertisements",
          icon: "Megaphone",
          order: 7,
          isActive: true
        }
      });
    }

    for (const role of roles) {
      const exists = await prisma.roleMenuAccess.findUnique({
        where: {
          roleId_menuId: {
            roleId: role.id,
            menuId: promoMenu.id
          }
        }
      });

      if (!exists) {
        await prisma.roleMenuAccess.create({
          data: {
            roleId: role.id,
            menuId: promoMenu.id,
            canView: true,
            canAdd: true,
            canEdit: true,
            canDelete: true
          }
        });
      }
    }
    discountAdvertisementMenuEnsured = true;
  } catch (error) {
    console.error("ensureDiscountAdvertisementMenuItem error:", error);
  }
}

/** Menu Combos — top-level sidebar item (not a submenu) */
export async function ensureCompositesMenuItem() {
  if (compositesMenuEnsured) return;
  try {
    // Remove old submenu entry under Kitchen & Menu if it exists
    await prisma.submenu.updateMany({
      where: {
        OR: [{ url: "/composites" }, { title: "Menu Combos" }],
      },
      data: { isActive: false },
    });

    const kitchenMenu = await prisma.menu.findFirst({
      where: {
        OR: [{ title: "Kitchen & Menu" }, { url: "/menu" }, { url: "/menus" }],
      },
    });

    if (kitchenMenu) {
      const urlFixes = [
        { title: "Categories", url: "/categories", order: 1 },
        { title: "Menu Items", url: "/menus", order: 2 },
        { title: "Table Setup", url: "/tables", order: 3 },
      ];
      for (const fix of urlFixes) {
        await prisma.submenu.updateMany({
          where: { menuId: kitchenMenu.id, title: fix.title },
          data: { url: fix.url, order: fix.order, isActive: true },
        });
      }
    }

    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: "admin" } },
          { name: { contains: "Admin" } },
          { name: { contains: "manager" } },
          { name: { contains: "Manager" } },
        ],
      },
    });

    if (roles.length === 0) return;

    let comboMenu = await prisma.menu.findFirst({
      where: {
        OR: [{ url: "/composites" }, { title: "Menu Combos" }],
      },
    });

    if (comboMenu) {
      comboMenu = await prisma.menu.update({
        where: { id: comboMenu.id },
        data: {
          title: "Menu Combos",
          url: "/composites",
          icon: "Layers",
          order: comboMenu.order > 0 ? comboMenu.order : 5,
        },
      });
    } else {
      comboMenu = await prisma.menu.create({
        data: {
          title: "Menu Combos",
          url: "/composites",
          icon: "Layers",
          order: 5,
          isActive: true,
        },
      });
    }

    for (const role of roles) {
      const exists = await prisma.roleMenuAccess.findUnique({
        where: {
          roleId_menuId: { roleId: role.id, menuId: comboMenu.id },
        }
      });

      if (!exists) {
        await prisma.roleMenuAccess.create({
          data: {
            roleId: role.id,
            menuId: comboMenu.id,
            canView: true,
            canAdd: true,
            canEdit: true,
            canDelete: true,
          }
        });
      }
    }

    clearRoleMenusCache();
    compositesMenuEnsured = true;
  } catch (error) {
    console.error("ensureCompositesMenuItem error:", error);
  }
}

/** Adds Restaurant Suppliers without resetting existing menus or permissions. */
export async function ensureSuppliersMenuItem() {
  if (suppliersMenuEnsured) return;
  try {
    let suppliersMenu = await prisma.menu.findFirst({
      where: { OR: [{ url: '/suppliers' }, { title: 'Suppliers' }] },
    });

    if (suppliersMenu) {
      suppliersMenu = await prisma.menu.update({
        where: { id: suppliersMenu.id },
        data: {
          title: 'Suppliers',
          url: '/suppliers',
          icon: 'Truck',
          moduleKey: 'RESTAURANT',
          isActive: true,
        },
      });
    } else {
      const lastMenu = await prisma.menu.aggregate({
        where: { moduleKey: 'RESTAURANT' },
        _max: { order: true },
      });
      suppliersMenu = await prisma.menu.create({
        data: {
          title: 'Suppliers',
          url: '/suppliers',
          icon: 'Truck',
          order: (lastMenu._max.order || 0) + 1,
          moduleKey: 'RESTAURANT',
          isActive: true,
        },
      });
    }

    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: 'admin' } },
          { name: { contains: 'Admin' } },
          { name: { contains: 'manager' } },
          { name: { contains: 'Manager' } },
        ],
      },
    });

    for (const role of roles) {
      await prisma.roleMenuAccess.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: suppliersMenu.id } },
        update: { canView: true },
        create: {
          roleId: role.id,
          menuId: suppliersMenu.id,
          canView: true,
          canAdd: true,
          canEdit: true,
          canDelete: true,
        },
      });
    }

    clearRoleMenusCache();
    clearAuthCaches();
    suppliersMenuEnsured = true;
  } catch (error) {
    console.error('ensureSuppliersMenuItem error:', error);
  }
}

/** Adds Purchases directly after Suppliers without resetting existing menu permissions. */
export async function ensurePurchasesMenuItem() {
  if (purchasesMenuEnsured) return;
  try {
    let purchasesMenu = await prisma.menu.findFirst({
      where: { OR: [{ url: '/purchases' }, { title: 'Purchases' }] },
    });
    const suppliersMenu = await prisma.menu.findFirst({ where: { url: '/suppliers' } });
    const order = (suppliersMenu?.order || 0) + 1;

    if (purchasesMenu) {
      purchasesMenu = await prisma.menu.update({
        where: { id: purchasesMenu.id },
        data: { title: 'Purchases', url: '/purchases', icon: 'ShoppingCart', moduleKey: 'RESTAURANT', isActive: true, order },
      });
    } else {
      await prisma.menu.updateMany({
        where: { moduleKey: 'RESTAURANT', order: { gte: order } },
        data: { order: { increment: 1 } },
      });
      purchasesMenu = await prisma.menu.create({
        data: { title: 'Purchases', url: '/purchases', icon: 'ShoppingCart', order, moduleKey: 'RESTAURANT', isActive: true },
      });
    }

    const roles = await prisma.role.findMany({
      where: { OR: [{ name: { contains: 'admin' } }, { name: { contains: 'Admin' } }, { name: { contains: 'manager' } }, { name: { contains: 'Manager' } }] },
    });
    for (const role of roles) {
      await prisma.roleMenuAccess.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: purchasesMenu.id } },
        update: { canView: true },
        create: { roleId: role.id, menuId: purchasesMenu.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
      });
    }
    clearRoleMenusCache();
    clearAuthCaches();
    purchasesMenuEnsured = true;
  } catch (error) {
    console.error('ensurePurchasesMenuItem error:', error);
  }
}

/** Makes the ingredient stock page available directly after Categories. */
export async function ensureIngredientsMenuItem() {
  if (ingredientsMenuEnsured) return;
  try {
    let ingredientsMenu = await prisma.menu.findFirst({
      where: { OR: [{ url: '/inventory' }, { title: 'Ingredients' }, { title: 'Inventory & Stock' }] },
    });
    const categoriesMenu = await prisma.menu.findFirst({ where: { url: '/categories' } });
    const order = (categoriesMenu?.order || 0) + 1;

    if (ingredientsMenu) {
      ingredientsMenu = await prisma.menu.update({
        where: { id: ingredientsMenu.id },
        data: { title: 'Ingredients', url: '/inventory', icon: 'Package', moduleKey: 'RESTAURANT', isActive: true, order },
      });
    } else {
      await prisma.menu.updateMany({
        where: { moduleKey: 'RESTAURANT', order: { gte: order } },
        data: { order: { increment: 1 } },
      });
      ingredientsMenu = await prisma.menu.create({
        data: { title: 'Ingredients', url: '/inventory', icon: 'Package', order, moduleKey: 'RESTAURANT', isActive: true },
      });
    }

    const roles = await prisma.role.findMany({
      where: { OR: [{ name: { contains: 'admin' } }, { name: { contains: 'Admin' } }, { name: { contains: 'manager' } }, { name: { contains: 'Manager' } }] },
    });
    for (const role of roles) {
      await prisma.roleMenuAccess.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: ingredientsMenu.id } },
        update: { canView: true },
        create: { roleId: role.id, menuId: ingredientsMenu.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
      });
    }
    clearRoleMenusCache();
    clearAuthCaches();
    ingredientsMenuEnsured = true;
  } catch (error) {
    console.error('ensureIngredientsMenuItem error:', error);
  }
}

export const getAllMenus = async (req, res) => {
  try {
    const requestedModule = req.query.moduleKey ? String(req.query.moduleKey).toUpperCase() : null;
    if (requestedModule && !MENU_MODULE_KEYS.has(requestedModule)) {
      return res.status(400).json({ success: false, message: 'Invalid moduleKey' });
    }
    const now = Date.now();
    if (allMenusCache.data && now - allMenusCache.at < ALL_MENUS_TTL_MS) {
      const data = requestedModule ? allMenusCache.data.filter((menu) => menu.moduleKey === requestedModule) : allMenusCache.data;
      return res.json({ success: true, data });
    }

    if (allMenusInflight) {
      const data = await allMenusInflight;
      return res.json({ success: true, data: requestedModule ? data.filter((menu) => menu.moduleKey === requestedModule) : data });
    }

    allMenusInflight = loadAllMenusFromDb()
      .catch((err) => {
        allMenusInflight = null;
        throw err;
      })
      .finally(() => {
        allMenusInflight = null;
      });

    const data = await allMenusInflight;
    res.json({ success: true, data: requestedModule ? data.filter((menu) => menu.moduleKey === requestedModule) : data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

function patchAllMenusOrderInCache(items) {
  if (!allMenusCache.data) return;
  const orderById = new Map(items.map((i) => [Number(i.id), Number(i.order) || 0]));
  allMenusCache.data = allMenusCache.data
    .map((m) => (orderById.has(m.id) ? { ...m, order: orderById.get(m.id) } : m))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  allMenusCache.at = Date.now();
}

function patchAllMenusEntryInCache(formatted) {
  if (!allMenusCache.data) return;
  const idx = allMenusCache.data.findIndex((m) => m.id === formatted.id);
  if (idx >= 0) {
    allMenusCache.data[idx] = formatted;
  } else {
    allMenusCache.data.push(formatted);
  }
  allMenusCache.data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  allMenusCache.at = Date.now();
}

function removeAllMenusEntryFromCache(menuId) {
  if (!allMenusCache.data) return;
  allMenusCache.data = allMenusCache.data.filter((m) => m.id !== menuId);
  allMenusCache.at = Date.now();
}

/** Single round-trip save: menu + all sub-modules in one transaction. */
export const saveMenuBundle = async (req, res) => {
  try {
    const menuId = req.params.id ? Number(req.params.id) : null;
    const {
      title,
      url,
      icon,
      order,
      isActive,
      hasSubmenus,
      moduleKey,
      submenus: submenusInput = [],
    } = req.body;

    const normalizedModuleKey = String(moduleKey || '').toUpperCase();
    if (!title?.trim() || !url?.trim() || !MENU_MODULE_KEYS.has(normalizedModuleKey)) {
      return res.status(400).json({ success: false, message: 'Title, URL, and a valid moduleKey are required' });
    }

    const submenus = Array.isArray(submenusInput) ? submenusInput : [];

    const result = await prisma.$transaction(async (tx) => {
      let menu;
      if (menuId) {
        const data = {};
        if (title !== undefined) data.title = title.trim();
        if (url !== undefined) data.url = url.trim();
        if (icon !== undefined) data.icon = icon;
        if (order !== undefined) data.order = Number(order) || 0;
        if (isActive !== undefined) data.isActive = !!isActive;
        data.moduleKey = normalizedModuleKey;
        menu = await tx.menu.update({ where: { id: menuId }, data });
      } else {
        menu = await tx.menu.create({
          data: {
            title: title.trim(),
            url: url.trim(),
            icon: icon || 'LayoutDashboard',
            order: Number(order) || 0,
            isActive: isActive !== false,
            moduleKey: normalizedModuleKey,
          },
        });
        const adminRole = await tx.role.findFirst({
          where: { name: { contains: 'Admin' } },
        });
        if (adminRole) {
          await tx.roleMenuAccess.create({
            data: {
              roleId: adminRole.id,
              menuId: menu.id,
              canView: true,
              canAdd: true,
              canEdit: true,
              canDelete: true,
            },
          });
        }
      }

      let savedSubs = [];
      if (hasSubmenus) {
        const existing = menuId
          ? await tx.submenu.findMany({ where: { menuId: menu.id }, select: { id: true } })
          : [];
        const keptIds = new Set();

        for (let i = 0; i < submenus.length; i++) {
          const sm = submenus[i];
          if (!sm?.title?.trim() || !sm?.url?.trim()) continue;
          const orderVal = i + 1;

          if (sm.id) {
            const updated = await tx.submenu.update({
              where: { id: Number(sm.id) },
              data: {
                title: sm.title.trim(),
                url: sm.url.trim(),
                order: orderVal,
                ...(sm.isActive !== undefined ? { isActive: !!sm.isActive } : {}),
              },
            });
            savedSubs.push(updated);
            keptIds.add(updated.id);
          } else {
            const created = await tx.submenu.create({
              data: {
                menuId: menu.id,
                title: sm.title.trim(),
                url: sm.url.trim(),
                order: orderVal,
                isActive: sm.isActive !== false,
              },
            });
            savedSubs.push(created);
            keptIds.add(created.id);

            const adminRole = await tx.role.findFirst({
              where: { name: { contains: 'Admin' } },
            });
            if (adminRole) {
              const menuAccess = await tx.roleMenuAccess.findUnique({
                where: { roleId_menuId: { roleId: adminRole.id, menuId: menu.id } },
              });
              if (menuAccess) {
                await tx.roleSubMenuAccess.create({
                  data: {
                    roleMenuAccessId: menuAccess.id,
                    subMenuId: created.id,
                    canView: true,
                    canAdd: true,
                    canEdit: true,
                    canDelete: true,
                  },
                });
              }
            }
          }
        }

        if (menuId) {
          const removeIds = existing.filter((e) => !keptIds.has(e.id)).map((e) => e.id);
          if (removeIds.length) {
            await tx.submenu.deleteMany({ where: { id: { in: removeIds } } });
          }
        }
      } else if (menuId) {
        savedSubs = await tx.submenu.findMany({
          where: { menuId: menu.id },
          orderBy: { order: 'asc' },
        });
      }

      return { menu, items: savedSubs };
    }, { timeout: 30000 });

    const formatted = {
      ...result.menu,
      items: result.items,
      permissions: {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
      },
    };

    patchAllMenusEntryInCache(formatted);
    clearRoleMenusCache();

    if (req.user) {
      void trackingController.logAction(
        req.user.id,
        menuId ? 'UPDATE' : 'CREATE',
        'MENU',
        formatted.id,
        `${menuId ? 'Updated' : 'Created'} menu module: ${formatted.title}`
      );
    }

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('saveMenuBundle error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMenu = async (req, res) => {
  try {
    const { title, url, icon, order, moduleKey } = req.body;
    const normalizedModuleKey = String(moduleKey || '').toUpperCase();
    if (!MENU_MODULE_KEYS.has(normalizedModuleKey)) return res.status(400).json({ success: false, message: 'Valid moduleKey is required' });
    const menu = await prisma.menu.create({
      data: { title, url, icon, order: Number(order) || 0, moduleKey: normalizedModuleKey }
    });
    
    const adminRole = await prisma.role.findFirst({ where: { name: { contains: "Admin" } } });
    if (adminRole) {
      await prisma.roleMenuAccess.create({
        data: {
          roleId: adminRole.id,
          menuId: menu.id,
          canView: true, canAdd: true, canEdit: true, canDelete: true
        }
      });
    }

    if (req.user) {
      await trackingController.logAction(
        req.user.id,
        'CREATE',
        'MENU',
        menu.id,
        `Created new main menu: ${menu.title}`
      );
    }

    clearRoleMenusCache();
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, url, icon, order, isActive, moduleKey } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (url !== undefined) data.url = url;
    if (icon !== undefined) data.icon = icon;
    if (order !== undefined) data.order = Number(order);
    if (isActive !== undefined) data.isActive = !!isActive;
    if (moduleKey !== undefined) {
      const normalizedModuleKey = String(moduleKey).toUpperCase();
      if (!MENU_MODULE_KEYS.has(normalizedModuleKey)) return res.status(400).json({ success: false, message: 'Invalid moduleKey' });
      data.moduleKey = normalizedModuleKey;
    }

    const menu = await prisma.menu.update({
      where: { id: Number(id) },
      data,
    });

    if (req.user) {
      await trackingController.logAction(
        req.user.id,
        'UPDATE',
        'MENU',
        menu.id,
        `Updated menu configuration: ${menu.title}`
      );
    }
    clearRoleMenusCache();
    res.json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await prisma.menu.findUnique({ where: { id: Number(id) } });
    await prisma.menu.delete({ where: { id: Number(id) } });

    if (req.user) {
      await trackingController.logAction(
        req.user.id,
        'DELETE',
        'MENU',
        Number(id),
        `Deleted menu module: ${menu?.title || id}`
      );
    }
    clearRoleMenusCache();
    res.json({ success: true, message: "Menu deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSubMenu = async (req, res) => {
  try {
    const { menuId, title, url, order } = req.body;
    const submenu = await prisma.submenu.create({
      data: { menuId: Number(menuId), title, url, order: Number(order) || 0 }
    });

    const adminRole = await prisma.role.findFirst({ where: { name: { contains: "Admin" } } });
    if (adminRole) {
      const menuAccess = await prisma.roleMenuAccess.findUnique({
        where: { roleId_menuId: { roleId: adminRole.id, menuId: Number(menuId) } }
      });
      if (menuAccess) {
        await prisma.roleSubMenuAccess.create({
          data: {
            roleMenuAccessId: menuAccess.id,
            subMenuId: submenu.id,
            canView: true, canAdd: true, canEdit: true, canDelete: true
          }
        });
      }
    }

    clearRoleMenusCache();
    res.json({ success: true, data: submenu });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSubMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, url, order, isActive } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (url !== undefined) data.url = url;
    if (order !== undefined) data.order = Number(order);
    if (isActive !== undefined) data.isActive = !!isActive;

    const submenu = await prisma.submenu.update({
      where: { id: Number(id) },
      data,
    });
    clearRoleMenusCache();
    res.json({ success: true, data: submenu });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Reorder main menus — updates display order only; role permissions are untouched. */
export const reorderMenus = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }

    await prisma.$transaction(
      items.map(({ id, order }) =>
        prisma.menu.update({
          where: { id: Number(id) },
          data: { order: Number(order) || 0 },
        })
      )
    );

    patchAllMenusOrderInCache(items);
    clearRoleMenusCache();

    if (req.user) {
      trackingController
        .logAction(req.user.id, 'UPDATE', 'MENU', 0, 'Reordered sidebar menus')
        .catch(() => {});
    }

    res.json({ success: true, data: allMenusCache.data || items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Reorder sub-modules under a parent menu — permissions untouched. */
export const reorderSubMenus = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }

    await prisma.$transaction(
      items.map(({ id, order }) =>
        prisma.submenu.update({
          where: { id: Number(id) },
          data: { order: Number(order) || 0 },
        })
      )
    );

    patchAllMenusOrderInCache(
      items.map(({ id, order }) => ({ id, order }))
    );
    clearRoleMenusCache();
    res.json({ success: true, message: 'Sub-menu order updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSubMenu = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.submenu.delete({ where: { id: Number(id) } });
    clearRoleMenusCache();
    res.json({ success: true, message: "Submenu deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePermissions = async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    const { permissions } = req.body;

    if (isNaN(roleId)) {
      return res.status(400).json({ success: false, message: "Invalid role ID" });
    }

    const activeMenuPerms = (permissions || []).filter(
      (p) => p.canView || p.canAdd || p.canEdit || p.canDelete
    );

    await prisma.$transaction(async (tx) => {
      await tx.roleMenuAccess.deleteMany({ where: { roleId } });

      if (activeMenuPerms.length === 0) return;

      await tx.roleMenuAccess.createMany({
        data: activeMenuPerms.map((menuPerm) => ({
          roleId,
          menuId: Number(menuPerm.menuId),
          canView: !!menuPerm.canView,
          canAdd: !!menuPerm.canAdd,
          canEdit: !!menuPerm.canEdit,
          canDelete: !!menuPerm.canDelete,
        })),
      });

      const createdAccess = await tx.roleMenuAccess.findMany({
        where: { roleId },
        select: { id: true, menuId: true },
      });
      const accessByMenuId = new Map(createdAccess.map((row) => [row.menuId, row.id]));

      const allSubRows = [];
      for (const menuPerm of activeMenuPerms) {
        const roleMenuAccessId = accessByMenuId.get(Number(menuPerm.menuId));
        if (!roleMenuAccessId || !Array.isArray(menuPerm.submenus)) continue;

        for (const sp of menuPerm.submenus) {
          if (!sp.canView && !sp.canAdd && !sp.canEdit && !sp.canDelete) continue;
          allSubRows.push({
            roleMenuAccessId,
            subMenuId: Number(sp.submenuId),
            canView: !!sp.canView,
            canAdd: !!sp.canAdd,
            canEdit: !!sp.canEdit,
            canDelete: !!sp.canDelete,
          });
        }
      }

      if (allSubRows.length > 0) {
        await tx.roleSubMenuAccess.createMany({ data: allSubRows });
      }
    }, { timeout: 20000 });

    clearPermissionCache();
    clearRoleMenusCache(roleId);

    if (req.user) {
      trackingController
        .logAction(
          req.user.id,
          'UPDATE',
          'PERMISSIONS',
          roleId,
          `Updated system permissions for role ID: ${roleId}`
        )
        .catch(() => {});
    }

    res.json({ success: true, message: "Permissions updated successfully" });
  } catch (error) {
    console.error("CRITICAL: Error updating permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error during permission update",
      error: error.message,
    });
  }
};
