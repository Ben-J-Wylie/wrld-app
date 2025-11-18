// src/Backdrop.ts
import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";
import { getBreakpoint } from "./Breakpoints";

export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

const DEFAULT_DIMS: BackdropDimensions = {
  mobile: { width: 100, height: 50 },
  tablet: { width: 75, height: 75 },
  desktop: { width: 50, height: 100 },
};

export function initializeBackdrop(
  scene: THREE.Scene,
  dims: BackdropDimensions = DEFAULT_DIMS
) {
  let backdrop: THREE.Mesh | null = null;
  const store = useSceneStore.getState();

  // -----------------------------------------
  // APPLY DIMENSIONS BASED ON BREAKPOINT
  // -----------------------------------------
  const applyDimensions = () => {
    const bp = getBreakpoint(window.innerWidth);
    const { width, height } = dims[bp];

    // Update store → camera reacts → subscribers update
    store.setSceneWidth(width);
    store.setSceneHeight(height);

    // Resize existing backdrop mesh
    if (backdrop) resizeBackdrop(backdrop, width, height);
  };

  // -----------------------------------------
  // INITIALIZE BACKDROP
  // -----------------------------------------
  applyDimensions();

  const initialBp = getBreakpoint(window.innerWidth);
  const { width, height } = dims[initialBp];

  backdrop = createBackdrop({ width, height });
  scene.add(backdrop);

  // -----------------------------------------
  // STORE SUBSCRIPTION FOR EXTERNAL CHANGES
  // -----------------------------------------
  useSceneStore.subscribe((state, prev) => {
    if (
      state.sceneWidth !== prev.sceneWidth ||
      state.sceneHeight !== prev.sceneHeight
    ) {
      if (backdrop) {
        resizeBackdrop(backdrop, state.sceneWidth, state.sceneHeight);
      }
    }
  });

  // -----------------------------------------
  // RESIZE LISTENER
  // -----------------------------------------
  const onResize = () => applyDimensions();
  window.addEventListener("resize", onResize);

  // Cleanup hook for scene teardown (optional)
  (backdrop as any)._dispose = () => {
    window.removeEventListener("resize", onResize);
  };

  return backdrop;
}

// -------------------------------------------------
// CREATE + RESIZE HELPERS
// -------------------------------------------------

export function createBackdrop({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.position.z = 0;
  return mesh;
}

export function resizeBackdrop(
  mesh: THREE.Mesh,
  width: number,
  height: number
) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(width, height);
}
