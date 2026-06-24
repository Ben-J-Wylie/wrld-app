// src/components/features/clip/useTimelineScroll.ts
//
// The universal timeline SCROLL ENGINE (DESIGN.md "Timeline core principles"). Reanimated, UI-thread.
//
// Animates the PIXEL translate `tx` (in [-contentW, 0]; 0 = head, -contentW = tail) — NOT a
// normalised 0..1 — so `withDecay`'s deceleration physics match the Clips page exactly (decaying a
// 0..1 value covers a tiny range → abrupt stop; pixels glide). `zoom` scales the content width.
//
// Pan → scrub with clamped `withDecay` release inertia; pinch → zoom pinned to centre; vertical
// passes through to a parent scroll. Half-field head/tail padding so the centre playhead reaches the
// first/last frame. PLAYBACK is playhead-driven: `startPlayback()` glides `tx` to the tail over the
// remaining real time on the UI thread (`withTiming` linear) — the video follows; no per-frame JS
// polling of `video.currentTime` (that was the jitter). Seek is a THROTTLED JS callback fired only
// while scrubbing/decaying (never during playback, so playback doesn't seek itself).
//
// LINEAR axis (single content span). ClipsTimeline keeps its bespoke collapsed-gap/reaper engine —
// see DESIGN.md decision log (Timeline core principles → scope B).

import { useCallback, useMemo, useRef, useState } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withDecay,
  withTiming,
  cancelAnimation,
  runOnJS,
  clamp,
  Easing,
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
  onPlayEnd?: () => void // the playback glide reached the tail
}

export function useTimelineScroll({
  fieldW,
  contentMs,
  minZoom = 0.5,
  maxZoom = 8,
  onScrubStart,
  onScrub,
  onSettle,
  onPlayEnd,
}: Opts) {
  const tx = useSharedValue(0) // px translateX, [-contentW, 0]
  const zoom = useSharedValue(1)
  const scrubbing = useSharedValue(false) // true during a drag + its decay → enables JS seeks
  const txStart = useSharedValue(0)
  const zoomStart = useSharedValue(1)
  const [zoomState, setZoomState] = useState(1) // JS mirror (drives the content/cell width)

  // Stable callbacks for runOnJS (so the gesture isn't rebuilt every render).
  const cbRef = useRef({ onScrubStart, onScrub, onSettle, onPlayEnd })
  cbRef.current = { onScrubStart, onScrub, onSettle, onPlayEnd }
  const seekThrottleRef = useRef(0)
  const emitStart = useCallback(() => cbRef.current.onScrubStart?.(), [])
  const emitScrub = useCallback((ms: number) => {
    const now = Date.now()
    if (now - seekThrottleRef.current < SEEK_THROTTLE_MS) return
    seekThrottleRef.current = now
    cbRef.current.onScrub?.(ms)
  }, [])
  const emitSettle = useCallback((ms: number) => cbRef.current.onSettle?.(ms), [])
  const emitPlayEnd = useCallback(() => cbRef.current.onPlayEnd?.(), [])
  const mirrorZoom = useCallback((z: number) => setZoomState(z), [])

  // Seek during a scrub/decay (throttled). Gated to `scrubbing` so the playback glide never seeks.
  useAnimatedReaction(
    () => (scrubbing.value ? tx.value : 1),
    (cur, prev) => {
      if (scrubbing.value && cur !== prev) {
        const cw = fieldW * zoom.value
        const ms = cw > 0 ? clamp(-cur / cw, 0, 1) * contentMs : 0
        runOnJS(emitScrub)(ms)
      }
    },
  )

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        'worklet'
        cancelAnimation(tx)
        txStart.value = tx.value
        scrubbing.value = true
        runOnJS(emitStart)()
      })
      .onUpdate((e) => {
        'worklet'
        const cw = fieldW * zoom.value
        tx.value = clamp(txStart.value + e.translationX, -cw, 0) // drag right → tx↑ → earlier
      })
      .onEnd((e) => {
        'worklet'
        const cw = fieldW * zoom.value
        tx.value = withDecay({ velocity: e.velocityX, clamp: [-cw, 0], deceleration: 0.998 }, (finished) => {
          'worklet'
          scrubbing.value = false
          if (finished) {
            const ms = cw > 0 ? clamp(-tx.value / cw, 0, 1) * contentMs : 0
            runOnJS(emitSettle)(ms)
          }
        })
      })
    const pinch = Gesture.Pinch()
      .onBegin(() => {
        'worklet'
        zoomStart.value = zoom.value
      })
      .onUpdate((e) => {
        'worklet'
        const oldCw = fieldW * zoom.value
        const prog = oldCw > 0 ? -tx.value / oldCw : 0 // keep the centre time fixed across the zoom
        zoom.value = clamp(zoomStart.value * e.scale, minZoom, maxZoom)
        tx.value = -prog * (fieldW * zoom.value)
        runOnJS(mirrorZoom)(zoom.value)
      })
      .onEnd(() => {
        'worklet'
        runOnJS(mirrorZoom)(zoom.value)
      })
    return Gesture.Simultaneous(pan, pinch)
  }, [fieldW, contentMs, minZoom, maxZoom, emitStart, emitScrub, emitSettle, mirrorZoom, tx, zoom, scrubbing, txStart, zoomStart])

  // The strip translates the content under the centre; head/tail = half-field padding each side.
  const stripStyle = useAnimatedStyle(() => ({
    width: fieldW + fieldW * zoom.value,
    transform: [{ translateX: tx.value }],
  }))
  // The clip block sits at headPad (fieldW/2), width = content width (animates with zoom).
  const blockStyle = useAnimatedStyle(() => ({ left: fieldW / 2, width: fieldW * zoom.value }))

  // Imperative centre (transport jumps / replay-from-head). Writes the value; emits NO seek.
  const setProgress = useCallback(
    (p: number) => {
      cancelAnimation(tx)
      scrubbing.value = false
      tx.value = -clampJS(p, 0, 1) * (fieldW * zoom.value)
    },
    [fieldW, tx, zoom, scrubbing],
  )
  const getProgress = useCallback(() => {
    const cw = fieldW * zoom.value
    return cw > 0 ? clampJS(-tx.value / cw, 0, 1) : 0
  }, [fieldW, tx, zoom])
  // Playhead-driven playback: glide tx → tail over the remaining real time (UI thread, linear). The
  // caller plays the video alongside (they start synced from the last seek, both 1×). Smooth — no
  // per-frame JS / no video.currentTime polling.
  const startPlayback = useCallback(() => {
    const cw = fieldW * zoom.value
    if (cw <= 0) return
    scrubbing.value = false
    const prog = clampJS(-tx.value / cw, 0, 1)
    const remainingMs = contentMs * (1 - prog)
    if (remainingMs <= 0) return
    tx.value = withTiming(-cw, { duration: remainingMs, easing: Easing.linear }, (finished) => {
      'worklet'
      if (finished) runOnJS(emitPlayEnd)()
    })
  }, [fieldW, contentMs, emitPlayEnd, tx, zoom, scrubbing])
  const stopPlayback = useCallback(() => {
    cancelAnimation(tx)
  }, [tx])

  return { gesture, stripStyle, blockStyle, zoomState, blockW: fieldW * zoomState, setProgress, getProgress, startPlayback, stopPlayback }
}
