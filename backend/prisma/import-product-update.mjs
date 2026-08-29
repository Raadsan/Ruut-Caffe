import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const rows = JSON.parse(Buffer.concat(chunks).toString('utf8'))

if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error('No product rows were supplied')
}

const products = rows.map((row, index) => {
  const name = String(row.name ?? '').trim()
  const category = String(row.category ?? '').trim()
  const price = Math.round(Number(row.price) * 100) / 100
  const costPrice = Math.round(Number(row.costPrice ?? 0) * 100) / 100

  if (!name || !category || !Number.isFinite(price) || !Number.isFinite(costPrice)) {
    throw new Error(`Invalid product at row ${index + 2}`)
  }

  return { name, category, price, costPrice }
})

const categoryNames = [...new Set(products.map((product) => product.category))]

try {
  const result = await prisma.$transaction(async (tx) => {
    await tx.menuitemcomponent.deleteMany()
    await tx.discountAdvertisementProduct.deleteMany()
    await tx.menuitembom.deleteMany()
    await tx.cartitem.deleteMany()
    await tx.menuitem.deleteMany()
    await tx.category.deleteMany()

    const categoryIds = new Map()
    for (const name of categoryNames) {
      const category = await tx.category.create({ data: { name, isActive: true } })
      categoryIds.set(name, category.id)
    }

    await tx.menuitem.createMany({
      data: products.map((product) => ({
        name: product.name,
        price: product.price,
        costPrice: product.costPrice,
        categoryId: categoryIds.get(product.category),
        isAvailable: true,
      })),
    })

    return {
      categories: await tx.category.count(),
      menuItems: await tx.menuitem.count(),
    }
  }, { timeout: 60000 })

  console.log(JSON.stringify(result))
} finally {
  await prisma.$disconnect()
}
