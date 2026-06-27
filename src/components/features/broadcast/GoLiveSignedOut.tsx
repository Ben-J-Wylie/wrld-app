// src/components/features/broadcast/GoLiveSignedOut.tsx
//
// The signed-out broadcast prompt — shown on the Dashboard AND the center
// Stream tab (the go-live preview) when no one is signed in. Going live
// requires an account (the anonymous-viewing model: browse/watch freely,
// identity actions gate at the point of attempt), so instead of a blank
// preview these surfaces show a Sign in + Sign up entry point.

import { StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { ScreenScroll } from '@/components/sections/ScreenScroll'
import { Text } from '@/components/primitives/Text'
import { Button } from '@/components/primitives/Button'
import { Pressable } from '@/components/primitives/Pressable'
import { theme } from '@/tokens/theme'

export function GoLiveSignedOut() {
  return (
    <ScreenScroll contentContainerStyle={styles.center}>
      <Text variant="display">Go Live</Text>
      <Text variant="body" color={theme.colors.text.muted} style={styles.centerText}>
        Sign in to broadcast on WRLD.
      </Text>
      <Button label="Sign In" onPress={() => router.push('/(auth)/login')} variant="secondary" />
      <Pressable
        variant="default"
        onPress={() => router.push('/(auth)/signup')}
        accessibilityRole="link"
        accessibilityLabel="Sign up"
        style={styles.signupRow}
      >
        <Text variant="body" color={theme.colors.text.muted}>
          No account?{' '}
          <Text variant="bodyEmphasized" color={theme.colors.accent.default}>
            Sign up
          </Text>
        </Text>
      </Pressable>
    </ScreenScroll>
  )
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  centerText: {
    textAlign: 'center',
  },
  signupRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
})
