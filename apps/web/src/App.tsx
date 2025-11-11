import { VirtualScrollController } from "./components/containers/Parallax/VirtualScrollController";
import { Stage } from "./components/containers/Parallax/Stage";
import ExampleScene from "./components/containers/Parallax/ExampleScene";

export default function App() {
  return (
    <>
      <VirtualScrollController />
      <Stage>
        <ExampleScene />
      </Stage>
    </>
  );
}

// import FlyCamTest from "./components/containers/Parallax/FlyCamTest";
// export default FlyCamTest;
