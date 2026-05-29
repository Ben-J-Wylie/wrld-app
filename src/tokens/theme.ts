// src/tokens/theme.ts
//
// WRLD design system tokens. Hybrid model: flat palette layer (raw values)
// + semantic layer (what components import). Per DESIGN.md Section 2,
// components consume ONLY the semantic `theme.*` exports below;
// the palette is internal to this file.
//
// Populated in sub-phase 12.3 (2026-05-29). Aesthetic values derived
// from the `docs/design/references/` material (architectural drawings +
// brutalist UI compositions) plus the Section 1 design principles —
// NOT from the mocks in `docs/design/mocks/`. Mocks inform layout,
// functionality, and the component inventory; aesthetic comes from
// references + principles.
//
// Locked rulings (see DESIGN.md Section 6 decision-log entries 2026-05-29):
//
// - **No #000 or #fff.** Inverted-newspaper rule. Background is warm
//   near-black (sepia undertone, not cool grey); text is warm cream.
// - **Single neon accent.** `colors.accent` (warm crimson red `#d92e3a`)
//   serves every "look here" role: LIVE indicator, primary CTA, focus,
//   danger / destructive, accent badges. No separate `live` token.
//   References (brutalist set especially) consistently use ONE warm red
//   as the single saturated color; the mocks' two-color treatment
//   (blue accent + red live) was incorrect aesthetic input.
// - **Warm undertone.** Cream-tinted lines / borders / surface tints,
//   not cool-white. References' material vibe is paper + wood + cream +
//   ink, inverted to dark mode preserving the warmth.
// - **Flat surfaces with hairline borders.** Glass `backdrop-filter:blur`
//   is NOT the default panel treatment. References show flat surfaces
//   with thin warm-tinted borders. `colors.bg.glass` exists as an
//   opt-in for surfaces overlaying the globe (where dynamic backgrounds
//   genuinely need legibility help).
// - **Strict r:4** for all chrome (`radius.md = 4`); `radius.full` for
//   pills + circular buttons. Mocks render r:14–22 — tokens win.
// - **Glow opt-in.** `elevation.glow.accent` exists for consumers to
//   wire on hero CTAs (Go Live, primary onboarding). `Button` primary
//   does NOT default-glow.
// - **Warn** kept as dedicated `colors.warn` (amber). Used by
//   PasswordStrengthMeter mid-tier + CCPA jurisdiction badge.
// - **Typography:** Inter Tight (sans) + IBM Plex Mono (mono).
//   IBM Plex Mono reads as engineering document / architectural drawing
//   rather than code editor — matches references.

// ─── Palette (raw values — NOT imported by components) ─────────────────────

const palette = {
  // Backgrounds — warm near-blacks (sepia undertone). No #000.
  bg900: '#0d0b08',
  bg800: '#15120e',
  bg700: '#1c1813',
  bg600: '#241f18',

  // Ink (text) — warm near-creams. No #fff.
  ink100: '#ece6d6',
  ink60: 'rgba(236,230,214,0.58)',
  ink34: 'rgba(236,230,214,0.34)',

  // Borders — warm-tinted cream (not cool white)
  line08: 'rgba(236,230,214,0.08)',
  line14: 'rgba(236,230,214,0.14)',

  // Accent — sole saturated color. Warm crimson red. Used for every
  // "look here" role: LIVE indicator, primary CTA, focus, danger, accent.
  red500: '#d92e3a',
  red300: '#ff5060',
  red500a45: 'rgba(217,46,58,0.35)',
  red500a32: 'rgba(217,46,58,0.32)',
  red500a08: 'rgba(217,46,58,0.08)',

  // Warn (rare moderate-stakes — password mid-tier, CCPA badge)
  amber400: '#e6a23d',

  // Dark ink for accent fills (button labels on accent bg)
  ink900: '#0d0b08',
} as const

// ─── Semantic layer (components import only from `theme`) ──────────────────

export const theme = {
  colors: {
    bg: {
      primary: palette.bg900,
      elevated: palette.bg800,
      panel: palette.bg700,
      panelHi: palette.bg600,
      // Glass overlay: opt-in for surfaces over the globe (dynamic content).
      // Not the default panel treatment.
      glass: 'rgba(28,24,19,0.72)',
      // Modal scrim
      overlay: 'rgba(0,0,0,0.55)',
    },
    text: {
      primary: palette.ink100,
      muted: palette.ink60,
      subtle: palette.ink34,
      inverse: palette.ink900,
    },
    border: {
      subtle: palette.line08,
      strong: palette.line14,
    },
    accent: {
      default: palette.red500,
      bright: palette.red300,
      glow: palette.red500a45,
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
    // Mono = IBM Plex Mono per references' technical-drawing aesthetic
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
    easing: {
      standard: 'ease-out',
      spring: 'cubic-bezier(0.4, 1.4, 0.6, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    press: {
      scaleLarge: 0.98,
      scaleMid: 0.96,
      scaleSmall: 0.94,
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
      shadowOpacity: 0.6,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -20 },
    },
    // Glow — opt-in. Consumers wire on specific surfaces (Go Live
    // primary CTA, hero onboarding CTAs). NOT default on generic
    // `Button` primary. Single-accent rule: only one glow color exists.
    glow: {
      accent: {
        shadowColor: palette.red500,
        shadowOpacity: 0.25,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 0 },
      },
    },
  },
} as const

export type Theme = typeof theme
