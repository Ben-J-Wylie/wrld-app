export type StreamSignal =
  | { kind: 'disconnected'; broadcasterHandle: string | null }
  | { kind: 'ended' }
  | { kind: 'kicked' }
  | { kind: 'cancelled' }

let _signal: StreamSignal | null = null

export function signalStreamDisconnected(broadcasterHandle: string | null) {
  _signal = { kind: 'disconnected', broadcasterHandle }
}

export function signalStreamEnded() {
  _signal = { kind: 'ended' }
}

export function signalKicked() {
  _signal = { kind: 'kicked' }
}

export function signalEventCancelled() {
  _signal = { kind: 'cancelled' }
}

export function consumeStreamSignal(): StreamSignal | null {
  const v = _signal
  _signal = null
  return v
}
