// FakeShadowContext.tsx
import React from "react";
import * as THREE from "three";

export interface ShadowReceiverEntry {
  id: string;
  meshRef: React.RefObject<THREE.Mesh>;

  /** Mask texture for the receiver */
  alphaMap?: THREE.Texture | null;

  /** Duplicate canvas mesh for shadow accumulation (in main scene) */
  canvasRef?: React.RefObject<THREE.Mesh>;

  /** NEW: Offscreen render target where this receiver's shadows will be composited */
  shadowRT?: THREE.WebGLRenderTarget | null;

  /** NEW: Offscreen scene that holds the shadow quads / debug quad */
  shadowScene?: THREE.Scene | null;

  /** NEW: Camera used to render shadowScene into shadowRT */
  shadowCamera?: THREE.OrthographicCamera | null;
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
      const existing = prev.find((p) => p.id === entry.id);
      if (existing) {
        // Merge / update existing entry (keeps RT, scene, etc. if they already exist)
        return prev.map((p) =>
          p.id === entry.id
            ? {
                ...p,
                ...entry,
              }
            : p
        );
      }
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
