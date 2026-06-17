import { useEffect, useRef, useState } from 'react'
import { signalingClient, type TelemetryPayload } from '@/lib/mediasoupSignaling'

type Kind = TelemetryPayload['kind']
type ByKind<K extends Kind> = Extract<TelemetryPayload, { kind: K }>

// The viewer's live view of a stream's sensor sources: the latest sample per kind
// (each null until the first arrives). Subscribes to the signaling client's
// `telemetryUpdate` fan-out (Option A) — the single decode point. `motionIntensity`
// is DERIVED here from `accel` (one sensor on the wire, perfectly consistent).
export type StreamTelemetry = {
  compass: ByKind<'compass'> | null
  gyro: ByKind<'gyro'> | null
  accel: ByKind<'accel'> | null
  speed: ByKind<'speed'> | null
  torch: ByKind<'torch'> | null
  location: ByKind<'location'> | null
  motionIntensity: number | null
}

const EMPTY: StreamTelemetry = {
  compass: null,
  gyro: null,
  accel: null,
  speed: null,
  torch: null,
  location: null,
  motionIntensity: null,
}

// Gravity baseline (m/s²) removed from the accel magnitude; the remaining
// deviation is normalised to 0..1 over a ~12 m/s² span (clamped) for the orb.
const GRAVITY = 9.81
const MOTION_SPAN = 12

export function useStreamTelemetry(enabled = true): StreamTelemetry {
  const [tel, setTel] = useState<StreamTelemetry>(EMPTY)
  // Last accepted ts per kind — drop stale / out-of-order samples.
  const tsRef = useRef<Partial<Record<Kind, number>>>({})

  useEffect(() => {
    if (!enabled) {
      setTel(EMPTY)
      tsRef.current = {}
      return
    }
    const unsub = signalingClient.onMessage((msg) => {
      if (msg.type !== 'telemetryUpdate') return
      const p = msg.payload
      const last = tsRef.current[p.kind] ?? 0
      if (typeof p.ts === 'number' && p.ts < last) return
      tsRef.current[p.kind] = p.ts
      setTel((prev) => {
        switch (p.kind) {
          case 'compass':
            return { ...prev, compass: p }
          case 'gyro':
            return { ...prev, gyro: p }
          case 'speed':
            return { ...prev, speed: p }
          case 'torch':
            return { ...prev, torch: p }
          case 'location':
            return { ...prev, location: p }
          case 'accel': {
            const mag = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z)
            const intensity = Math.max(0, Math.min(1, Math.abs(mag - GRAVITY) / MOTION_SPAN))
            return { ...prev, accel: p, motionIntensity: intensity }
          }
        }
      })
    })
    return unsub
  }, [enabled])

  return tel
}
