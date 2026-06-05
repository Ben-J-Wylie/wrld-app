// src/components/sections/ScreenHeader.tsx
//
// The shared top-of-screen header (2026-06-05). Logo + WRLD wordmark on the
// left, identical on every page; a right slot on the right. On the globe the
// right slot is the LIVE count Pill; on every other page it's the page name
// (`title`), right-justified — e.g. "logo WRLD ............ Dashboard".
//
// Geometry is fixed (`paddingHorizontal: lg`, `minHeight: 32` = the brand-row
// height) so the header is the SAME height on every screen. Each screen then
// renders its field (search / "What's happening") in a `paddingTop: sm` row
// directly below, which makes that field land at an identical Y everywhere —
// so it doesn't jump when you switch tabs. The header expects to sit just
// inside the safe-area top with a `paddingTop: sm` (pass via `style`, or rely
// on a parent that already adds it).

import { type ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native'
import { BrandMark } from '@/components/primitives/BrandMark'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  // Right-justified page name (non-globe pages). Ignored if `right` is given.
  title?: string
  // Custom right slot (e.g. the globe's LIVE Pill). Takes precedence over `title`.
  right?: ReactNode
  // When set, a compact back chevron renders left of the wordmark — the
  // "up-affordance" for linear drill-down screens (the hybrid-nav replacement
  // for bespoke back arrows). Sized to fit the 32-tall row so the header height
  // stays constant whether or not a screen has it.
  onBack?: () => void
  // Forwarded to the root View — the globe overlays this on the map and needs
  // `box-none` so drags pass through to the globe under it.
  pointerEvents?: ViewProps['pointerEvents']
  style?: StyleProp<ViewStyle>
}

export function ScreenHeader({ title, right, onBack, pointerEvents, style }: Props) {
  const rightContent =
    right ?? (title ? <Text variant="heading">{title}</Text> : null)

  return (
    <View style={[styles.row, style]} pointerEvents={pointerEvents}>
      <View style={styles.left}>
        {onBack && (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.back}
          >
            <Icon name="arrow-left" size="md" color={theme.colors.text.primary} />
          </Pressable>
        )}
        <View style={styles.brand}>
          <BrandMark size="hero" />
          <Text variant="display">WRLD</Text>
        </View>
      </View>
      {rightContent}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    // Brand-row height (BrandMark hero 32 / display lineHeight 32). Pinned so
    // a shorter right slot (page name / LIVE pill) can't change the header
    // height — keeps the field below at a constant Y across screens.
    minHeight: 32,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  back: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
})
