// src/components/Scene/Lights/AmbientLight.tsx
import { SceneConfig } from "@/components/containers/SceneCore";

/**
 * AmbientLight
 * ---------------------------------------------------------------------------
 * A soft, global light that brightens the entire scene evenly.
 *
 * NOTES:
 * • Ambient light does NOT cast shadows.
 * • It is usually paired with a key light (e.g. a directional light)
 *   that provides shape, shadow, and direction.
 * • The intensity should stay relatively low (0.2–0.6) so that
 *   shadows from the main light remain visible.
 */
export function AmbientLight() {
  const { intensity, color } = SceneConfig.lighting.ambient;

  return <ambientLight intensity={intensity} color={color} />;
}
