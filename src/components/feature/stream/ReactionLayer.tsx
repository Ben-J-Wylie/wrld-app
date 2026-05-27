import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useEffect, useRef } from 'react'
import { theme } from '@/lib/theme'
import type { Reaction } from '@/hooks/useSignaling'

const REACTION_EMOJIS: Record<string, string> = {
  heart: '❤️',
  fire: '🔥',
  clap: '👏',
  wow: '😮',
}

const KINDS = ['heart', 'fire', 'clap', 'wow'] as const

type FloatingReactionProps = {
  reaction: Reaction
  onDone: (id: number) => void
}

function FloatingReaction({ reaction, onDone }: FloatingReactionProps) {
  const translateY = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  // Small random horizontal drift so stacked reactions spread out
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
    ]).start(() => onDone(reaction.id))
  }, [])

  const emoji = REACTION_EMOJIS[reaction.kind] ?? '❤️'

  return (
    <Animated.View
      style={[
        styles.floatingReaction,
        { transform: [{ translateY }, { translateX }], opacity },
      ]}
    >
      <Text style={styles.floatingEmoji}>{emoji}</Text>
    </Animated.View>
  )
}

type Props = {
  reactions: Reaction[]
  isSignedIn: boolean
  onReact: (kind: string) => void
  onAuthRequest: () => void
  onDismiss: (id: number) => void
}

export function ReactionLayer({ reactions, isSignedIn, onReact, onAuthRequest, onDismiss }: Props) {
  function handlePress(kind: string) {
    if (isSignedIn) {
      onReact(kind)
    } else {
      onAuthRequest()
    }
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Floating burst animations */}
      <View style={styles.burstArea} pointerEvents="none">
        {reactions.map((r) => (
          <FloatingReaction key={r.id} reaction={r} onDone={onDismiss} />
        ))}
      </View>

      {/* Reaction buttons row */}
      <View style={styles.buttonRow}>
        {KINDS.map((kind) => (
          <Pressable
            key={kind}
            onPress={() => handlePress(kind)}
            style={({ pressed }) => [styles.reactionBtn, pressed && styles.reactionBtnPressed]}
          >
            <Text style={styles.emoji}>{REACTION_EMOJIS[kind]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.lg,
    alignItems: 'flex-end',
  },
  burstArea: {
    position: 'absolute',
    bottom: 60,
    right: 0,
    width: 80,
    alignItems: 'center',
  },
  floatingReaction: {
    position: 'absolute',
    bottom: 0,
  },
  floatingEmoji: { fontSize: 28 },
  buttonRow: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reactionBtnPressed: { transform: [{ scale: 1.2 }] },
  emoji: { fontSize: 22 },
})
