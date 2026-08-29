import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'
import { emitMenuChanged } from '../../../../utils/emitMenuChanged.js'
import { enrichMenuItemsWithFlashSale } from '../../../../utils/flashSaleHelper.js'
import {
  persistMenuImageUrl,
  deleteMenuImageFile,
  getApiPublicOrigin,
  sanitizeMenuImageUrlForPos,
  toAbsoluteMenuImageUrl,
} from '../../../../utils/menuImageStorage.js'
import {
  loadCompositeComponents,
  attachCompositesToMenuItems,
} from '../../../../utils/compositeMenuHelper.js'
import { refreshSumPricedCompositesForItem, invalidateComboFormCache } from '../composite/composite.controller.js'
import { syncAccountingProduct } from '../../../../utils/accountingProductSync.js'

const posCatalogCache = { data: null, at: 0 }
const POS_CATALOG_TTL_MS = 5 * 60 * 1000

const allMenuItemsCache = { data: null, at: 0 }
let allMenuItemsInflight = null
const ALL_MENU_ITEMS_TTL_MS = 5 * 60 * 1000

function scheduleBase64MenuImageMigration(items) {
  void (async () => {
    for (const item of items) {
      if (!item.imageUrl?.startsWith('data:')) continue
      try {
        const persisted = await persistMenuImageUrl(item.imageUrl, item.id)
        if (persisted) {
          await prisma.menuitem.update({
            where: { id: item.id },
            data: { imageUrl: persisted },
          })
          invalidateAllMenuItemCaches()
        }
      } catch (err) {
        console.error(`Background menu image migrate #${item.id}:`, err.message)
      }
    }
  })()
}

function mapMenuItemsForApi(items, origin) {
  return items.map((item) => {
    const path = sanitizeMenuImageUrlForPos(item.imageUrl)
    const imageUrl = toAbsoluteMenuImageUrl(path, origin)
    return { ...item, imageUrl }
  })
}

async function loadAllMenuItemsFromDb(origin) {
  const items = await prisma.menuitem.findMany({
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
    orderBy: { id: 'asc' },
  })

  scheduleBase64MenuImageMigration(items)

  const withImages = mapMenuItemsForApi(items, origin)
  return enrichMenuItemsWithFlashSale(withImages)
}

export function invalidateAllMenuItemCaches() {
  posCatalogCache.data = null
  posCatalogCache.at = 0
  allMenuItemsCache.data = null
  allMenuItemsCache.at = 0
  allMenuItemsInflight = null
  invalidateComboFormCache()
  void import('../category/category.controller.js')
    .then((m) => m.clearCategoryListCache())
    .catch(() => {})
}

export async function warmAllMenuItemsCache(origin = 'http://127.0.0.1:2005') {
  if (allMenuItemsCache.data && Date.now() - allMenuItemsCache.at < ALL_MENU_ITEMS_TTL_MS) {
    return allMenuItemsCache.data
  }
  if (allMenuItemsInflight) return allMenuItemsInflight
  allMenuItemsInflight = loadAllMenuItemsFromDb(origin)
    .then((data) => {
      allMenuItemsCache.data = data
      allMenuItemsCache.at = Date.now()
      allMenuItemsInflight = null
      return data
    })
    .catch((err) => {
      allMenuItemsInflight = null
      throw err
    })
  return allMenuItemsInflight
}

function normalizeDiscountInput(discountType, discountValue, price) {
  const value = Math.max(0, Number(discountValue) || 0)
  const basePrice = Math.max(0, Number(price) || 0)

  if (!value || !discountType) {
    return { discountType: null, discountValue: 0 }
  }

  const type =
    discountType === 'fixed'
      ? 'fixed'
      : discountType === 'percentage'
        ? 'percentage'
        : null

  if (!type) {
    return { discountType: null, discountValue: 0 }
  }

  if (type === 'percentage') {
    return { discountType: type, discountValue: Math.min(100, value) }
  }

  return { discountType: type, discountValue: Math.min(basePrice, value) }
}

function normalizeOptionsInput(raw) {
  if (raw === undefined) return undefined
  if (raw === null || raw === '') return null
  if (Array.isArray(raw)) {
    const list = raw.map(String).map(s => s.trim()).filter(Boolean)
    return list.length ? list : null
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const list = parsed.map(String).map(s => s.trim()).filter(Boolean)
        return list.length ? list : null
      }
    } catch {
      const list = raw.split(',').map(s => s.trim()).filter(Boolean)
      return list.length ? list : null
    }
  }
  return null
}

// CREATE MENU ITEM
export const createMenuItem = async (req, res) => {
  try {
    const { name, description, costPrice, price, tax, imageUrl, categoryId, isAvailable, isSellable, isPurchasable, isRecommended, options, discountType, discountValue } = req.body

    if (!name || price === undefined || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'name, price, and categoryId are required'
      })
    }

    const cat = await prisma.category.findUnique({
      where: { id: Number(categoryId) }
    })

    if (!cat) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    const parsedPrice = Number(price)
    const discount = normalizeDiscountInput(discountType, discountValue, parsedPrice)

    const item = await prisma.menuitem.create({
      data: {
        name: name.trim(),
        description: description?.trim() ? description.trim() : null,
        costPrice: costPrice !== undefined ? Number(costPrice) : null,
        price: parsedPrice,
        tax: tax !== undefined ? Number(tax) : 5,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        imageUrl: null,
        categoryId: Number(categoryId),
        isAvailable: typeof isAvailable === 'boolean' ? isAvailable : true,
        isSellable: typeof isSellable === 'boolean' ? isSellable : true,
        isPurchasable: typeof isPurchasable === 'boolean' ? isPurchasable : false,
        isRecommended: typeof isRecommended === 'boolean' ? isRecommended : false,
        options: normalizeOptionsInput(options),
      },
      include: {
        category: true
      }
    })

    let savedItem = item
    if (imageUrl) {
      const persisted = await persistMenuImageUrl(imageUrl, item.id)
      const nextUrl =
        persisted ||
        (typeof imageUrl === 'string' && !imageUrl.startsWith('data:') ? imageUrl : null)
      if (nextUrl) {
        savedItem = await prisma.menuitem.update({
          where: { id: item.id },
          data: { imageUrl: nextUrl },
          include: { category: true },
        })
      }
    }

    await syncAccountingProduct(savedItem)
    logAudit({ userId: req.user?.id, action: 'Created', entity: 'MenuItem', entityId: savedItem.id, description: `Created menu item "${savedItem.name}"` })
    invalidatePosMenuCatalogCache()
    emitMenuChanged({ action: 'create', id: savedItem.id })

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: mapMenuItemsForApi([savedItem], getApiPublicOrigin(req))[0]
    })
  } catch (error) {
    console.error('Create MenuItem Error:', error)

    if (error.code === 'P2000' && error.meta?.column_name === 'imageUrl') {
      return res.status(400).json({
        success: false,
        message: 'Image is too large. Use a smaller image (under 1MB recommended).',
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create menu item',
      error: error.message
    })
  }
}

// GET POS MENU CATALOG — absolute image URLs on every fresh load
export const getPosMenuCatalog = async (req, res) => {
  try {
    const fresh = req.query.fresh === '1' || req.query.fresh === 'true'
    const now = Date.now()
    if (!fresh && posCatalogCache.data && now - posCatalogCache.at < POS_CATALOG_TTL_MS) {
      return res.status(200).json({
        success: true,
        count: posCatalogCache.data.length,
        data: posCatalogCache.data,
      })
    }

    const origin = getApiPublicOrigin(req)

    const items = await prisma.menuitem.findMany({
      where: { isAvailable: true, isSellable: true },
      select: {
        id: true,
        name: true,
        price: true,
        tax: true,
        discountType: true,
        discountValue: true,
        isAvailable: true,
        isSellable: true,
        isPurchasable: true,
        isRecommended: true,
        categoryId: true,
        options: true,
        imageUrl: true,
        isComposite: true,
        compositePricing: true,
      },
      orderBy: { id: 'asc' },
    })

    const slim = items.map((item) => {
      const path = sanitizeMenuImageUrlForPos(item.imageUrl)
      const imageUrl = toAbsoluteMenuImageUrl(path, origin)
      return { ...item, imageUrl }
    })

    scheduleBase64MenuImageMigration(items)

    const enriched = await enrichMenuItemsWithFlashSale(slim)
    const compositeIds = enriched.filter((i) => i.isComposite).map((i) => i.id)
    const componentMap = await loadCompositeComponents(compositeIds, prisma)
    const withComposites = attachCompositesToMenuItems(enriched, componentMap)
    posCatalogCache.data = withComposites
    posCatalogCache.at = now

    res.status(200).json({
      success: true,
      count: withComposites.length,
      data: withComposites,
    })
  } catch (error) {
    console.error('Get POS Menu Catalog Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch POS menu catalog',
      error: error.message,
    })
  }
}

export const invalidatePosMenuCatalogCache = invalidateAllMenuItemCaches

// GET ALL MENU ITEMS
export const getAllMenuItems = async (req, res) => {
  try {
    const origin = getApiPublicOrigin(req)
    const fresh = req.query.fresh === '1' || req.query.fresh === 'true'
    const now = Date.now()

    if (
      !fresh &&
      allMenuItemsCache.data &&
      now - allMenuItemsCache.at < ALL_MENU_ITEMS_TTL_MS
    ) {
      return res.status(200).json({
        success: true,
        count: allMenuItemsCache.data.length,
        data: allMenuItemsCache.data,
      })
    }

    if (allMenuItemsInflight) {
      const data = await allMenuItemsInflight
      return res.status(200).json({
        success: true,
        count: data.length,
        data,
      })
    }

    allMenuItemsInflight = loadAllMenuItemsFromDb(origin)
      .then((data) => {
        allMenuItemsCache.data = data
        allMenuItemsCache.at = Date.now()
        allMenuItemsInflight = null
        return data
      })
      .catch((err) => {
        allMenuItemsInflight = null
        throw err
      })

    const data = await allMenuItemsInflight

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    })
  } catch (error) {
    console.error('Get MenuItems Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu items',
      error: error.message,
    })
  }
}

// GET MENU ITEMS BY CATEGORY
export const getMenuItemsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params

    const items = await prisma.menuitem.findMany({
      where: { categoryId: Number(categoryId) },
      include: {
        category: { select: { id: true, name: true } }
      },
      orderBy: { id: 'asc' }
    })

    const enriched = await enrichMenuItemsWithFlashSale(items)

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    })
  } catch (error) {
    console.error('Get MenuItems By Category Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu items by category',
      error: error.message
    })
  }
}

// UPDATE MENU ITEM
export const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, costPrice, price, tax, imageUrl, categoryId, isAvailable, isSellable, isPurchasable, isRecommended, options, discountType, discountValue } = req.body

    const itemId = Number(id)
    if (isNaN(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid menu item id' })
    }

    const existing = await prisma.menuitem.findUnique({ where: { id: itemId } })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Menu item not found' })
    }

    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: Number(categoryId) } })
      if (!cat) {
        return res.status(404).json({ success: false, message: 'Category not found' })
      }
    }

    const nextPrice = price !== undefined ? Number(price) : existing.price
    const nextDiscountType =
      discountType !== undefined ? discountType : existing.discountType
    const nextDiscountValue =
      discountValue !== undefined ? discountValue : existing.discountValue
    const discount = normalizeDiscountInput(
      nextDiscountType,
      nextDiscountValue,
      nextPrice
    )

    let nextImageUrl = existing.imageUrl
    if (imageUrl !== undefined) {
      if (!imageUrl) {
        await deleteMenuImageFile(existing.imageUrl)
        nextImageUrl = null
      } else if (imageUrl.startsWith('data:')) {
        const persisted = await persistMenuImageUrl(imageUrl, itemId)
        if (persisted) {
          if (
            existing.imageUrl &&
            existing.imageUrl !== persisted
          ) {
            await deleteMenuImageFile(existing.imageUrl)
          }
          nextImageUrl = persisted
        }
      } else {
        if (
          existing.imageUrl &&
          existing.imageUrl !== imageUrl
        ) {
          await deleteMenuImageFile(existing.imageUrl)
        }
        nextImageUrl = imageUrl
      }
    }

    const updated = await prisma.menuitem.update({
      where: { id: itemId },
      data: {
        name: name ?? existing.name,
        description:
          description !== undefined
            ? description?.trim()
              ? description.trim()
              : null
            : existing.description,
        costPrice: costPrice !== undefined ? Number(costPrice) : existing.costPrice,
        price: nextPrice,
        tax: tax !== undefined ? Number(tax) : existing.tax,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        imageUrl: nextImageUrl,
        categoryId: categoryId ? Number(categoryId) : existing.categoryId,
        isAvailable: typeof isAvailable === 'boolean' ? isAvailable : existing.isAvailable,
        isSellable: typeof isSellable === 'boolean' ? isSellable : existing.isSellable,
        isPurchasable: typeof isPurchasable === 'boolean' ? isPurchasable : existing.isPurchasable,
        isRecommended: typeof isRecommended === 'boolean' ? isRecommended : (existing.isRecommended ?? false),
        ...(options !== undefined ? { options: normalizeOptionsInput(options) } : {}),
      },
      include: {
        category: { select: { id: true, name: true } }
      }
    })

    await syncAccountingProduct(updated)
    logAudit({ userId: req.user?.id, action: 'Updated', entity: 'MenuItem', entityId: updated.id, description: `Updated menu item "${updated.name}"` })
    invalidatePosMenuCatalogCache()
    emitMenuChanged({ action: 'update', id: updated.id })
    if (!updated.isComposite) {
      void refreshSumPricedCompositesForItem(updated.id)
    }

    return res.status(200).json({
      success: true,
      message: 'Menu item updated successfully',
      data: mapMenuItemsForApi([updated], getApiPublicOrigin(req))[0]
    })
  } catch (error) {
    console.error('Update MenuItem Error:', error)

    if (error.code === 'P2000' && error.meta?.column_name === 'imageUrl') {
      return res.status(400).json({
        success: false,
        message: 'Image is too large. Use a smaller image (under 1MB recommended).',
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update menu item',
      error: error.message
    })
  }
}

// DELETE MENU ITEM
export const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params
    const itemId = Number(id)

    if (isNaN(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid menu item id' })
    }

    const existing = await prisma.menuitem.findUnique({ where: { id: itemId } })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Menu item not found' })
    }

    await deleteMenuImageFile(existing.imageUrl)
    await prisma.menuitem.delete({ where: { id: itemId } })

    logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'MenuItem', entityId: itemId, description: `Deleted menu item "${existing.name}"` })
    invalidatePosMenuCatalogCache()
    emitMenuChanged({ action: 'delete', id: itemId })

    return res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully'
    })
  } catch (error) {
    console.error('Delete MenuItem Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete menu item',
      error: error.message
    })
  }
}

// GET PUBLIC MENU BY QR CODE
export const getPublicMenuByQrCode = async (req, res) => {
  try {
    const { qrCode } = req.params

    const table = await prisma.table.findUnique({
      where: { qrCode },
    })

    if (!table) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code or table not found'
      })
    }

    const origin = getApiPublicOrigin(req)

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        menuitem: {
          where: { isAvailable: true, isSellable: true },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    })

    const categoriesWithImages = await Promise.all(
      categories.map(async (cat) => {
        const menuitem = await Promise.all(
          cat.menuitem.map(async (item) => {
            const path = sanitizeMenuImageUrlForPos(item.imageUrl)
            const imageUrl = toAbsoluteMenuImageUrl(path, origin)
            return { ...item, imageUrl }
          })
        )
        return { ...cat, menuitem }
      })
    )

    const allItems = categoriesWithImages.flatMap((c) => c.menuitem)
    const compositeIds = allItems.filter((i) => i.isComposite).map((i) => i.id)
    const componentMap = await loadCompositeComponents(compositeIds, prisma)

    const categoriesWithComposites = categoriesWithImages.map((cat) => ({
      ...cat,
      menuitem: attachCompositesToMenuItems(cat.menuitem, componentMap),
    }))

    res.status(200).json({
      success: true,
      data: {
        table,
        categories: categoriesWithComposites,
      }
    })
  } catch (error) {
    console.error('Get Public Menu Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public menu',
      error: error.message
    })
  }
}
