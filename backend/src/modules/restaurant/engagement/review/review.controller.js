import prisma from '../../../../config/db.js'

// CREATE REVIEW
export const createReview = async (req, res) => {
  try {
    const { rating, comment, menuItemId } = req.body
    const userId = req.user.id

    if (!rating || !menuItemId) {
      return res.status(400).json({ success: false, message: 'Rating and menuItemId are required' })
    }

    // 1. Get user phone to verify purchase
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.phone) {
      return res.status(400).json({ success: false, message: 'User phone is required to verify purchase' })
    }

    // 2. Check if user has purchased this item (Order must be served/completed)
    const hasPurchased = await prisma.order.findFirst({
      where: {
        customerPhone: user.phone,
        status: 'served',
        orderitem: {
          some: {
            menuItemId: Number(menuItemId)
          }
        }
      }
    })

    if (!hasPurchased) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only review items you have successfully purchased and received.' 
      })
    }

    // 3. Create the review
    const review = await prisma.review.create({
      data: {
        rating: Number(rating),
        comment,
        userId: Number(userId),
        menuItemId: Number(menuItemId)
      },
      include: {
        user: {
          select: { fullName: true }
        }
      }
    })

    res.status(201).json({ success: true, data: review })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// GET REVIEWS FOR A MENU ITEM
export const getMenuItemReviews = async (req, res) => {
  try {
    const { menuItemId } = req.params

    const reviews = await prisma.review.findMany({
      where: { menuItemId: Number(menuItemId) },
      include: {
        user: {
          select: { fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ success: true, data: reviews })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// CHECK IF USER CAN REVIEW
export const checkCanReview = async (req, res) => {
  try {
    const { menuItemId } = req.params
    const userId = req.user.id

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.phone) {
      return res.json({ success: true, canReview: false })
    }

    const hasPurchased = await prisma.order.findFirst({
      where: {
        customerPhone: user.phone,
        status: 'served',
        orderitem: {
          some: {
            menuItemId: Number(menuItemId)
          }
        }
      }
    })

    res.json({ success: true, canReview: !!hasPurchased })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
