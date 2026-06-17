// src/components/features/stream/StreamStateBanner.tsx
//
// Top-of-globe banner surfacing post-exit stream lifecycle state.
// Three variants drive the visual treatment + interaction model:
//
//   disconnected — muted card, spinner + "waiting to reconnect" copy.
//                  Consumer polls externally; sets variant `resumed`
//                  if the broadcaster comes back online.
//   ended        — muted card, "stream has ended". Auto-dismisses
//                  after `autoDismissMs` (default 8000) unless 0.
//   resumed      — accent-tinted, tappable. `onTap` rejoins.
//   kicked       — muted card, "you have been removed from this
//                  stream". 8s auto-dismiss. Added 2026-05-31 to
//                  surface Aaron's Phase 5/22 admin-kick handling.
//
// **Where the state machine lives.** The DESIGN.md proposal asked for
// the feature to own polling + signal consumption. We deliberately
// kept those at the screen level (GlobeScreen consumes
// `consumeStreamSignal()` and polls `streamsApi.near`) so this feature
// stays domain-blind — no API client or signal-store import. The
// feature owns its own timers (auto-dismiss) and the visual variants;
// the screen owns the transitions between them.
//
// All three variants always render a dismiss X.

import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type StreamStateVariant = 'disconnected' | 'ended' | 'resumed' | 'kicked' | 'cancelled'

type Props = {
  variant: StreamStateVariant
  onDismiss: () => void
  onTap?: () => void
  autoDismissMs?: number
  style?: StyleProp<ViewStyle>
}

const DEFAULT_DISMISS_MS: Record<StreamStateVariant, number | undefined> = {
  ended: 8000,
  disconnected: 5 * 60 * 1000,
  resumed: undefined,
  kicked: 8000,
  cancelled: undefined, // persists until the viewer dismisses it (refund notice)
}

export function StreamStateBanner({
  variant,
  onDismiss,
  onTap,
  autoDismissMs,
  style,
}: Props) {
  const dismissMs = autoDismissMs ?? DEFAULT_DISMISS_MS[variant]

  useEffect(() => {
    if (!dismissMs) return
    const t = setTimeout(onDismiss, dismissMs)
    return () => clearTimeout(t)
  }, [variant, dismissMs, onDismiss])

  const tappable = variant === 'resumed' && !!onTap

  return (
    <Pressable
      variant="subtle"
      onPress={tappable ? onTap : undefined}
      accessibilityRole={tappable ? 'button' : undefined}
      accessibilityLabel={tappable ? 'Stream resumed — tap to rejoin' : undefined}
      style={[
        styles.banner,
        variant === 'resumed' ? styles.resumed : styles.muted,
        style,
      ]}
    >
      <View style={styles.content}>
        {variant === 'disconnected' && (
          <>
            <ActivityIndicator size="small" color={theme.colors.text.muted} />
            <Text variant="body" color={theme.colors.text.primary} numberOfLines={1}>
              Stream disconnected — waiting to reconnect
            </Text>
          </>
        )}
        {variant === 'ended' && (
          <Text variant="body" color={theme.colors.text.primary} numberOfLines={1}>
            The stream has ended
          </Text>
        )}
        {variant === 'resumed' && (
          <Text variant="bodyEmphasized" color={theme.colors.accent.default} numberOfLines={1}>
            Stream resumed — tap to rejoin
          </Text>
        )}
        {variant === 'kicked' && (
          <Text variant="body" color={theme.colors.text.primary} numberOfLines={1}>
            You have been removed from this stream
          </Text>
        )}
        {variant === 'cancelled' && (
          <Text variant="body" color={theme.colors.text.primary} numberOfLines={2}>
            This pay-per-view event was cancelled — you&apos;ll be refunded.
          </Text>
        )}
      </View>
      <Pressable
        variant="default"
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={12}
        style={styles.close}
      >
        <Icon name="x" size="md" color={theme.colors.text.muted} />
      </Pressable>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  muted: {
    backgroundColor: theme.colors.bg.elevated,
    borderColor: theme.colors.border.subtle,
  },
  resumed: {
    backgroundColor: theme.colors.accent.surface,
    borderColor: theme.colors.accent.default,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  close: {
    padding: theme.spacing.xxs,
  },
})
