// src/components/features/clip/useTimelineScroll.ts
//
// The universal timeline SCROLL ENGINE (DESIGN.md "Timeline core principles"). Reanimated, UI-thread:
// a `progress` (0..1 = centre TIME over the content) + `zoom` (multiplier; 1 = content spans the
// field). Pan scrubs → progress, with clamped `withDecay` release inertia; pinch → zoom, pinned to
// the centre; vertical passes through to a parent scroll. Half-field head/tail padding so the centre
// playhead reaches the very first/last frame.
//
// LINEAR axis (a single content span). The Clips-page ClipsTimeline keeps its own bespoke engine
// for the collapsed-gap / reaper / live-build axis — see DESIGN.md decision log (Timeline core
// principles → scope B). This hook is the shared engine for the simple case (the segment shelf +
// any future single-span timeline) and is modelled on ClipsTimeline's mechanics so the FEEL matches.
//
// Seek is decoupled: the translate animates on the UI thread; the video seek is a THROTTLED JS
// callback (`onScrub`) fired only while scrubbing/decaying (never during programmatic playback via
// `setProgress`), so playback doesn't seek itself.

import { useCallback, useMemo, useRef, useState } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withDecay,
  cancelAnimation,
  runOnJS,
  clamp,
} from 'react-native-reanimated'

const SEEK_THROTTLE_MS = 80
const clampJS = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

type Opts = {
  fieldW: number // visible timeline width
  contentMs: number // total content duration
  minZoom?: number
  maxZoom?: number
  onScrubStart?: () => void // a grab begins (caller pauses playback)
  onScrub?: (ms: number) => void // throttled, as the centre time changes (drag + decay) → seek
  onSettle?: (ms: number) => void // after a flick's decay settles → final seek + resume play
}

export function useTimelineScroll({ fieldW, contentMs, minZoom = 0.5, maxZoom = 8, onScrubStart, onScrub, onSettle }: Opts) {
  const progress = useSharedValue(0) // 0..1 centre time over the content
  const zoom = useSharedValue(1)
  const scrubbing = useSharedValue(false) // true during a drag + its decay → enables JS seeks
  const progStart = useSharedValue(0)
  const zoomStart = useSharedValue(1)
  const [zoomState, setZoomState] = useState(1) // JS mirror (drives the content/cell width)

  // Stable callbacks for runOnJS (so the gesture isn't rebuilt every render).
  const cbRef = useRef({ onScrubStart, onScrub, onSettle, contentMs })
  cbRef.current = { onScrubStart, onScrub, onSettle, contentMs }
  const seekThrottleRef = useRef(0)
  const emitStart = useCallback(() => cbRef.current.onScrubStart?.(), [])
  const emitScrub = useCallback((p: number) => {
    const now = Date.now()
    if (now - seekThrottleRef.current < SEEK_THROTTLE_MS) return
    seekThrottleRef.current = now
    cbRef.current.onScrub?.(clampJS(p, 0, 1) * cbRef.current.contentMs)
  }, [])
  const emitSettle = useCallback((p: number) => cbRef.current.onSettle?.(clampJS(p, 0, 1) * cbRef.current.contentMs), [])
  const mirrorZoom = useCallback((z: number) => setZoomState(z), [])

  // Seek during a scrub/decay (throttled). Gated to `scrubbing` so programmatic playback (setProgress)
  // never seeks the video to where it already is.
  useAnimatedReaction(
    () => (scrubbing.value ? progress.value : -1),
    (cur, prev) => {
      if (cur >= 0 && cur !== prev) runOnJS(emitScrub)(cur)
    },
  )

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        'worklet'
        cancelAnimation(progress)
        progStart.value = progress.value
        scrubbing.value = true
        runOnJS(emitStart)()
      })
      .onUpdate((e) => {
        'worklet'
        const w = fieldW * zoom.value
        if (w <= 0) return
        progress.value = clamp(progStart.value - e.translationX / w, 0, 1) // drag right → earlier
      })
      .onEnd((e) => {
        'worklet'
        const w = fieldW * zoom.value
        const vel = w > 0 ? -e.velocityX / w : 0 // progress units / s
        progress.value = withDecay({ velocity: vel, clamp: [0, 1], deceleration: 0.998 }, (finished) => {
          'worklet'
          scrubbing.value = false
          if (finished) runOnJS(emitSettle)(progress.value)
        })
      })
    const pinch = Gesture.Pinch()
      .onBegin(() => {
        'worklet'
        zoomStart.value = zoom.value
      })
      .onUpdate((e) => {
        'worklet'
        zoom.value = clamp(zoomStart.value * e.scale, minZoom, maxZoom)
        runOnJS(mirrorZoom)(zoom.value) // JS mirror → cells re-tile (throttled by React batching)
      })
      .onEnd(() => {
        'worklet'
        runOnJS(mirrorZoom)(zoom.value)
      })
    return Gesture.Simultaneous(pan, pinch)
  }, [fieldW, minZoom, maxZoom, emitStart, emitScrub, emitSettle, mirrorZoom, progress, zoom, scrubbing, progStart, zoomStart])

  // The strip translates the content under the centre; head/tail = half-field padding each side.
  const stripStyle = useAnimatedStyle(() => ({
    width: fieldW + fieldW * zoom.value,
    transform: [{ translateX: -progress.value * fieldW * zoom.value }],
  }))
  // The clip block sits at headPad (fieldW/2), width = content width (animates with zoom).
  const blockStyle = useAnimatedStyle(() => ({ left: fieldW / 2, width: fieldW * zoom.value }))

  // Imperative centre (playback follow + transport jumps). Writes the shared value; emits NO seek.
  const setProgress = useCallback(
    (p: number) => {
      cancelAnimation(progress)
      scrubbing.value = false
      progress.value = clampJS(p, 0, 1)
    },
    [progress, scrubbing],
  )

  return { gesture, stripStyle, blockStyle, zoomState, blockW: fieldW * zoomState, setProgress }
}
