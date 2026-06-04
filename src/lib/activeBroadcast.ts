type BroadcastParams = {
  title: string
  sources: string
  subscribersOnly?: string
  // Clips initiative (2026-06-03): capture intent carried alongside the
  // broadcast set. `air` is a comma list of all aired source kinds (the
  // media subset that actually streams lives in `sources`); `record` is a
  // comma list of kinds saving to disk; `identity` flags an anonymous
  // broadcast; `precision` is the location capture ceiling. Consumed by
  // the live on-air-vs-recording indicator; backend wiring for the non-AV
  // layers and record-to-disk is a follow-up (Aaron).
  air?: string
  record?: string
  identity?: string
  precision?: string
}

let _active: BroadcastParams | null = null

export const activeBroadcast = {
  set(p: BroadcastParams) { _active = p },
  get(): BroadcastParams | null { return _active },
  clear() { _active = null },
}
