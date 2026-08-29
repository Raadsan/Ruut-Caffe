import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')

  // Clean up existing data (optional but recommended for a fresh start)
  // Ordered to avoid foreign key constraints
  await prisma.orderStatusHistory.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.paymentTransaction.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.menuItemBOM.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.ingredient.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.category.deleteMany()
  await prisma.qrScanLog.deleteMany()
  await prisma.table.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()
  await prisma.setting.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.auditLog.deleteMany()

  console.log('Cleanup complete.')

  // 1. ROLES
  const adminRole = await prisma.role.create({
    data: { name: 'admin', description: 'System Administrator' }
  })
  const managerRole = await prisma.role.create({
    data: { name: 'manager', description: 'Restaurant Manager' }
  })
  const kitchenRole = await prisma.role.create({
    data: { name: 'kitchen', description: 'Kitchen Staff' }
  })
  const waiterRole = await prisma.role.create({
    data: { name: 'waiter', description: 'Wait Staff' }
  })

  console.log('Roles created.')

  // 2. USERS
  const hashedPassword = await bcrypt.hash('password123', 10)

  await prisma.user.createMany({
    data: [
      { fullName: 'Admin User', email: 'admin@restaurant.com', password: hashedPassword, roleId: adminRole.id },
      { fullName: 'Manager User', email: 'manager@restaurant.com', password: hashedPassword, roleId: managerRole.id },
      { fullName: 'Chef Gordon', email: 'kitchen@restaurant.com', password: hashedPassword, roleId: kitchenRole.id },
      { fullName: 'Waiter Sam', email: 'waiter@restaurant.com', password: hashedPassword, roleId: waiterRole.id }
    ]
  })

  console.log('Users created.')

  // 3. TABLES
  await prisma.table.createMany({
    data: [
      { number: 1, name: 'Window Table 1', qrCode: 'T1-SECRET', status: 'active' },
      { number: 2, name: 'Cozy Corner 2', qrCode: 'T2-SECRET', status: 'active' },
      { number: 3, name: 'Family Booth 3', qrCode: 'T3-SECRET', status: 'active' },
      { number: 4, name: 'Patio 4', qrCode: 'T4-SECRET', status: 'active' },
      { number: 5, name: 'Bar Counter 5', qrCode: 'T5-SECRET', status: 'active' }
    ]
  })

  const tables = await prisma.table.findMany()

  console.log('Tables created.')

  // 4. CATEGORIES
  const catStarters = await prisma.category.create({ data: { name: 'Starters' } })
  const catBurgers = await prisma.category.create({ data: { name: 'Burgers' } })
  const catPizza = await prisma.category.create({ data: { name: 'Pizza' } })
  const catDrinks = await prisma.category.create({ data: { name: 'Drinks' } })
  const catDesserts = await prisma.category.create({ data: { name: 'Desserts' } })

  console.log('Categories created.')

  // 5. MENU ITEMS
  const items = [
    { name: 'Spring Rolls', price: 5.50, categoryId: catStarters.id },
    { name: 'Garlic Bread', price: 4.00, categoryId: catStarters.id },
    { name: 'Classic Beef Burger', price: 12.50, categoryId: catBurgers.id },
    { name: 'Cheese Burger', price: 13.50, categoryId: catBurgers.id },
    { name: 'Margherita Pizza', price: 10.00, categoryId: catPizza.id },
    { name: 'Pepperoni Pizza', price: 14.00, categoryId: catPizza.id },
    { name: 'Coca Cola', price: 2.50, categoryId: catDrinks.id },
    { name: 'Fresh Orange Juice', price: 4.50, categoryId: catDrinks.id },
    { name: 'Chocolate Lava Cake', price: 7.00, categoryId: catDesserts.id },
    { name: 'Ice Cream Sundae', price: 6.00, categoryId: catDesserts.id }
  ]

  for (const item of items) {
    await prisma.menuItem.create({ data: item })
  }

  const menuItems = await prisma.menuItem.findMany()

  console.log('Menu items created.')

  // 6. INGREDIENTS
  const ingFlour = await prisma.ingredient.create({ data: { name: 'Flour (kg)', stockQuantity: 50.0 } })
  const ingBeef = await prisma.ingredient.create({ data: { name: 'Beef Patty (units)', stockQuantity: 100.0 } })
  const ingCheese = await prisma.ingredient.create({ data: { name: 'Cheese (kg)', stockQuantity: 20.0 } })
  const ingTomato = await prisma.ingredient.create({ data: { name: 'Tomato Sauce (L)', stockQuantity: 15.0 } })
  const ingBun = await prisma.ingredient.create({ data: { name: 'Burger Bun (units)', stockQuantity: 200.0 } })

  console.log('Ingredients created.')

  // 7. BOM (Bill of Materials)
  // For Classic Beef Burger (id: check by name)
  const burgerItem = menuItems.find(i => i.name === 'Classic Beef Burger')
  if (burgerItem) {
    await prisma.menuItemBOM.createMany({
      data: [
        { menuItemId: burgerItem.id, ingredientId: ingBeef.id, quantity: 1 },
        { menuItemId: burgerItem.id, ingredientId: ingBun.id, quantity: 1 },
        { menuItemId: burgerItem.id, ingredientId: ingCheese.id, quantity: 0.05 }
      ]
    })
  }

  // 8. CUSTOMERS
  const customer1 = await prisma.customer.create({
    data: { fullName: 'John Doe', phone: '1234567890' }
  })
  const customer2 = await prisma.customer.create({
    data: { fullName: 'Jane Smith', phone: '0987654321' }
  })

  console.log('Customers created.')

  // 9. SETTINGS
  await prisma.setting.createMany({
    data: [
      { key: 'restaurant_name', value: 'Raadsan Gourmet' },
      { key: 'currency', value: 'USD' },
      { key: 'tax_rate', value: '0.05' }
    ]
  })

  console.log('Settings created.')

  // 10. SAMPLE ORDERS
  // Order 1: Completed
  const order1 = await prisma.order.create({
    data: {
      tableId: tables[0].id,
      customerId: customer1.id,
      total: 18.00,
      status: 'completed',
      items: {
        create: [
          { menuItemId: menuItems.find(i => i.name === 'Spring Rolls').id, quantity: 1, unitPrice: 5.50 },
          { menuItemId: menuItems.find(i => i.name === 'Classic Beef Burger').id, quantity: 1, unitPrice: 12.50 }
        ]
      },
      payments: {
        create: {
          amount: 18.00,
          status: 'paid',
          method: 'cash'
        }
      },
      logs: {
        create: [
          { status: 'pending' },
          { status: 'preparing' },
          { status: 'ready' },
          { status: 'completed' }
        ]
      }
    }
  })

  // Order 2: Pending
  await prisma.order.create({
    data: {
      tableId: tables[1].id,
      customerId: customer2.id,
      total: 13.50,
      status: 'pending',
      items: {
        create: [
          { menuItemId: menuItems.find(i => i.name === 'Cheese Burger').id, quantity: 1, unitPrice: 13.50 }
        ]
      },
      logs: {
        create: { status: 'pending' }
      }
    }
  })

  console.log('Orders created.')
  console.log('Seed finished successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })