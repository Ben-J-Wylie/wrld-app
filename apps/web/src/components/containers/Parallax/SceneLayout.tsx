import React from "react";
import CircleStack from "./CircleStack";
import ParallaxCardStack from "./ParallaxCardStack";

export default function SceneLayout() {
  return (
    <>
      <CircleStack top="50vh" left="50vw" color="orange" />
      <ParallaxCardStack top="200vh" left="60vw" color="#fff" />
    </>
  );
}
