let _pending = false

export const signOutSignal = {
  set: () => { _pending = true },
  consume: (): boolean => {
    if (!_pending) return false
    _pending = false
    return true
  },
}
