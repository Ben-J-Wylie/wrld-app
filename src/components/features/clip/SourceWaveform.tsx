// src/components/features/clip/SourceWaveform.tsx
//
// Audio source view for the buffer viewer — a centred amplitude waveform that fills the
// scrub field when the AUDIO source is selected. Bars left of the playhead read accent
// ("played"), the rest muted. Dependency-free (pure Views), so it works without a chart
// lib or native module. The parent supplies normalised peaks (0..1) and the playhead
// progress (0..1). See DESIGN.md Section 3 (Buffer-trim clip editor).

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type Props = {
  peaks: number[] // 0..1 amplitudes, oldest → newest
  progress?: number // 0..1 playhead position across the peaks
  label?: string
  style?: StyleProp<ViewStyle>
}

export function SourceWaveform({ peaks, progress = 0, label = 'AUDIO', style }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        {peaks.map((p, i) => {
          const played = peaks.length > 1 ? i / (peaks.length - 1) <= progress : true
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: `${Math.max(6, Math.min(100, p * 100))}%`,
                  backgroundColor: played ? theme.colors.accent.default : 'rgba(236,230,214,0.30)',
                },
              ]}
            />
          )
        })}
      </View>
      <View style={styles.tag}>
        <Icon name="mic" size="sm" color={theme.colors.text.inverse} />
        <Text variant="monoLabel" color={theme.colors.text.inverse}>
          {label}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    // Warm-ink media backdrop (palette ink900) so the waveform reads like a dark clip
    // surface, consistent with the video frame it sits alongside.
    backgroundColor: '#1a1612',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '50%',
    width: '100%',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: theme.radius.full,
    minWidth: 1,
  },
  tag: {
    position: 'absolute',
    bottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
})
