-- Additive, non-destructive workspace migration for existing menu records.
-- Back up the menu tables before applying in production.
ALTER TABLE `menu`
  ADD COLUMN `moduleKey` ENUM('CORE', 'RESTAURANT', 'ACCOUNTING', 'ACCESS_CONTROL')
  NOT NULL DEFAULT 'RESTAURANT';

-- Existing operational menus, including the existing Dashboard, remain RESTAURANT.
UPDATE `menu` SET `moduleKey` = 'ACCESS_CONTROL' WHERE `url` = '/users';

-- Promote the three legacy access-control submenus to workspace menu entries.
-- The original submenu rows and permission rows remain in place for rollback/audit.
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'Roles', '/config/roles', 'Shield', 2, TRUE, 'ACCESS_CONTROL', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'ACCESS_CONTROL' AND `url` = '/config/roles');
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'Permissions', '/config/permissions', 'Key', 3, TRUE, 'ACCESS_CONTROL', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'ACCESS_CONTROL' AND `url` = '/config/permissions');
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'Menus', '/config/menus', 'LayoutGrid', 4, TRUE, 'ACCESS_CONTROL', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'ACCESS_CONTROL' AND `url` = '/config/menus');
UPDATE `submenu` SET `isActive` = FALSE WHERE `url` IN ('/config/roles', '/config/permissions', '/config/menus');

-- Module entry records are additive. Existing restaurant menus and permissions are not replaced.
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'Dashboard', '/dashboard', 'LayoutDashboard', 1, TRUE, 'CORE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'CORE' AND `url` = '/dashboard');
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'Restaurant', '/restaurant/dashboard', 'Store', 2, TRUE, 'CORE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'CORE' AND `url` = '/restaurant/dashboard');
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'POS', '/pos-terminal', 'MonitorSmartphone', 3, TRUE, 'CORE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'CORE' AND `url` = '/pos-terminal');
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'Accounting', '/accounting/dashboard', 'Landmark', 4, TRUE, 'CORE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'CORE' AND `url` = '/accounting/dashboard');
INSERT INTO `menu` (`title`, `url`, `icon`, `order`, `isActive`, `moduleKey`, `createdAt`, `updatedAt`)
SELECT 'Access Control', '/access-control/users', 'ShieldCheck', 5, TRUE, 'CORE', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM `menu` WHERE `moduleKey` = 'CORE' AND `url` = '/access-control/users');

-- Grant existing admin roles full access to the additive CORE entries.
INSERT INTO `roleMenuAccess` (`roleId`, `menuId`, `canView`, `canAdd`, `canEdit`, `canDelete`, `createdAt`, `updatedAt`)
SELECT r.id, m.id, TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
FROM `role` r CROSS JOIN `menu` m
LEFT JOIN `roleMenuAccess` a ON a.roleId = r.id AND a.menuId = m.id
WHERE LOWER(REPLACE(r.name, ' ', '_')) IN ('admin', 'super_admin')
  AND m.moduleKey IN ('CORE', 'RESTAURANT', 'ACCOUNTING', 'ACCESS_CONTROL') AND a.id IS NULL;

CREATE INDEX `menu_moduleKey_isActive_order_idx`
  ON `menu` (`moduleKey`, `isActive`, `order`);
