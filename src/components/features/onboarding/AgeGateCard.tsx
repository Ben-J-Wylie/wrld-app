// src/components/features/onboarding/AgeGateCard.tsx
//
// Terminal-state refusal card for the age gate. Clock icon + heading +
// respectful body + a single "Take me back" secondary button. No
// retry, no "try a different date" link — the parent wizard enforces
// no re-entry. Use only when the date entered confirms <18.

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { Button } from '@/components/primitives/Button'
import { theme } from '@/tokens/theme'

type Props = {
  title?: string
  body?: string
  ctaLabel?: string
  onBack: () => void
  style?: StyleProp<ViewStyle>
}

export function AgeGateCard({
  title = 'Wrld is 18+',
  body = "We're not able to create an account for you. When you're old enough, we'd love to have you. Thanks for stopping by.",
  ctaLabel = 'Take me back',
  onBack,
  style,
}: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconFrame}>
        <Icon name="clock" size="lg" color={theme.colors.text.muted} />
      </View>
      <Text variant="display" color={theme.colors.text.primary} style={styles.center}>
        {title}
      </Text>
      <Text variant="body" color={theme.colors.text.muted} style={styles.center}>
        {body}
      </Text>
      <Button variant="secondary" label={ctaLabel} onPress={onBack} />
    </View>
  )
}

const ICON_FRAME = 72

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.xl,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.bg.elevated,
    gap: theme.spacing.md,
    alignItems: 'stretch',
  },
  iconFrame: {
    width: ICON_FRAME,
    height: ICON_FRAME,
    borderRadius: ICON_FRAME / 2,
    borderWidth: 2,
    borderColor: theme.colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  center: {
    textAlign: 'center',
  },
})
