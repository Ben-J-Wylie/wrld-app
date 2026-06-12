// src/components/features/stream/VisualizerFrame.tsx
//
// Shared chrome for the live source visualizers (audio / compass / gyro / motion
// / speed / temp / torch). Provides the warm-ink media backdrop (ink900, matching
// SourceWaveform and the video frame these replace) and the bottom-left label tag
// (source icon + mono label). The per-source visual goes in `children`, centred.
//
// Each visualizer is PRESENTATIONAL — it renders a typed data prop and does not
// touch WebRTC. See the source-visualizers handoff for the data seam.

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from '@/components/primitives/Icon'
import { Text } from '@/components/primitives/Text'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

// Muted cream for idle/inactive marks on the ink backdrop (matches SourceWaveform).
export const VIZ_MUTED = 'rgba(236,230,214,0.30)'

type Props = {
  icon: IconName
  label: string
  children: React.ReactNode
  /** Dim the whole surface when the source isn't currently sending data. */
  dim?: boolean
  style?: StyleProp<ViewStyle>
}

export function VisualizerFrame({ icon, label, children, dim = false, style }: Props) {
  return (
    <View style={[styles.wrap, dim && styles.dim, style]}>
      <View style={styles.body}>{children}</View>
      <View style={styles.tag}>
        <Icon name={icon} size="sm" color={theme.colors.text.inverse} />
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
    backgroundColor: '#1a1612',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  dim: { opacity: 0.5 },
  body: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
})
