import { getIO } from '../socket.js'

function staffRooms() {
  return ['kitchen', 'waiter', 'pos', 'admin', 'manager']
}

function emitToStaff(event, payload) {
  const io = getIO()
  for (const room of staffRooms()) {
    io.to(room).emit(event, payload)
  }
}

function emitStaffNotification(payload) {
  const io = getIO()
  const role = payload.role
  if (role) {
    io.to(role).emit('notification', payload)
  }
  io.to('admin').emit('notification', payload)
  io.to('manager').emit('notification', payload)
}

// NEW ORDER → kitchen + waiter rooms only (no global refresh)
export const emitNewOrder = (order) => {
  const payload = {
    id: order.id,
    status: order.status,
    table: order.table?.number,
    total: order.total,
    orderType: order.orderType,
  }

  emitToStaff('new_order', payload)
  emitStaffNotification({ type: 'new_order', orderId: order.id, role: 'kitchen' })
  emitStaffNotification({ type: 'new_order', orderId: order.id, role: 'waiter' })
  emitStaffNotification({ type: 'new_order', orderId: order.id, role: 'pos' })
}

// ORDER READY → targeted rooms only
export const emitOrderReady = (order) => {
  const payload = {
    id: order.id,
    status: 'ready',
    table: order.table?.number,
    orderType: order.orderType,
    userId: order.userId,
    customerId: order.customerId,
  }

  const io = getIO()
  io.to('waiter').emit('order_ready', payload)
  io.to('pos').emit('order_ready', payload)
  io.to('kitchen').emit('order_update', payload)
  io.to('admin').emit('order_ready', payload)
  io.to('manager').emit('order_ready', payload)

  if (order.userId) {
    io.to(`user_${order.userId}`).emit('order_ready', payload)
  }
  if (order.id) {
    io.to(`order_${order.id}`).emit('order_ready', payload)
  }

  emitStaffNotification({ type: 'order_ready', orderId: order.id, role: 'waiter' })
  emitStaffNotification({ type: 'order_ready', orderId: order.id, role: 'kitchen' })
}

// ORDER UPDATE → role rooms + order room (no global refresh)
export const emitOrderUpdate = (order) => {
  const io = getIO()
  const payload = {
    id: order.id,
    status: order.status,
    table: order.table?.number ?? order.table,
    orderType: order.orderType,
    userId: order.userId,
    customerId: order.customerId,
  }

  io.to('waiter').emit('order_update', payload)
  io.to('kitchen').emit('order_update', payload)
  io.to('admin').emit('order_update', payload)
  io.to('manager').emit('order_update', payload)
  if (order.userId) {
    io.to(`user_${order.userId}`).emit('order_update', payload)
  }
  io.to(`order_${order.id}`).emit('order_update', payload)
}

// PAYMENT SUCCESS → customer order room only
export const emitPaymentSuccess = (order) => {
  const io = getIO()
  io.to(`order_${order.id}`).emit('payment_success', {
    orderId: order.id,
  })
}
