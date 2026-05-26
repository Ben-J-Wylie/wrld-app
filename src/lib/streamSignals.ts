let _streamPaused = false

export function signalStreamPaused() {
  _streamPaused = true
}

export function consumeStreamPaused(): boolean {
  const v = _streamPaused
  _streamPaused = false
  return v
}
