import { useEffect, useRef, useState } from 'react'

// Accumulate live location samples (from useStreamTelemetry / useLocalTelemetry — SP5) into a
// growing [lng, lat] trail for SourceLocationTrail. A single point renders as a pin; movement
// renders as the path. Caps the length, dedupes near-identical points, and resets when disabled
// (e.g. leaving the room / not broadcasting) so a new session starts a fresh trail.
//
// Pass the STABLE sample object (`tel.location`) — it only changes identity when a new sample
// arrives, so the effect fires once per sample; the `ts` guard drops stale/out-of-order ones.

type Sample = { ts: number; lat: number; lng: number } | null | undefined

const MAX_POINTS = 300 // ~5 min at 1 Hz; bounds memory + keeps the map readable
const MOVE_EPS = 1e-5 // ~1 m — below this the position is treated as unchanged (don't append)

export function useLocationTrail(sample: Sample, enabled = true): [number, number][] {
  const [trail, setTrail] = useState<[number, number][]>([])
  const lastTsRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      lastTsRef.current = 0
      setTrail((prev) => (prev.length ? [] : prev))
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !sample) return
    if (sample.ts <= lastTsRef.current) return // stale / duplicate
    lastTsRef.current = sample.ts
    setTrail((prev) => {
      const last = prev[prev.length - 1]
      if (last && Math.abs(last[0] - sample.lng) < MOVE_EPS && Math.abs(last[1] - sample.lat) < MOVE_EPS) return prev
      const next: [number, number][] = [...prev, [sample.lng, sample.lat]]
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
    })
  }, [enabled, sample])

  return trail
}
