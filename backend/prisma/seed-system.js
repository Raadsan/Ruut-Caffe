import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const restaurantMenus = [
  ['Dashboard', '/dashboard', 'LayoutDashboard'], ['Tables', '/tables', 'TableProperties'],
  ['Orders', '/orders', 'ListOrdered'], ['Categories', '/categories', 'Tags'],
  ['Menu Items', '/menus', 'UtensilsCrossed'], ['Menu Combos', '/composites', 'Layers'],
  ['Payments', '/payments', 'WalletCards'], ['Advertisements', '/discount-advertisements', 'Megaphone'],
  ['Suppliers', '/suppliers', 'Truck'], ['Purchases', '/purchases', 'ShoppingCart'],
  ['Report', '/report', 'ChartNoAxesCombined', [
    ['Order Reports', '/report/orders'], ['Financial Reports', '/report/finance'], ['Customer Reports', '/report/clients'],
  ]],
  ['Configuration', '/config', 'Settings2', [
    ['Receipt Settings', '/receipt-settings'], ['Tracking', '/config/tracking'], ['Notifications', '/config/notifications'],
  ]],
]

const accountingMenus = [
  ['Dashboard', '/dashboard', 'LayoutDashboard', []],
  ['Configuration', '/configuration', 'Settings2', [['Companies', '/configuration/companies'], ['Account Types', '/configuration/account-types'], ['Currencies', '/configuration/currencies'], ['Payment Methods', '/configuration/payment-methods'], ['Payment Terms', '/configuration/payment-terms'], ['Taxes', '/configuration/taxes'], ['Product Categories', '/configuration/product-categories']]],
  ['Chart of Accounts', '/chart-of-accounts', 'ListTree', []],
  ['Fiscal Management', '/fiscal', 'CalendarRange', [['Fiscal Years', '/fiscal-years'], ['Fiscal Periods', '/fiscal-periods']]],
  ['Ledger', '/ledger', 'BookOpen', [['Journals', '/journals'], ['Journal Entries', '/journal-entries']]],
  ['Receivables', '/receivables', 'ArrowDownToLine', [['Customers', '/customers'], ['Customer Invoices', '/customer-invoices'], ['Customer Receipts', '/customer-receipts'], ['Credit Notes', '/credit-notes']]],
  ['Payables', '/payables', 'ArrowUpFromLine', [['Vendors', '/vendors'], ['Vendor Bills', '/vendor-bills'], ['Vendor Payments', '/vendor-payments'], ['Vendor Refunds', '/vendor-refunds']]],
  ['Banking', '/banking', 'Landmark', [['Bank Accounts', '/bank-accounts'], ['Cash Transactions', '/cash-transactions']]],
  ['Products', '/products', 'Package', []],
  ['Financial Reports', '/reports', 'ChartNoAxesCombined', [['General Ledger', '/reports/general-ledger'], ['Trial Balance', '/reports/trial-balance'], ['Profit & Loss', '/reports/profit-and-loss'], ['Balance Sheet', '/reports/balance-sheet'], ['Cash Flow', '/reports/cash-flow'], ['Journal Report', '/reports/journal-report']]],
]

async function seedAccess() {
  const roles = {}
  for (const row of [
    ['admin', 'System Administrator'], ['manager', 'Restaurant Manager'], ['kitchen', 'Kitchen Staff'],
    ['waiter', 'Wait Staff'], ['accountant', 'Accounting Staff'], ['pos', 'Point of Sale Staff'],
    ['client', 'Mobile Client Customer'],
  ]) roles[row[0]] = await prisma.role.upsert({ where: { name: row[0] }, update: { description: row[1] }, create: { name: row[0], description: row[1] } })

  const password = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'password123', 10)
  await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL || 'admin@ruutcaffe.com' },
    update: { fullName: 'Ruut Caffe Administrator', roleId: roles.admin.id, isActive: true },
    create: { fullName: 'Ruut Caffe Administrator', email: process.env.SEED_ADMIN_EMAIL || 'admin@ruutcaffe.com', password, roleId: roles.admin.id },
  })

  const grant = async (role, menu) => prisma.roleMenuAccess.upsert({
    where: { roleId_menuId: { roleId: role.id, menuId: menu.id } },
    update: { canView: true, canAdd: true, canEdit: true, canDelete: true },
    create: { roleId: role.id, menuId: menu.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
  })
  const coreMenus = [
    ['Dashboard', '/dashboard', 'LayoutDashboard', []],
    ['Restaurant', '/restaurant/dashboard', 'Store', []],
    ['Accounting', '/accounting/dashboard', 'Landmark', []],
    ['Configurations', '/config/roles', 'Settings2', []],
  ]
  await prisma.menu.updateMany({
    where: { moduleKey: 'CORE', title: 'Configurations', url: { not: '/config/roles' } },
    data: { isActive: false },
  })
  for (const [index, [title, url, icon, children]] of coreMenus.entries()) {
    const existing = await prisma.menu.findFirst({ where: { moduleKey: 'CORE', url } })
    const menu = existing
      ? await prisma.menu.update({ where: { id: existing.id }, data: { title, icon, order: index + 1, isActive: true } })
      : await prisma.menu.create({ data: { title, url, icon, order: index + 1, moduleKey: 'CORE' } })
    const access = await grant(roles.admin, menu)
    for (const [childIndex, [childTitle, childUrl]] of children.entries()) {
      const found = await prisma.submenu.findFirst({ where: { menuId: menu.id, url: childUrl } })
      const child = found
        ? await prisma.submenu.update({ where: { id: found.id }, data: { title: childTitle, order: childIndex + 1, isActive: true } })
        : await prisma.submenu.create({ data: { menuId: menu.id, title: childTitle, url: childUrl, order: childIndex + 1 } })
      await prisma.roleSubMenuAccess.upsert({
        where: { roleMenuAccessId_subMenuId: { roleMenuAccessId: access.id, subMenuId: child.id } },
        update: { canView: true, canAdd: true, canEdit: true, canDelete: true },
        create: { roleMenuAccessId: access.id, subMenuId: child.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
      })
    }
    if (children.length) await prisma.submenu.updateMany({ where: { menuId: menu.id, url: { notIn: children.map(([, childUrl]) => childUrl) } }, data: { isActive: false } })
  }
  const coreConfigurationMenus = [
    ['Roles', '/config/roles', 'ShieldCheck'], ['System Users', '/users', 'Users'],
    ['Menus', '/config/menus', 'PanelLeft'], ['Permissions', '/config/permissions', 'KeyRound'],
  ]
  await prisma.menu.updateMany({
    where: { moduleKey: 'ACCESS_CONTROL', url: { notIn: coreConfigurationMenus.map(([, url]) => url) } },
    data: { isActive: false },
  })
  for (const [index, [title, url, icon]] of coreConfigurationMenus.entries()) {
    const existing = await prisma.menu.findFirst({ where: { moduleKey: 'ACCESS_CONTROL', url } })
    const menu = existing
      ? await prisma.menu.update({ where: { id: existing.id }, data: { title, icon, order: index + 1, isActive: true } })
      : await prisma.menu.create({ data: { title, url, icon, order: index + 1, moduleKey: 'ACCESS_CONTROL' } })
    await grant(roles.admin, menu)
  }

  for (const [index, [title, url, icon, children = []]] of restaurantMenus.entries()) {
    const existing = await prisma.menu.findFirst({ where: { moduleKey: 'RESTAURANT', url } })
    const menu = existing ? await prisma.menu.update({ where: { id: existing.id }, data: { title, url, icon, order: index + 1, isActive: true } }) : await prisma.menu.create({ data: { title, url, icon, order: index + 1, moduleKey: 'RESTAURANT' } })
    for (const role of [roles.admin, roles.manager, roles.kitchen, roles.waiter]) {
      const access = await grant(role, menu)
      for (const [childIndex, [childTitle, childUrl]] of children.entries()) {
        const found = await prisma.submenu.findFirst({ where: { menuId: menu.id, url: childUrl } })
        const child = found
          ? await prisma.submenu.update({ where: { id: found.id }, data: { title: childTitle, order: childIndex + 1, isActive: true } })
          : await prisma.submenu.create({ data: { menuId: menu.id, title: childTitle, url: childUrl, order: childIndex + 1 } })
        await prisma.roleSubMenuAccess.upsert({
          where: { roleMenuAccessId_subMenuId: { roleMenuAccessId: access.id, subMenuId: child.id } },
          update: { canView: true, canAdd: true, canEdit: true, canDelete: true },
          create: { roleMenuAccessId: access.id, subMenuId: child.id, canView: true, canAdd: true, canEdit: true, canDelete: true },
        })
      }
    }
    if (children.length) await prisma.submenu.updateMany({ where: { menuId: menu.id, url: { notIn: children.map(([, childUrl]) => childUrl) } }, data: { isActive: false } })
  }
  for (const [index, [title, url, icon, children]] of accountingMenus.entries()) {
    const existing = await prisma.menu.findFirst({ where: { moduleKey: 'ACCOUNTING', url } })
    const menu = existing ? await prisma.menu.update({ where: { id: existing.id }, data: { title, icon, order: index + 1, isActive: true } }) : await prisma.menu.create({ data: { title, url, icon, order: index + 1, moduleKey: 'ACCOUNTING' } })
    for (const role of [roles.admin, roles.accountant]) {
      const access = await grant(role, menu)
      for (const [childIndex, [childTitle, childUrl]] of children.entries()) {
        const found = await prisma.submenu.findFirst({ where: { menuId: menu.id, url: childUrl } })
        const child = found ? await prisma.submenu.update({ where: { id: found.id }, data: { title: childTitle, order: childIndex + 1, isActive: true } }) : await prisma.submenu.create({ data: { menuId: menu.id, title: childTitle, url: childUrl, order: childIndex + 1 } })
        await prisma.roleSubMenuAccess.upsert({ where: { roleMenuAccessId_subMenuId: { roleMenuAccessId: access.id, subMenuId: child.id } }, update: { canView: true, canAdd: true, canEdit: true, canDelete: true }, create: { roleMenuAccessId: access.id, subMenuId: child.id, canView: true, canAdd: true, canEdit: true, canDelete: true } })
      }
    }
  }
}

async function seedRestaurant() {
  for (let number = 1; number <= 10; number += 1) await prisma.table.upsert({ where: { number }, update: { status: 'active' }, create: { number, name: `Table ${number}`, qrCode: `RUUT-TABLE-${number}`, status: 'active' } })
  const categories = {}
  for (const name of ['Breakfast', 'Main Dishes', 'Coffee', 'Cold Drinks', 'Desserts']) categories[name] = await prisma.category.upsert({ where: { name }, update: { isActive: true }, create: { name } })
  const items = [
    ['Cappuccino', 3, 'Coffee'], ['Espresso', 2, 'Coffee'], ['Fresh Juice', 3, 'Cold Drinks'],
    ['Club Sandwich', 7, 'Main Dishes'], ['Pasta', 8, 'Main Dishes'], ['Chocolate Cake', 4, 'Desserts'],
  ]
  for (const [name, price, category] of items) {
    const existing = await prisma.menuitem.findFirst({ where: { name } })
    if (existing) await prisma.menuitem.update({ where: { id: existing.id }, data: { price, categoryId: categories[category].id, isAvailable: true } })
    else await prisma.menuitem.create({ data: { name, price, categoryId: categories[category].id } })
  }
  await prisma.receiptSettings.upsert({ where: { id: 1 }, update: { name: 'Ruut Caffe', footerText: 'Thank you for visiting Ruut Caffe.' }, create: { id: 1, name: 'Ruut Caffe', footerText: 'Thank you for visiting Ruut Caffe.' } })
}

async function seedAccounting() {
  const usd = await prisma.currencies.upsert({ where: { code: 'USD' }, update: { name: 'US Dollar', symbol: '$', is_active: true }, create: { code: 'USD', name: 'US Dollar', symbol: '$' } })
  const typeDefs = [
    ['Assets', 'asset', 'debit', 'balance_sheet', 10], ['Liabilities', 'liability', 'credit', 'balance_sheet', 20],
    ['Equity', 'equity', 'credit', 'balance_sheet', 30], ['Revenue', 'income', 'credit', 'profit_loss', 40],
    ['Expenses', 'expense', 'debit', 'profit_loss', 50],
  ]
  const types = {}
  for (const [name, internal_group, normal_balance, report_type, sequence] of typeDefs) types[internal_group] = await prisma.account_types.upsert({ where: { name }, update: { internal_group, normal_balance, report_type, sequence }, create: { name, internal_group, normal_balance, report_type, sequence } })
  let company = await prisma.companies.findFirst({ where: { name: 'Ruut Caffe' } })
  company = company ? await prisma.companies.update({ where: { id: company.id }, data: { currency_id: usd.id, is_active: true } }) : await prisma.companies.create({ data: { name: 'Ruut Caffe', legal_name: 'Ruut Caffe', currency_id: usd.id, country: 'Somalia' } })
  const accountDefs = [
    ['1000', 'Current Assets', 'asset', false], ['1001', 'Cash on Hand', 'asset', true], ['1002', 'Bank Account', 'asset', true], ['1003', 'Mobile Wallet - EVC Plus', 'asset', true],
    ['1004', 'Mobile Wallet - eDahab', 'asset', true], ['1005', 'Mobile Wallet - Merchant', 'asset', true], ['1006', 'Mobile Wallet - IBS', 'asset', true],
    ['1100', 'Accounts Receivable', 'asset', true], ['1400', 'Vendor Advances', 'asset', true], ['2000', 'Accounts Payable', 'liability', true],
    ['3000', 'Owner Equity', 'equity', false], ['4000', 'Sales Revenue', 'income', true],
    ['5001', 'Cost of Goods Sold', 'expense', false], ['5005', 'Cafeteria Expense', 'expense', false],
  ]
  const accounts = {}
  for (const [code, name, group, reconcilable] of accountDefs) accounts[code] = await prisma.chart_of_accounts.upsert({ where: { company_id_code: { company_id: company.id, code } }, update: { name, account_type_id: types[group].id, currency_id: usd.id, is_active: true, allow_manual_entry: !['1000', '5001'].includes(code) }, create: { company_id: company.id, code, name, account_type_id: types[group].id, currency_id: usd.id, is_reconcilable: reconcilable, allow_manual_entry: !['1000', '5001'].includes(code) } })
  for (const code of ['1001', '1002', '1003', '1004', '1005', '1006', '1100', '1400']) await prisma.chart_of_accounts.update({ where: { id: accounts[code].id }, data: { parent_id: accounts['1000'].id } })
  const journals = [
    ['INV', 'Customer Invoices', 'sale', '1100', '4000'], ['POS', 'Point of Sale', 'sale', '1100', '4000'],
    ['BILL', 'Vendor Bills', 'purchase', '5005', '2000'], ['CASH', 'Cash', 'cash', '1001', null], ['BANK', 'Bank', 'bank', '1002', null], ['WALLET', 'Mobile Wallet', 'bank', '1003', null],
  ]
  for (const [code, name, journal_type, debit, credit] of journals) await prisma.journals.upsert({ where: { company_id_code: { company_id: company.id, code } }, update: { name, journal_type, default_debit_account_id: accounts[debit]?.id, default_credit_account_id: accounts[credit]?.id, is_active: true }, create: { company_id: company.id, code, name, journal_type, default_debit_account_id: accounts[debit]?.id, default_credit_account_id: accounts[credit]?.id, currency_id: usd.id, sequence_prefix: code } })
  for (const [code, name, account] of [['CASH', 'Cash', '1001'], ['BANK', 'Bank', '1002'], ['EVC', 'EVC Plus', '1003'], ['EDAHAB', 'eDahab', '1004'], ['MERCHANT', 'Merchant', '1005'], ['IBS', 'IBS', '1006']]) await prisma.payment_methods.upsert({ where: { code }, update: { name, gl_account_id: accounts[account].id, is_active: true }, create: { code, name, payment_type: 'both', gl_account_id: accounts[account].id } })
  const term = await prisma.payment_terms.upsert({ where: { name: 'Due on Receipt' }, update: { is_active: true }, create: { name: 'Due on Receipt', description: 'Payment is due immediately.' } })
  if (!await prisma.payment_term_lines.findFirst({ where: { payment_term_id: term.id } })) await prisma.payment_term_lines.create({ data: { payment_term_id: term.id, value_type: 'balance', due_days: 0 } })
  await prisma.taxes.upsert({ where: { name: 'No Tax' }, update: { rate_percent: 0, is_active: true }, create: { name: 'No Tax', rate_percent: 0 } })
  const vatAccount = await prisma.chart_of_accounts.upsert({ where: { company_id_code: { company_id: company.id, code: '2100' } }, update: { name: 'VAT Payable', account_type_id: types.liability.id, currency_id: usd.id, is_active: true }, create: { company_id: company.id, code: '2100', name: 'VAT Payable', account_type_id: types.liability.id, currency_id: usd.id } })
  await prisma.taxes.upsert({ where: { name: 'VAT 5%' }, update: { rate_percent: 5, tax_scope: 'sale', tax_account_id: vatAccount.id, is_active: true }, create: { name: 'VAT 5%', rate_percent: 5, tax_scope: 'sale', tax_account_id: vatAccount.id } })
  const year = new Date().getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1)); const end = new Date(Date.UTC(year, 11, 31))
  const fiscalYear = await prisma.fiscal_years.upsert({ where: { company_id_name: { company_id: company.id, name: String(year) } }, update: { state: 'open' }, create: { company_id: company.id, name: String(year), start_date: start, end_date: end } })
  for (let month = 0; month < 12; month += 1) await prisma.fiscal_periods.upsert({ where: { fiscal_year_id_period_number: { fiscal_year_id: fiscalYear.id, period_number: month + 1 } }, update: { state: 'open' }, create: { fiscal_year_id: fiscalYear.id, name: new Date(Date.UTC(year, month, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' }), period_number: month + 1, start_date: new Date(Date.UTC(year, month, 1)), end_date: new Date(Date.UTC(year, month + 1, 0)) } })
  await prisma.vendors.upsert({ where: { company_id_vendor_code: { company_id: company.id, vendor_code: 'V0001' } }, update: { name: 'Coffee Imports Co.', is_active: true }, create: { company_id: company.id, vendor_code: 'V0001', name: 'Coffee Imports Co.', currency_id: usd.id, payment_term_id: term.id, payable_account_id: accounts['2000'].id } })
}

async function main() {
  console.log('Seeding Ruut Caffe system configuration...')
  // Seed accounting first so essential posting accounts are available even
  // when a high-latency remote database makes menu permission seeding slow.
  await seedAccounting()
  await seedAccess()
  await seedRestaurant()
  console.log('Seed completed. Login: admin@ruutcaffe.com / password123 (override with SEED_ADMIN_* env vars).')
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
