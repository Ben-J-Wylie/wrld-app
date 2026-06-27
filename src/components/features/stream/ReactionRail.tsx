// src/components/features/stream/ReactionRail.tsx
//
// Vertical column of round reaction buttons (44×44, glass backdrop)
// plus a Periscope-style floating-emoji burst overlay. Replaces the
// Phase-10 `ReactionLayer` once the stream view is migrated in 12.6.
//
// Composition note: DESIGN.md proposed `IconButton + count-badge Pill`,
// but reactions render emoji (not Feather glyphs), so this feature
// builds its own round button instead of composing IconButton.
// Count-badge is an inline Pill-style chip.
//
// API is consumer-driven — the screen passes the list of reactions
// (kind / emoji / count / on) so the same component renders any future
// reaction-set without code changes here. The `burst` queue is owned
// by the screen; this feature renders + dismisses entries via
// `onBurstDismiss`.
//
// **Layout requirement.** The rail's natural height is
// `reactions.length * 44 + (reactions.length - 1) * 8` (= 200px for
// the typical 4-reaction set). In real usage the rail is positioned
// absolutely against the stream view (`position: 'absolute', right,
// bottom`) so it takes its intrinsic height. The column carries
// `flexShrink: 0` so any consumer that places the rail in a normal-
// flow flex parent can't crush it either — buttons never crowd.

import { useEffect, useRef } from 'react'
import {
  Animated,
  Pressable as RNPressable,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

export type ReactionConfig = {
  kind: string
  emoji: string
  count?: number
  on?: boolean
}

export type BurstEntry = {
  id: number
  kind: string
}

type Props = {
  reactions: ReactionConfig[]
  burst: BurstEntry[]
  authenticated?: boolean
  suspended?: boolean
  onReact: (kind: string) => void
  onAuthRequest?: () => void
  onBurstDismiss: (id: number) => void
  style?: StyleProp<ViewStyle>
}

export function ReactionRail({
  reactions,
  burst,
  authenticated = true,
  suspended = false,
  onReact,
  onAuthRequest,
  onBurstDismiss,
  style,
}: Props) {
  // Suspended: dim the rail. The tap still routes through onReact → useSignaling,
  // which blocks the send and surfaces the "you can't react" suspension Alert.
  function handlePress(kind: string) {
    if (authenticated) onReact(kind)
    else onAuthRequest?.()
  }

  const emojiByKind = Object.fromEntries(reactions.map((r) => [r.kind, r.emoji]))

  return (
    <View style={[styles.container, style]} pointerEvents="box-none">
      <View style={styles.burstArea} pointerEvents="none">
        {burst.map((b) => (
          <FloatingReaction
            key={b.id}
            entry={b}
            emoji={emojiByKind[b.kind] ?? '❤️'}
            onDone={onBurstDismiss}
          />
        ))}
      </View>

      <View style={[styles.column, suspended && { opacity: 0.4 }]}>
        {reactions.map((r) => (
          <ReactionButton key={r.kind} config={r} onPress={() => handlePress(r.kind)} />
        ))}
      </View>
    </View>
  )
}

// ─── Reaction button ─────────────────────────────────────────────────────────

function ReactionButton({
  config,
  onPress,
}: {
  config: ReactionConfig
  onPress: () => void
}) {
  return (
    <View style={btnStyles.wrap}>
      <RNPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`React with ${config.kind}`}
        style={({ pressed }) => [
          btnStyles.btn,
          config.on && btnStyles.btnOn,
          pressed && btnStyles.btnPressed,
        ]}
      >
        <RNText style={btnStyles.emoji}>{config.emoji}</RNText>
      </RNPressable>
      {config.count !== undefined && config.count > 0 && (
        <View style={btnStyles.countBadge}>
          <Text variant="monoCaption" color={theme.colors.text.inverse}>
            {formatCount(config.count)}
          </Text>
        </View>
      )}
    </View>
  )
}

// ─── Floating burst ──────────────────────────────────────────────────────────

function FloatingReaction({
  entry,
  emoji,
  onDone,
}: {
  entry: BurstEntry
  emoji: string
  onDone: (id: number) => void
}) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value((Math.random() - 0.5) * 40)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -160,
        duration: 2200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onDone(entry.id))
  }, [])

  return (
    <Animated.View
      style={[
        burstStyles.floating,
        { transform: [{ translateY }, { translateX }], opacity },
      ]}
    >
      <RNText style={burstStyles.emoji}>{emoji}</RNText>
    </Animated.View>
  )
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
  },
  burstArea: {
    position: 'absolute',
    bottom: 60,
    right: 0,
    width: 80,
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    alignItems: 'center',
    flexShrink: 0,
  },
})

const BTN_DIM = 44

const btnStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  btn: {
    width: BTN_DIM,
    height: BTN_DIM,
    borderRadius: BTN_DIM / 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  btnOn: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  btnPressed: {
    transform: [{ scale: 1.15 }],
  },
  emoji: {
    fontSize: 22,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,0,0,0.7)',
    minWidth: 18,
    alignItems: 'center',
  },
})

const burstStyles = StyleSheet.create({
  floating: {
    position: 'absolute',
    bottom: 0,
  },
  emoji: {
    fontSize: 28,
  },
})
