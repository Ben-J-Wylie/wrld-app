type BroadcastParams = {
  title: string
  sources: string
  subscribersOnly?: string
  // Clips initiative (2026-06-03): capture intent carried alongside the
  // broadcast set. `record` is a comma list of source kinds saving to
  // disk; `identity` flags an anonymous broadcast; `precision` is the
  // location capture ceiling. Consumed by the live on-air-vs-recording
  // indicator; backend record-to-disk wiring is a follow-up (Aaron).
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
