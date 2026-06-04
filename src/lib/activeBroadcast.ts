import { router } from 'expo-router'

type BroadcastParams = {
  title: string
  sources: string
  subscribersOnly?: string
  // Clips initiative: capture intent carried alongside the broadcast set.
  // `air` is a comma list of all aired source kinds (the media subset that
  // actually streams lives in `sources`); `identity` flags an anonymous
  // broadcast; `precision` is the location capture ceiling. Recording is
  // no longer armed on the dashboard — a single Record button on the
  // stream view records the aired set (2026-06-04), so there is no
  // separate `record` set here anymore.
  air?: string
  identity?: string
  precision?: string
  // Optional PPV event this broadcast is linked to (forwarded to createRoom).
  ppvEventId?: string
}

let _active: BroadcastParams | null = null

export const activeBroadcast = {
  set(p: BroadcastParams) { _active = p },
  get(): BroadcastParams | null { return _active },
  clear() { _active = null },
}

// Navigate (back) to the broadcaster's own live stream view, carrying the
// arming config forward as params. Used by the tab-bar live-return bar and
// by tapping one's own (black) pin on the globe. The stream stays in-room,
// so StreamScreen's focus effect re-enters without restarting it.
export function returnToActiveBroadcast() {
  const a = _active
  router.navigate({
    pathname: '/(app)/stream/[id]',
    params: {
      id: 'new',
      title: a?.title ?? '',
      sources: a?.sources ?? '',
      subscribersOnly: a?.subscribersOnly ?? 'false',
      precision: a?.precision ?? 'exact',
    },
  })
}
