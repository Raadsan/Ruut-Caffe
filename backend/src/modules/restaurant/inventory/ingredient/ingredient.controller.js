import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'

// CREATE INGREDIENT
export const createIngredient = async (req, res) => {
  try {
    let { name, unit, stockQuantity, minStockLevel, costPerUnit, isActive } = req.body

    name = name?.trim()
    unit = unit?.trim()

    if (!name || !unit) {
      return res.status(400).json({
        success: false,
        message: 'name and unit are required'
      })
    }

    const existingIngredient = await prisma.ingredient.findUnique({
      where: { name }
    })

    if (existingIngredient) {
      return res.status(409).json({
        success: false,
        message: 'Ingredient already exists'
      })
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : 0,
        minStockLevel: minStockLevel !== undefined ? Number(minStockLevel) : 0,
        costPerUnit: costPerUnit !== undefined ? Number(costPerUnit) : 0,
        isActive: typeof isActive === 'boolean' ? isActive : true
      }
    })

    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'Ingredient', entityId: ingredient.id, description: `Created ingredient "${ingredient.name}"` })

    return res.status(201).json({
      success: true,
      message: 'Ingredient created successfully',
      data: ingredient
    })
  } catch (error) {
    console.error('Create Ingredient Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to create ingredient',
      error: error.message
    })
  }
}

// GET ALL INGREDIENTS
export const getAllIngredients = async (req, res) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      count: ingredients.length,
      data: ingredients
    })
  } catch (error) {
    console.error('Get Ingredients Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ingredients',
      error: error.message
    })
  }
}

// GET INGREDIENT BY ID
export const getIngredientById = async (req, res) => {
  try {
    const { id } = req.params
    const ingredientId = Number(id)

    if (isNaN(ingredientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ingredient id'
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

    return res.status(200).json({
      success: true,
      data: ingredient
    })
  } catch (error) {
    console.error('Get Ingredient By Id Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ingredient',
      error: error.message
    })
  }
}

// UPDATE INGREDIENT
export const updateIngredient = async (req, res) => {
  try {
    const { id } = req.params
    let { name, unit, stockQuantity, minStockLevel, costPerUnit, isActive } = req.body

    const ingredientId = Number(id)

    if (isNaN(ingredientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ingredient id'
      })
    }

    const existingIngredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId }
    })

    if (!existingIngredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
    }

    if (name) {
      name = name.trim()

      const duplicateIngredient = await prisma.ingredient.findFirst({
        where: {
          name,
          NOT: { id: ingredientId }
        }
      })

      if (duplicateIngredient) {
        return res.status(409).json({
          success: false,
          message: 'Another ingredient with this name already exists'
        })
      }
    }

    const updatedIngredient = await prisma.ingredient.update({
      where: { id: ingredientId },
      data: {
        name: name ?? existingIngredient.name,
        unit: unit?.trim() ?? existingIngredient.unit,
        stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : existingIngredient.stockQuantity,
        minStockLevel: minStockLevel !== undefined ? Number(minStockLevel) : existingIngredient.minStockLevel,
        costPerUnit: costPerUnit !== undefined ? Number(costPerUnit) : existingIngredient.costPerUnit,
        isActive: typeof isActive === 'boolean' ? isActive : existingIngredient.isActive
      }
    })

    await logAudit({ userId: req.user?.id, action: 'Updated', entity: 'Ingredient', entityId: updatedIngredient.id, description: `Updated ingredient "${updatedIngredient.name}"` })

    return res.status(200).json({
      success: true,
      message: 'Ingredient updated successfully',
      data: updatedIngredient
    })
  } catch (error) {
    console.error('Update Ingredient Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update ingredient',
      error: error.message
    })
  }
}

// DELETE INGREDIENT
export const deleteIngredient = async (req, res) => {
  try {
    const { id } = req.params
    const ingredientId = Number(id)

    if (isNaN(ingredientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ingredient id'
      })
    }

    const existingIngredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      include: {
        menuitembom: true,
        stockmovement: true
      }
    })

    if (!existingIngredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
    }

    if (existingIngredient.menuitembom.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete ingredient because it is linked to menu item BOM'
      })
    }

    await prisma.stockmovement.deleteMany({
      where: { ingredientId }
    })

    await prisma.ingredient.delete({
      where: { id: ingredientId }
    })

    await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'Ingredient', entityId: ingredientId, description: `Deleted ingredient "${existingIngredient.name}"` })

    return res.status(200).json({
      success: true,
      message: 'Ingredient deleted successfully'
    })
  } catch (error) {
    console.error('Delete Ingredient Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete ingredient',
      error: error.message
    })
  }
}