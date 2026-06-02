// src/components/features/discovery/PlaceResult.tsx
//
// Search result row for a geographic place hit (e.g. "Paris,
// France"). Used in the Globe page's bottom drawer when the user
// types a query that matches a Mapbox geocoding result. Tapping
// flies the globe to the place's coords.
//
// Sibling row types in the same drawer:
//   • StreamCard.compact — for live stream hits
//   • BroadcasterRow.default — for person hits
//
// All three share approximate row height + a left-anchored glyph or
// avatar so the mixed list scans uniformly.
//
// Inputs (consumer-flat):
//   name        — primary label ("Paris")
//   region      — secondary label below ("France" or
//                 "Île-de-France, France"); optional
//   streamCount — small badge on the right when > 0, e.g. "12 live"
//   onPress     — tap handler
//
// The feature does not know about Mapbox or geocoding APIs. The
// consumer fetches the place hits and maps them to these props.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Pressable } from '@/components/primitives/Pressable'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type Props = {
  name: string
  region?: string | null
  streamCount?: number
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function PlaceResult({ name, region, streamCount, onPress, style }: Props) {
  const body = (
    <>
      <View style={styles.glyph}>
        <Icon name="map-pin" size="md" color={theme.colors.text.muted} />
      </View>
      <View style={styles.col}>
        <Text variant="bodyEmphasized" numberOfLines={1}>
          {name}
        </Text>
        {!!region && (
          <Text
            variant="monoCaption"
            color={theme.colors.text.muted}
            numberOfLines={1}
          >
            {region}
          </Text>
        )}
      </View>
      {!!streamCount && streamCount > 0 && (
        <Text variant="monoCaption" color={theme.colors.text.muted}>
          {streamCount} live
        </Text>
      )}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        variant="subtle"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={name}
        style={[styles.row, style]}
      >
        {body}
      </Pressable>
    )
  }
  return <View style={[styles.row, style]}>{body}</View>
}

const GLYPH_SIZE = 40

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  glyph: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
    borderRadius: GLYPH_SIZE / 2,
    backgroundColor: theme.colors.bg.panel,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  col: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
