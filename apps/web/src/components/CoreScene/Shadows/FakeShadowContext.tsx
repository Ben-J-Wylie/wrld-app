// FakeShadowContext.tsx — Extended to support width & height on receivers
import React from "react";
import * as THREE from "three";

export interface ShadowCasterEntry {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
}

export interface ShadowReceiverEntry {
  id: string;
  meshRef: React.RefObject<THREE.Object3D>;
  width?: number; // ← NEW (optional)
  height?: number; // ← NEW (optional)
}

interface FakeShadowContextType {
  casters: ShadowCasterEntry[];
  receivers: ShadowReceiverEntry[];
  registerCaster: (entry: ShadowCasterEntry) => void;
  unregisterCaster: (id: string) => void;
  registerReceiver: (entry: ShadowReceiverEntry) => void;
  unregisterReceiver: (id: string) => void;
}

export const FakeShadowContext = React.createContext<FakeShadowContextType>({
  casters: [],
  receivers: [],
  registerCaster: () => {},
  unregisterCaster: () => {},
  registerReceiver: () => {},
  unregisterReceiver: () => {},
});

export function FakeShadowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [casters, setCasters] = React.useState<ShadowCasterEntry[]>([]);
  const [receivers, setReceivers] = React.useState<ShadowReceiverEntry[]>([]);

  // ---------------------------------------------------------
  // CASTER REGISTRATION
  // ---------------------------------------------------------
  const registerCaster = React.useCallback((entry: ShadowCasterEntry) => {
    setCasters((prev) => {
      if (prev.some((c) => c.id === entry.id)) return prev;
      return [...prev, entry];
    });
  }, []);

  const unregisterCaster = React.useCallback((id: string) => {
    setCasters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ---------------------------------------------------------
  // RECEIVER REGISTRATION (now accepts width/height)
  // ---------------------------------------------------------
  const registerReceiver = React.useCallback((entry: ShadowReceiverEntry) => {
    setReceivers((prev) => {
      if (prev.some((r) => r.id === entry.id)) return prev;
      return [...prev, entry];
    });
  }, []);

  const unregisterReceiver = React.useCallback((id: string) => {
    setReceivers((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return (
    <FakeShadowContext.Provider
      value={{
        casters,
        receivers,
        registerCaster,
        unregisterCaster,
        registerReceiver,
        unregisterReceiver,
      }}
    >
      {children}
    </FakeShadowContext.Provider>
  );
}
