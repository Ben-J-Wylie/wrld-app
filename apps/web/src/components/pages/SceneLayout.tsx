// @ts-nocheck

import React from "react";
import CircleStack from "../containers/Parallax/Examples/CircleStack";
import ParallaxCardStack from "../containers/Parallax/Examples/ParallaxCardStack";

export default function SceneLayout() {
  return (
    <>
      <CircleStack top="50vh" left="50vw" color="orange" />
      <ParallaxCardStack top="200vh" left="60vw" color="#fff" />
    </>
  );
}
