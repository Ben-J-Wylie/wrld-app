import React from "react";
import { ResponsiveProvider } from "../../containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "../../containers/Parallax/ParallaxScene";
import { ParallaxLight } from "../../containers/Parallax/ParallaxLight";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import MenuEntry from "./MenuEntry";
import "../../_main/main.css";

export default function App() {
  const handleClick = (label: string) => {
    alert(`Clicked: ${label}`);
  };

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          <div
            style={{
              height: "200vh",
              width: "100vw",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              position: "relative",
            }}
          >
            <ParallaxItem depth={0.1}>
              <h2 style={{ color: "white", marginBottom: "16px" }}>
                Menu Demo
              </h2>
            </ParallaxItem>

            <MenuEntry
              label="Home"
              depth={0.05}
              onClick={() => handleClick("Home")}
            />
            <MenuEntry
              label="About"
              depth={0.1}
              onClick={() => handleClick("About")}
            />
            <MenuEntry
              label="Services"
              depth={0.15}
              onClick={() => handleClick("Services")}
            />
            <MenuEntry
              label="This Label Is Far Too Long For The Box"
              depth={0.2}
              onClick={() => handleClick("Truncated")}
            />
            <MenuEntry
              label="Contact"
              depth={0.25}
              onClick={() => handleClick("Contact")}
            />
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
