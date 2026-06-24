// src/components/features/clip/SegmentPreview.tsx
//
// The top section of the segment settings shelf: a SQUARE clip viewer (left) + the editable
// title / date / time (right), then a THIN clip timeline (the clip skates left under a static
// centre red playhead, with half-field head/tail padding so the playhead reaches the clip's head
// and tail — same feel as the Clips page), then a transport (BufferTransport with the buffer
// head/tail buttons hidden — a single clip only snaps to its OWN head/tail).
//
// The timeline clip block uses the SAME film-cell band as the Clips-page ClipBlock (sprocket bands
// + constant-size square frame cells) and supports pinch-to-zoom (scales the clip's width → more
// cells, finer scrub). Self-contained: owns one expo-video player + the playhead. Starts PAUSED
// (no autoplay audio in a sheet). Horizontal scrub passes vertical through to the sheet scroll.

import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { GestureDetector } from 'react-native-gesture-handler'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Image } from 'expo-image'
import { Input } from '@/components/primitives/Input'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { BufferTransport } from './BufferTransport'
import { FilmStrip } from './FilmStrip'
import { useTimelineScroll } from './useTimelineScroll'
import { theme } from '@/tokens/theme'

const TIMELINE_H = 50
const FRAME_SEC = 0.3 // frame-step size for the transport chevrons
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

type Props = {
  manifestUrl: string | null
  posterUrl: string | null
  /** Clip span (wall-clock ms) — its length drives the timeline geometry. */
  startMs: number
  endMs: number
  titleValue: string
  onTitleChangeText: (t: string) => void
  onTitleCommit: () => void
  dateLabel: string
  rangeLabel: string
  onClose: () => void
}

export function SegmentPreview({
  manifestUrl,
  posterUrl,
  startMs,
  endMs,
  titleValue,
  onTitleChangeText,
  onTitleCommit,
  dateLabel,
  rangeLabel,
  onClose,
}: Props) {
  const hasMedia = !!manifestUrl
  const durationSec = Math.max(0.1, (endMs - startMs) / 1000)
  const durationMs = durationSec * 1000
  const player = useVideoPlayer(hasMedia ? { uri: manifestUrl!, contentType: 'hls' } : null, (p) => {
    p.timeUpdateEventInterval = 0.25
    p.loop = false
  })

  const [playing, setPlaying] = useState(false)
  const [fieldW, setFieldW] = useState(0)
  const progressRef = useRef(0) // JS mirror of the centre (0..1) for the transport + end check
  const wasPlaying = useRef(false)
  // The expo-video player is released when this unmounts (the sheet closes); any player call after
  // that throws FunctionCallException. Guard every access with this + try/catch.
  const aliveRef = useRef(true)
  const safe = (fn: () => void) => {
    if (!aliveRef.current) return
    try {
      fn()
    } catch {
      /* player released mid-teardown */
    }
  }
  useEffect(() => () => { aliveRef.current = false }, [])

  // The SHARED timeline scroll engine — inertia + pinch + centre playhead (DESIGN.md timeline
  // principles). It owns the gesture + the animated strip/block; we wire its scrub callbacks to the
  // video seek (the scrub path) and feed it the centre during playback (no seek).
  const ts = useTimelineScroll({
    fieldW,
    contentMs: durationMs,
    onScrubStart: () => {
      wasPlaying.current = playing
      if (playing) {
        safe(() => player.pause())
        setPlaying(false)
      }
    },
    onScrub: (ms) => {
      progressRef.current = clamp01(ms / durationMs)
      if (hasMedia) safe(() => (player.currentTime = ms / 1000))
    },
    onSettle: (ms) => {
      progressRef.current = clamp01(ms / durationMs)
      if (hasMedia) {
        safe(() => (player.currentTime = ms / 1000))
        if (wasPlaying.current) {
          safe(() => player.play())
          setPlaying(true)
        }
      }
    },
  })

  // Advance the playhead from the video while playing (RAF; feeds the engine, no seek). Pause at end.
  useEffect(() => {
    if (!playing || !hasMedia) return
    let raf = 0
    const tick = () => {
      if (!aliveRef.current) return
      try {
        const d = player.duration || durationSec
        const p = clamp01(player.currentTime / d)
        progressRef.current = p
        ts.setProgress(p)
        if (p >= 0.999) {
          player.pause()
          setPlaying(false)
          return
        }
      } catch {
        return // player released mid-frame
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hasMedia])

  // Jump the centre (transport / replay-from-head) — moves the engine + seeks the video.
  const goTo = (p: number) => {
    const c = clamp01(p)
    progressRef.current = c
    ts.setProgress(c)
    if (hasMedia) safe(() => (player.currentTime = c * durationSec))
  }
  const togglePlay = () => {
    if (!hasMedia) return
    if (playing) {
      safe(() => player.pause())
      setPlaying(false)
    } else {
      if (progressRef.current >= 0.999) goTo(0) // replay from head if parked at the tail
      safe(() => player.play())
      setPlaying(true)
    }
  }
  const toHead = () => goTo(0)
  const toTail = () => goTo(1)
  const frameBack = () => hasMedia && goTo(progressRef.current - FRAME_SEC / durationSec)
  const frameForward = () => hasMedia && goTo(progressRef.current + FRAME_SEC / durationSec)

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.viewer}>
          {hasMedia ? (
            // contain → letterbox/pillarbox within the square (no crop); the panel bg fills the bars.
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
          ) : posterUrl ? (
            <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.viewerEmpty]}>
              <Icon name="film" size="lg" color={theme.colors.text.subtle} />
            </View>
          )}
        </View>
        <View style={styles.headerText}>
          <Input
            value={titleValue}
            onChangeText={onTitleChangeText}
            onEndEditing={onTitleCommit}
            onBlur={onTitleCommit}
            placeholder="Untitled segment"
            returnKeyType="done"
          />
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {dateLabel}
          </Text>
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            {rangeLabel}
          </Text>
        </View>
        <Pressable variant="subtle" hitSlop={12} accessibilityLabel="Close" onPress={onClose} style={styles.close}>
          <Icon name="x" size="md" color={theme.colors.text.muted} />
        </Pressable>
      </View>

      <GestureDetector gesture={ts.gesture}>
        <View style={styles.timeline} onLayout={(e) => setFieldW(e.nativeEvent.layout.width)}>
          {fieldW > 0 && (
            <Animated.View style={[styles.strip, ts.stripStyle]}>
              <Animated.View style={[styles.clipBlock, ts.blockStyle]}>
                <FilmStrip widthPx={ts.blockW} posterUrl={posterUrl} />
              </Animated.View>
            </Animated.View>
          )}
          <View style={styles.playhead} pointerEvents="none" />
        </View>
      </GestureDetector>

      <BufferTransport
        showBufferEdges={false}
        playing={playing}
        onToStart={toHead}
        onPrevClip={toHead}
        onFrameBack={frameBack}
        onFrameBackHold={() => {}}
        onTogglePlay={togglePlay}
        onFrameForward={frameForward}
        onFrameForwardHold={() => {}}
        onNextClip={toTail}
        onToEnd={toTail}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.sm },
  header: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' },
  viewer: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.panel,
  },
  viewerEmpty: { alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: theme.spacing.xxs, paddingRight: theme.spacing.lg },
  close: { position: 'absolute', top: 0, right: 0 },
  timeline: {
    height: TIMELINE_H,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.panel,
    justifyContent: 'center',
  },
  strip: { position: 'absolute', top: 0, bottom: 0 },
  // Matches the Clips-page ClipBlock film container (`topSpan`): light paper, hairline outline,
  // rounded — the film cells (panelHi) sit on it, the gaps show this bg (must be bg.primary, the
  // lighter paper, NOT panelHi — that was the "darker" drift).
  clipBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg.primary,
  },
  playhead: {
    position: 'absolute',
    left: '50%',
    width: 2,
    marginLeft: -1,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent.default,
  },
})
