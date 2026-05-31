// src/components/sections/ScreenScroll.tsx
//
// Canonical form-bearing-screen wrapper. Composes:
//
//   SafeAreaView (react-native-safe-area-context)
//     KeyboardAwareScrollView (react-native-keyboard-controller)
//       children
//
// **Design rule: trust the library, don't fight it.** This wrapper
// applies one universally-good ScrollView option (`keyboardShould-
// PersistTaps='handled'`) and otherwise passes through to
// `KeyboardAwareScrollView` with its defaults. Anything opinionated
// (`bottomOffset`, `keyboardDismissMode`, `paddingBottom`,
// `backgroundColor`) is opt-in via props, never applied as a hidden
// default. Hidden defaults are exactly what fought the library's
// keyboard animation in earlier rounds and caused the gallery stutter
// (see 2026-05-30 decision-log entries).
//
// **SafeAreaView edges: top-only.** The bottom safe-area inset on iOS
// shrinks when the keyboard appears (the keyboard takes precedence
// over the home indicator zone). The default 4-edge `SafeAreaView`
// re-renders with reduced bottom padding on every keyboard event,
// fighting `KeyboardAwareScrollView`'s own bottom-inset management.
// Limiting `SafeAreaView` to `['top']` (and letting KAS own the
// bottom) eliminates the race. Left/right insets are typically zero
// on iPhones; iPads get them from the parent SafeAreaProvider.
//
// Requires `<KeyboardProvider>` mounted at the root layout (already
// wired in app/_layout.tsx).

import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import type { ReactNode } from 'react'
import { theme } from '@/tokens/theme'

type Props = {
  children: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  bottomOffset?: number
  keyboardDismissMode?: 'none' | 'on-drag' | 'interactive'
}

export function ScreenScroll({
  children,
  contentContainerStyle,
  style,
  bottomOffset,
  keyboardDismissMode,
}: Props) {
  return (
    <SafeAreaView style={[styles.root, style]} edges={['top']}>
      <KeyboardAwareScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        bottomOffset={bottomOffset}
        keyboardDismissMode={keyboardDismissMode}
      >
        {children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
})
