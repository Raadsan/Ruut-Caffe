import prisma from '../../../../config/db.js'

// CREATE BOM ITEM
export const createBOMItem = async (req, res) => {
  try {
    let { menuItemId, ingredientId, quantityRequired } = req.body

    menuItemId = Number(menuItemId)
    ingredientId = Number(ingredientId)
    quantityRequired = Number(quantityRequired)

    if (isNaN(menuItemId) || isNaN(ingredientId) || isNaN(quantityRequired)) {
      return res.status(400).json({
        success: false,
        message: 'menuItemId, ingredientId and quantityRequired must be valid numbers'
      })
    }

    if (quantityRequired <= 0) {
      return res.status(400).json({
        success: false,
        message: 'quantityRequired must be greater than 0'
      })
    }

    const menuItem = await prisma.menuitem.findUnique({
      where: { id: menuItemId }
    })

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      })
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId }
    })

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
    }

    const existingBOMItem = await prisma.menuitembom.findFirst({
      where: {
        menuItemId,
        ingredientId
      }
    })

    if (existingBOMItem) {
      return res.status(409).json({
        success: false,
        message: 'This ingredient is already linked to this menu item'
      })
    }

    const bomItem = await prisma.menuitembom.create({
      data: {
        menuItemId,
        ingredientId,
        quantityRequired
      },
      include: {
        menuitem: {
          select: {
            id: true,
            name: true
          }
        },
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true
          }
        }
      }
    })

    return res.status(201).json({
      success: true,
      message: 'BOM item created successfully',
      data: bomItem
    })
  } catch (error) {
    console.error('Create BOM Item Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to create BOM item',
      error: error.message
    })
  }
}

// GET ALL BOM ITEMS
export const getAllBOMItems = async (req, res) => {
  try {
    const bomItems = await prisma.menuitembom.findMany({
      include: {
        menuitem: {
          select: {
            id: true,
            name: true
          }
        },
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
            stockQuantity: true,
            costPerUnit: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      count: bomItems.length,
      data: bomItems
    })
  } catch (error) {
    console.error('Get BOM Items Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch BOM items',
      error: error.message
    })
  }
}

// GET BOM BY MENU ITEM
export const getBOMByMenuItem = async (req, res) => {
  try {
    const { menuItemId } = req.params
    const parsedMenuItemId = Number(menuItemId)

    if (isNaN(parsedMenuItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid menu item id'
      })
    }

    const menuItem = await prisma.menuitem.findUnique({
      where: { id: parsedMenuItemId }
    })

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      })
    }

    const bomItems = await prisma.menuitembom.findMany({
      where: {
        menuItemId: parsedMenuItemId
      },
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
            stockQuantity: true,
            costPerUnit: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      menuItem: {
        id: menuItem.id,
        name: menuItem.name
      },
      count: bomItems.length,
      data: bomItems
    })
  } catch (error) {
    console.error('Get BOM By Menu Item Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch BOM for menu item',
      error: error.message
    })
  }
}

// UPDATE BOM ITEM
export const updateBOMItem = async (req, res) => {
  try {
    const { id } = req.params
    let { quantityRequired } = req.body

    const bomItemId = Number(id)
    quantityRequired = Number(quantityRequired)

    if (isNaN(bomItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid BOM item id'
      })
    }

    if (isNaN(quantityRequired) || quantityRequired <= 0) {
      return res.status(400).json({
        success: false,
        message: 'quantityRequired must be a valid number greater than 0'
      })
    }

    const existingBOMItem = await prisma.menuitembom.findUnique({
      where: { id: bomItemId }
    })

    if (!existingBOMItem) {
      return res.status(404).json({
        success: false,
        message: 'BOM item not found'
      })
    }

    const updatedBOMItem = await prisma.menuitembom.update({
      where: { id: bomItemId },
      data: {
        quantityRequired
      },
      include: {
        menuitem: {
          select: {
            id: true,
            name: true
          }
        },
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true
          }
        }
      }
    })

    return res.status(200).json({
      success: true,
      message: 'BOM item updated successfully',
      data: updatedBOMItem
    })
  } catch (error) {
    console.error('Update BOM Item Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update BOM item',
      error: error.message
    })
  }
}

// DELETE BOM ITEM
export const deleteBOMItem = async (req, res) => {
  try {
    const { id } = req.params
    const bomItemId = Number(id)

    if (isNaN(bomItemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid BOM item id'
      })
    }

    const existingBOMItem = await prisma.menuitembom.findUnique({
      where: { id: bomItemId }
    })

    if (!existingBOMItem) {
      return res.status(404).json({
        success: false,
        message: 'BOM item not found'
      })
    }

    await prisma.menuitembom.delete({
      where: { id: bomItemId }
    })

    return res.status(200).json({
      success: true,
      message: 'BOM item deleted successfully'
    })
  } catch (error) {
    console.error('Delete BOM Item Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete BOM item',
      error: error.message
    })
  }
}