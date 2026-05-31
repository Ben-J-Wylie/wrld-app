// src/components/sections/InfoList.tsx
//
// List of tonal info rows (keep / change / hold). Each row uses a
// token-driven color: accent for "keep", warn for "change", neutral
// for "hold". Used by the Change Handle "what changes" panel and any
// future consequence-disclosure surface.

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

export type InfoTone = 'keep' | 'change' | 'hold'

export type InfoRow = {
  tone: InfoTone
  iconName?: IconName
  title: string
  body?: string
}

type Props = {
  rows: InfoRow[]
  style?: StyleProp<ViewStyle>
}

const WARN_BG = 'rgba(200,134,30,0.10)'

function toneInk(tone: InfoTone): string {
  if (tone === 'keep') return theme.colors.accent.default
  if (tone === 'change') return theme.colors.warn
  return theme.colors.text.muted
}

function toneSurface(tone: InfoTone): string {
  if (tone === 'keep') return theme.colors.accent.surface
  if (tone === 'change') return WARN_BG
  return theme.colors.bg.panel
}

export function InfoList({ rows, style }: Props) {
  return (
    <View style={[styles.list, style]}>
      {rows.map((r, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.badge, { backgroundColor: toneSurface(r.tone) }]}>
            <Icon
              name={r.iconName ?? (r.tone === 'keep' ? 'check' : r.tone === 'change' ? 'edit-3' : 'pause')}
              size="md"
              color={toneInk(r.tone)}
            />
          </View>
          <View style={styles.col}>
            <Text variant="bodyEmphasized">{r.title}</Text>
            {r.body && (
              <Text variant="caption" color={theme.colors.text.muted}>
                {r.body}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}

const BADGE = 32

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
