import type { DataSample } from '@/hooks/useDataTrack'

// Pure mappers: a data track's parsed samples → the inputs the design renderers
// (SourceTelemetryGraph / SourceLocationTrail / SourceChatLog) expect. Kept here
// (lib tier) so they're unit-testable and the screen stays thin. Oldest → newest.

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const num = (s: DataSample, k: string): number => (typeof s[k] === 'number' ? (s[k] as number) : 0)

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
