import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Accelerometer, DeviceMotion } from 'expo-sensors'

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

// Below this normalised in-plane gravity the phone is ~flat (face up/down) — keep
// the last reading rather than flip-flopping.
const FLAT_GUARD = 0.45
// Hysteresis for the discrete orientation: this many consecutive same samples
// before committing, so wobble near a 45° boundary doesn't thrash the recording.
const STABLE_SAMPLES = 4
// DeviceMotion sampling. Its gravity is gyro-fused (clean during motion), so we
// can smooth lightly and still track a turn smoothly.
const UPDATE_MS = 50
const SMOOTH = 0.5 // exponential smoothing factor for tiltDeg (higher = more responsive)
const MIN_DELTA_DEG = 0.5 // skip a state update if the angle barely moved

// Roll from the GYRO-FUSED gravity vector (DeviceMotion: accelerationIncluding
// gravity minus user-acceleration), normalised so it's unit-agnostic. iOS/Android
// report opposite X/Y signs — iOS negates both. atan2(x, y) gives the roll:
// 0°=portrait, 180°=upside-down, ±90°=the two landscapes. If a hold is misread on
// a platform, this sign pair is the place to flip.
function rollDeg(gx: number, gy: number, gz: number): number | null {
  const mag = Math.hypot(gx, gy, gz) || 1
  let x = gx / mag
  let y = gy / mag
  if (Platform.OS === 'ios') {
    x = -x
    y = -y
  }
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
    let cancelled = false
    let sub: { remove: () => void } | null = null

    // Process one gravity sample → smooth continuous tilt (gimbal) + discrete
    // orientation (recording). Same for both sensor sources.
    const process = (gx: number, gy: number, gz: number) => {
      const deg = rollDeg(gx, gy, gz)
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
    }

    ;(async () => {
      // Prefer DeviceMotion (gyro-fused gravity — smooth through a turn), but it
      // needs a motion-permission grant + availability on iOS. Fall back to the
      // raw Accelerometer (always fires, just can't track during fast motion) so
      // the gimbal never silently does nothing.
      let useDM = false
      try {
        if (await DeviceMotion.isAvailableAsync()) {
          let perm = await DeviceMotion.getPermissionsAsync()
          if (!perm.granted && perm.canAskAgain) perm = await DeviceMotion.requestPermissionsAsync()
          useDM = perm.granted
        }
      } catch {}
      if (cancelled) return

      if (useDM) {
        DeviceMotion.setUpdateInterval(UPDATE_MS)
        sub = DeviceMotion.addListener((d) => {
          const g = d.accelerationIncludingGravity
          if (!g) return
          const u = d.acceleration // user accel — subtract to recover clean gravity
          process(g.x - (u?.x ?? 0), g.y - (u?.y ?? 0), g.z - (u?.z ?? 0))
        })
      } else {
        Accelerometer.setUpdateInterval(UPDATE_MS)
        sub = Accelerometer.addListener(({ x, y, z }) => process(x, y, z ?? 0))
      }
    })()

    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled])

  return { orientation, tiltDeg }
}
