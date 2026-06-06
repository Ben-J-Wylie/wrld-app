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
// SafeAreaView uses default 4-edge mode (top/bottom/left/right). An
// earlier attempt to limit to `['top']` (to avoid the bottom-inset
// race with KAS) broke other screens (e.g. MeScreen failed to render),
// so reverted. The bottom-inset race is real but the cure was worse
// than the disease.
//
// Requires `<KeyboardProvider>` mounted at the root layout (already
// wired in app/_layout.tsx).

import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import type { ReactNode } from 'react'
import { theme } from '@/tokens/theme'

type Props = {
  children: ReactNode
  // Fixed header rendered above the scroll (inside the safe area, so it sits at
  // safe-area-top + sm and stays put while the body scrolls). Pass a
  // `ScreenHeader` here for the shared top header.
  header?: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  bottomOffset?: number
  keyboardDismissMode?: 'none' | 'on-drag' | 'interactive'
  refreshControl?: React.ReactElement<any>
  // Opt-in scroll lock — e.g. while a vertical-drag control (the clip editor's
  // TimeScrubber wheels) is active, so its gesture isn't stolen by the scroll view.
  scrollEnabled?: boolean
}

export function ScreenScroll({
  children,
  header,
  contentContainerStyle,
  style,
  bottomOffset,
  keyboardDismissMode,
  refreshControl,
  scrollEnabled,
}: Props) {
  return (
    <SafeAreaView style={[styles.root, style]}>
      {header != null && <View style={styles.header}>{header}</View>}
      <KeyboardAwareScrollView
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        bottomOffset={bottomOffset}
        keyboardDismissMode={keyboardDismissMode}
        refreshControl={refreshControl}
        scrollEnabled={scrollEnabled}
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
  // Matches the globe / dashboard header offset (safe-area-top + sm) so the
  // header sits at the same Y on every screen.
  header: {
    paddingTop: theme.spacing.sm,
  },
})
