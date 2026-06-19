// Tiny pub/sub bridging the root-singleton user socket (useUserSocket) to any
// screen that needs PPV pushes. The socket forwards ppv_event_live /
// ppv_event_ended here; PpvEventDetailScreen + StreamScreen subscribe.

export type PpvSocketEvent =
  | { type: 'ppv_event_live'; eventId: string; streamId: string; mediasoupRoomId: string }
  | { type: 'ppv_event_ended'; eventId: string; reason?: 'ended' | 'cancelled' | 'admin_cancelled' }

type Listener = (e: PpvSocketEvent) => void

const listeners = new Set<Listener>()

export function emitPpvSocketEvent(e: PpvSocketEvent) {
  for (const l of listeners) l(e)
}

export function onPpvSocketEvent(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
