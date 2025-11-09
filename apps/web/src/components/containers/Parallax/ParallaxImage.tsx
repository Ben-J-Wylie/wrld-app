// In simple terms:
// - A convenience wrapper for rendering 2D images with depth and opacity.

// Controls:
// - src: image file path.
// - width / height: world-space size.
// - depth: passed to ParallaxGroup.
// - opacity: for fading layers in/out.

// Impact:
// - Makes it easy to drop in images or textures at any depth in the scene.

// src/parallax/ParallaxImage.tsx
import { ThreeElements } from "@react-three/fiber";
import { Image } from "@react-three/drei";
import { ParallaxGroup } from "./ParallaxGroup";
import { ParallaxConfig } from "./ParallaxConfig";

type GroupProps = ThreeElements["group"];

type Props = GroupProps & {
  src: string;
  width?: number;
  height?: number;
  depth?: number;
  opacity?: number;
};

export default function ParallaxImage({
  src,
  width = ParallaxConfig.layers.defaultWidth,
  height,
  depth = ParallaxConfig.layers.defaultDepth,
  opacity = ParallaxConfig.layers.defaultOpacity,
  ...rest
}: Props) {
  return (
    <ParallaxGroup depth={depth} {...rest}>
      <Image
        url={src}
        transparent
        toneMapped={false}
        scale={[width, height ?? width]}
        opacity={opacity}
      />
    </ParallaxGroup>
  );
}
