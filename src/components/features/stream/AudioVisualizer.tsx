// src/components/features/stream/AudioVisualizer.tsx
//
// Live audio visualizer for the stream viewer — shown when a viewer watches an
// audio-only source (no camera in the broadcast set). Two variants:
//
//   • 'waveform' — a scrolling amplitude history (a live SourceWaveform); newest
//     sample enters on the right and scrolls left.
//   • 'orb'      — a central glow that scales/brightens with loudness.
//
// PRESENTATIONAL ONLY. It takes a single `level` (0..1) and renders it. It does
// NOT touch WebRTC. Internal envelope smoothing tames raw jitter, so the same
// component serves both the gallery (synthetic level) and the live path.
//
// ── Data seam (Aaron's lane: hooks/ + screens/) ────────────────────────────
// react-native-webrtc has no Web Audio / AnalyserNode, so the only real source
// of loudness is the inbound-rtp `audioLevel` from getStats(). The intended
// contract is a thin hook that retains the audio consumer in useMediasoup and
// polls it:
//
//   // src/hooks/useAudioLevel.ts  (Aaron)
//   function useAudioLevel(consumer): number  // 0..1, ~10Hz, 0 when no audio
//     - setInterval(async () => {
//         const stats = await consumer.getStats()       // mediasoup Consumer
//         for (const r of stats.values())
//           if (r.type === 'inbound-rtp' && r.audioLevel != null) setLevel(r.audioLevel)
//       }, 100)
//
// Then in StreamScreen, for an audio-only viewer (showRemoteVideo === false but
// remoteStream has an audio track):
//   <AudioVisualizer level={useAudioLevel(audioConsumer)} variant={...} />
//
// See DESIGN.md Section 3 (AudioVisualizer) + the source-visualizers initiative.

import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/primitives/Icon'
import { VisualizerFrame } from '@/components/features/stream/VisualizerFrame'
import { theme } from '@/tokens/theme'

export type AudioVisualizerVariant = 'waveform' | 'orb'

type Props = {
  /** Latest audio level, 0..1 (raw from getStats — smoothed internally). */
  level: number
  variant?: AudioVisualizerVariant
  /** Is audio actually flowing? When false the visual settles to its idle baseline. */
  active?: boolean
  label?: string
  /** Waveform resolution (bar count). Effectively static — set once. */
  barCount?: number
  /** PLAYBACK mode (clip replay): the recorded level window (oldest → newest) ending at the
   *  playhead. When set, the waveform is driven by this directly (scroll + rewind with the
   *  playhead) instead of the live real-time ticker — so a clip's audio replays as it sounded. */
  history?: number[]
  style?: StyleProp<ViewStyle>
}

// audioLevel from getStats is RMS-ish and small in practice — normal speech measured
// ~0.05–0.13 on-device (RN-WebRTC 124), peaking well under 1 — so a strong perceptual
// gain lifts it into the visible range before clamping. Without this the waveform moves
// but only to ~10–20% height, reading as near-static.
const GAIN = 4
// Steady scroll cadence for the waveform, independent of how often `level` ticks.
const SAMPLE_MS = 70
// Asymmetric envelope — snap up to peaks, ease back down (natural VU feel).
const ATTACK = 0.6
const DECAY = 0.22

export function AudioVisualizer({
  level,
  variant = 'waveform',
  active = true,
  label = 'AUDIO',
  barCount = 48,
  history,
  style,
}: Props) {
  return (
    <VisualizerFrame icon="mic" label={label} dim={!active} style={style}>
      {variant === 'orb' ? (
        <Orb level={history && history.length ? history[history.length - 1]! : level} active={active} />
      ) : (
        <Waveform level={level} history={history} active={active} barCount={barCount} />
      )}
    </VisualizerFrame>
  )
}

function Waveform({ level, history, active, barCount }: { level: number; history?: number[]; active: boolean; barCount: number }) {
  const playback = !!history
  // Latest target held in a ref so the steady ticker samples it (decouples scroll
  // cadence from the prop's update rate).
  const target = useRef(0)
  target.current = active ? level : 0
  const smooth = useRef(0)
  const [tickBars, setTickBars] = useState<number[]>(() => new Array(barCount).fill(0))

  // LIVE: a steady ticker scrolls the latest level in. PLAYBACK: the prop drives it — no ticker.
  useEffect(() => {
    if (playback) return
    const id = setInterval(() => {
      const t = target.current
      const cur = smooth.current
      smooth.current = cur + (t - cur) * (t > cur ? ATTACK : DECAY)
      setTickBars((prev) => {
        const next = prev.slice(1)
        next.push(smooth.current)
        return next
      })
    }, SAMPLE_MS)
    return () => clearInterval(id)
  }, [playback])

  // PLAYBACK: the recorded level window, left-padded to barCount so it scrolls in from the left as
  // it fills (newest on the right, like live). LIVE: the ticker history.
  const bars = playback
    ? (() => {
        const w = history!.slice(-barCount)
        const pad = barCount - w.length
        return pad > 0 ? [...new Array(pad).fill(0), ...w] : w
      })()
    : tickBars

  const n = bars.length
  return (
    <View style={styles.waveRow}>
      {bars.map((b, i) => {
        const h = Math.max(4, Math.min(100, b * GAIN * 100))
        // Fade older samples (left) so the leading edge reads as "now".
        const opacity = n > 1 ? 0.3 + 0.7 * (i / (n - 1)) : 1
        return (
          <View
            key={i}
            style={[styles.bar, { height: `${h}%`, opacity, backgroundColor: theme.colors.accent.default }]}
          />
        )
      })}
    </View>
  )
}

function Orb({ level, active }: { level: number; active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: active ? Math.min(1, level * GAIN) : 0,
      duration: 90,
      useNativeDriver: true,
    }).start()
  }, [level, active, anim])

  const coreScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] })
  const haloScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1.2, 2.4] })
  const haloOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.45] })

  return (
    <View style={styles.orbWrap}>
      <Animated.View
        style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
      />
      <Animated.View style={[styles.core, { transform: [{ scale: coreScale }] }]}>
        <Icon name="mic" size="lg" color={theme.colors.text.inverse} />
      </Animated.View>
    </View>
  )
}

const ORB = 96

const styles = StyleSheet.create({
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '50%',
    width: '100%',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: theme.radius.full,
    minWidth: 1,
  },
  orbWrap: {
    width: ORB * 2.6,
    height: ORB * 2.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: theme.colors.accent.default,
  },
  core: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: theme.colors.accent.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
