// src/tokens/theme.ts
//
// WRLD design system tokens. Hybrid model: flat palette layer (raw values)
// + semantic layer (what components import). Per DESIGN.md Section 2,
// components consume ONLY the semantic `theme.*` exports below;
// the palette is internal to this file.
//
// **v0.2 ships light mode only.** Per DESIGN.md decision log
// 2026-05-29 (light-first pivot), the references — architectural
// drawings + brutalist UI compositions in `docs/design/references/` —
// are inherently light: cream/paper backgrounds with dark ink content
// and warm accents. Deriving light directly is more faithful than
// mentally inverting to dark first. Dark mode becomes a v0.3 follow-on
// (semantic keys stay; palette values invert).
//
// Aesthetic values come from references + Section 1 principles.
// Mocks inform layout, functionality, and the component inventory.
//
// Locked rulings (DESIGN.md Section 6 decision-log entries 2026-05-29):
//
// - **No #000 or #fff.** Inverted-newspaper rule (here in its natural
//   newspaper form): warm cream paper background, warm dark ink text.
// - **Single neon accent.** `colors.accent` (warm crimson `#d92e3a`)
//   serves every "look here" role: LIVE indicator, primary CTA, focus,
//   danger / destructive, accent badges. No separate `live` token.
// - **Warm undertone.** Background, text, borders all carry sepia /
//   cream warmth. Light mode = warm cream paper, not cool grey.
// - **Flat surfaces with hairline borders.** Glass `backdrop-filter:blur`
//   is NOT the default panel treatment. `colors.bg.glass` exists as an
//   opt-in for over-globe overlays where dynamic backgrounds need
//   legibility help.
// - **Strict r:4** for chrome (`radius.md`); `radius.full` for pills +
//   circular buttons.
// - **Glow opt-in.** `elevation.glow.accent` exists; `Button` primary
//   does NOT default-glow.
// - **Warn** dedicated (amber `#e6a23d`). Used by PasswordStrengthMeter
//   mid-tier + CCPA jurisdiction badge.
// - **Typography:** Inter Tight (sans) + IBM Plex Mono (mono).

import { Easing } from 'react-native'

// ─── Palette (raw values — NOT imported by components) ─────────────────────

const palette = {
  // Backgrounds — warm cream paper tones. No #fff.
  paper100: '#ece6d6', // primary canvas
  paper90: '#e5dcc8',  // elevated
  paper80: '#dbcfb6',  // panel
  paper70: '#d3c4a8',  // panel-hi

  // Ink (text) — warm dark inks. No #000.
  ink900: '#1a1612',
  ink60: 'rgba(26,22,18,0.62)',
  ink38: 'rgba(26,22,18,0.38)',
  ink08: 'rgba(26,22,18,0.08)',

  // Borders — warm dark rgba on cream paper
  line08: 'rgba(26,22,18,0.10)',
  line14: 'rgba(26,22,18,0.20)',

  // Accent — sole saturated color. Warm crimson red. Same in light + dark.
  red500: '#d92e3a',
  red300: '#ff5060',
  red500a35: 'rgba(217,46,58,0.35)',
  red500a32: 'rgba(217,46,58,0.32)',
  red500a08: 'rgba(217,46,58,0.08)',

  // Warn (rare moderate-stakes — pw meter mid-tier, CCPA badge)
  amber400: '#c8861e', // warmer + slightly darker for light-mode contrast

  // Cream for accent-fill text inverse
  paperLight: '#ece6d6',
} as const

// ─── Semantic layer (components import only from `theme`) ──────────────────

export const theme = {
  colors: {
    bg: {
      primary: palette.paper100,
      elevated: palette.paper90,
      panel: palette.paper80,
      panelHi: palette.paper70,
      // Glass overlay: opt-in for surfaces over the globe (dynamic
      // GL scene). Not the default panel treatment.
      glass: 'rgba(236,230,214,0.82)',
      // Modal scrim — warm-tinted dark
      overlay: 'rgba(26,22,18,0.45)',
    },
    text: {
      primary: palette.ink900,
      muted: palette.ink60,
      subtle: palette.ink38,
      // Inverse: cream for text on accent-filled buttons
      inverse: palette.paperLight,
    },
    border: {
      subtle: palette.line08,
      strong: palette.line14,
    },
    accent: {
      default: palette.red500,
      bright: palette.red300,
      glow: palette.red500a35,
      surface: palette.red500a08,
      border: palette.red500a32,
    },
    warn: palette.amber400,
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  radius: {
    md: 4,
    full: 9999,
  },

  typography: {
    display: {
      fontFamily: 'InterTight_600SemiBold',
      fontSize: 28,
      lineHeight: 32,
    },
    heading: {
      fontFamily: 'InterTight_600SemiBold',
      fontSize: 20,
      lineHeight: 24,
    },
    body: {
      fontFamily: 'InterTight_500Medium',
      fontSize: 14,
      lineHeight: 20,
    },
    bodyEmphasized: {
      fontFamily: 'InterTight_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
    },
    caption: {
      fontFamily: 'InterTight_500Medium',
      fontSize: 11,
      lineHeight: 16,
    },
    monoLabel: {
      fontFamily: 'IBMPlexMono_500Medium',
      fontSize: 10,
      lineHeight: 14,
      letterSpacing: 1.6,
      textTransform: 'uppercase' as const,
    },
    monoCaption: {
      fontFamily: 'IBMPlexMono_500Medium',
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0.4,
    },
    monoValue: {
      fontFamily: 'IBMPlexMono_500Medium',
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0.4,
      fontVariant: ['tabular-nums'] as const,
    },
  },

  fontFamilies: {
    sans: 'InterTight',
    mono: 'IBMPlexMono',
  },

  motion: {
    timing: {
      instant: 0,
      fast: 180,
      base: 250,
      slow: 350,
      pulse: 1600,
    },
    // RN `Easing` references, not CSS strings — these go straight into
    // `Animated.timing({ easing })`. Standard is the workhorse (ease-out
    // quad); inOut is for symmetric pulse/loop motion; linear is for
    // continuously rotating decor (Spinner).
    easing: {
      standard: Easing.out(Easing.quad),
      inOut: Easing.inOut(Easing.quad),
      linear: Easing.linear,
    },
    press: {
      scaleLarge: 0.98,
      scaleMid: 0.96,
      scaleSmall: 0.94,
    },
    // Named patterns — the 12.7 vocabulary. Consumers compose by pattern,
    // not raw duration. Three patterns ship; `screen-transition` from the
    // DESIGN.md draft list is deferred since expo-router handles route
    // motion and no consumer exists today.
    patterns: {
      press:   { duration: 180,  easing: Easing.out(Easing.quad) },   // tap feedback — fast + decisive
      overlay: { duration: 250,  easing: Easing.out(Easing.quad) },   // modal / banner enter+exit
      pulse:   { duration: 1600, easing: Easing.inOut(Easing.quad) }, // LIVE indicator, armed CTA — full cycle (split in half by consumer)
    },
  },

  elevation: {
    card: {
      borderWidth: 1,
      borderColor: palette.line08,
    },
    panel: {
      borderWidth: 1,
      borderColor: palette.line14,
    },
    sheet: {
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -8 },
    },
    // Glow — opt-in. Consumers wire on specific surfaces (Go Live
    // primary CTA, hero onboarding CTAs). Single-accent rule:
    // only one glow color (the warm red).
    glow: {
      accent: {
        shadowColor: palette.red500,
        shadowOpacity: 0.28,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
      },
    },
  },
} as const

export type Theme = typeof theme
