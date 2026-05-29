export const theme = {
  colors: {
    bg: '#0A0A0F',
    bgElevated: '#15151D',
    border: '#262631',
    text: '#FFFFFF',
    textMuted: '#8A8A98',
    accent: '#5B8CFF',
    accentMuted: '#3D5BB0',
    danger: '#FF4D6D',
    success: '#3DDC97',
    live: '#FF3B5C',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 6, md: 10, lg: 16, full: 999 },
  typography: {
    title: { fontSize: 32, fontWeight: '700' as const },
    heading: { fontSize: 20, fontWeight: '600' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
  },
} as const

export type Theme = typeof theme
