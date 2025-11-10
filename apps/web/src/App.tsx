// src/App.tsx
import { Stage } from "./components/containers/Parallax/Stage";
import { ParallaxController } from "./components/containers/Parallax/ParallaxController";
import ExampleScene from "./components/containers/Parallax/ExampleScene";

export default function App() {
  return (
    <>
      {/* Controller tracks scroll + viewport size and updates global store */}
      <ParallaxController />

      {/* Stage: fixed Three.js canvas with camera + lighting */}
      <Stage>
        <ExampleScene />
      </Stage>

      {/* Regular scrollable page content */}
      <div style={{ height: "200vh" }} />
    </>
  );
}
