// CoreScene/Shadows/FakeShadowContext.tsx
import React from "react";
import * as THREE from "three";

export interface ShadowCasterEntry {
  id: string;
  ref: React.RefObject<THREE.Object3D>;
}

interface FakeShadowContextType {
  casters: ShadowCasterEntry[];
  registerCaster: (entry: ShadowCasterEntry) => void;
  unregisterCaster: (entry: ShadowCasterEntry) => void;
}

export const FakeShadowContext = React.createContext<FakeShadowContextType>({
  casters: [],
  registerCaster: () => {},
  unregisterCaster: () => {},
});

export function FakeShadowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [casters, setCasters] = React.useState<ShadowCasterEntry[]>([]);

  const registerCaster = React.useCallback((entry: ShadowCasterEntry) => {
    setCasters((prev) => {
      // avoid duplicates by id
      if (prev.some((c) => c.id === entry.id)) return prev;
      return [...prev, entry];
    });
  }, []);

  const unregisterCaster = React.useCallback((entry: ShadowCasterEntry) => {
    setCasters((prev) => prev.filter((c) => c.id !== entry.id));
  }, []);

  return (
    <FakeShadowContext.Provider
      value={{ casters, registerCaster, unregisterCaster }}
    >
      {children}
    </FakeShadowContext.Provider>
  );
}
