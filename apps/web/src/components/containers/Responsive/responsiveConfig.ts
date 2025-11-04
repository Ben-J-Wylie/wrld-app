// components/containers/Responsive/responsiveConfig.ts

export const BREAKPOINTS = {
  mobile: 720,
  tablet: 1024,
  desktop: 1440,
};

// All global parameters, organized by breakpoint
export const GLOBAL_PARAMS = {
  parallaxStrength: { mobile: 1, tablet: 1, desktop: 1 },
  scaleFactor: { mobile: 0.6, tablet: 0.8, desktop: 1 },

  shadow: {
    
    // 🔹 opacity of base shadow color
    opacity: { mobile: 0.6, tablet: 0.6, desktop: 0.6 },

    // 🔹 base visual softness
    blur: { mobile: 0.2, tablet: 0.6, desktop: 1 },

    // 🔹 how much blur grows per unit of depth distance
    growth: { mobile: 0.7, tablet: 0.85, desktop: 1 },

    // 🔹 how much offset grows per unit of depth
    offsetScale: { mobile: 0.6, tablet: 0.8, desktop: 1 },

    // 🔹 how quickly opacity falls off with depth
    falloff: { mobile: 5, tablet: 5, desktop: 5 },
  },
};