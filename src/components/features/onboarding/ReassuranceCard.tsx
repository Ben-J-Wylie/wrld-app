// src/components/features/onboarding/ReassuranceCard.tsx
//
// Small inline info card — icon-circle on the left, body text on the
// right. For reassuring messaging like "Your handle is changeable.
// Your account identity is permanent."

import type { ComponentProps } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Text } from '@/components/primitives/Text'
import { Icon } from '@/components/primitives/Icon'
import { theme } from '@/tokens/theme'

type IconName = ComponentProps<typeof Icon>['name']

type Props = {
  iconName: IconName
  body: string
  style?: StyleProp<ViewStyle>
}

export function ReassuranceCard({ iconName, body, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconCircle}>
        <Icon name={iconName} size="md" color={theme.colors.text.muted} />
      </View>
      <Text variant="body" color={theme.colors.text.primary} style={styles.body}>
        {body}
      </Text>
    </View>
  )
}

const CIRCLE = 36

const styles = StyleSheet.create({
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
  iconCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: theme.colors.bg.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
})
