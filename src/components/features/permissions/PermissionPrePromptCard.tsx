// src/components/features/permissions/PermissionPrePromptCard.tsx
//
// Card shown before any OS permission prompt fires. Sets context with
// a large illustration, plain title, and 2–3 bullet reasons. The
// primary CTA fires the OS prompt; denial advances the wizard (the
// parent decides what "advance" means).
//
// Variants ship with sensible default icon + title + bullets that can
// be overridden via props:
//   location       — map-pin
//   notifications  — bell
//   camera         — video
//   microphone     — mic
//
// Copy is intentionally non-manipulative: it says what we want and
// what users get back.

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type PermissionKind = 'location' | 'notifications' | 'camera' | 'microphone'

type Props = {
  kind: PermissionKind
  title?: string
  bullets?: string[]
  iconName?: IconName
  onAllow: () => void
  onSkip?: () => void
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

const DEFAULT_ICON: Record<PermissionKind, IconName> = {
  location: 'map-pin',
  notifications: 'bell',
  camera: 'video',
  microphone: 'mic',
}

const DEFAULT_TITLE: Record<PermissionKind, string> = {
  location: 'Find streams happening nearby',
  notifications: "Don't miss it when someone you follow goes live",
  camera: 'Show what you see',
  microphone: 'Bring the sound of where you are',
}

const DEFAULT_BULLETS: Record<PermissionKind, string[]> = {
  location: [
    "We use your location to surface live streams near you",
    "Granularity is your choice (Pin / City / Country / Off)",
    "We never share your exact location with broadcasters",
  ],
  notifications: [
    "Followed broadcasters going live",
    "Optional: nearby live streams",
    "You can change either toggle anytime in Settings",
  ],
  camera: [
    "Required to broadcast video",
    "Active only while you're live or recording a clip",
    "You can flip front/back and stop the camera at any moment",
  ],
  microphone: [
    "Required to broadcast audio",
    "Active only while you're live or recording a clip",
    "You can mute mid-stream without ending the broadcast",
  ],
}

const ALLOW_LABEL: Record<PermissionKind, string> = {
  location: 'Allow location',
  notifications: 'Allow notifications',
  camera: 'Allow camera',
  microphone: 'Allow microphone',
}

export function PermissionPrePromptCard({
  kind,
  title,
  bullets,
  iconName,
  onAllow,
  onSkip,
  loading,
  style,
}: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconFrame}>
        <Icon
          name={iconName ?? DEFAULT_ICON[kind]}
          size="lg"
          color={theme.colors.accent.default}
        />
      </View>
      <Text variant="heading" color={theme.colors.text.primary} style={styles.title}>
        {title ?? DEFAULT_TITLE[kind]}
      </Text>
      <View style={styles.bullets}>
        {(bullets ?? DEFAULT_BULLETS[kind]).map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text variant="body" color={theme.colors.text.primary} style={styles.bulletText}>
              {b}
            </Text>
          </View>
        ))}
      </View>
      <Button
        variant="primary"
        label={ALLOW_LABEL[kind]}
        loading={loading}
        onPress={onAllow}
      />
      {onSkip && (
        <Button variant="skip" label="Not now" onPress={onSkip} />
      )}
    </View>
  )
}

const ICON_FRAME = 64

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.xl,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    gap: theme.spacing.md,
    alignItems: 'stretch',
  },
  iconFrame: {
    width: ICON_FRAME,
    height: ICON_FRAME,
    borderRadius: ICON_FRAME / 2,
    backgroundColor: theme.colors.accent.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
  },
  bullets: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent.default,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
  },
})
