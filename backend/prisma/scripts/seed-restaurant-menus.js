import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const definitions = [
  ['Dashboard', '/dashboard', 'LayoutDashboard'],
  ['Tables', '/tables', 'TableProperties'],
  ['Orders', '/orders', 'ListOrdered'],
  ['Pickup History', '/orders/pickup/history', 'History'],
  ['Categories', '/categories', 'Tags'],
  ['Ingredients', '/inventory', 'Package'],
  ['Menu Items', '/menus', 'UtensilsCrossed'],
  ['Menu Combos', '/composites', 'Layers'],
  ['Advertisements', '/discount-advertisements', 'Megaphone'],
  ['Suppliers', '/suppliers', 'Truck'],
  ['Purchases', '/purchases', 'ShoppingCart'],
  ['Payments', '/payments', 'WalletCards'],
  ['Report', '/report', 'ChartNoAxesCombined'],
  ['Configuration', '/config', 'Settings2'],
]

async function main() {
  const restaurantRoles = await prisma.role.findMany({
    where: {
      roleMenuAccess: {
        some: { canView: true, menu: { moduleKey: 'RESTAURANT' } },
      },
    },
  })

  const activeIds = []
  for (const [index, [title, url, icon]] of definitions.entries()) {
    let menu = await prisma.menu.findFirst({
      where: { moduleKey: 'RESTAURANT', OR: [{ url }, { title }] },
    })
    menu = menu
      ? await prisma.menu.update({
          where: { id: menu.id },
          data: { title, url, icon, order: index + 1, moduleKey: 'RESTAURANT', isActive: true },
        })
      : await prisma.menu.create({
          data: { title, url, icon, order: index + 1, moduleKey: 'RESTAURANT', isActive: true },
        })
    activeIds.push(menu.id)

    for (const role of restaurantRoles) {
      await prisma.roleMenuAccess.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
        update: { canView: true },
        create: { roleId: role.id, menuId: menu.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
      })
    }
  }

  await prisma.menu.updateMany({
    where: { moduleKey: 'RESTAURANT', id: { notIn: activeIds } },
    data: { isActive: false },
  })

  // Categories, menu items, and tables are now top-level entries.
  await prisma.submenu.updateMany({
    where: { url: { in: ['/categories', '/menus', '/tables'] } },
    data: { isActive: false },
  })

  console.log(`Restaurant menus synchronized for ${restaurantRoles.length} permitted role(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
