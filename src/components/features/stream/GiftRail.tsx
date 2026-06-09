// src/components/features/stream/GiftRail.tsx
//
// A gift button that expands a vertical column of the 5 catalog gift emojis
// above it (Periscope-style). Tapping a gift sends it; each shows its Space
// Bucks cost and dims when the viewer can't afford it. The catalog (emoji +
// value) is server-driven — passed in from GET /gifts/catalog. The floating
// burst on send is owned by the screen (mirrors tips/reactions), not here.

import { useState } from 'react'
import {
  Pressable as RNPressable,
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'
import type { GiftCatalogItem } from '@/types'

type Props = {
  gifts: GiftCatalogItem[]
  balance: number
  authenticated?: boolean
  onSend: (giftId: string) => void
  onAuthRequest?: () => void
  onInsufficient?: (gift: GiftCatalogItem) => void
  style?: StyleProp<ViewStyle>
}

export function GiftRail({
  gifts,
  balance,
  authenticated = true,
  onSend,
  onAuthRequest,
  onInsufficient,
  style,
}: Props) {
  const [open, setOpen] = useState(false)

  function handleTogglePress() {
    if (!authenticated) {
      onAuthRequest?.()
      return
    }
    setOpen((o) => !o)
  }

  function handleGiftPress(gift: GiftCatalogItem) {
    if (!authenticated) {
      onAuthRequest?.()
      return
    }
    if (balance < gift.value) {
      onInsufficient?.(gift)
      return
    }
    onSend(gift.id)
    setOpen(false)
  }

  return (
    <View style={[styles.container, style]} pointerEvents="box-none">
      {open && (
        <View style={styles.column}>
          {gifts.map((g) => {
            const affordable = balance >= g.value
            return (
              <RNPressable
                key={g.id}
                onPress={() => handleGiftPress(g)}
                accessibilityRole="button"
                accessibilityLabel={`Send ${g.label} gift for ${g.value} Space Bucks`}
                style={({ pressed }) => [
                  btnStyles.btn,
                  !affordable && btnStyles.btnDisabled,
                  pressed && affordable && btnStyles.btnPressed,
                ]}
              >
                <RNText style={btnStyles.emoji}>{g.emoji}</RNText>
                <View style={btnStyles.valueChip}>
                  <Text variant="monoCaption" color={theme.colors.text.inverse}>
                    {g.value}
                  </Text>
                </View>
              </RNPressable>
            )
          })}
        </View>
      )}

      <RNPressable
        onPress={handleTogglePress}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close gifts' : 'Open gifts'}
        style={({ pressed }) => [
          btnStyles.toggle,
          open && btnStyles.toggleOpen,
          pressed && btnStyles.btnPressed,
        ]}
      >
        <RNText style={btnStyles.toggleEmoji}>🎁</RNText>
      </RNPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    flexShrink: 0,
  },
})

const BTN_DIM = 44

const btnStyles = StyleSheet.create({
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
  btnDisabled: {
    opacity: 0.4,
  },
  btnPressed: {
    transform: [{ scale: 1.15 }],
  },
  emoji: {
    fontSize: 22,
  },
  valueChip: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent.default,
    minWidth: 18,
    alignItems: 'center',
  },
  toggle: {
    width: BTN_DIM,
    height: BTN_DIM,
    borderRadius: BTN_DIM / 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  toggleOpen: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  toggleEmoji: {
    fontSize: 22,
  },
})
