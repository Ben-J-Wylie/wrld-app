import { TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { theme } from '@/tokens/theme'

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.colors.text.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
})
