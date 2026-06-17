import { useEffect, useState } from 'react'
import { DeviceMotion } from 'expo-sensors'
import * as Location from 'expo-location'
import type { StreamTelemetry } from '@/hooks/useStreamTelemetry'

// The BROADCASTER's local sensor readout — the self-monitor analog of useStreamTelemetry.
// The signaling relay fans telemetry out to viewers but NOT back to the sender, so a
// broadcaster can't watch its own sensors over the wire. This reads the device sensors
// directly and returns the SAME StreamTelemetry shape, so StreamScreen's `buildSource`
// renders the broadcaster's own data with the identical code path the viewer uses.
//
// Only the CURRENTLY-VIEWED sensor is subscribed (the broadcaster monitors one source at a
// time via the rail), so we don't spin every sensor — clicking a source starts its sensor,
// leaving it stops it. All reads are guarded; a missing permission / unavailable sensor just
// leaves that field null (the visualizer shows idle). Distinct from useTelemetryCapture, which
// reads the ARMED sensors to SEND to viewers while live; this is read-only, for the monitor.

const RAD2DEG = 180 / Math.PI
const MOTION_HZ_MS = 66 // ~15 Hz for gyro / accel
const GRAVITY = 9.81 // baseline removed from the accel magnitude (matches useStreamTelemetry)
const MOTION_SPAN = 12

const EMPTY: StreamTelemetry = {
  compass: null,
  gyro: null,
  accel: null,
  speed: null,
  torch: null,
  motionIntensity: null,
}

type Sub = { remove: () => void }

export function useLocalTelemetry(kind: string | null, enabled: boolean): StreamTelemetry {
  const [tel, setTel] = useState<StreamTelemetry>(EMPTY)

  const wantGyro = kind === 'gyro'
  // motion is derived from accel, so viewing either runs the accelerometer.
  const wantAccel = kind === 'accel' || kind === 'motion'
  const wantCompass = kind === 'compass'
  const wantSpeed = kind === 'speed'

  // DeviceMotion → gyro attitude + accel vector (one listener feeds both).
  useEffect(() => {
    if (!enabled || (!wantGyro && !wantAccel)) return
    let sub: Sub | null = null
    let cancelled = false
    ;(async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) return
        await DeviceMotion.requestPermissionsAsync().catch(() => undefined)
        DeviceMotion.setUpdateInterval(MOTION_HZ_MS)
        const s = DeviceMotion.addListener((d) => {
          const ts = Date.now()
          if (wantGyro && d.rotation) {
            setTel((prev) => ({
              ...prev,
              gyro: { kind: 'gyro', ts, pitch: d.rotation!.beta * RAD2DEG, roll: d.rotation!.gamma * RAD2DEG, yaw: d.rotation!.alpha * RAD2DEG },
            }))
          }
          if (wantAccel) {
            const a = d.accelerationIncludingGravity ?? d.acceleration
            if (a) {
              const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
              const intensity = Math.max(0, Math.min(1, Math.abs(mag - GRAVITY) / MOTION_SPAN))
              setTel((prev) => ({ ...prev, accel: { kind: 'accel', ts, x: a.x, y: a.y, z: a.z }, motionIntensity: intensity }))
            }
          }
        })
        if (cancelled) s.remove()
        else sub = s
      } catch {
        /* sensor unavailable → visualizer stays idle */
      }
    })()
    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled, wantGyro, wantAccel])

  // Compass heading via the location stack.
  useEffect(() => {
    if (!enabled || !wantCompass) return
    let sub: Location.LocationSubscription | null = null
    let cancelled = false
    ;(async () => {
      try {
        const s = await Location.watchHeadingAsync((h) => {
          const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading
          setTel((prev) => ({ ...prev, compass: { kind: 'compass', ts: Date.now(), heading, accuracy: h.accuracy } }))
        })
        if (cancelled) s.remove()
        else sub = s
      } catch {
        /* heading unavailable */
      }
    })()
    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled, wantCompass])

  // Speed via GPS (coords.speed is m/s; -1 / null ⇒ unknown).
  useEffect(() => {
    if (!enabled || !wantSpeed) return
    let sub: Location.LocationSubscription | null = null
    let cancelled = false
    ;(async () => {
      try {
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 1000, distanceInterval: 0 },
          (pos) => setTel((prev) => ({ ...prev, speed: { kind: 'speed', ts: Date.now(), mps: pos.coords.speed ?? -1 } })),
        )
        if (cancelled) s.remove()
        else sub = s
      } catch {
        /* position unavailable */
      }
    })()
    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled, wantSpeed])

  return tel
}
