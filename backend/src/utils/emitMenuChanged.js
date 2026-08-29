import { getIO } from '../socket.js'

/** Notify all connected clients (POS, admin) that the menu catalog changed. */
export function emitMenuChanged(detail = {}) {
  try {
    getIO().emit('menu_changed', detail)
  } catch {
    // Socket not initialized yet (e.g. during tests)
  }
}
