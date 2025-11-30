// FakeShadowContext.tsx
import React from "react";
import * as THREE from "three";

export interface FakeShadowEntry {
  id: string;
  target: React.RefObject<THREE.Object3D>;
  shadow: React.RefObject<THREE.Mesh>;
}

interface FakeShadowContextType {
  entries: FakeShadowEntry[];
  register: (e: FakeShadowEntry) => void;
  unregister: (id: string) => void;
}

export const FakeShadowContext = React.createContext<FakeShadowContextType>({
  entries: [],
  register: () => {},
  unregister: () => {},
});

export function FakeShadowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entries, setEntries] = React.useState<FakeShadowEntry[]>([]);

  const register = React.useCallback((e: FakeShadowEntry) => {
    setEntries((prev) => {
      if (prev.find((p) => p.id === e.id)) return prev;
      return [...prev, e];
    });
  }, []);

  const unregister = React.useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <FakeShadowContext.Provider value={{ entries, register, unregister }}>
      {children}
    </FakeShadowContext.Provider>
  );
}
