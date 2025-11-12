import {
  BackgroundPlane,
  Group,
} from "@/components/containers/SceneCore/Layers";
import {
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";
import background from "./32.png";

/**
 * DemoScene
 * -----------------------------------------------------------------------------
 * A showcase of multi-depth 2.5D composition using Scene/Layers system.
 * Each layer sits at a specific depth (Z), creating parallax via perspective.
 */
export function DemoScene() {
  return (
    <>
      <BackgroundPlane src={background} depth={0} />
      <Group depth={0.1}>
        <LayerMid2Shape />
      </Group>
      <Group depth={2}>
        <LayerMid1Shape />
      </Group>
      <Group depth={3}>
        <LayerFrontShape />
      </Group>
      <Group depth={3.2}>
        <UiGlassShape />
      </Group>
    </>
  );
}
