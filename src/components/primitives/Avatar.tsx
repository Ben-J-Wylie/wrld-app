// src/components/primitives/Avatar.tsx
//
// Circular user representation. Promoted from
// `src/components/features/user/Avatar.tsx` (Phase 8) — it's domain-blind
// (a circle with a user's face or initials), so it belongs in primitives.
//
// Variants are inferred from props:
//   - avatarUrl present → image variant (cropped to circle)
//   - avatarUrl absent  → initials variant (warm-ink-tinted bg, cream
//                         initials derived from displayName)
//   - live=true wraps either variant in an accent ring + glow
//
// Sizes: xs 24 | sm 32 | md 42 (default) | lg 72 | xl 88. A raw number
// is also accepted for one-off cases (the 7 Phase-8 call sites pass
// 38/44/88 — those keep working unchanged).
//
// **Gradient deferred:** Section 3 originally specced a "generated
// gradient (orange/brown for default)" but that was authored before the
// 2026-05-29 light-pivot locked the single warm-crimson accent rule.
// Initials use a solid warm-ink background; per-user differentiation is
// the initials themselves, not color. The gradient idea revisits in
// v0.3 if the friends-and-family group actively misses it.

import { Image, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from './Text'
import { theme } from '@/tokens/theme'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_PX: Record<Size, number> = { xs: 24, sm: 32, md: 42, lg: 72, xl: 88 }

type Props = {
  displayName: string
  avatarUrl?: string | null
  size?: Size | number
  live?: boolean
  style?: StyleProp<ViewStyle>
}

export function Avatar({ displayName, avatarUrl, size = 'md', live, style }: Props) {
  const px = typeof size === 'number' ? size : SIZE_PX[size]
  const radius = px / 2
  const ringWidth = px >= 42 ? 2 : 1

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'

  const inner = avatarUrl ? (
    <Image
      source={{ uri: avatarUrl }}
      style={[
        styles.image,
        { width: px, height: px, borderRadius: radius },
        px >= 42 && { borderWidth: ringWidth, borderColor: theme.colors.border.strong },
      ]}
    />
  ) : (
    <View
      style={[
        styles.initials,
        { width: px, height: px, borderRadius: radius },
        px >= 42 && { borderWidth: ringWidth, borderColor: theme.colors.border.strong },
      ]}
    >
      <Text
        variant="bodyEmphasized"
        color={theme.colors.text.inverse}
        style={{ fontSize: Math.round(px * 0.38), lineHeight: Math.round(px * 0.38) + 2 }}
      >
        {initials}
      </Text>
    </View>
  )

  if (live) {
    const gap = Math.max(3, Math.round(px * 0.06))
    const outer = px + 2 * (ringWidth + gap)
    return (
      <View
        style={[
          styles.liveRing,
          {
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderWidth: ringWidth,
            borderColor: theme.colors.accent.default,
          },
          theme.elevation.glow.accent,
          style,
        ]}
      >
        {inner}
      </View>
    )
  }

  return <View style={style}>{inner}</View>
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: theme.colors.bg.elevated,
  },
  initials: {
    backgroundColor: theme.colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
