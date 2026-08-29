import prisma from '../../../../config/db.js'
import { logAudit } from '../../../../utils/auditHelper.js'

// CREATE STOCK MOVEMENT
export const createStockMovement = async (req, res) => {
  try {
    let { ingredientId, type, quantity, note } = req.body

    ingredientId = Number(ingredientId)
    quantity = Number(quantity)
    type = type?.trim().toLowerCase()

    if (isNaN(ingredientId) || !type || isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'ingredientId, type and quantity are required'
      })
    }

    if (!['in', 'out', 'adjustment'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Allowed: in, out, adjustment'
      })
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
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

    let newStockQuantity = ingredient.stockQuantity

    if (type === 'in') {
      newStockQuantity += quantity
    } else if (type === 'out') {
      if (ingredient.stockQuantity < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock quantity'
        })
      }

      newStockQuantity -= quantity
    } else if (type === 'adjustment') {
      newStockQuantity = quantity
    }

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockmovement.create({
        data: {
          ingredientId,
          type,
          quantity,
          note: note?.trim() || null
        },
        include: {
          ingredient: true
        }
      })

      const updatedIngredient = await tx.ingredient.update({
        where: { id: ingredientId },
        data: {
          stockQuantity: newStockQuantity
        }
      })

      return { movement, updatedIngredient }
    })

    await logAudit({ userId: req.user?.id, action: 'Created', entity: 'StockMovement', entityId: result.movement.id, description: `Stock ${type} of ${quantity} for "${ingredient.name}"` })

    return res.status(201).json({
      success: true,
      message: 'Stock movement created successfully',
      data: result
    })
  } catch (error) {
    console.error('Create Stock Movement Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to create stock movement',
      error: error.message
    })
  }
}

// GET ALL STOCK MOVEMENTS
export const getAllStockMovements = async (req, res) => {
  try {
    const stockmovements = await prisma.stockmovement.findMany({
      include: {
        ingredient: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      count: stockmovements.length,
      data: stockmovements
    })
  } catch (error) {
    console.error('Get Stock Movements Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movements',
      error: error.message
    })
  }
}

// GET STOCK MOVEMENT BY ID
export const getStockMovementById = async (req, res) => {
  try {
    const { id } = req.params
    const movementId = Number(id)

    if (isNaN(movementId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock movement id'
      })
    }

    const stockmovement = await prisma.stockmovement.findUnique({
      where: { id: movementId },
      include: {
        ingredient: true
      }
    })

    if (!stockmovement) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      })
    }

    return res.status(200).json({
      success: true,
      data: stockmovement
    })
  } catch (error) {
    console.error('Get Stock Movement By Id Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movement',
      error: error.message
    })
  }
}

// GET STOCK MOVEMENTS BY INGREDIENT
export const getStockMovementsByIngredient = async (req, res) => {
  try {
    const { ingredientId } = req.params
    const parsedIngredientId = Number(ingredientId)

    if (isNaN(parsedIngredientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ingredient id'
      })
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: parsedIngredientId }
    })

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
    }

    const stockmovements = await prisma.stockmovement.findMany({
      where: {
        ingredientId: parsedIngredientId
      },
      include: {
        ingredient: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return res.status(200).json({
      success: true,
      ingredient,
      count: stockmovements.length,
      data: stockmovements
    })
  } catch (error) {
    console.error('Get Stock Movements By Ingredient Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movements for ingredient',
      error: error.message
    })
  }
}

// DELETE STOCK MOVEMENT
export const deleteStockMovement = async (req, res) => {
  try {
    const { id } = req.params
    const movementId = Number(id)

    if (isNaN(movementId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock movement id'
      })
    }

    const existingMovement = await prisma.stockmovement.findUnique({
      where: { id: movementId }
    })

    if (!existingMovement) {
      return res.status(404).json({
        success: false,
        message: 'Stock movement not found'
      })
    }

    await prisma.stockmovement.delete({
      where: { id: movementId }
    })

    await logAudit({ userId: req.user?.id, action: 'Deleted', entity: 'StockMovement', entityId: movementId, description: `Deleted stock movement #${movementId}` })

    return res.status(200).json({
      success: true,
      message: 'Stock movement deleted successfully'
    })
  } catch (error) {
    console.error('Delete Stock Movement Error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to delete stock movement',
      error: error.message
    })
  }
}