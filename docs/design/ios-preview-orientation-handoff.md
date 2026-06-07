# iOS broadcast preview orientation — handoff

Status as of 2026-06-07. Pick this up in a fresh context.

## Goal

The broadcaster's **live camera preview** (`StreamScreen`, the local/own-camera
view) should keep the subject **vertical at any phone tilt** — a continuous
"gimbal", **matching Android, which already does this**. The app is portrait-
locked (`app.json` `orientation: portrait`) and the controls stay portrait.
**Discrete snapping is NOT acceptable** to the product owner.

This is the **preview** only. The **recording** orientation is a separate,
server-side concern (see "Recording" below) and is not what this doc is about.

## Current status

- **Android:** continuous-vertical, correct. This is the reference. Untouched.
- **iOS:** currently **clean discrete** — correct portrait/landscape, snaps at
  ~45°, no zoom (`objectFit: contain`). Works, but snaps — **not** the goal.
- The continuous attempt was reverted to this clean-discrete baseline.

## Why iOS can't do continuous with the current stack (dead-ends — don't repeat)

- **`RTCMTLVideoView`** (react-native-webrtc's iOS renderer) fits the video
  correctly **only via discrete frame rotation** (`RTCVideoRotation` enum =
  0/90/180/270). Discrete ⟹ it snaps.
- A **`CGAffineTransform` rotation on the video view** rotates continuously, but
  the fit is computed *before* the transform → heavy crop / letterbox / zoom; and
  combined with frame rotation it composes unpredictably (a forward-then-back
  **sawtooth** as you turn).
- A **parent-`View` transform** (JS wrapper) rotates the box but NOT the video
  content — iOS re-orients the texture under it.
- **Accelerometer-only** sensing can't track *during* motion (gravity is
  corrupted by movement) → switched to **`DeviceMotion`** (gyro-fused gravity),
  which is smooth.
- **The native iOS Camera app is also discrete** (`AVCaptureVideoPreviewLayer` —
  snaps, rides the tilt; it is NOT a gimbal). So "match the native iOS camera" ≠
  continuous. The target is **Android's** behavior, which is beyond what Apple's
  own camera does. There is no "use the native API and get continuous for free"
  shortcut.
- **Conclusion:** continuous-vertical on iOS requires a **custom Metal /
  `MTKView` renderer** that draws the WebRTC frame texture with an arbitrary
  rotation + scale.

## Current code (committed on `main`)

- **`patches/react-native-webrtc+124.0.7.patch`** (patch-package; applied via the
  `postinstall` hook). Adds two props to `RTCView` (iOS):
  - **`rotationOverride`** (number): a proxy `RTCVideoRenderer`
    (`WRLDRotationRenderer` in `RTCVideoViewManager.m`) rewrites each local
    frame's `RTCVideoRotation` to a fixed value — kills the capturer's janky
    `UIDevice` auto-rotation. Drives the clean **discrete** orientation.
  - **`transformRotationDeg`** (number): a continuous `CGAffineTransform`
    rotation on `self.videoView` (composed with `mirror`, implicit layer
    animation disabled). Currently fed `0` (continuous residual disabled — it
    caused the sawtooth).
  - TS types added in `src/RTCView.ts` + `lib/typescript/RTCView.d.ts`.
- **`src/hooks/useDeviceOrientation.ts`**: `DeviceMotion`-based (Accelerometer
  fallback), returns `{ orientation, tiltDeg }` — `orientation` is the 4-way
  discrete hold (hysteresis), `tiltDeg` is the **continuous smoothed roll** in
  degrees. Also exports `RECORD_ROTATION_DEG` (recording bake) and
  `PREVIEW_FRAME_ROTATION` (now unused).
- **`src/components/screens/StreamScreen.tsx`**: local preview `RTCView` (iOS
  only): `rotationOverride` = nearest 90° of `(90 + tiltDeg)` (correct discrete
  orientation), `transformRotationDeg` = `0`, `objectFit` = `contain`. Android:
  no override, `cover`. There is a **TEMP on-screen debug readout** overlay
  (Platform / hold / tilt / step / rec) — remove when done. (An orientation
  *unlock* approach was tried and reverted; the app stays portrait-locked.)

## Calibration facts (confirmed on device)

- `tiltDeg`: 0 = portrait, ≈ −90 = landscape-right, ≈ +90 = landscape-left,
  ≈ 180 = upside-down.
- **Nearest 90° of `(90 + tiltDeg)`** gives the correct upright discrete
  orientation for every hold (verified — portrait and both landscapes correct).
- A continuous video rotation that fills a portrait screen inherently needs
  **cover-scale** (zoom that grows with the rotation) or it letterboxes — there
  is no zoom-free continuous fill. Cover-scale for screen `W×H` at angle θ:
  `scale = max((W·|cosθ| + H·|sinθ|)/W, (W·|sinθ| + H·|cosθ|)/H)` (= 1 at 0°).

## Path forward — custom Metal renderer

Build an `MTKView`-based renderer for the **local preview only** (remote/viewer
keeps `RTCMTLVideoView`):

1. Add it as an `RTCVideoRenderer` on the local track (same hook point as the
   proxy) to receive `RTCVideoFrame` / `CVPixelBuffer`.
2. Draw the texture with an **arbitrary continuous rotation** (counter the
   physical roll, i.e. driven by `tiltDeg`) **+ cover-scale** so it stays
   vertical AND fills the screen with no letterbox.
3. Expose a continuous-angle prop; drive it from JS with `tiltDeg`.
4. Handle the **front-camera mirror**.

Wire it into the patch (new native view) or a small native module + a new RN
component used for the local preview. Expect device-test cycles (native).

## Workflow

- Dev on the desktop (Windows). **JS changes → Metro Fast Refresh.** **Native /
  patch changes → `eas build --profile development --platform ios`** (the
  `postinstall` runs `patch-package`; `npm ci` re-applies the patch).
- Commit to `main`; pull on the desktop.

## Recording orientation (separate, still owed)

The saved video's orientation is baked **server-side** (mediasoup
`-display_rotation` display matrix, driven by `broadcasterOrientation.rotationDeg`
from the app's discrete orientation; portrait bake = 270 confirmed). It still
needs its own quick calibration: go live held portrait, save a clip, check
playback; repeat held landscape; adjust `RECORD_ROTATION_DEG`. This is
independent of the preview gimbal.
