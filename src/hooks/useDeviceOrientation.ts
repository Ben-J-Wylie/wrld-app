import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
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

// Below this gravity magnitude in the screen plane the phone is ~flat (face up/
// down) — keep the last orientation rather than flip-flopping.
const FLAT_GUARD = 0.45
// Hysteresis: require this many consecutive same-classification samples before
// committing, so small wobbles near a boundary don't thrash the orientation.
const STABLE_SAMPLES = 3
const UPDATE_MS = 200

// iOS and Android report opposite accelerometer X/Y signs. Calibrated to Android
// (held upright-portrait, y reads positive); iOS negates both axes. atan2(x, y)
// then gives a stable tilt angle: 0°=portrait, 180°=upside-down, +90°/−90°=the
// two landscapes. If a hold is misread on a platform, this sign pair is the one
// place to flip.
function classify(xRaw: number, yRaw: number): DeviceOrientation | null {
  const x = Platform.OS === 'ios' ? -xRaw : xRaw
  const y = Platform.OS === 'ios' ? -yRaw : yRaw
  if (Math.hypot(x, y) < FLAT_GUARD) return null // phone ~flat
  const deg = (Math.atan2(x, y) * 180) / Math.PI // -180..180, 0 = upright portrait
  if (deg > -45 && deg <= 45) return 'portrait'
  if (deg > 45 && deg <= 135) return 'landscape-left'
  if (deg > 135 || deg <= -135) return 'portrait-upside-down'
  return 'landscape-right' // -135..-45
}

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
  'landscape-left': 270,
  'landscape-right': 90,
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
      const next = classify(x, y)
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
