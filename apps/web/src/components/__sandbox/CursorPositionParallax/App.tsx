// @ts-nocheck

import React from "react";
import { ParallaxProvider } from "./components/containers/Parallax/ParallaxProvider";
import { ParallaxText } from "./components/containers/Parallax/ParallaxText";

export default function App() {
  return (
    <ParallaxProvider>
      <ParallaxText />
    </ParallaxProvider>
  );
}
