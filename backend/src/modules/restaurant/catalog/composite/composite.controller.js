import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'
import { emitMenuChanged } from '../../../../utils/emitMenuChanged.js'
import { invalidatePosMenuCatalogCache } from '../menuItem/menuItem.controller.js'
import { persistMenuImageUrl } from '../../../../utils/menuImageStorage.js'
import {
  enrichCompositeMenuItem,
  getItemUnitPrice,
  sumComponentPrices,
} from '../../../../utils/compositeMenuHelper.js'

const compositeInclude = {
  category: { select: { id: true, name: true } },
  compositeComponents: {
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
  },
}

function normalizeComponentsInput(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const list = raw
    .map((row) => ({
      menuItemId: Number(row.menuItemId ?? row.componentItemId ?? row.id),
      quantity: Math.max(1, Number(row.quantity) || 1),
    }))
    .filter((row) => Number.isFinite(row.menuItemId) && row.menuItemId > 0)
  return list.length ? list : null
}

function normalizeDiscountInput(discountType, discountValue, price) {
  const value = Math.max(0, Number(discountValue) || 0)
  const basePrice = Math.max(0, Number(price) || 0)
  if (!value || !discountType) return { discountType: null, discountValue: 0 }
  if (discountType === 'percentage') {
    return { discountType: 'percentage', discountValue: Math.min(100, value) }
  }
  if (discountType === 'fixed') {
    return { discountType: 'fixed', discountValue: Math.min(basePrice, value) }
  }
  return { discountType: null, discountValue: 0 }
}

async function loadComponentItems(componentList) {
  const ids = [...new Set(componentList.map((c) => c.menuItemId))]
  if (!ids.length) return new Map()
  const items = await prisma.menuitem.findMany({
    where: { id: { in: ids } },
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
  })
  return new Map(items.map((i) => [i.id, i]))
}

async function prepareComponents(compositeId, componentList, compositePricing, manualPrice) {
  const itemsById = await loadComponentItems(componentList)

  for (const comp of componentList) {
    const item = itemsById.get(comp.menuItemId)
    if (!item) {
      return { ok: false, message: `Menu item #${comp.menuItemId} not found` }
    }
    if (item.isComposite) {
      return { ok: false, message: `"${item.name}" is already a combo — use simple items only` }
    }
    if (compositeId && comp.menuItemId === compositeId) {
      return { ok: false, message: 'A combo cannot include itself' }
    }
  }

  const pricedRows = componentList.map((c) => ({
    quantity: c.quantity,
    componentItem: itemsById.get(c.menuItemId),
  }))
  const sumTotal = sumComponentPrices(pricedRows)
  const resolvedPrice =
    compositePricing === 'sum'
      ? Math.round(sumTotal * 100) / 100
      : Math.max(0, Number(manualPrice) || 0)

  return { ok: true, itemsById, resolvedPrice, pricedRows }
}

function formatCompositeFromParts(item, pricedRows) {
  return enrichCompositeMenuItem(item, pricedRows)
}

const compositeCreateSelect = {
  id: true,
  name: true,
  description: true,
  categoryId: true,
  price: true,
  tax: true,
  discountType: true,
  discountValue: true,
  isAvailable: true,
  isRecommended: true,
  isComposite: true,
  compositePricing: true,
  imageUrl: true,
}

function scheduleCompositeImagePersist(imageUrl, itemId) {
  if (!imageUrl?.startsWith('data:')) return
  void (async () => {
    try {
      const persisted = await persistMenuImageUrl(imageUrl, itemId)
      if (persisted) {
        await prisma.menuitem.update({
          where: { id: itemId },
          data: { imageUrl: persisted },
        })
        invalidateCompositeRelatedCaches()
      }
    } catch (err) {
      console.error(`Background combo image migrate #${itemId}:`, err.message)
    }
  })()
}

function formatCompositeResponse(item) {
  return enrichCompositeMenuItem(item, item.compositeComponents || [])
}

const compositesCache = { data: null, at: 0 }
let compositesInflight = null
const COMPOSITES_TTL_MS = 5 * 60 * 1000

export function invalidateCompositesCache() {
  compositesCache.data = null
  compositesCache.at = 0
  compositesInflight = null
}

async function loadAllCompositesFromDb() {
  const items = await prisma.menuitem.findMany({
    where: { isComposite: true },
    include: compositeInclude,
    orderBy: { id: 'desc' },
  })
  return items.map(formatCompositeResponse)
}

export async function warmCompositesCache() {
  if (compositesCache.data && Date.now() - compositesCache.at < COMPOSITES_TTL_MS) {
    return compositesCache.data
  }
  if (compositesInflight) return compositesInflight
  compositesInflight = loadAllCompositesFromDb()
    .then((data) => {
      compositesCache.data = data
      compositesCache.at = Date.now()
      compositesInflight = null
      return data
    })
    .catch((err) => {
      compositesInflight = null
      throw err
    })
  return compositesInflight
}

function invalidateCompositeRelatedCaches() {
  invalidateCompositesCache()
  invalidateComboFormCache()
  invalidatePosMenuCatalogCache()
}

const comboFormCache = { data: null, at: 0 }
let comboFormInflight = null
const COMBO_FORM_TTL_MS = 5 * 60 * 1000

export function invalidateComboFormCache() {
  comboFormCache.data = null
  comboFormCache.at = 0
  comboFormInflight = null
}

async function loadComboFormDataFromDb() {
  const [categories, menuItems] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: { not: false } },
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.menuitem.findMany({
      where: { isComposite: false },
      select: {
        id: true,
        name: true,
        categoryId: true,
        price: true,
        tax: true,
        discountType: true,
        discountValue: true,
        isAvailable: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])
  return { categories, menuItems }
}

export async function warmComboFormCache() {
  if (comboFormCache.data && Date.now() - comboFormCache.at < COMBO_FORM_TTL_MS) {
    return comboFormCache.data
  }
  if (comboFormInflight) return comboFormInflight
  comboFormInflight = loadComboFormDataFromDb()
    .then((data) => {
      comboFormCache.data = data
      comboFormCache.at = Date.now()
      comboFormInflight = null
      return data
    })
    .catch((err) => {
      comboFormInflight = null
      throw err
    })
  return comboFormInflight
}

export const getComboFormData = async (req, res) => {
  try {
    const fresh = req.query.fresh === '1' || req.query.fresh === 'true'
    const now = Date.now()

    if (!fresh && comboFormCache.data && now - comboFormCache.at < COMBO_FORM_TTL_MS) {
      return res.status(200).json({ success: true, data: comboFormCache.data })
    }

    if (comboFormInflight) {
      const data = await comboFormInflight
      return res.status(200).json({ success: true, data })
    }

    comboFormInflight = loadComboFormDataFromDb()
      .then((data) => {
        comboFormCache.data = data
        comboFormCache.at = Date.now()
        comboFormInflight = null
        return data
      })
      .catch((err) => {
        comboFormInflight = null
        throw err
      })

    const data = await comboFormInflight
    res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('Get Combo Form Data Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getAllComposites = async (req, res) => {
  try {
    const fresh = req.query.fresh === '1' || req.query.fresh === 'true'
    const now = Date.now()

    if (!fresh && compositesCache.data && now - compositesCache.at < COMPOSITES_TTL_MS) {
      return res.status(200).json({
        success: true,
        count: compositesCache.data.length,
        data: compositesCache.data,
      })
    }

    if (compositesInflight) {
      const data = await compositesInflight
      return res.status(200).json({
        success: true,
        count: data.length,
        data,
      })
    }

    compositesInflight = loadAllCompositesFromDb()
      .then((data) => {
        compositesCache.data = data
        compositesCache.at = Date.now()
        compositesInflight = null
        return data
      })
      .catch((err) => {
        compositesInflight = null
        throw err
      })

    const data = await compositesInflight

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    })
  } catch (error) {
    console.error('Get Composites Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getCompositeById = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const item = await prisma.menuitem.findFirst({
      where: { id, isComposite: true },
      include: compositeInclude,
    })
    if (!item) {
      return res.status(404).json({ success: false, message: 'Combo not found' })
    }
    res.status(200).json({ success: true, data: formatCompositeResponse(item) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const createComposite = async (req, res) => {
  try {
    const {
      name,
      description,
      categoryId,
      imageUrl,
      tax,
      isAvailable,
      isRecommended,
      compositePricing,
      price,
      discountType,
      discountValue,
      components,
    } = req.body

    const componentList = normalizeComponentsInput(components)
    if (!name?.trim() || !categoryId || !componentList) {
      return res.status(400).json({
        success: false,
        message: 'name, categoryId, and at least one component are required',
      })
    }

    const pricingMode = compositePricing === 'sum' ? 'sum' : 'fixed'
    const prepared = await prepareComponents(null, componentList, pricingMode, price)
    if (!prepared.ok) {
      return res.status(400).json({ success: false, message: prepared.message })
    }

    const { resolvedPrice, pricedRows } = prepared
    if (pricingMode === 'fixed' && resolvedPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Bundle price is required for fixed pricing',
      })
    }

    const discount = normalizeDiscountInput(discountType, discountValue, resolvedPrice)

    const saved = await prisma.menuitem.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        categoryId: Number(categoryId),
        price: resolvedPrice,
        tax: tax !== undefined ? Number(tax) : 0,
        discountType: discount.discountType,
        discountValue: discount.discountValue,
        isAvailable: typeof isAvailable === 'boolean' ? isAvailable : true,
        isRecommended: typeof isRecommended === 'boolean' ? isRecommended : false,
        isComposite: true,
        compositePricing: pricingMode,
        imageUrl:
          typeof imageUrl === 'string' && !imageUrl.startsWith('data:') ? imageUrl : null,
        compositeComponents: {
          create: componentList.map((c) => ({
            componentItemId: c.menuItemId,
            quantity: c.quantity,
          })),
        },
      },
      select: compositeCreateSelect,
    })

    void logAudit({
      userId: req.user?.id,
      action: 'Created',
      entity: 'CompositeMenuItem',
      entityId: saved.id,
      description: `Created combo "${saved.name}"`,
    })
    invalidateCompositeRelatedCaches()
    emitMenuChanged({ action: 'create', id: saved.id })
    scheduleCompositeImagePersist(imageUrl, saved.id)

    const data = formatCompositeFromParts(saved, pricedRows)
    res.status(201).json({ success: true, data })
  } catch (error) {
    console.error('Create Composite Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const updateComposite = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.menuitem.findFirst({
      where: { id, isComposite: true },
      include: { compositeComponents: true },
    })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Combo not found' })
    }

    const {
      name,
      description,
      categoryId,
      imageUrl,
      tax,
      isAvailable,
      isRecommended,
      compositePricing,
      price,
      discountType,
      discountValue,
      components,
    } = req.body

    const pricingMode =
      compositePricing === 'sum' ? 'sum' : compositePricing === 'fixed' ? 'fixed' : existing.compositePricing

    let componentList = existing.compositeComponents.map((c) => ({
      menuItemId: c.componentItemId,
      quantity: c.quantity,
    }))
    if (components !== undefined) {
      const parsed = normalizeComponentsInput(components)
      if (!parsed) {
        return res.status(400).json({ success: false, message: 'At least one component is required' })
      }
      componentList = parsed
    }

    const prepared = await prepareComponents(
      id,
      componentList,
      pricingMode,
      price !== undefined ? price : existing.price
    )
    if (!prepared.ok) {
      return res.status(400).json({ success: false, message: prepared.message })
    }

    const { resolvedPrice, pricedRows } = prepared
    const discount = normalizeDiscountInput(
      discountType !== undefined ? discountType : existing.discountType,
      discountValue !== undefined ? discountValue : existing.discountValue,
      resolvedPrice
    )

    const saved = await prisma.$transaction(async (tx) => {
      await tx.menuitemcomponent.deleteMany({ where: { compositeItemId: id } })
      return tx.menuitem.update({
        where: { id },
        data: {
          name: name?.trim() ?? existing.name,
          description: description !== undefined ? description?.trim() || null : existing.description,
          categoryId: categoryId !== undefined ? Number(categoryId) : existing.categoryId,
          price: resolvedPrice,
          tax: tax !== undefined ? Number(tax) : existing.tax,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          isAvailable: typeof isAvailable === 'boolean' ? isAvailable : existing.isAvailable,
          isRecommended: typeof isRecommended === 'boolean' ? isRecommended : existing.isRecommended,
          compositePricing: pricingMode,
          ...(imageUrl !== undefined && !imageUrl?.startsWith('data:')
            ? { imageUrl: imageUrl || null }
            : {}),
          compositeComponents: {
            create: componentList.map((c) => ({
              componentItemId: c.menuItemId,
              quantity: c.quantity,
            })),
          },
        },
        select: compositeCreateSelect,
      })
    })

    void logAudit({
      userId: req.user?.id,
      action: 'Updated',
      entity: 'CompositeMenuItem',
      entityId: saved.id,
      description: `Updated combo "${saved.name}"`,
    })
    invalidateCompositeRelatedCaches()
    emitMenuChanged({ action: 'update', id: saved.id })
    if (imageUrl?.startsWith('data:')) scheduleCompositeImagePersist(imageUrl, id)

    res.status(200).json({
      success: true,
      data: formatCompositeFromParts(saved, pricedRows),
    })
  } catch (error) {
    console.error('Update Composite Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

export const deleteComposite = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const existing = await prisma.menuitem.findFirst({
      where: { id, isComposite: true },
    })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Combo not found' })
    }

    // Preserve historical order lines; archive ordered combos and hard-delete unused ones.
    const orderReferences = await prisma.orderitem.count({ where: { menuItemId: id } })
    if (orderReferences > 0) {
      await prisma.menuitem.update({ where: { id }, data: { isAvailable: false, isComposite: false } })
    } else {
      await prisma.menuitem.delete({ where: { id } })
    }

    void logAudit({
      userId: req.user?.id,
      action: 'Deleted',
      entity: 'CompositeMenuItem',
      entityId: id,
      description: `Deleted combo "${existing.name}"`,
    })
    invalidateCompositeRelatedCaches()
    emitMenuChanged({ action: 'delete', id })

    res.status(200).json({ success: true, message: 'Combo deleted' })
  } catch (error) {
    console.error('Delete Composite Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

/** Recalculate sum-priced combos when a component item price changes. */
export async function refreshSumPricedCompositesForItem(menuItemId) {
  const links = await prisma.menuitemcomponent.findMany({
    where: { componentItemId: menuItemId },
    select: { compositeItemId: true },
  })
  const compositeIds = [...new Set(links.map((l) => l.compositeItemId))]
  if (!compositeIds.length) return

  for (const compositeId of compositeIds) {
    const composite = await prisma.menuitem.findUnique({
      where: { id: compositeId },
      include: { compositeComponents: { include: { componentItem: true } } },
    })
    if (!composite?.isComposite || composite.compositePricing !== 'sum') continue

    const newPrice = Math.round(sumComponentPrices(composite.compositeComponents) * 100) / 100
    if (newPrice !== composite.price) {
      await prisma.menuitem.update({
        where: { id: compositeId },
        data: { price: newPrice },
      })
    }
  }
  invalidateCompositeRelatedCaches()
}

export { getItemUnitPrice }
