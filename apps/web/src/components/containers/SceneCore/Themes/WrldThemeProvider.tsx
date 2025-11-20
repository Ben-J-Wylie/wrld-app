// SceneCore/Theme/WrldThemeProvider.tsx

import React, { createContext, useContext } from "react";
import { WrldTheme, WrldThemeType } from "./index";

const WrldThemeContext = createContext<WrldThemeType>(WrldTheme);

interface WrldThemeProviderProps {
  children: React.ReactNode;
  value?: Partial<WrldThemeType>; // allow user overrides
}

export function WrldThemeProvider({ children, value }: WrldThemeProviderProps) {
  // Deep merge (layered merge)
  const mergedTheme: WrldThemeType = {
    ...WrldTheme,
    ...value,

    colors: {
      ...WrldTheme.colors,
      ...(value?.colors ?? {}),
    },

    typography: {
      ...WrldTheme.typography,
      ...(value?.typography ?? {}),
      presets: {
        ...WrldTheme.typography.presets,
        ...(value?.typography?.presets ?? {}),
      },
    },

    materials: {
      ...WrldTheme.materials,
      ...(value?.materials ?? {}),
    },

    lighting: {
      ...WrldTheme.lighting,
      ...(value?.lighting ?? {}),
    },

    motion: {
      ...WrldTheme.motion,
      ...(value?.motion ?? {}),
    },

    layout: {
      ...WrldTheme.layout,
      ...(value?.layout ?? {}),
    },
  };

  return (
    <WrldThemeContext.Provider value={mergedTheme}>
      {children}
    </WrldThemeContext.Provider>
  );
}

export function useWrldTheme(): WrldThemeType {
  return useContext(WrldThemeContext);
}
