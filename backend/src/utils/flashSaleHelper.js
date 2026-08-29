export function isCampaignActive(record, now = new Date()) {
  if (!record?.isActive) return false
  if (record.startAt && new Date(record.startAt) > now) return false
  if (record.endAt && new Date(record.endAt) < now) return false
  return true
}

export function computeDiscountedPrice(price, discountPercent) {
  const base = Math.max(0, Number(price) || 0)
  const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0))
  const discounted = base * (1 - pct / 100)
  return Math.round(discounted * 100) / 100
}

export function computeMenuItemDiscount(item) {
  const price = Math.max(0, Number(item.price) || 0)
  const value = Math.max(0, Number(item.discountValue) || 0)
  const type = item.discountType

  if (!type || value <= 0 || price <= 0) return null

  let discountAmount = 0
  let discountPercent = 0

  if (type === 'percentage') {
    discountPercent = Math.min(100, value)
    discountAmount = price * (discountPercent / 100)
  } else if (type === 'fixed') {
    discountAmount = Math.min(price, value)
    discountPercent = Math.round((discountAmount / price) * 100)
  } else {
    return null
  }

  if (discountAmount <= 0) return null

  const salePrice = Math.round((price - discountAmount) * 100) / 100

  return {
    discountPercent,
    originalPrice: price,
    salePrice,
    flashSale: {
      discountPercent,
      discountType: type,
      discountValue: value,
      source: 'menu_item',
    },
  }
}

export function enrichMenuItemWithFlashSale(item) {
  const discount = computeMenuItemDiscount(item)
  if (!discount) {
    return {
      ...item,
      flashSale: null,
      originalPrice: item.price,
      salePrice: item.price,
      discountPercent: null,
    }
  }

  return {
    ...item,
    ...discount,
  }
}

export async function enrichMenuItemsWithFlashSale(items) {
  return items.map((item) => enrichMenuItemWithFlashSale(item))
}

export function getDiscountedMenuItems(items) {
  return items
    .map((item) => enrichMenuItemWithFlashSale(item))
    .filter((item) => item.flashSale != null && item.isAvailable !== false)
}
