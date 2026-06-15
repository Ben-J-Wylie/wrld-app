// The universal wall clock (CONTENT.md §6 — "read it, never keep your own").
//
// ONE server-aligned clock that the WHOLE app reads. Everything that represents a
// position in time (the now/reaper edges, the playhead, every digital readout) must
// derive its position by READING this clock — never by accumulating its own per-frame
// ticks (a stopwatch that drifts), and never off raw `Date.now()` (the device clock,
// which skews against the server-anchored clip geometry).
//
//   serverNow() = device Date.now() + a cached, eased offset
//
// The offset is measured from the backend's `serverNowMs` (the server's wall-clock at
// response build) via `feedServerNow`. It is LOCAL — no per-tick network call — so an
// offline blip never disturbs it: the device clock keeps ticking and the offset stays
// frozen until the next measurement (see the robustness note in CONTENT.md §6).

let offsetMs = 0
let hasOffset = false

// Feed a fresh server-time measurement (epoch ms at response build). The first snaps;
// later ones EASE (0.25) so per-fetch network-latency jitter is smoothed while the true
// skew converges. Monotonicity is the consumer's concern (e.g. the reaper edge clamps
// forward-only) — this just keeps the offset close to truth. No-op for nullish input
// (older backends that don't send `serverNowMs` → we stay on the raw device clock).
export function feedServerNow(serverNowMs: number | null | undefined): void {
  if (serverNowMs == null || !Number.isFinite(serverNowMs)) return
  const target = serverNowMs - Date.now()
  offsetMs = hasOffset ? offsetMs + (target - offsetMs) * 0.25 : target
  hasOffset = true
}

// The universal clock. Read this for any time POSITION. Falls back to the raw device
// clock until the first measurement lands.
export function serverNow(): number {
  return Date.now() + offsetMs
}

// The current device→server offset (ms). `serverNow() === Date.now() + serverOffsetMs()`.
export function serverOffsetMs(): number {
  return offsetMs
}

// True once a real server measurement has been folded in (vs. the device-clock fallback).
export function hasServerClock(): boolean {
  return hasOffset
}
