// src/components/features/clip/ClipViewer.tsx
//
// The sticky clip viewer at the top of the Clips landing page — a full-width 2:1 field
// (half-height) that previews the currently-selected clip. The footage is letterboxed /
// pillarboxed inside the field (`contentFit="contain"` over a black field), so portrait and
// landscape clips both show whole — no crop.
//
// Presentational: the host owns the video player (so the bottom transport + clock can drive
// it) and passes its `VideoView` as `frameSlot`. The poster covers the video until it plays.
// No play button here — the bottom transport owns play/pause.
//
// NOTE: capture currently encodes landscape, so the buffer video can play rotated — that's
// a capture-side fix (wrld-mediasoup), NOT an app rotation. Do not rotate here.
// See DESIGN.md Section 3 (Clips landing grid).

import { type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  posterUrl?: string | null
  title?: string | null
  // True while the host's player is playing — hides the poster so the video shows through.
  playing?: boolean
  // True while the host is swapping the VOD (a cross-VOD seam). Forces the poster on top of the
  // video so the brief reload shows the incoming clip's frame, not the bg — unbroken across seams.
  coverPoster?: boolean
  // The host's `VideoView` (or any frame layer), rendered full-bleed behind the chrome.
  frameSlot?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function ClipViewer({ posterUrl, title, playing, coverPoster, frameSlot, style }: Props) {
  const hasClip = !!frameSlot || !!posterUrl
  // The poster stays MOUNTED whenever there's a posterUrl and only its opacity toggles — so raising
  // it (paused, or covering a reload) is instant, with no remount fade that would flash the bg.
  const showPoster = !!posterUrl && (coverPoster || !playing)

  return (
    <View style={[styles.frame, style]}>
      {frameSlot}
      {/* Poster: covers the video while paused/ended, and while a cross-VOD seam reloads. */}
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={[StyleSheet.absoluteFill, { opacity: showPoster ? 1 : 0 }]}
          contentFit="contain"
          transition={120}
        />
      ) : null}

      {!hasClip ? (
        <View style={styles.empty}>
          <Icon name="film" size="lg" color={theme.colors.text.subtle} />
          <Text variant="monoCaption" color={theme.colors.text.muted}>
            Tap a clip to preview
          </Text>
        </View>
      ) : null}

      {hasClip && title ? (
        <View style={styles.titleChip} pointerEvents="none">
          <Text variant="monoCaption" color={theme.colors.text.inverse} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 2, // full width, half-height
    backgroundColor: theme.colors.bg.panel, // letterbox / pillarbox bars (matches the gap card)
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  titleChip: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    maxWidth: '70%',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(20,16,12,0.55)',
  },
})
