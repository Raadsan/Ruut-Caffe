import { retryFailedPOSAccounting } from './posOrderAccounting.service.js'

export const retryPOSOrderAccounting = async (req, res) => {
  try {
    const data = await retryFailedPOSAccounting(req.params.id)
    if (data.status === 'not_eligible') {
      return res.status(409).json({
        success: false,
        message: `Order is not eligible for accounting (order: ${data.orderStatus}, payment: ${data.paymentStatus || 'missing'})`,
        data,
      })
    }
    res.json({ success: true, message: data.status === 'posted' ? 'POS order accounting posted successfully' : 'POS order was already accounted', data })
  } catch (error) {
    res.status(422).json({ success: false, message: error instanceof Error ? error.message : 'POS accounting retry failed' })
  }
}
