import { ThreeElements } from "@react-three/fiber";
import { Image } from "@react-three/drei";
import { SceneConfig } from "@/components/containers/SceneCore";
import { Group } from "@/components/containers/SceneCore/Layers";

type GroupProps = ThreeElements["group"];

interface ImagePlaneProps extends GroupProps {
  src: string;
  width?: number;
  height?: number;
  depth?: number;
  opacity?: number;
}

/**
 * ImagePlane
 * ---------------------------------------------------------------------------
 * Convenience wrapper for 2D image layers with depth and opacity.
 * Useful for UI cards, background images, or layered illustrations.
 */
export function ImagePlane({
  src,
  width = SceneConfig.scene.background.worldWidth,
  height,
  depth = 0,
  opacity = 1,
  ...rest
}: ImagePlaneProps) {
  return (
    <Group depth={depth} {...rest}>
      <Image
        url={src}
        transparent
        toneMapped={false}
        scale={[width, height ?? width]}
        opacity={opacity}
      />
    </Group>
  );
}
