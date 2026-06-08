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
- **iOS:** ✅ **DONE — CONFIRMED ON DEVICE (2026-06-07).** The local preview now
  renders via `AVCaptureVideoPreviewLayer` (off the WebRTC capturer's shared
  `AVCaptureSession`) and **stays vertical at every tilt — a continuous gimbal,
  matching Android.** Key finding: the preview layer is **already upright on its
  own**, so **no rotation and no cover-zoom are applied** (`GIMBAL_GAIN = 0`).
  (Earlier theory — incl. this doc's "native iOS Camera / AVCaptureVideoPreviewLayer
  snaps" claim — was wrong for this session's preview layer; it's continuous.)
- (Earlier: clean-discrete `RTCMTLVideoView` baseline — superseded; the discrete
  `rotationOverride` patch path is retained as an untouched fallback.)

## Pinch-to-zoom — real camera zoom (2026-06-08)

Pinch = **real camera zoom** on both platforms, so the broadcast + rolling
buffer zoom too (not a preview-only transform). Double-tap resets to 1×, 5× cap,
and a shared `2.4×` indicator pill (`flashZoom` in `StreamScreen`) fades in
during the gesture. Zoom resets on camera flip (silent). Both need an EAS rebuild.

**Status:** iOS ✅ confirmed on device (2026-06-08). Android ⏳ built, awaiting
an on-device pass (the reflection path + RNGH gesture on the SurfaceView).

**iOS** — `WRLDCameraPreviewView` handles a `UIPinchGestureRecognizer` (+ a
2-tap `UITapGestureRecognizer`) that drives the active
`AVCaptureDevice.videoZoomFactor` (device resolved from the session inputs each
pinch, so it follows a flip). Reports the factor up via the `onZoomChange`
RCTDirectEventBlock for the pill. Cap = `min(activeFormat.videoMaxZoomFactor, 5)`.

**Android** — `RTCView` has no zoom path and the camera is in the prebuilt
`org.webrtc` capturer, so the pinch is detected in JS (RNGH `Gesture.Pinch` +
`Gesture.Tap` around the preview) and drives a new
`WebRTCModule.mediaStreamTrackSetVideoZoom` patch method →
`GetUserMediaImpl.setVideoZoom` → **`CameraZoomHelper`**, which reaches the live
Camera2 `CameraCaptureSession` by **reflection (matched by field TYPE, not
name)** and re-issues the repeating request with `SCALER_CROP_REGION` (true
sensor crop = crisp), preserving the capturer's fps. **Fail-safe:** any
reflection failure no-ops (camera never breaks); a future lib bump degrades to
"zoom stops working", not a crash. Camera1 devices fall through to no-op.

## BUILT — `AVCaptureVideoPreviewLayer` continuous gimbal (2026-06-07)

Implements the decision below. The local iOS preview now renders the raw camera
feed via an `AVCaptureVideoPreviewLayer` tapped off the WebRTC capturer's
existing `AVCaptureSession` (reused, never re-opened), counter-rotated by the
physical roll (`tiltDeg`) and cover-scaled so it stays vertical at any tilt.

**Native (new files, react-native-webrtc patch — `eas build` required):**
- `ios/RCTWebRTC/WRLDCameraPreviewView.{h,m}` — the `UIView`. Resolves
  `streamURL` → first video track → `track.captureController`
  (`VideoCaptureController`) → `.capturer.captureSession`, attaches a preview
  layer (`videoGravity = resizeAspectFill`, connection pinned to portrait), and
  on `rotationDeg`/`mirror`/`layoutSubviews` applies
  `affineTransform = scale(cover) · rotate(rad) · scale(mirror,1)` with implicit
  CA animation disabled. Cover-scale = the doc's `max((W·|cos|+H·|sin|)/W, …)`.
- `ios/RCTWebRTC/WRLDCameraPreviewManager.m` — `RCTViewManager`, exposes the
  native component **`WRLDCameraPreview`** with props `streamURL` (NSString),
  `rotationDeg` (number), `mirror` (BOOL). Auto-registered (RCT_EXPORT_MODULE);
  the podspec globs `ios/**/*.{h,m}` so the new files compile on `pod install`.
- The existing `rotationOverride` / `transformRotationDeg` RTCView patch is left
  in place (untouched fallback); the patch was regenerated with `patch-package`.

**JS:**
- `src/components/native/CameraPreview.tsx` — `requireNativeComponent`
  wrapper (iOS only; renders null elsewhere).
- `StreamScreen.tsx` — iOS local preview now renders `<CameraPreview>` (Android
  keeps `<RTCView>` cover). `previewGimbalDeg = GIMBAL_BASE + GIMBAL_SIGN *
  gimbalMirrorSign * tiltDeg` (constants in-file, hot-reloadable). The TEMP
  debug readout now shows `tilt`/`gimbal`/`rec` (kept until calibrated).

**Calibration result (on device, 2026-06-07):** the raw preview layer holds
vertical at all tilts with **`GIMBAL_GAIN = 0`** (no rotation, no zoom). Trying
gain ±1 each tilted it the opposite way symmetrically — that symmetry is what
revealed the natural zero. The rotation/cover-scale knob (`GIMBAL_GAIN` in
`StreamScreen.tsx`, native cover-scale in `WRLDCameraPreviewView`) is **kept but
inert** as a hot-reloadable safety valve in case a future device rides the tilt.
The TEMP debug readout has been removed.

**Remaining (separate task):** the **recording** orientation bake — see
"Recording orientation" below — still needs its own on-device calibration. It is
independent of the (now-done) preview gimbal.

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

## Path forward — DECIDED: `AVCaptureVideoPreviewLayer` + continuous transform

**Decision (owner, 2026-06-07):** go beyond native iOS to Android-continuous,
using Apple's native preview layer rotated ourselves — try this **before** a
from-scratch Metal renderer (it's "more native" and likely less work).

The native iOS camera renders its preview with **`AVCaptureVideoPreviewLayer`**
(AVFoundation), not Metal. We can use that same layer for our LOCAL preview and
apply a **continuous rotation** to it ourselves to get the gimbal Android has.

### Plan

1. **Get the camera's `AVCaptureSession`.** It's owned by react-native-webrtc's
   `RTCCameraVideoCapturer` (created on `getUserMedia`). `VideoCaptureController.m`
   holds `@property RTCCameraVideoCapturer *capturer`, which exposes
   `.captureSession`. The main plumbing task is surfacing that session to the
   preview view (track → capturer → session). The preview is the RAW camera feed
   (same camera), decoupled from the WebRTC track — exactly how the native Camera
   app works (preview ≠ the encode path). WebRTC still captures + transmits.
   ⚠️ One camera = one session; do NOT open a second `AVCaptureSession` (conflict)
   — reuse WebRTC's.
2. **Render the local preview via `AVCaptureVideoPreviewLayer`** on that session,
   `videoGravity = resizeAspectFill` (cover). Use it for the local preview
   instead of `RTCMTLVideoView` (remote/viewer keeps `RTCMTLVideoView`).
3. **Rotate it continuously:** apply a `CATransform3D` Z-rotation to the layer
   driven by `tiltDeg` (counter the physical roll → stays vertical), **plus
   cover-scale** (formula above) so it always fills as it rotates. Disable
   implicit CA animation for smooth tracking.
4. **Handle the front-camera mirror** and follow bounds on `layoutSubviews`.
5. **Wire from JS:** a continuous-angle prop fed by `tiltDeg`
   (`useDeviceOrientation`), local preview only.

### Notes / gotchas

- Continuous fill ⟹ cover-zoom that grows with tilt — **expected** (Android does
  this too; it is not the old "bad zoom", which was discrete cover at 90°).
- Calibrate the rotation sign + base on device (sign flips were the recurring
  issue; keep them as single constants).
- Likely delivered via the existing `patch-package` patch (new native view /
  prop) or a small native module + RN component. Native ⟹ `eas build` cycles.
- Fallback if `AVCaptureVideoPreviewLayer` can't be cleanly wired: the custom
  `MTKView` renderer (receive `RTCVideoFrame`s as an `RTCVideoRenderer`, draw the
  texture with rotation+scale). Same idea, more code.

### When this lands

- Remove the TEMP debug-readout overlay in `StreamScreen`.
- The discrete `rotationOverride` path can stay as an Android-untouched / fallback,
  or be removed for iOS once the continuous layer is in.

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
