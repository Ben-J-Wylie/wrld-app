import * as Scene from "@/Scene";
import { StageDom } from "./components/containers/Scene/Stage/StageDom"; // if you put it there

export default function App() {
  return (
    // A: Synthetic scroll
    <Scene.Stage>
      <Scene.ScrollController />
      <Scene.DemoScene />
    </Scene.Stage>

    // B: DOM scroll
    // <Scene.StageDom>
    //   <Scene.DemoScene />
    // </Scene.StageDom>
  );
}
