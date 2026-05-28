type BroadcastParams = { title: string; sources: string }

let _active: BroadcastParams | null = null

export const activeBroadcast = {
  set(p: BroadcastParams) { _active = p },
  get(): BroadcastParams | null { return _active },
  clear() { _active = null },
}
