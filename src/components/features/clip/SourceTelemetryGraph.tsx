// src/components/features/clip/SourceTelemetryGraph.tsx
//
// Data-channel source view for the buffer viewer — a sparkline of a recorded telemetry
// track (gyro / compass / speed / temperature …) over the buffer, with the value at the
// playhead surfaced in a header. Bars left of the playhead read accent ("played"), the
// rest muted. Dependency-free (pure Views) so it needs no chart lib or native module.
// The parent supplies normalised values (0..1) + a preformatted current reading.
// See DESIGN.md Section 3 (Buffer-trim clip editor).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  values: number[] // 0..1 normalised samples, oldest → newest
  progress?: number // 0..1 playhead position across the samples
  label: string // e.g. 'COMPASS'
  reading?: string // preformatted value at the playhead, e.g. '182°'
  iconName?: Parameters<typeof Icon>[0]['name']
  style?: StyleProp<ViewStyle>
}

export function SourceTelemetryGraph({ values, progress = 0, label, reading, iconName = 'activity', style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name={iconName} size="sm" color={theme.colors.text.inverse} />
          <Text variant="monoLabel" color={theme.colors.text.inverse}>
            {label}
          </Text>
        </View>
        {reading != null && (
          <Text variant="bodyEmphasized" color={theme.colors.text.inverse}>
            {reading}
          </Text>
        )}
      </View>
      <View style={styles.graph}>
        {values.map((v, i) => {
          const played = values.length > 1 ? i / (values.length - 1) <= progress : true
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: `${Math.max(3, Math.min(100, v * 100))}%`,
                  backgroundColor: played ? theme.colors.accent.default : 'rgba(236,230,214,0.28)',
                },
              ]}
            />
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#1a1612',
    padding: theme.spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  graph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '55%',
    width: '100%',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minWidth: 1,
  },
})
