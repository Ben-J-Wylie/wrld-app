import { useEffect, useRef, useState } from 'react'
import { Accelerometer } from 'expo-sensors'

// Physical device orientation, sensed from the accelerometer's gravity vector.
//
// Why the accelerometer and not expo-screen-orientation / Dimensions: the app is
// LOCKED to portrait (app.json `orientation: 'portrait'`), so the OS interface
// orientation never changes and screen-orientation/Dimensions always report
// portrait. The gravity vector is physical — it tells us how the phone is actually
// being held even while the UI stays put. This lets the broadcast screen rotate
// just the camera preview (and signal the recording orientation) without unlocking
// the whole UI.
//
// Returns one of four orientations + the degrees the *content* must be rotated to
// appear upright. Both the preview transform and the recording's display-matrix
// rotation derive from `uprightDeg` (tunable — confirm signs on device).

export type DeviceOrientation = 'portrait' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right'

// Gravity dominance threshold (g). Above this on an axis ⟹ that axis is "down".
// A dead-band so a phone held flat (z dominant) doesn't flip-flop the reading.
const DOMINANCE = 0.6
// Hysteresis: require this many consecutive same-classification samples before
// committing, so small wobbles near a boundary don't thrash the orientation.
const STABLE_SAMPLES = 3
const UPDATE_MS = 200

// ── On-device tunables ───────────────────────────────────────────────────────
// Two separate rotation maps because the live preview and the recording live in
// different reference frames:
//
// PREVIEW_ROTATION_DEG — how many degrees to rotate the on-screen RTCView so the
//   composed scene looks upright. Portrait already renders upright (0); only the
//   landscape holds need a counter-rotation.
//
// RECORD_ROTATION_DEG — the display-matrix degrees the recorder bakes into the
//   fmp4 (sent to mediasoup as `rotationDeg`). Portrait is the empirically
//   confirmed 270 (the camera is pinned to the portrait interface, so -c:v copy
//   stores it sideways); landscape holds offset from there.
//
// Both are starting points — confirm each on device and flip the offending entry
// if the preview or the recording comes out rotated the wrong way / mirrored.
export const PREVIEW_ROTATION_DEG: Record<DeviceOrientation, number> = {
  portrait: 0,
  'landscape-left': 90,
  'landscape-right': 270,
  'portrait-upside-down': 180,
}
export const RECORD_ROTATION_DEG: Record<DeviceOrientation, number> = {
  portrait: 270,
  'landscape-left': 0,
  'landscape-right': 180,
  'portrait-upside-down': 90,
}

export function useDeviceOrientation(enabled = true): DeviceOrientation {
  const [orientation, setOrientation] = useState<DeviceOrientation>('portrait')
  const candidate = useRef<DeviceOrientation>('portrait')
  const stableCount = useRef(0)

  useEffect(() => {
    if (!enabled) return
    Accelerometer.setUpdateInterval(UPDATE_MS)
    const sub = Accelerometer.addListener(({ x, y }) => {
      // Classify from the dominant horizontal/vertical axis. iOS/Android gravity
      // sign conventions differ slightly; if landscape-left/right come out
      // swapped on device, flip the x comparisons here (single place to tune).
      let next: DeviceOrientation | null = null
      if (Math.abs(y) >= Math.abs(x) && Math.abs(y) >= DOMINANCE) {
        next = y <= 0 ? 'portrait' : 'portrait-upside-down'
      } else if (Math.abs(x) >= DOMINANCE) {
        next = x > 0 ? 'landscape-left' : 'landscape-right'
      }
      if (!next) return // phone near-flat — keep the last committed orientation

      if (next === candidate.current) {
        stableCount.current += 1
      } else {
        candidate.current = next
        stableCount.current = 1
      }
      if (stableCount.current >= STABLE_SAMPLES) {
        setOrientation((prev) => (prev === candidate.current ? prev : candidate.current))
      }
    })
    return () => sub.remove()
  }, [enabled])

  return orientation
}
