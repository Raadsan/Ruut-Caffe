import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const accountingMenus = [
  { title: 'Dashboard', url: '/dashboard', icon: 'LayoutDashboard', order: 1 },
  {
    title: 'Configuration', url: '/configuration', icon: 'Settings2', order: 2,
    items: [
      ['Companies', '/configuration/companies'],
      ['Account Types', '/configuration/account-types'],
      ['Currencies', '/configuration/currencies'],
      ['Payment Methods', '/configuration/payment-methods'],
      ['Payment Terms', '/configuration/payment-terms'],
      ['Taxes', '/configuration/taxes'],
      ['Product Categories', '/configuration/product-categories'],
    ],
  },
  { title: 'Chart of Accounts', url: '/chart-of-accounts', icon: 'ListTree', order: 3 },
  {
    title: 'Fiscal Management', url: '/fiscal', icon: 'CalendarRange', order: 4,
    items: [['Fiscal Years', '/fiscal-years'], ['Fiscal Periods', '/fiscal-periods']],
  },
  {
    title: 'Ledger', url: '/ledger', icon: 'BookOpen', order: 5,
    items: [['Journals', '/journals'], ['Journal Entries', '/journal-entries']],
  },
  {
    title: 'Receivables', url: '/receivables', icon: 'ArrowDownToLine', order: 6,
    items: [['Customers', '/customers'], ['Customer Invoices', '/customer-invoices'], ['Customer Receipts', '/customer-receipts'], ['Credit Notes', '/credit-notes']],
  },
  {
    title: 'Payables', url: '/payables', icon: 'ArrowUpFromLine', order: 7,
    items: [['Vendors', '/vendors'], ['Vendor Bills', '/vendor-bills'], ['Vendor Payments', '/vendor-payments'], ['Vendor Refunds', '/vendor-refunds']],
  },
  {
    title: 'Banking', url: '/banking', icon: 'Landmark', order: 8,
    items: [['Bank Accounts', '/bank-accounts'], ['Cash Transactions', '/cash-transactions']],
  },
  { title: 'Products', url: '/products', icon: 'Package', order: 9 },
  {
    title: 'Financial Reports', url: '/reports', icon: 'ChartNoAxesCombined', order: 10,
    items: [
      ['General Ledger', '/reports/general-ledger'],
      ['Trial Balance', '/reports/trial-balance'],
      ['Profit & Loss', '/reports/profit-and-loss'],
      ['Balance Sheet', '/reports/balance-sheet'],
      ['Cash Flow', '/reports/cash-flow'],
      ['Journal Report', '/reports/journal-report'],
    ],
  },
]

async function main() {
  const roles = await prisma.role.findMany()
  const permittedRoles = roles.filter((role) =>
    ['admin', 'super_admin', 'accounting', 'accountant'].includes(
      role.name.trim().toLowerCase().replace(/[\s-]+/g, '_')
    )
  )

  for (const definition of accountingMenus) {
    const { items, ...menuData } = definition
    const existing = await prisma.menu.findFirst({
      where: { moduleKey: 'ACCOUNTING', url: definition.url },
    })
    const menu = existing
      ? await prisma.menu.update({
          where: { id: existing.id },
          data: { title: definition.title, icon: definition.icon, order: definition.order, isActive: true },
        })
      : await prisma.menu.create({
          data: { ...menuData, moduleKey: 'ACCOUNTING', isActive: true },
        })

    for (const role of permittedRoles) {
      await prisma.roleMenuAccess.upsert({
        where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
        update: { canView: true },
        create: { roleId: role.id, menuId: menu.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
      })
    }

    for (const [index, item] of (items || []).entries()) {
      const [title, url] = item
      const existingSubmenu = await prisma.submenu.findFirst({ where: { menuId: menu.id, url } })
      const submenu = existingSubmenu
        ? await prisma.submenu.update({ where: { id: existingSubmenu.id }, data: { title, order: index + 1, isActive: true } })
        : await prisma.submenu.create({ data: { menuId: menu.id, title, url, order: index + 1, isActive: true } })

      for (const role of permittedRoles) {
        const menuAccess = await prisma.roleMenuAccess.findUnique({
          where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
        })
        await prisma.roleSubMenuAccess.upsert({
          where: { roleMenuAccessId_subMenuId: { roleMenuAccessId: menuAccess.id, subMenuId: submenu.id } },
          update: { canView: true },
          create: { roleMenuAccessId: menuAccess.id, subMenuId: submenu.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
        })
      }
    }

    const activeUrls = new Set((items || []).map(([, url]) => url))
    await prisma.submenu.updateMany({
      where: {
        menuId: menu.id,
        ...(activeUrls.size ? { url: { notIn: [...activeUrls] } } : {}),
      },
      data: { isActive: false },
    })
  }

  console.log(`Accounting menus synchronized for ${permittedRoles.length} permitted role(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
