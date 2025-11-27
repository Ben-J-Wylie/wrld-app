import { Backdrop } from "../../containers/SceneCore/Layers/Backdrop";
import { Stage } from "../../containers/SceneCore/Stage";
import { Group } from "../../containers/SceneCore/Layers/Group";
import { ThreeStateToggle } from "../../elements/NestedToggle/ThreeStateToggle";

const backdropSizes = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

export function NestedToggle() {
  return (
    <Stage backdrop={backdropSizes}>
      <Group
        name="MyGroup"
        position={{ mobile: [0, 0, 0], tablet: [0, 0, 0], desktop: [0, 0, 0] }}
        rotation={{ mobile: [0, 0, 0], tablet: [0, 0, 0], desktop: [0, 0, 0] }}
        scale={{ mobile: [1, 1, 1], tablet: [1, 1, 1], desktop: [1, 1, 1] }}
        anchor={[0, 0, 0]}
        visible={true}
      >
        <ThreeStateToggle name="Test Toggle" />
      </Group>

      <Backdrop />
    </Stage>
  );
}
