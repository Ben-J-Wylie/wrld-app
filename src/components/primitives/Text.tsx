// src/components/primitives/Text.tsx
//
// Text primitive — the universal text surface for the classical layer.
// Variant prop maps 1:1 to `theme.typography.*` keys; raw pixel sizes
// never appear in consumer code. Default color is `text.primary` —
// override via the `color` prop or `style.color`. All other RN `<Text>`
// props (numberOfLines, onPress, accessibility, etc.) pass through.

import { Text as RNText, type TextProps } from 'react-native'
import { theme } from '@/tokens/theme'

type Variant =
  | 'display'
  | 'heading'
  | 'body'
  | 'bodyEmphasized'
  | 'caption'
  | 'monoLabel'
  | 'monoCaption'
  | 'monoValue'

type Props = TextProps & {
  variant?: Variant
  color?: string
}

export function Text({ variant = 'body', color, style, ...rest }: Props) {
  const variantStyle = theme.typography[variant]
  return (
    <RNText
      {...rest}
      style={[
        { color: theme.colors.text.primary },
        variantStyle,
        color != null && { color },
        style,
      ]}
    />
  )
}
