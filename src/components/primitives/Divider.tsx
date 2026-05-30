// src/components/primitives/Divider.tsx
//
// Universal hairline separator. Replaces the inline `<View style={{
// height: 1, backgroundColor: theme.colors.border }} />` pattern
// scattered across screens.
//
// Tones:
//   subtle  border.subtle (default — consent rows, transaction rows,
//           settings rows)
//   strong  border.strong (between sections)
//   dashed  dashed border.subtle (row-actions dividers in Clip Edit)

import { View, type StyleProp, type ViewStyle } from 'react-native'
import { theme } from '@/tokens/theme'

type Tone = 'subtle' | 'strong' | 'dashed'

type Props = {
  tone?: Tone
  style?: StyleProp<ViewStyle>
}

export function Divider({ tone = 'subtle', style }: Props) {
  if (tone === 'dashed') {
    return (
      <View
        style={[
          {
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.subtle,
            borderStyle: 'dashed',
          },
          style,
        ]}
      />
    )
  }
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor:
            tone === 'subtle'
              ? theme.colors.border.subtle
              : theme.colors.border.strong,
        },
        style,
      ]}
    />
  )
}
