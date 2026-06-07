import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Accelerometer } from 'expo-sensors'

// Physical device orientation + continuous tilt, sensed from the accelerometer's
// gravity vector.
//
// Why the accelerometer and not expo-screen-orientation / Dimensions: the app is
// LOCKED to portrait (app.json `orientation: 'portrait'`), so the OS interface
// orientation never changes and screen-orientation/Dimensions always report
// portrait. The gravity vector is physical — it tells us how the phone is actually
// being held even while the UI stays put.
//
// Returns:
//  • `orientation` — discrete (4-way), used for the RECORDING display-matrix bake
//    (the recorder is -c:v copy → one rotation per go-live, can't level per-frame).
//  • `tiltDeg` — continuous roll angle (deg) used to GIMBAL-LEVEL the live preview
//    so it stays upright at any tilt. The discrete preview angles that worked are
//    just samples of this same angle.

export type DeviceOrientation = 'portrait' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right'

// Below this gravity magnitude in the screen plane the phone is ~flat (face up/
// down) — keep the last reading rather than flip-flopping.
const FLAT_GUARD = 0.45
// Hysteresis for the discrete orientation: this many consecutive same samples
// before committing, so wobble near a 45° boundary doesn't thrash the recording.
const STABLE_SAMPLES = 4
// Fast sampling so the gimbal preview tracks smoothly; the angle is low-pass
// smoothed and only re-rendered when it moves enough to matter.
const UPDATE_MS = 60
const SMOOTH = 0.35 // exponential smoothing factor for tiltDeg
const MIN_DELTA_DEG = 0.75 // skip a state update if the angle barely moved

// iOS and Android report opposite accelerometer X/Y signs. Calibrated to Android
// (held upright-portrait, y reads positive); iOS negates both axes. atan2(x, y)
// gives the roll angle: 0°=portrait, 180°=upside-down, +90°/−90°=the two
// landscapes. If a hold is misread on a platform, this sign pair is the place to flip.
function rollDeg(xRaw: number, yRaw: number): number | null {
  const x = Platform.OS === 'ios' ? -xRaw : xRaw
  const y = Platform.OS === 'ios' ? -yRaw : yRaw
  if (Math.hypot(x, y) < FLAT_GUARD) return null // phone ~flat — undefined roll
  return (Math.atan2(x, y) * 180) / Math.PI // -180..180, 0 = upright portrait
}

function orientationFromDeg(deg: number): DeviceOrientation {
  if (deg > -45 && deg <= 45) return 'portrait'
  if (deg > 45 && deg <= 135) return 'landscape-left'
  if (deg > 135 || deg <= -135) return 'portrait-upside-down'
  return 'landscape-right' // -135..-45
}

// ── On-device tunables ───────────────────────────────────────────────────────
// RECORD_ROTATION_DEG — display-matrix degrees the recorder bakes into the fmp4
// (sent to mediasoup as `rotationDeg`). Portrait is the confirmed 270; landscape
// holds offset from there. Confirm on device via a saved clip and flip if wrong.
// (PREVIEW no longer uses a discrete map — it gimbal-levels off `tiltDeg`.)
export const RECORD_ROTATION_DEG: Record<DeviceOrientation, number> = {
  portrait: 270,
  'landscape-left': 0,
  'landscape-right': 180,
  'portrait-upside-down': 90,
}

export type DeviceTilt = { orientation: DeviceOrientation; tiltDeg: number }

export function useDeviceOrientation(enabled = true): DeviceTilt {
  const [orientation, setOrientation] = useState<DeviceOrientation>('portrait')
  const [tiltDeg, setTiltDeg] = useState(0)
  const candidate = useRef<DeviceOrientation>('portrait')
  const stableCount = useRef(0)
  const smoothed = useRef(0)
  const lastEmitted = useRef(0)

  useEffect(() => {
    if (!enabled) return
    Accelerometer.setUpdateInterval(UPDATE_MS)
    const sub = Accelerometer.addListener(({ x, y }) => {
      const deg = rollDeg(x, y)
      if (deg == null) return // ~flat — keep the last reading

      // Continuous, wrap-safe exponential smoothing for the gimbal preview.
      let delta = deg - smoothed.current
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      let next = smoothed.current + SMOOTH * delta
      if (next > 180) next -= 360
      else if (next <= -180) next += 360
      smoothed.current = next
      if (Math.abs(next - lastEmitted.current) >= MIN_DELTA_DEG) {
        lastEmitted.current = next
        setTiltDeg(next)
      }

      // Discrete orientation (for the recording) with hysteresis.
      const o = orientationFromDeg(deg)
      if (o === candidate.current) {
        stableCount.current += 1
      } else {
        candidate.current = o
        stableCount.current = 1
      }
      if (stableCount.current >= STABLE_SAMPLES) {
        setOrientation((prev) => (prev === candidate.current ? prev : candidate.current))
      }
    })
    return () => sub.remove()
  }, [enabled])

  return { orientation, tiltDeg }
}
