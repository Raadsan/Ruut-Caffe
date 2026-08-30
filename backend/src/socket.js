import { Server } from 'socket.io'

let io

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    console.log('✅ Connected:', socket.id)

    // JOIN ROLE (kitchen, waiter, admin...)
    socket.on('join_role', (role) => {
      socket.join(role)
      console.log(`Joined role: ${role}`)
    })

    // JOIN SPECIFIC ORDER (customer)
    socket.on('join_order', (orderId) => {
      socket.join(`order_${orderId}`)
      console.log(`Joined order room: ${orderId}`)
    })

    // JOIN USER (personal alerts for waiters)
    socket.on('join_user', (userId) => {
      socket.join(`user_${userId}`)
      console.log(`Joined user room: ${userId}`)
    })

    // LEAVE ROOM (optional)
    socket.on('leave_room', (room) => {
      socket.leave(room)
    })

    socket.on('disconnect', () => {
      console.log('❌ Disconnected:', socket.id)
    })
  })
}

export const getIO = () => {
  if (!io) throw new Error('Socket not initialized')
  return io
}