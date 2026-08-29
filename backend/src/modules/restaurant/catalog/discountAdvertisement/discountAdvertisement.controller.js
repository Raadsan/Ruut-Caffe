import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'
import { ensureDiscountAdvertisementMenuItem } from '../menu/menu.controller.js'
import {
  isCampaignActive,
  enrichMenuItemsWithFlashSale,
  computeDiscountedPrice,
  getDiscountedMenuItems,
} from '../../../../utils/flashSaleHelper.js'

const VALID_TYPES = ['advertisement']

const includeProducts = {
  products: {
    include: {
      menuitem: {
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          isAvailable: true,
          categoryId: true,
        },
      },
    },
  },
}

function parseDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`)
  }
  return date
}

function validatePngImage(imageUrl) {
  if (!imageUrl) return false
  const value = String(imageUrl).trim()
  if (value.startsWith('data:image/png')) return true
  if (/\.png(\?.*)?$/i.test(value)) return true
  return false
}

function normalizeType(type) {
  const value = String(type || '').trim().toLowerCase()
  if (!VALID_TYPES.includes(value)) return null
  return value
}

function validatePayload(body, { isUpdate = false } = {}) {
  const type = body.type !== undefined ? normalizeType(body.type) : undefined
  const title = body.title !== undefined ? String(body.title || '').trim() : undefined
  const description =
    body.description !== undefined
      ? body.description
        ? String(body.description).trim()
        : null
      : undefined
  const imageUrl = body.imageUrl !== undefined ? body.imageUrl || null : undefined
  const url = body.url !== undefined ? (body.url ? String(body.url).trim() : null) : undefined
  const discountPercent =
    body.discountPercent !== undefined ? Number(body.discountPercent) : undefined
  const isActive = body.isActive !== undefined ? !!body.isActive : undefined
  const menuItemIds = body.menuItemIds

  let startAt
  let endAt

  if (body.startAt !== undefined) {
    startAt = parseDate(body.startAt, 'startAt')
  }
  if (body.endAt !== undefined) {
    endAt = parseDate(body.endAt, 'endAt')
  }

  if (startAt && endAt && startAt > endAt) {
    throw new Error('startAt must be before endAt')
  }

  return {
    type,
    title,
    description,
    imageUrl,
    url,
    discountPercent,
    startAt,
    endAt,
    isActive,
    menuItemIds,
    isUpdate,
  }
}

function assertCreateRules(payload) {
  if (!payload.type) {
    throw new Error('type is required (advertisement)')
  }

  if (payload.type !== 'advertisement') {
    throw new Error('Only advertisement campaigns are supported. Set product discounts on Menu Items.')
  }

  if (!payload.title) throw new Error('title is required for advertisement')
  if (!payload.imageUrl) throw new Error('image is required for advertisement')
  if (!validatePngImage(payload.imageUrl)) {
    throw new Error('Advertisement image must be PNG format')
  }
}

async function syncProducts(campaignId, menuItemIds) {
  const ids = [...new Set(menuItemIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)))]

  if (!ids.length) {
    throw new Error('Select at least one product for discount')
  }

  const existingItems = await prisma.menuitem.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })

  if (existingItems.length !== ids.length) {
    throw new Error('One or more selected products were not found')
  }

  await prisma.discountAdvertisementProduct.deleteMany({
    where: { discountAdvertisementId: campaignId },
  })

  await prisma.discountAdvertisementProduct.createMany({
    data: ids.map((menuItemId) => ({
      discountAdvertisementId: campaignId,
      menuItemId,
    })),
  })
}

export const createDiscountAdvertisement = async (req, res) => {
  try {
    await ensureDiscountAdvertisementMenuItem()

    const payload = validatePayload(req.body)
    payload.type = 'advertisement'
    assertCreateRules(payload)

    const created = await prisma.discountAdvertisement.create({
      data: {
        type: 'advertisement',
        title: payload.title || null,
        description: payload.description ?? null,
        imageUrl: payload.imageUrl,
        url: payload.url ?? null,
        discountPercent: null,
        startAt: payload.startAt ?? null,
        endAt: payload.endAt ?? null,
        isActive: payload.isActive !== undefined ? payload.isActive : true,
      },
    })

    const data = await prisma.discountAdvertisement.findUnique({
      where: { id: created.id },
      include: includeProducts,
    })

    logAudit({
      userId: req.user?.id,
      action: 'Created',
      entity: 'DiscountAdvertisement',
      entityId: data.id,
      description: `Created ${data.type} campaign "${data.title || data.id}"`,
    })

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data,
    })
  } catch (error) {
    console.error('Create DiscountAdvertisement Error:', error)

    if (error.code === 'P2000' && error.meta?.column_name === 'imageUrl') {
      return res.status(400).json({
        success: false,
        message: 'Image is too large. Use a smaller PNG image.',
      })
    }

    const message = error.message?.includes('required') || error.message?.includes('Invalid') || error.message?.includes('must')
      ? error.message
      : 'Failed to create campaign'

    return res.status(400).json({ success: false, message })
  }
}

export const getAllDiscountAdvertisements = async (req, res) => {
  try {
    const items = await prisma.discountAdvertisement.findMany({
      where: { type: 'advertisement' },
      include: includeProducts,
      orderBy: [{ createdAt: 'desc' }],
    })

    const now = new Date()
    const data = items.map((item) => ({
      ...item,
      isCurrentlyActive: isCampaignActive(item, now),
    }))

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    })
  } catch (error) {
    console.error('Get DiscountAdvertisements Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch campaigns',
      error: error.message,
    })
  }
}

export const getDiscountAdvertisementById = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' })
    }

    const item = await prisma.discountAdvertisement.findUnique({
      where: { id },
      include: includeProducts,
    })

    if (!item) {
      return res.status(404).json({ success: false, message: 'Campaign not found' })
    }

    return res.status(200).json({
      success: true,
      data: {
        ...item,
        isCurrentlyActive: isCampaignActive(item),
      },
    })
  } catch (error) {
    console.error('Get DiscountAdvertisement Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign',
      error: error.message,
    })
  }
}

export const getHomepagePromotions = async (req, res) => {
  try {
    const now = new Date()

    const campaigns = await prisma.discountAdvertisement.findMany({
      where: { isActive: true, type: 'advertisement' },
      orderBy: [{ createdAt: 'desc' }],
    })

    const advertisements = campaigns
      .filter((item) => isCampaignActive(item, now))
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        url: item.url,
      }))

    const menuItems = await prisma.menuitem.findMany({
      where: { isAvailable: true },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    })

    const flashSaleProducts = getDiscountedMenuItems(menuItems)

    return res.status(200).json({
      success: true,
      data: {
        advertisements,
        flashSaleProducts,
      },
    })
  } catch (error) {
    console.error('Get Homepage Promotions Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch homepage promotions',
      error: error.message,
    })
  }
}

export const updateDiscountAdvertisement = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' })
    }

    const existing = await prisma.discountAdvertisement.findUnique({
      where: { id },
      include: { products: true },
    })

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Campaign not found' })
    }

    const payload = validatePayload(req.body, { isUpdate: true })

    if (payload.type && payload.type !== 'advertisement') {
      return res.status(400).json({
        success: false,
        message: 'Only advertisement campaigns are supported. Set product discounts on Menu Items.',
      })
    }

    if (existing.type !== 'advertisement') {
      return res.status(400).json({
        success: false,
        message: 'Legacy discount campaigns are no longer supported. Manage discounts on Menu Items.',
      })
    }

    const nextImage = payload.imageUrl ?? existing.imageUrl
    if (!nextImage) {
      return res.status(400).json({ success: false, message: 'image is required for advertisement' })
    }
    if (payload.imageUrl !== undefined && !validatePngImage(payload.imageUrl)) {
      return res.status(400).json({ success: false, message: 'Advertisement image must be PNG format' })
    }

    const updated = await prisma.discountAdvertisement.update({
      where: { id },
      data: {
        type: 'advertisement',
        title: payload.title !== undefined ? payload.title || null : existing.title,
        description: payload.description !== undefined ? payload.description : existing.description,
        imageUrl: payload.imageUrl !== undefined ? payload.imageUrl : existing.imageUrl,
        url: payload.url !== undefined ? payload.url : existing.url,
        discountPercent: null,
        startAt: payload.startAt !== undefined ? payload.startAt : existing.startAt,
        endAt: payload.endAt !== undefined ? payload.endAt : existing.endAt,
        isActive: payload.isActive !== undefined ? payload.isActive : existing.isActive,
      },
    })

    await prisma.discountAdvertisementProduct.deleteMany({
      where: { discountAdvertisementId: updated.id },
    })

    const data = await prisma.discountAdvertisement.findUnique({
      where: { id: updated.id },
      include: includeProducts,
    })

    logAudit({
      userId: req.user?.id,
      action: 'Updated',
      entity: 'DiscountAdvertisement',
      entityId: data.id,
      description: `Updated ${data.type} campaign "${data.title || data.id}"`,
    })

    return res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data,
    })
  } catch (error) {
    console.error('Update DiscountAdvertisement Error:', error)

    if (error.code === 'P2000' && error.meta?.column_name === 'imageUrl') {
      return res.status(400).json({
        success: false,
        message: 'Image is too large. Use a smaller PNG image.',
      })
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update campaign',
    })
  }
}

export const deleteDiscountAdvertisement = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' })
    }

    const existing = await prisma.discountAdvertisement.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Campaign not found' })
    }

    await prisma.discountAdvertisement.delete({ where: { id } })

    logAudit({
      userId: req.user?.id,
      action: 'Deleted',
      entity: 'DiscountAdvertisement',
      entityId: id,
      description: `Deleted ${existing.type} campaign "${existing.title || id}"`,
    })

    return res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully',
    })
  } catch (error) {
    console.error('Delete DiscountAdvertisement Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete campaign',
      error: error.message,
    })
  }
}

export { enrichMenuItemsWithFlashSale, computeDiscountedPrice }
