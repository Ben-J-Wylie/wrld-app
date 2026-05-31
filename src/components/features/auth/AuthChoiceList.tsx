// src/components/features/auth/AuthChoiceList.tsx
//
// Vertical stack of SocialAuthButton items + an "OR" divider + an
// email button. Platform-aware ordering: iOS shows Apple first (HIG),
// Android shows Google first. Emits a single `onChoose(kind)` callback
// — backend wiring for Apple/Google is a separate task; this feature
// only handles the UI choice + ordering.

import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Divider } from '@/components/primitives/Divider'
import { Text } from '@/components/primitives/Text'
import { SocialAuthButton } from './SocialAuthButton'
import { theme } from '@/tokens/theme'

type Kind = 'apple' | 'google' | 'email'

type Props = {
  onChoose: (kind: Kind) => void
  loadingKind?: Kind | null
  style?: StyleProp<ViewStyle>
}

export function AuthChoiceList({ onChoose, loadingKind, style }: Props) {
  const social: Kind[] = Platform.OS === 'ios' ? ['apple', 'google'] : ['google']

  return (
    <View style={[styles.stack, style]}>
      {social.map((kind) => (
        <SocialAuthButton
          key={kind}
          kind={kind}
          onPress={() => onChoose(kind)}
          loading={loadingKind === kind}
        />
      ))}
      <View style={styles.orRow}>
        <Divider style={styles.orLine} />
        <Text variant="monoLabel" color={theme.colors.text.subtle}>
          OR
        </Text>
        <Divider style={styles.orLine} />
      </View>
      <SocialAuthButton
        kind="email"
        onPress={() => onChoose('email')}
        loading={loadingKind === 'email'}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.sm,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  orLine: {
    flex: 1,
  },
})
