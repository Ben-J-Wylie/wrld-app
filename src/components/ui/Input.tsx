import { TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { theme } from '@/lib/theme'

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.colors.textMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
})
