import { Server } from 'socket.io'

let io

export const initSocket = (server) => {
  const allowedOrigins = [
    "http://localhost:2005",
    "http://127.0.0.1:2005",
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_PROD
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
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