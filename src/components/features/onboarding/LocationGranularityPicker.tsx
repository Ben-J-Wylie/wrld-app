// src/components/features/onboarding/LocationGranularityPicker.tsx
//
// 4 radio cards picking how precisely the user shares location:
//
//   bluedot  — exact pin (warn-tinted; chosen carries the highest
//              privacy cost)
//   city     — fuzzy circle
//   country  — big shape
//   private  — eye-off (no broadcast of location at all)
//
// Each card has a map-style visual preview drawn inline (no
// illustration assets yet). Selected card carries the accent border +
// accent radio fill; bluedot variant carries an extra warn-toned
// caption to telegraph that exact-pin is sensitive.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

export type LocationGranularity = 'bluedot' | 'city' | 'country' | 'private'

type Props = {
  value: LocationGranularity
  onChange: (next: LocationGranularity) => void
  style?: StyleProp<ViewStyle>
}

type Option = {
  id: LocationGranularity
  title: string
  description: string
  tone?: 'warn'
}

const OPTIONS: Option[] = [
  {
    id: 'bluedot',
    title: 'Pin (exact)',
    description: 'Show my exact location to broadcasters near me.',
    tone: 'warn',
  },
  {
    id: 'city',
    title: 'City (fuzzy)',
    description: 'Show a fuzzy circle around the city I’m in.',
  },
  {
    id: 'country',
    title: 'Country',
    description: 'Show only the country I’m in.',
  },
  {
    id: 'private',
    title: 'Private',
    description: 'Don’t share my location with broadcasters.',
  },
]

export function LocationGranularityPicker({ value, onChange, style }: Props) {
  return (
    <View style={[styles.list, style]}>
      {OPTIONS.map((o) => {
        const selected = value === o.id
        return (
          <Pressable
            key={o.id}
            variant="subtle"
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={o.title}
            style={[
              styles.card,
              selected && styles.selected,
              o.tone === 'warn' && selected && { borderColor: theme.colors.warn },
            ]}
          >
            <GranularityPreview kind={o.id} />
            <View style={styles.col}>
              <Text variant="bodyEmphasized">{o.title}</Text>
              <Text variant="monoCaption" color={theme.colors.text.muted}>
                {o.description}
              </Text>
              {o.tone === 'warn' && (
                <Text variant="monoLabel" color={theme.colors.warn}>
                  HIGHEST PRIVACY COST
                </Text>
              )}
            </View>
            <View style={[styles.bullet, selected && styles.bulletSelected]}>
              {selected && <View style={styles.bulletFill} />}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

function GranularityPreview({ kind }: { kind: LocationGranularity }) {
  return (
    <View style={previewStyles.frame}>
      <View style={previewStyles.gridA} />
      <View style={previewStyles.gridB} />
      {kind === 'bluedot' && (
        <View style={previewStyles.pin} />
      )}
      {kind === 'city' && (
        <View style={previewStyles.cityCircle} />
      )}
      {kind === 'country' && (
        <View style={previewStyles.countryShape} />
      )}
      {kind === 'private' && (
        <View style={previewStyles.privateCenter}>
          <Icon name="eye-off" size="md" color={theme.colors.text.muted} />
        </View>
      )}
    </View>
  )
}

const PREVIEW = 64

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  selected: {
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletSelected: {
    borderColor: theme.colors.accent.default,
  },
  bulletFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent.default,
  },
})

const previewStyles = StyleSheet.create({
  frame: {
    width: PREVIEW,
    height: PREVIEW,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.panel,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    position: 'relative',
  },
  gridA: {
    position: 'absolute',
    top: PREVIEW / 3,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  gridB: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: PREVIEW / 3,
    width: 1,
    backgroundColor: theme.colors.border.subtle,
  },
  pin: {
    position: 'absolute',
    top: PREVIEW / 2 - 4,
    left: PREVIEW / 2 - 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent.default,
    borderWidth: 2,
    borderColor: theme.colors.text.inverse,
  },
  cityCircle: {
    position: 'absolute',
    top: PREVIEW / 2 - 14,
    left: PREVIEW / 2 - 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
    opacity: 0.6,
  },
  countryShape: {
    position: 'absolute',
    top: 12,
    left: 10,
    right: 10,
    bottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.accent.default,
    backgroundColor: theme.colors.accent.surface,
    opacity: 0.4,
    borderRadius: 4,
  },
  privateCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

