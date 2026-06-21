import { useEffect, useRef } from 'react'
import { DeviceMotion } from 'expo-sensors'
import * as Location from 'expo-location'
import type { TelemetryPayload } from '@/lib/mediasoupSignaling'

// Broadcaster sensor capture: while live, reads the device sensors for each armed
// sensor source, throttles to the suggested rates, and emits `telemetry` messages
// (the broadcaster monitors its own sensors locally, so the relay only fans out to
// viewers). Sources:
//   • compass — expo-location watchHeadingAsync (already a dep, no extra sensor)
//   • speed   — NOT here. Speed rides StreamScreen's single broadcaster GPS watcher
//     (the same one that updates the stream pin) so we never run a 2nd concurrent
//     watchPositionAsync. See StreamScreen's "Single broadcaster GPS watcher".
//   • gyro / accel — expo-sensors DeviceMotion (ONE sensor → both; motion is
//     derived viewer-side from accel, so we don't run a second sensor or send it)
//   • torch — a control, not a sensor; emitted wherever the torch toggles (not here)
//   • temp  — no reliable phone sensor; armed-but-data-absent by design
// All sensor reads are guarded — a missing permission / unavailable sensor just
// means that visualizer stays idle on the viewer.

const RAD2DEG = 180 / Math.PI
const MOTION_HZ_MS = 100 // ~10 Hz for gyro/accel — plenty for the visualizers, and
                         // each sample is a viewer WS send, so lower = less radio too

type Sub = { remove: () => void }

export function useTelemetryCapture(
  airedKinds: Set<string>,
  sendTelemetry: (p: TelemetryPayload) => void,
  enabled: boolean,
) {
  // Keep the latest sender without re-subscribing the sensors each render.
  const sendRef = useRef(sendTelemetry)
  sendRef.current = sendTelemetry

  const wantGyro = airedKinds.has('gyro')
  // motion is derived viewer-side from accel, so arming either runs the accelerometer.
  const wantAccel = airedKinds.has('accel') || airedKinds.has('motion')
  const wantCompass = airedKinds.has('compass')

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
            // alpha/beta/gamma (rad) → yaw/pitch/roll (deg).
            sendRef.current({
              kind: 'gyro',
              ts,
              pitch: d.rotation.beta * RAD2DEG,
              roll: d.rotation.gamma * RAD2DEG,
              yaw: d.rotation.alpha * RAD2DEG,
            })
          }
          if (wantAccel) {
            // Gravity-included vector — the AccelerometerVisualizer's default range expects it.
            const a = d.accelerationIncludingGravity ?? d.acceleration
            if (a) sendRef.current({ kind: 'accel', ts, x: a.x, y: a.y, z: a.z })
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

  // Compass heading via the location stack (already a dep / permission).
  useEffect(() => {
    if (!enabled || !wantCompass) return
    let sub: Location.LocationSubscription | null = null
    let cancelled = false
    ;(async () => {
      try {
        const s = await Location.watchHeadingAsync((h) => {
          const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading
          sendRef.current({ kind: 'compass', ts: Date.now(), heading, accuracy: h.accuracy })
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
}
