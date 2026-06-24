// src/components/features/clip/SegmentPreview.tsx
//
// The top section of the segment settings shelf: a SQUARE clip viewer (left) + the editable
// title / date / time (right), then a THIN clip timeline (the clip skates left under a static
// centre red playhead, with half-field head/tail padding so the playhead reaches the clip's head
// and tail — same feel as the Clips page), then a transport (BufferTransport with the buffer
// head/tail buttons hidden — a single clip only snaps to its OWN head/tail).
//
// Self-contained: owns one expo-video player + the playhead. Starts PAUSED (no autoplay audio in
// a settings sheet). Scrub is a horizontal RNGH pan (vertical passes through to the sheet scroll).

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

const TIMELINE_H = 48
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
  const player = useVideoPlayer(hasMedia ? { uri: manifestUrl!, contentType: 'hls' } : null, (p) => {
    p.timeUpdateEventInterval = 0.25
    p.loop = false
  })

  const [playing, setPlaying] = useState(false)
  const [fieldW, setFieldW] = useState(0)
  const tx = useRef(new Animated.Value(0)).current // strip translateX = -progress * fieldW
  const progressRef = useRef(0) // 0..1 over the clip

  const setProgress = (p: number) => {
    const c = clamp01(p)
    progressRef.current = c
    if (fieldW > 0) tx.setValue(-c * fieldW)
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
  }, [playing, hasMedia, fieldW])

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

  // Horizontal scrub: drag the strip; vertical passes to the sheet's ScrollView.
  const scrubStart = useRef(0)
  const wasPlaying = useRef(false)
  const pan = useMemo(
    () =>
      Gesture.Pan()
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
          if (fieldW <= 0) return
          setProgress(scrubStart.current - e.translationX / fieldW) // drag right → earlier
          if (hasMedia) player.currentTime = progressRef.current * durationSec
        })
        .onEnd(() => {
          if (wasPlaying.current) togglePlay()
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldW, hasMedia, playing, durationSec],
  )

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.viewer}>
          {hasMedia ? (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
          ) : posterUrl ? (
            <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
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

      <GestureDetector gesture={pan}>
        <View style={styles.timeline} onLayout={(e) => setFieldW(e.nativeEvent.layout.width)}>
          {fieldW > 0 && (
            <Animated.View style={[styles.strip, { width: fieldW * 2, transform: [{ translateX: tx }] }]}>
              <View style={[styles.clipBlock, { left: fieldW / 2, width: fieldW }]}>
                {posterUrl ? <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
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
})
