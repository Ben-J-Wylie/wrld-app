// src/components/features/user/BroadcasterRow.tsx
//
// Broadcaster identity row. Composes Avatar + Text + (optional)
// FollowButton. Two variants:
//
//   default — full row, Avatar md + name + @handle (· followers) +
//             FollowButton on the right. ~50px tall. Used by the
//             Viewer Sheet preview, Profile header, stream view's
//             broadcaster identity strip.
//   chip    — compact pill (Avatar xs + name + @handle), no Follow
//             button, sits on top of arbitrary video content with a
//             dark backdrop for legibility. Used in Broadcast Live's
//             HUD overlay (broadcaster sees their own identity on
//             their own camera feed).
//
// Data is consumer-flat (not a `User` object) so the feature stays
// domain-blind. FollowButton reads its own follow state internally via
// `useUserProfile(handle)`, so we only pass the handle down.

import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Avatar } from '@/components/primitives/Avatar'
import { Text } from '@/components/primitives/Text'
import { Pressable } from '@/components/primitives/Pressable'
import { FollowButton } from './FollowButton'
import { theme } from '@/tokens/theme'

type Variant = 'default' | 'chip'

type Props = {
  variant?: Variant
  avatarUrl?: string | null
  displayName: string
  handle: string
  followerCount?: number
  showFollowButton?: boolean
  onAuthRequest?: () => void
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function BroadcasterRow(props: Props) {
  const { variant = 'default' } = props
  return variant === 'chip' ? <ChipRow {...props} /> : <DefaultRow {...props} />
}

// ─── Default ─────────────────────────────────────────────────────────────────

function DefaultRow({
  avatarUrl,
  displayName,
  handle,
  followerCount,
  showFollowButton = true,
  onAuthRequest,
  onPress,
  style,
}: Props) {
  const aliasLine =
    followerCount !== undefined
      ? `@${handle} · ${formatCount(followerCount)} followers`
      : `@${handle}`

  const body = (
    <>
      <Avatar avatarUrl={avatarUrl} displayName={displayName} size="md" />
      <View style={defaultStyles.col}>
        <Text variant="bodyEmphasized" numberOfLines={1}>{displayName}</Text>
        <Text variant="monoCaption" color={theme.colors.text.muted} numberOfLines={1}>
          {aliasLine}
        </Text>
      </View>
      {showFollowButton && (
        <View style={defaultStyles.followWrap}>
          <FollowButton handle={handle} onAuthRequest={onAuthRequest} />
        </View>
      )}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        style={[defaultStyles.row, style]}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={[defaultStyles.row, style]}>{body}</View>
}

const defaultStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  followWrap: {
    flexShrink: 0,
  },
})

// ─── Chip ────────────────────────────────────────────────────────────────────

function ChipRow({ avatarUrl, displayName, handle, onPress, style }: Props) {
  const body = (
    <>
      <Avatar avatarUrl={avatarUrl} displayName={displayName} size="xs" />
      <Text variant="bodyEmphasized" color={theme.colors.text.inverse}>
        {displayName}
      </Text>
      <Text variant="monoCaption" style={chipStyles.alias}>
        @{handle}
      </Text>
    </>
  )

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={displayName}
        style={[chipStyles.chip, style]}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={[chipStyles.chip, style]}>{body}</View>
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    height: 32,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignSelf: 'flex-start',
  },
  alias: {
    color: 'rgba(236,230,214,0.6)',
  },
})

// ─── Shared ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
