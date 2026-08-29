import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'
import { emitMenuChanged } from '../../../../utils/emitMenuChanged.js'
import { invalidatePosMenuCatalogCache } from '../menuItem/menuItem.controller.js'
import { createResponseCache } from '../../../../utils/responseCache.js'

const categoryCache = createResponseCache(5 * 60 * 1000)

export const clearCategoryListCache = () => {
  categoryCache.clear()
}

async function fetchAllCategoriesData() {
  return prisma.category.findMany({
    orderBy: { id: 'asc' },
  })
}

async function fetchCategoriesWithItemsData() {
  return prisma.category.findMany({
    include: { menuitem: true },
    orderBy: { id: 'asc' },
  })
}

export async function warmCategoryCaches() {
  await Promise.all([
    categoryCache.get('all', fetchAllCategoriesData),
    categoryCache.get('with-items', fetchCategoriesWithItemsData),
  ]).catch(() => {})
}

function invalidateCategoryCaches() {
  clearCategoryListCache()
  invalidatePosMenuCatalogCache()
}

// CREATE CATEGORY
export const createCategory = async (req, res) => {
  try {
    const { name, description, imageUrl, isActive } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      })
    }

    const existingCategory = await prisma.category.findUnique({
      where: { name: name.trim() }
    })

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'Category already exists'
      })
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description || null,
        imageUrl: imageUrl || null,
        isActive: isActive !== undefined ? !!isActive : true,
      }
    })

    logAudit({ userId: req.user?.id, action: 'Created', entity: 'Category', entityId: category.id, description: `Created category "${category.name}"` })
    invalidateCategoryCaches()
    emitMenuChanged({ action: 'category_create', id: category.id })

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    })
  } catch (error) {
    console.error('Create Category Error:', error)

    if (error.code === 'P2000' && error.meta?.column_name === 'imageUrl') {
      return res.status(400).json({
        success: false,
        message: 'Category image is too large. Use a smaller image or a shorter URL.',
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    })
  }
}

// GET ALL CATEGORIES
export const getAllCategories = async (req, res) => {
  try {
    const categories = await categoryCache.get('all', fetchAllCategoriesData)

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    })
  } catch (error) {
    console.error('Get Categories Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    })
  }
}

// UPDATE CATEGORY
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, imageUrl, isActive } = req.body

    const categoryId = parseInt(id)

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    })

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: name ?? existingCategory.name,
        description: description ?? existingCategory.description,
        imageUrl: imageUrl ?? existingCategory.imageUrl,
        isActive: isActive !== undefined ? !!isActive : existingCategory.isActive,
        updatedAt: new Date()
      }
    })

    logAudit({ userId: req.user?.id, action: 'Updated', entity: 'Category', entityId: updatedCategory.id, description: `Updated category "${updatedCategory.name}"` })
    invalidateCategoryCaches()
    emitMenuChanged({ action: 'category_update', id: updatedCategory.id })

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory
    })
  } catch (error) {
    console.error('Update Category Error:', error)

    if (error.code === 'P2000' && error.meta?.column_name === 'imageUrl') {
      return res.status(400).json({
        success: false,
        message: 'Category image is too large. Use a smaller image or a shorter URL.',
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    })
  }
}

// DELETE CATEGORY
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params
    const categoryId = parseInt(id)

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category id'
      })
    }

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        menuitem: true
      }
    })

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    if (existingCategory.menuitem.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category because it has related menu items'
      })
    }

    await prisma.category.delete({
      where: { id: categoryId }
    })

    logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'Category', entityId: categoryId, description: `Deleted category "${existingCategory.name}"` })
    invalidateCategoryCaches()
    emitMenuChanged({ action: 'category_delete', id: categoryId })

    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    })
  } catch (error) {
    console.error('Delete Category Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    })
  }
}

// GET CATEGORIES WITH ITEMS
export const getCategoriesWithItems = async (req, res) => {
  try {
    const categories = await categoryCache.get('with-items', fetchCategoriesWithItemsData)

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    })

  } catch (error) {
    console.error("Get Categories With Items Error:", error)

    res.status(500).json({
      success: false,
      message: "Failed to fetch categories with items",
      error: error.message
    })
  }
}

// GET CATEGORY BY ID WITH ITEMS
export const getCategoryByIdWithItems = async (req, res) => {
  try {
    const { id } = req.params
    const categoryId = parseInt(id)

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category id'
      })
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        menuitem: {
          orderBy: {
            id: 'asc'
          }
        }
      }
    })

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      })
    }

    res.status(200).json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Get Category By Id With Items Error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category with items',
      error: error.message
    })
  }
}