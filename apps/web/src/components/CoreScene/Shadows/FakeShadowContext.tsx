// FakeShadowContext.tsx
import React from "react";
import * as THREE from "three";

export interface ShadowReceiverEntry {
  id: string;
  meshRef: React.RefObject<THREE.Mesh>;

  /** Mask texture for the receiver */
  alphaMap?: THREE.Texture | null;

  /** NEW — duplicate canvas mesh for shadow accumulation */
  canvasRef?: React.RefObject<THREE.Mesh>;
}

export interface ShadowCasterEntry {
  id: string;
  targetRef: React.RefObject<THREE.Object3D>;
}

interface FakeShadowContextType {
  receivers: ShadowReceiverEntry[];
  casters: ShadowCasterEntry[];

  registerReceiver: (entry: ShadowReceiverEntry) => void;
  unregisterReceiver: (id: string) => void;

  registerCaster: (entry: ShadowCasterEntry) => void;
  unregisterCaster: (id: string) => void;
}

export const FakeShadowContext = React.createContext<FakeShadowContextType>({
  receivers: [],
  casters: [],
  registerReceiver: () => {},
  unregisterReceiver: () => {},
  registerCaster: () => {},
  unregisterCaster: () => {},
});

export function FakeShadowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [receivers, setReceivers] = React.useState<ShadowReceiverEntry[]>([]);
  const [casters, setCasters] = React.useState<ShadowCasterEntry[]>([]);

  const registerReceiver = React.useCallback((entry: ShadowReceiverEntry) => {
    setReceivers((prev) => {
      if (prev.some((p) => p.id === entry.id)) return prev;
      return [...prev, entry];
    });
  }, []);

  const unregisterReceiver = React.useCallback((id: string) => {
    setReceivers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const registerCaster = React.useCallback((entry: ShadowCasterEntry) => {
    setCasters((prev) => {
      if (prev.some((p) => p.id === entry.id)) return prev;
      return [...prev, entry];
    });
  }, []);

  const unregisterCaster = React.useCallback((id: string) => {
    setCasters((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <FakeShadowContext.Provider
      value={{
        receivers,
        casters,
        registerReceiver,
        unregisterReceiver,
        registerCaster,
        unregisterCaster,
      }}
    >
      {children}
    </FakeShadowContext.Provider>
  );
}
