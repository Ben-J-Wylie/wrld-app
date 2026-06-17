import type { DataSample } from '@/hooks/useDataTrack'

// Pure mappers: a data track's parsed samples → the inputs the design renderers
// (SourceTelemetryGraph / SourceLocationTrail / SourceChatLog) expect. Kept here
// (lib tier) so they're unit-testable and the screen stays thin. Oldest → newest.

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const num = (s: DataSample, k: string): number => (typeof s[k] === 'number' ? (s[k] as number) : 0)

// ── time-based sampling (clip PLAYBACK) ──────────────────────────────────────
// Recorded sources replay through the SAME live visualizers as a live stream, fed the value AT the
// playhead. Samples carry wall-clock `ts`; the playhead is wall-clock too, so we look up by time
// (accurate for sparse/event tracks like torch, not just evenly-spaced ones). Oldest → newest.

// The sample in effect at wall-clock `atMs` — the latest with ts ≤ atMs (the held state); before the
// first sample, the first one; null when empty.
export function sampleAt(samples: DataSample[], atMs: number): DataSample | null {
  if (!samples.length) return null
  let lo = 0
  let hi = samples.length - 1
  if (atMs < samples[0]!.ts) return samples[0]!
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (samples[mid]!.ts <= atMs) lo = mid
    else hi = mid - 1
  }
  return samples[lo]!
}

// The most recent `max` samples at or before `atMs` (the scrolling window for the live-style traces:
// AccelerometerVisualizer / AudioVisualizer in playback mode). As the playhead advances the window
// slides (scroll in from the left); scrubbing back moves it earlier (rewind). Oldest → newest.
export function recentUpTo(samples: DataSample[], atMs: number, max: number): DataSample[] {
  const upTo = samples.filter((s) => s.ts <= atMs)
  return upTo.length > max ? upTo.slice(upTo.length - max) : upTo
}

// Torch state at `atMs`. Torch is an EVENT track (each entry is a toggle), so before the first
// logged event the state is the one PRIOR to that toggle — the inverse of the first event — NOT the
// first event's value (unlike position/sensors, which hold their first reading). After the first
// event, hold the latest state ≤ atMs. (Ben 2026-06-17.)
export function torchStateAt(samples: DataSample[], atMs: number): boolean {
  if (!samples.length) return false
  let state: boolean | null = null
  for (const s of samples) {
    if (s.ts <= atMs) state = !!s.on
    else break // ts-sorted — once past atMs, stop
  }
  return state !== null ? state : !samples[0]!.on // before the first toggle → the prior (inverse) state
}

// The location trail UP TO `atMs` — so the path draws (and the pin moves) as the clip plays.
// Position is a HELD signal: before the first fix, hold the earliest known point (a single pin), so
// the map shows at the head of the clip rather than going blank (matches sampleAt's held behaviour).
export function trailUpTo(samples: DataSample[], atMs: number): [number, number][] {
  const pts = samples.filter((s) => typeof s.lng === 'number' && typeof s.lat === 'number')
  if (!pts.length) return []
  const upTo = pts.filter((s) => s.ts <= atMs).map((s) => [s.lng as number, s.lat as number] as [number, number])
  if (upTo.length) return upTo
  return [[pts[0]!.lng as number, pts[0]!.lat as number]] // before the first fix → hold the earliest point
}

// Chat messages UP TO `atMs` — so the log unfolds as the clip plays (not the whole transcript).
export function chatUpTo(samples: DataSample[], atMs: number): { handle: string; text: string }[] {
  return samples
    .filter((s) => s.ts <= atMs && typeof s.text === 'string')
    .map((s) => ({ handle: typeof s.handle === 'string' ? s.handle : 'unknown', text: s.text as string }))
}

// Normalise a telemetry track to a 0..1 line for SourceTelemetryGraph.
export function toGraphValues(samples: DataSample[], kind: string): number[] {
  return samples.map((s) => {
    switch (kind) {
      case 'compass':
        return clamp01(num(s, 'heading') / 360)
      case 'gyro': {
        const p = num(s, 'pitch')
        const r = num(s, 'roll')
        return clamp01(Math.sqrt(p * p + r * r) / 90) // tilt magnitude, ~90° full-scale
      }
      case 'speed':
        return clamp01(num(s, 'mps') / 30) // 30 m/s ≈ 108 km/h full-scale
      case 'accel': {
        const x = num(s, 'x')
        const y = num(s, 'y')
        const z = num(s, 'z')
        return clamp01(Math.abs(Math.sqrt(x * x + y * y + z * z) - 9.81) / 12)
      }
      default:
        return 0.5
    }
  })
}

// A human reading for the sample at the playhead (`progress` 0..1 across the track).
export function readingAt(samples: DataSample[], kind: string, progress: number): string {
  if (!samples.length) return '—'
  const i = Math.min(samples.length - 1, Math.max(0, Math.round((samples.length - 1) * progress)))
  const s = samples[i]!
  switch (kind) {
    case 'compass':
      return `${Math.round(num(s, 'heading'))}°`
    case 'gyro':
      return `${Math.round(num(s, 'roll'))}° roll`
    case 'speed':
      return `${Math.round(num(s, 'mps') * 3.6)} km/h`
    case 'accel':
      return `${(Math.sqrt(num(s, 'x') ** 2 + num(s, 'y') ** 2 + num(s, 'z') ** 2)).toFixed(1)} m/s²`
    default:
      return ''
  }
}

// Location samples → a [lng, lat] trail for SourceLocationTrail.
export function toTrail(samples: DataSample[]): [number, number][] {
  return samples
    .filter((s) => typeof s.lng === 'number' && typeof s.lat === 'number')
    .map((s) => [s.lng as number, s.lat as number])
}

// The trail position at the playhead (or undefined when there's no trail).
export function trailPositionAt(trail: [number, number][], progress: number): [number, number] | undefined {
  if (!trail.length) return undefined
  return trail[Math.min(trail.length - 1, Math.max(0, Math.round((trail.length - 1) * progress)))]
}

// Chat samples → { handle, text } rows for SourceChatLog (structurally ChatLogMessage).
export function toChatLog(samples: DataSample[]): { handle: string; text: string }[] {
  return samples
    .filter((s) => typeof s.text === 'string')
    .map((s) => ({ handle: typeof s.handle === 'string' ? s.handle : 'unknown', text: s.text as string }))
}
