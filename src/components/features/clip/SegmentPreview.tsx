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

import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Image } from 'expo-image'
import { Input } from '@/components/primitives/Input'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { BufferTransport } from './BufferTransport'
import { theme } from '@/tokens/theme'

const TIMELINE_H = 50
const FRAME_SEC = 0.3 // frame-step size for the transport chevrons
const MIN_ZOOM = 0.5 // clip spans half the field (whole clip visible)
const MAX_ZOOM = 8 // clip spans 8× the field (fine scrub)
// Film strip (matches ClipBlock): constant-size square frame cells + sprocket bands.
const FILM_SPROCKET_H = 6
const FILM_GAP = 4
const FILM_CELL = 22
const FILM_PITCH = FILM_CELL + FILM_GAP
const FILM_SPK_W = 4
const FILM_SPK_PITCH = FILM_PITCH / 2
const MAX_CELLS = 120
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
const clampZoom = (n: number) => (n < MIN_ZOOM ? MIN_ZOOM : n > MAX_ZOOM ? MAX_ZOOM : n)

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
  const player = useVideoPlayer(hasMedia ? { uri: manifestUrl!, contentType: 'hls' } : null, (p) => {
    p.timeUpdateEventInterval = 0.25
    p.loop = false
  })

  const [playing, setPlaying] = useState(false)
  const [fieldW, setFieldW] = useState(0)
  const [zoom, setZoom] = useState(1)
  const fieldWRef = useRef(0)
  fieldWRef.current = fieldW
  const zoomRef = useRef(1)
  zoomRef.current = zoom
  const tx = useRef(new Animated.Value(0)).current // strip translateX = -progress * clipW
  const progressRef = useRef(0) // 0..1 over the clip

  const clipW = () => fieldWRef.current * zoomRef.current
  const setProgress = (p: number) => {
    const c = clamp01(p)
    progressRef.current = c
    if (fieldWRef.current > 0) tx.setValue(-c * clipW())
  }
  const seekToProgress = (p: number) => {
    const c = clamp01(p)
    setProgress(c)
    if (hasMedia) player.currentTime = c * durationSec
  }

  // Advance the playhead from the video while playing (RAF; no per-frame React render). Pause at end.
  useEffect(() => {
    if (!playing || !hasMedia) return
    let raf = 0
    const tick = () => {
      const d = player.duration || durationSec
      const p = clamp01(player.currentTime / d)
      setProgress(p)
      if (p >= 0.999) {
        player.pause()
        setPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hasMedia])

  // Re-pin the playhead under the centre when the field is measured or the zoom changes.
  useEffect(() => {
    if (fieldW > 0) setProgress(progressRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldW, zoom])

  useEffect(() => () => player.pause(), [player])

  const togglePlay = () => {
    if (!hasMedia) return
    if (playing) {
      player.pause()
      setPlaying(false)
    } else {
      if (progressRef.current >= 0.999) seekToProgress(0) // replay from head if parked at the tail
      player.play()
      setPlaying(true)
    }
  }
  const toHead = () => seekToProgress(0)
  const toTail = () => seekToProgress(1)
  const frameBack = () => hasMedia && seekToProgress(progressRef.current - FRAME_SEC / durationSec)
  const frameForward = () => hasMedia && seekToProgress(progressRef.current + FRAME_SEC / durationSec)

  // Horizontal scrub (1 finger); vertical passes to the sheet's ScrollView. Pinch (2 fingers) zooms.
  const scrubStart = useRef(0)
  const wasPlaying = useRef(false)
  const zoomStart = useRef(1)
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-10, 10])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        scrubStart.current = progressRef.current
        wasPlaying.current = playing
        if (playing) {
          player.pause()
          setPlaying(false)
        }
      })
      .onUpdate((e) => {
        const w = clipW()
        if (w <= 0) return
        setProgress(scrubStart.current - e.translationX / w) // drag right → earlier
        if (hasMedia) player.currentTime = progressRef.current * durationSec
      })
      .onEnd(() => {
        if (wasPlaying.current) togglePlay()
      })
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        zoomStart.current = zoomRef.current
      })
      .onUpdate((e) => {
        const z = clampZoom(zoomStart.current * e.scale)
        zoomRef.current = z
        setZoom(z)
        tx.setValue(-progressRef.current * clipW()) // keep the playhead pinned to centre while zooming
      })
    return Gesture.Simultaneous(pan, pinch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMedia, playing, durationSec])

  const blockW = fieldW * zoom

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

      <GestureDetector gesture={gesture}>
        <View style={styles.timeline} onLayout={(e) => setFieldW(e.nativeEvent.layout.width)}>
          {fieldW > 0 && (
            <Animated.View style={[styles.strip, { width: fieldW + blockW, transform: [{ translateX: tx }] }]}>
              <View style={[styles.clipBlock, { left: fieldW / 2, width: blockW }]}>
                <FilmCells width={blockW} posterUrl={posterUrl} />
              </View>
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

// The Clips-page film strip, static (the whole clip block translates as one unit): sprocket bands
// top + bottom, a row of constant-size square frame cells. Cell count scales with the block width
// (zoom), capped so a deep zoom can't render unbounded cells.
function FilmCells({ width, posterUrl }: { width: number; posterUrl: string | null }) {
  const cells = Math.min(Math.max(1, Math.ceil(width / FILM_PITCH)), MAX_CELLS)
  const sprockets = cells * 2
  return (
    <View style={styles.filmRow} pointerEvents="none">
      <View style={styles.sprocketBand}>
        {Array.from({ length: sprockets }).map((_, i) => (
          <View key={i} style={styles.sprocket} />
        ))}
      </View>
      <View style={styles.cellBand}>
        {Array.from({ length: cells }).map((_, i) => (
          <View key={i} style={styles.filmCell}>
            {posterUrl ? <Image source={{ uri: posterUrl }} style={styles.filmImg} contentFit="cover" transition={120} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.sprocketBand}>
        {Array.from({ length: sprockets }).map((_, i) => (
          <View key={i} style={styles.sprocket} />
        ))}
      </View>
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
  clipBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.accent.surface,
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
  filmRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  sprocketBand: { height: FILM_SPROCKET_H, flexDirection: 'row', alignItems: 'center' },
  sprocket: {
    width: FILM_SPK_W,
    height: 3,
    borderRadius: 1.5,
    marginRight: FILM_SPK_PITCH - FILM_SPK_W,
    backgroundColor: theme.colors.border.strong,
  },
  cellBand: { flexDirection: 'row', alignItems: 'center' },
  filmCell: {
    width: FILM_CELL,
    height: FILM_CELL,
    marginRight: FILM_GAP,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.panelHi,
    overflow: 'hidden',
  },
  filmImg: { width: '100%', height: '100%' },
})
