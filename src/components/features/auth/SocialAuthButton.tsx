// src/components/features/auth/SocialAuthButton.tsx
//
// Branded auth button — composes the Button primitive's `social`
// variant with a fixed sub-kind pairing per provider. Loading state
// replaces the label with a Spinner inside the same shell (the
// underlying Button handles that already).

import { Button } from '@/components/primitives/Button'
import type { StyleProp, ViewStyle } from 'react-native'

type Kind = 'apple' | 'google' | 'email'

type Props = {
  kind: Kind
  onPress: () => void
  loading?: boolean
  label?: string
  style?: StyleProp<ViewStyle>
}

const DEFAULT_LABEL: Record<Kind, string> = {
  apple: 'Continue with Apple',
  google: 'Continue with Google',
  email: 'Continue with email',
}

export function SocialAuthButton({ kind, onPress, loading, label, style }: Props) {
  return (
    <Button
      variant="social"
      social={kind}
      label={label ?? DEFAULT_LABEL[kind]}
      loading={loading}
      onPress={onPress}
      style={style}
    />
  )
}
