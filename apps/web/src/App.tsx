import React from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import Avatar from "./components/elements/Avatar/Avatar";

export default function AvatarDemoScene() {
  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          <div
            style={{
              height: "200vh",
              width: "100vw",
              overflow: "scroll",
            }}
          ></div>
          <Avatar
            avatarUrl="https://api.dicebear.com/8.x/adventurer/svg?seed=ben"
            username="Ben"
            size={100}
            depth={0}
            style={{ top: "30%", left: "50%", position: "absolute" }}
          />
          <Avatar
            username="Alice"
            size={100}
            depth={0.1}
            style={{ top: "150%", left: "50%", position: "absolute" }}
          />
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
