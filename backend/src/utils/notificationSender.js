import prisma from '../config/db.js'

const senderSelect = {
  id: true,
  fullName: true,
  avatarUrl: true,
}

export async function loadSenderFields(senderId) {
  if (!senderId) {
    return { senderId: null, senderName: null, senderAvatarUrl: null }
  }
  const user = await prisma.user.findUnique({
    where: { id: senderId },
    select: senderSelect,
  })
  if (!user) {
    return { senderId: null, senderName: null, senderAvatarUrl: null }
  }
  return {
    senderId: user.id,
    senderName: user.fullName,
    senderAvatarUrl: user.avatarUrl || null,
  }
}

export async function resolveSenderForOrder(order, explicitSenderId = null) {
  const id = explicitSenderId || order?.userId || null
  return loadSenderFields(id)
}

export { senderSelect }
