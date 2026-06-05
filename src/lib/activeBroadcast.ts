import { router } from 'expo-router'

// Per-go-live intent that isn't part of the persisted capture config.
// Arming (title / sources / precision / identity / subscribers-only) now
// lives in captureConfig — the single source of truth the dashboard and the
// stream-view preview share. The only thing carried here is the optional PPV
// event the dashboard links a broadcast to at Go Live time (it's computed
// from scheduled events, not a persisted setting).
type BroadcastParams = {
  ppvEventId?: string
}

let _active: BroadcastParams | null = null

export const activeBroadcast = {
  set(p: BroadcastParams) { _active = p },
  get(): BroadcastParams | null { return _active },
  clear() { _active = null },
}

// Open the broadcaster's own stream view (`stream/new`). If a broadcast is
// already live the view shows it (StreamScreen sees it still in-room); if
// not, it shows the armed preview. Used by the center stream tab and by
// tapping one's own (black) pin on the globe.
export function returnToActiveBroadcast() {
  router.navigate({ pathname: '/(app)/stream/[id]', params: { id: 'new' } })
}
