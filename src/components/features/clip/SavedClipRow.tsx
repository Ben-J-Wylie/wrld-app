// src/components/features/clip/SavedClipRow.tsx
//
// Buffer-trim clip editor — screen 2 (the Library). A saved clip as a horizontal row
// card (dashboard FeedRow proportions, ClipCard content): poster + name + capture
// timestamp + state/source tags + kebab. Tapping the head expands the row in place to
// an inline player (ClipPreview) + an action strip (Share · Publish · Delete) — no
// full-screen navigation.
//
// New clips arrive as private drafts, so the DRAFT tag is the default with a Publish
// affordance. Built as its own feature rather than a ClipCard variant — the
// inline-expand player + owner action strip diverge enough from ClipCard's grid-card
// variants that folding them in would bloat that API (reuses ClipCard's tag/meta
// vocabulary in spirit). Consumer-flat + domain-blind (no Clip import); the consumer
// preformats `capturedAt` and the sources line.
//
// See DESIGN.md Section 3 (Buffer-trim clip editor) + the 2026-06-06 decision log.

import type { ReactNode } from 'react'
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { IconButton } from '@/components/primitives/IconButton'
import { Divider } from '@/components/primitives/Divider'
import { ClipPreview } from './ClipPreview'
import { theme } from '@/tokens/theme'

type Visibility = 'draft' | 'anon' | 'public'
type PreviewVariant = 'camera' | 'audio-only' | 'map-only'
type TagTone = 'warn' | 'accent' | 'muted'

type Props = {
  name: string
  capturedAt: string
  durationSec: number
  thumbnailUrl?: string | null
  variant?: PreviewVariant
  sourcesLabel?: string
  visibility?: Visibility
  // Optional explicit tag row — overrides the default visibility + sources tags.
  // Lets a recordings-backed surface (LibraryScreen) show status tags
  // (RECORDING / UNEDITED / FAILED / expiry) instead of clip visibility.
  tags?: { label: string; tone: TagTone }[]
  // Show the poster play glyph (default true). Surfaces with no wired playback
  // (recordings) pass false.
  showPlayGlyph?: boolean
  expanded?: boolean
  playing?: boolean
  progressPct?: number
  onToggleExpand?: () => void
  onTogglePlay?: () => void
  onShare?: () => void
  onPublish?: () => void
  onDelete?: () => void
  // When set, the kebab becomes a real button (e.g. a recordings delete menu).
  onKebabPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function SavedClipRow({
  name,
  capturedAt,
  durationSec,
  thumbnailUrl,
  variant = 'camera',
  sourcesLabel,
  visibility = 'draft',
  tags,
  showPlayGlyph = true,
  expanded = false,
  playing,
  progressPct,
  onToggleExpand,
  onTogglePlay,
  onShare,
  onPublish,
  onDelete,
  onKebabPress,
  style,
}: Props) {
  return (
    <View style={[styles.row, expanded && styles.rowExpanded, style]}>
      <Pressable
        variant="subtle"
        onPress={onToggleExpand ?? (() => {})}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={styles.head}
      >
        <View style={styles.poster}>
          {variant === 'camera' && thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.posterFill as ImageStyle} resizeMode="cover" />
          ) : (
            <View style={[styles.posterFill, styles.posterPlaceholder]}>
              <Icon
                name={variant === 'audio-only' ? 'mic' : variant === 'map-only' ? 'map-pin' : 'video'}
                size="md"
                color={theme.colors.text.subtle}
              />
            </View>
          )}
          <View style={styles.durPill}>
            <Text variant="monoLabel" color={theme.colors.text.inverse}>
              {formatDuration(durationSec)}
            </Text>
          </View>
          {showPlayGlyph && (
            <View style={styles.playGlyph}>
              <Icon name={expanded ? 'pause' : 'play'} size="sm" color={theme.colors.text.inverse} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text variant="bodyEmphasized" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
            {capturedAt}
          </Text>
          <View style={styles.tags}>
            {tags ? (
              tags.map((t, i) => (
                <Tag key={i} tone={t.tone}>
                  {t.label}
                </Tag>
              ))
            ) : (
              <>
                <VisibilityTag visibility={visibility} />
                {sourcesLabel != null && <Tag tone="muted">{sourcesLabel}</Tag>}
              </>
            )}
          </View>
        </View>

        {onKebabPress ? (
          <Pressable
            variant="default"
            onPress={onKebabPress}
            accessibilityRole="button"
            accessibilityLabel="More options"
            hitSlop={8}
            style={styles.kebab}
          >
            <Icon name="more-vertical" size="md" color={theme.colors.text.subtle} />
          </Pressable>
        ) : (
          <View style={styles.kebab}>
            <Icon name="more-vertical" size="md" color={theme.colors.text.subtle} />
          </View>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.player}>
          <Divider tone="subtle" />
          <View style={styles.playerPad}>
            <ClipPreview
              variant={variant}
              thumbnailUrl={thumbnailUrl}
              playing={playing}
              progressPct={progressPct}
              onTogglePlay={onTogglePlay}
            />
            <View style={styles.acts}>
              <ActionButton icon="share" label="Share" onPress={onShare} />
              {visibility !== 'public' && (
                <ActionButton icon="upload" label="Publish" onPress={onPublish} primary />
              )}
              <IconButton
                name="trash-2"
                onPress={onDelete ?? (() => {})}
                accessibilityLabel="Delete clip"
                variant="surface"
                color={theme.colors.accent.default}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

function ActionButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  onPress?: () => void
  primary?: boolean
}) {
  return (
    <Pressable
      variant="default"
      onPress={onPress ?? (() => {})}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.actBtn, primary && styles.actBtnPrimary]}
    >
      <Icon name={icon} size="sm" color={primary ? theme.colors.text.inverse : theme.colors.text.muted} />
      <Text variant="bodyEmphasized" color={primary ? theme.colors.text.inverse : theme.colors.text.primary}>
        {label}
      </Text>
    </Pressable>
  )
}

function VisibilityTag({ visibility }: { visibility: Visibility }) {
  if (visibility === 'draft') return <Tag tone="warn">Draft</Tag>
  if (visibility === 'public') return <Tag tone="accent">Public</Tag>
  return <Tag tone="muted">Anon · only you</Tag>
}

function Tag({ tone, children }: { tone: 'warn' | 'accent' | 'muted'; children: ReactNode }) {
  const palette = TAG_TONE[tone]
  return (
    <View style={[styles.tag, { borderColor: palette.border, backgroundColor: palette.bg }]}>
      <Text variant="monoLabel" color={palette.text}>
        {children}
      </Text>
    </View>
  )
}

const TAG_TONE = {
  warn: { text: theme.colors.warn, border: 'rgba(200,134,30,0.4)', bg: 'rgba(200,134,30,0.08)' },
  accent: { text: theme.colors.accent.default, border: theme.colors.accent.border, bg: theme.colors.accent.surface },
  muted: { text: theme.colors.text.muted, border: theme.colors.border.strong, bg: 'transparent' },
} as const

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const POSTER_W = 104
const POSTER_H = 62

const styles = StyleSheet.create({
  row: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.elevated,
    overflow: 'hidden',
  },
  rowExpanded: {
    borderColor: theme.colors.accent.border,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  posterFill: {
    ...StyleSheet.absoluteFillObject,
  },
  posterPlaceholder: {
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durPill: {
    position: 'absolute',
    right: theme.spacing.xs,
    bottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(20,16,13,0.6)',
  },
  playGlyph: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 26,
    height: 26,
    marginTop: -13,
    marginLeft: -13,
    borderRadius: 13,
    backgroundColor: 'rgba(20,16,13,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: 1,
  },
  tag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  kebab: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {},
  playerPad: {
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  acts: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actBtn: {
    flex: 1,
    height: 38,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.strong,
    backgroundColor: theme.colors.bg.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  actBtnPrimary: {
    backgroundColor: theme.colors.accent.default,
    borderColor: theme.colors.accent.default,
  },
})
