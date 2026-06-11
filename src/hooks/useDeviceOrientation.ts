import { useEffect, useRef, useState } from 'react'
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
// gravity minus user-acceleration), normalised so it's unit-agnostic. atan2(x, y)
// gives the roll: 0°=portrait, 180°=upside-down, ±90°=the two landscapes.
// BOTH platforms negate x/y: the gravity vector reads 180° off raw on both, so
// raw portrait lands at 180° (upside-down) and the two landscapes swap. Confirmed
// on-device 2026-06-10 — Android (@aaron, @aaron2) was misreading portrait as
// portrait-upside-down and landscapes reversed because it was NOT negating (the
// old "iOS/Android opposite signs" assumption was wrong). Negating both fixes the
// fine 4-way hold, which the recording's landscape direction depends on. (The live
// preview is unaffected — GIMBAL_GAIN is 0, so tiltDeg never drives it.) If a hold
// is ever misread on a new platform, this negation is the place to flip.
function rollDeg(gx: number, gy: number, gz: number): number | null {
  const mag = Math.hypot(gx, gy, gz) || 1
  const x = -gx / mag
  const y = -gy / mag
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
// (sent to mediasoup as `rotationDeg`). VERIFIED by inspecting the actual recorded
// sensor frames off disk (2026-06-08): for each landscape hold, the raw frame
// (rotationDeg 0 = no matrix) showed whether 0 or 180 yields upright.
//   • portrait              = 270 (confirmed: raw landscape → 270 = upright)
//   • landscape-left        = 180 (its raw sensor frame is upside-down → +180)
//   • landscape-right       = 0   (its raw sensor frame is already upright)
//   • portrait-upside-down  = 90  (opposite of portrait; not yet device-verified)
// Note: the recording bakes ONCE ~1s after the first camera frame (it's -c:v
// copy), so the hold AT GO-LIVE is what the whole session records as — hold the
// target orientation steady through preview before Go Live.
// (PREVIEW no longer uses a discrete map — it gimbal-levels off `tiltDeg`.)
export const RECORD_ROTATION_DEG: Record<DeviceOrientation, number> = {
  portrait: 270,
  'landscape-left': 180,
  'landscape-right': 0,
  'portrait-upside-down': 90,
}

// Frame-rotation override for the LOCAL preview (RTCView `rotationOverride`, our
// react-native-webrtc patch). Must be one of 0/90/180/270 (RTCVideoRotation).
// Replaces the capturer's janky UIDevice auto-rotation with a clean, deliberate
// value per orientation so the preview snaps portrait/landscape without the 180°
// spin. On-device tunable — start equal to the record bake and adjust per hold.
export const PREVIEW_FRAME_ROTATION: Record<DeviceOrientation, number> = {
  portrait: 90,
  'landscape-left': 180,
  'landscape-right': 0,
  'portrait-upside-down': 270,
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

    // Start the plain Accelerometer IMMEDIATELY (needs no permission, fires within
    // ~50ms) so the discrete orientation settles in ~200ms. This matters at GO-LIVE:
    // the recorder bakes the recording's display rotation ~1-2s after the first
    // camera frame from whatever orientation we've reported, and the bake is fixed
    // for the session (-c:v copy). If we instead block on the DeviceMotion
    // availability/permission flow first (which can take ~2s on Android), the sensor
    // reports nothing until then, the recorder bakes the default portrait, and a
    // landscape start records sideways. So: accelerometer now for a fast first read,
    // then UPGRADE to gyro-fused DeviceMotion for the smooth gimbal once it's ready.
    Accelerometer.setUpdateInterval(UPDATE_MS)
    const accelSub = Accelerometer.addListener(({ x, y, z }) => process(x, y, z ?? 0))
    sub = accelSub

    ;(async () => {
      // Prefer DeviceMotion (gyro-fused gravity — smooth through a turn), but it
      // needs a motion-permission grant + availability on iOS. The Accelerometer
      // above already covers the fallback, so this only UPGRADES when available.
      let useDM = false
      try {
        if (await DeviceMotion.isAvailableAsync()) {
          let perm = await DeviceMotion.getPermissionsAsync()
          if (!perm.granted && perm.canAskAgain) perm = await DeviceMotion.requestPermissionsAsync()
          useDM = perm.granted
        }
      } catch {}
      if (cancelled || !useDM) return // accelerometer stays as-is

      // Swap the accelerometer for DeviceMotion (drop the old listener first).
      accelSub.remove()
      DeviceMotion.setUpdateInterval(UPDATE_MS)
      const dmSub = DeviceMotion.addListener((d) => {
        const g = d.accelerationIncludingGravity
        if (!g) return
        const u = d.acceleration // user accel — subtract to recover clean gravity
        process(g.x - (u?.x ?? 0), g.y - (u?.y ?? 0), g.z - (u?.z ?? 0))
      })
      sub = dmSub
    })()

    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled])

  return { orientation, tiltDeg }
}
