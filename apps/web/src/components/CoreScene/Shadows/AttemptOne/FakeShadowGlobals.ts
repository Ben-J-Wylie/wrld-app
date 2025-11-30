// CoreScene/Shadows/FakeShadowGlobals.ts
import * as THREE from "three";
import React from "react";

const SHADOW_TEXTURE_URL = "/textures/soft_shadow.png";
let cachedTexture: THREE.Texture | null = null;
let cachedLightDir = new THREE.Vector3(0.3, -1, -0.4).normalize();

export function useFakeShadowGlobals() {
  const [texture, setTexture] = React.useState<THREE.Texture | null>(
    cachedTexture
  );

  React.useEffect(() => {
    if (cachedTexture) {
      setTexture(cachedTexture);
      return;
    }

    new THREE.TextureLoader().load(SHADOW_TEXTURE_URL, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      cachedTexture = tex;
      setTexture(tex);
    });
  }, []);

  // If later you want to sync with DirectionalLight, you can expose a setter here.
  const lightDir = React.useMemo(() => cachedLightDir.clone(), []);

  return { shadowTexture: texture, lightDir };
}
