import { createContext, useContext } from "react";
import * as THREE from "three";

export const ParentContext = createContext<THREE.Object3D | null>(null);

export function useParent() {
  return useContext(ParentContext);
}
