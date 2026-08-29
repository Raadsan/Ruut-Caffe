/** Effective unit price after item-level discount (no flash sale). */
export function getItemUnitPrice(item) {
  const price = Math.max(0, Number(item.price) || 0)
  const value = Math.max(0, Number(item.discountValue) || 0)
  const type = item.discountType

  if (!type || value <= 0) return price

  if (type === 'percentage') {
    return Math.max(0, price - price * (Math.min(100, value) / 100))
  }
  if (type === 'fixed') {
    return Math.max(0, price - Math.min(price, value))
  }
  return price
}

export function sumComponentPrices(components) {
  return components.reduce((sum, row) => {
    const unit = getItemUnitPrice(row.componentItem || row)
    const qty = Math.max(1, Number(row.quantity) || 1)
    return sum + unit * qty
  }, 0)
}

export function formatComponentRow(row) {
  const item = row.componentItem
  const unitPrice = getItemUnitPrice(item)
  const qty = Math.max(1, Number(row.quantity) || 1)
  return {
    id: row.id,
    menuItemId: item.id,
    name: item.name,
    quantity: qty,
    unitPrice,
    lineTotal: Math.round(unitPrice * qty * 100) / 100,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable !== false,
  }
}

export function enrichCompositeMenuItem(item, componentRows = []) {
  const components = componentRows.map(formatComponentRow)
  const componentsTotal = Math.round(sumComponentPrices(componentRows) * 100) / 100
  const bundlePrice = Math.max(0, Number(item.price) || 0)
  const effectivePrice = getItemUnitPrice(item)
  const savings =
    item.compositePricing === 'fixed' && componentsTotal > bundlePrice
      ? Math.round((componentsTotal - effectivePrice) * 100) / 100
      : 0

  return {
    ...item,
    isComposite: true,
    components,
    componentsTotal,
    effectivePrice,
    savings,
  }
}

export async function loadCompositeComponents(compositeIds, prisma) {
  if (!compositeIds.length) return new Map()

  const rows = await prisma.menuitemcomponent.findMany({
    where: { compositeItemId: { in: compositeIds } },
    include: {
      componentItem: {
        select: {
          id: true,
          name: true,
          price: true,
          tax: true,
          discountType: true,
          discountValue: true,
          imageUrl: true,
          isAvailable: true,
          isComposite: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  })

  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.compositeItemId)) map.set(row.compositeItemId, [])
    map.get(row.compositeItemId).push(row)
  }
  return map
}

export function attachCompositesToMenuItems(items, componentMap) {
  return items.map((item) => {
    if (!item.isComposite) return item
    const rows = componentMap.get(item.id) || []
    return enrichCompositeMenuItem(item, rows)
  })
}

export function assertMenuItemSellable(menuItem, componentMap) {
  if (!menuItem?.isSellable) return 'Menu item is not enabled for sales'
  if (!menuItem?.isAvailable) {
    return menuItem?.isComposite
      ? `Combo "${menuItem.name}" is not available`
      : 'Menu item not available'
  }
  if (!menuItem.isComposite) return null

  const rows = componentMap.get(menuItem.id) || []
  if (rows.length === 0) {
    return `Combo "${menuItem.name}" has no components configured`
  }
  for (const row of rows) {
    if (!row.componentItem?.isAvailable) {
      return `Combo "${menuItem.name}" unavailable — ${row.componentItem?.name || 'item'} is out of stock`
    }
  }
  return null
}

export function buildOrderLineFromMenuItem(menuItem, quantity) {
  const qty = Math.max(1, Number(quantity) || 1)
  const unitPrice = getItemUnitPrice(menuItem)
  const itemTaxRate = Number(menuItem.tax) || 0
  const itemSubtotal = unitPrice * qty
  const itemTaxAmount = itemSubtotal * (itemTaxRate / 100)

  return {
    orderItem: {
      menuItemId: menuItem.id,
      quantity: qty,
      unitPrice,
      tax: itemTaxRate,
    },
    subtotal: itemSubtotal,
    taxAmount: itemTaxAmount,
  }
}

export async function loadMenuItemsForOrderSale(menuItemIds, prisma) {
  const uniqueIds = [...new Set(menuItemIds.map(Number).filter((id) => id > 0))]
  const items = await prisma.menuitem.findMany({
    where: { id: { in: uniqueIds } },
  })
  const compositeIds = items.filter((item) => item.isComposite).map((item) => item.id)
  const componentMap = await loadCompositeComponents(compositeIds, prisma)
  const itemMap = new Map(items.map((item) => [item.id, item]))
  return { itemMap, componentMap }
}

export async function buildOrderItemsPayload(items, prisma, { allowOverrides = false } = {}) {
  const menuItemIds = items.map((item) => Number(item.menuItemId))
  const { itemMap, componentMap } = await loadMenuItemsForOrderSale(menuItemIds, prisma)

  let subTotal = 0
  let taxAmount = 0
  const orderItemsData = []

  for (const item of items) {
    const menuItem = itemMap.get(Number(item.menuItemId))
    const sellError = assertMenuItemSellable(menuItem, componentMap)
    if (sellError) {
      return { error: sellError }
    }

    const line = buildOrderLineFromMenuItem(menuItem, item.quantity)
    if (allowOverrides) {
      const qty = line.orderItem.quantity
      const requestedRate = Number(item.unitPrice)
      const requestedTax = Number(item.tax)
      const requestedDiscount = Number(item.discountAmount)
      const rate = Number.isFinite(requestedRate) && requestedRate >= 0
        ? requestedRate
        : line.orderItem.unitPrice
      const tax = Number.isFinite(requestedTax)
        ? Math.min(100, Math.max(0, requestedTax))
        : line.orderItem.tax
      const gross = rate * qty
      const lineDiscount = Number.isFinite(requestedDiscount)
        ? Math.min(gross, Math.max(0, requestedDiscount))
        : 0
      const effectiveUnitPrice = qty > 0 ? (gross - lineDiscount) / qty : 0
      line.orderItem.unitPrice = effectiveUnitPrice
      line.orderItem.tax = tax
      line.subtotal = effectiveUnitPrice * qty
      line.taxAmount = line.subtotal * (tax / 100)
    }
    subTotal += line.subtotal
    taxAmount += line.taxAmount
    orderItemsData.push(line.orderItem)
  }

  // Keep the legacy flat VAT outside POS; POS sends each edited line's tax rate.
  if (!allowOverrides) taxAmount = subTotal * 0.05

  return { subTotal, taxAmount, orderItemsData }
}
