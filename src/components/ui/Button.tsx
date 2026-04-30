import { Pressable, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native'
import { theme } from '@/lib/theme'

type Variant = 'primary' | 'secondary' | 'danger'

type Props = {
  label: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: Props) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: { backgroundColor: theme.colors.accent },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  danger: { backgroundColor: theme.colors.danger },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  labelSecondary: { color: theme.colors.text },
})
