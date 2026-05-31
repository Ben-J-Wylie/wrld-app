// src/components/sections/ScreenScroll.tsx
//
// Canonical form-bearing-screen wrapper. Every scrollable screen with
// focusable inputs wraps in this section instead of inlining keyboard
// handling per-screen. Composes:
//
//   SafeAreaView (react-native-safe-area-context)
//     KeyboardAwareScrollView (react-native-keyboard-controller)
//       children
//
// Defaults:
//
//   keyboardShouldPersistTaps='handled'   adjacent input/button taps
//                                         while keyboard is up pass
//                                         through instead of being
//                                         eaten just to dismiss
//   keyboardDismissMode='none'            keyboard stays put unless
//                                         user explicitly dismisses
//                                         (opt into 'on-drag' or
//                                         'interactive' per consumer —
//                                         'interactive' can cause an
//                                         iOS animation stutter on
//                                         first focus as iOS reads the
//                                         auto-scroll-to-focused-input
//                                         as the start of a dismiss
//                                         gesture)
//   bottomOffset                          distance focused input lifts
//                                         above keyboard top
//                                         (default: spacing.lg = 16)
//   paddingBottom                         scroll has room beyond last
//                                         item so focusing it can
//                                         scroll into view
//                                         (default: spacing.xxxl = 48)
//   backgroundColor                       bg.primary warm cream paper
//                                         (override via `style`)
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
  bottomOffset = theme.spacing.lg,
  keyboardDismissMode = 'none',
}: Props) {
  return (
    <SafeAreaView style={[styles.root, style]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={keyboardDismissMode}
        bottomOffset={bottomOffset}
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
  content: {
    paddingBottom: theme.spacing.xxxl,
  },
})
