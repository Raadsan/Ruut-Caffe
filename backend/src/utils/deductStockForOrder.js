import prisma from '../config/db.js'

export const deductStockForOrder = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: {
      items: true
    }
  })

  if (!order) throw new Error('Order not found')

  for (const item of order.items) {
    // 1. get BOM
    const bomItems = await prisma.menuItemBOM.findMany({
      where: { menuItemId: item.menuItemId }
    })

    for (const bom of bomItems) {
      const requiredQty = bom.quantityRequired * item.quantity

      const ingredient = await prisma.ingredient.findUnique({
        where: { id: bom.ingredientId }
      })

      if (!ingredient) throw new Error('Ingredient not found')

      if (ingredient.stockQuantity < requiredQty) {
        throw new Error(`Not enough stock for ${ingredient.name}`)
      }

      // 2. update stock
      await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: {
          stockQuantity: ingredient.stockQuantity - requiredQty
        }
      })

      // 3. create stock movement
      await prisma.stockMovement.create({
        data: {
          ingredientId: ingredient.id,
          type: 'out',
          quantity: requiredQty,
          note: `Auto deduction for order #${order.id}`
        }
      })
    }
  }
}