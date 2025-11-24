// Backdrop.ts
import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";
import { getBreakpoint } from "../Theme/Breakpoints";

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

/**
 * Creates and manages a backdrop mesh that:
 * - Resizes based on window width breakpoints
 * - Syncs its dimensions into the SceneStore
 * - Updates automatically on window resize
 */
export function initializeBackdrop(
  scene: THREE.Scene,
  dims: BackdropDimensions = DEFAULT_DIMS,
  color: THREE.ColorRepresentation = 0x222222
): THREE.Mesh {
  let mesh: THREE.Mesh;
  const store = useSceneStore.getState();

  // -----------------------------------------
  // APPLY DIMENSIONS BASED ON BREAKPOINT
  // -----------------------------------------
  const applyDimensions = () => {
    const bp = getBreakpoint(window.innerWidth);
    const { width, height } = dims[bp];

    store.setSceneWidth(width);
    store.setSceneHeight(height);

    if (mesh) resizeBackdrop(mesh, width, height);
  };

  // -----------------------------------------
  // INITIAL DIMENSIONS
  // -----------------------------------------
  applyDimensions();
  const bp = getBreakpoint(window.innerWidth);
  const { width, height } = dims[bp];

  // -----------------------------------------
  // CREATE BACKDROP
  // -----------------------------------------
  mesh = createBackdrop({ width, height, color });
  scene.add(mesh);

  // -----------------------------------------
  // SUBSCRIBE TO STORE DIMENSION CHANGES
  // -----------------------------------------
  useSceneStore.subscribe((state, prev) => {
    if (
      state.sceneWidth !== prev.sceneWidth ||
      state.sceneHeight !== prev.sceneHeight
    ) {
      resizeBackdrop(mesh, state.sceneWidth, state.sceneHeight);
    }
  });

  // -----------------------------------------
  // WINDOW RESIZE LISTENER
  // -----------------------------------------
  const onResize = () => applyDimensions();
  window.addEventListener("resize", onResize);

  // Attach a disposal hook to mesh
  (mesh as any)._dispose = () => {
    window.removeEventListener("resize", onResize);
  };

  return mesh;
}

// -------------------------------------------------
// CREATE + RESIZE HELPERS
// -------------------------------------------------

export function createBackdrop({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: THREE.ColorRepresentation;
}): THREE.Mesh {
  const PAD = 100;

  const geometry = new THREE.PlaneGeometry(width + PAD, height + PAD);
  const material = new THREE.MeshStandardMaterial({ color });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.position.z = 0;

  return mesh;
}

export function resizeBackdrop(
  mesh: THREE.Mesh,
  width: number,
  height: number
) {
  const PAD = 100;

  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(width + PAD, height + PAD);
}
