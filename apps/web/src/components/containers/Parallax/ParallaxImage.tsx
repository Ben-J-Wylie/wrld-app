import { ThreeElements } from "@react-three/fiber";
import { Image } from "@react-three/drei";
import { ParallaxGroup } from "./ParallaxGroup";

type GroupProps = ThreeElements["group"];

type Props = GroupProps & {
  src: string;
  /** world units (remember ortho zoom=100 ≈ 10px per unit @ DPR=1) */
  width?: number;
  height?: number;
  depth?: number;

  opacity?: number;
};

export default function ParallaxImage({
  src,
  width = 8,
  height,
  depth = 1,

  opacity = 1,
  ...rest
}: Props) {
  // if height omitted, the <Image> keeps aspect automatically
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
