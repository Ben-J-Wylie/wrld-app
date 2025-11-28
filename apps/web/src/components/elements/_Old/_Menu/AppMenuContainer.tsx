// @ts-nocheck

import React, { useState } from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import ParallaxItem from "./components/containers/Parallax/ParallaxItem";
import MenuContainer from "./components/elements/Menu/MenuContainer";
import MenuEntry from "./components/elements/Menu/MenuEntry";
import "./components/_main/main.css";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(true);
  const [side, setSide] = useState<
    "menu-left" | "menu-right" | "menu-top" | "menu-bottom"
  >("menu-right");
  const [span, setSpan] = useState(60); // % of edge covered
  const [encroach, setEncroach] = useState(25); // % into viewport
  const [offset, setOffset] = useState(0); // % off-center

  const handleMenuToggle = () => setMenuOpen((prev) => !prev);
  const handleEntryClick = (label: string) => alert(`Clicked: ${label}`);

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          {/* UI Controls */}
          <ParallaxItem depth={0.1} fixed>
            <div
              style={{
                position: "fixed",
                top: "20px",
                left: "20px",
                zIndex: 200,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                color: "white",
                background: "rgba(0,0,0,0.3)",
                padding: "12px",
                borderRadius: "8px",
                backdropFilter: "blur(6px)",
              }}
            >
              <button
                onClick={handleMenuToggle}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                {menuOpen ? "Close Menu" : "Open Menu"}
              </button>

              <label>
                Side:&nbsp;
                <select
                  value={side}
                  onChange={(e) =>
                    setSide(
                      e.target.value as
                        | "menu-left"
                        | "menu-right"
                        | "menu-top"
                        | "menu-bottom"
                    )
                  }
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "6px",
                  }}
                >
                  <option value="menu-left">Left</option>
                  <option value="menu-right">Right</option>
                  <option value="menu-top">Top</option>
                  <option value="menu-bottom">Bottom</option>
                </select>
              </label>

              <label>
                Span: {span}%
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={span}
                  onChange={(e) => setSpan(parseInt(e.target.value))}
                />
              </label>

              <label>
                Encroach: {encroach}%
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={encroach}
                  onChange={(e) => setEncroach(parseInt(e.target.value))}
                />
              </label>

              <label>
                Offset: {offset}%
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="5"
                  value={offset}
                  onChange={(e) => setOffset(parseInt(e.target.value))}
                />
              </label>
            </div>
          </ParallaxItem>

          {/* Scrollable backdrop */}
          <div
            style={{
              height: "200vh",
              width: "100vw",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
              fontSize: "2rem",
            }}
          >
            <ParallaxItem depth={0.05}>
              <p>Scroll and play with the controls — the menu stays fixed.</p>
            </ParallaxItem>
          </div>

          {/* MenuContainer Demo */}
          <MenuContainer
            isOpen={menuOpen}
            side={side}
            depth={0.0}
            span={`${span}%`}
            encroach={`${encroach}%`}
            offset={`${offset}%`}
          >
            <MenuEntry
              label="Home"
              depth={0.0}
              onClick={() => handleEntryClick("Home")}
            />
            <MenuEntry
              label="About"
              depth={0.1}
              onClick={() => handleEntryClick("About")}
            />
            <MenuEntry
              label="Projects"
              depth={0.1}
              onClick={() => handleEntryClick("Projects")}
            />
            <MenuEntry
              label="Contact Us"
              depth={0.1}
              onClick={() => handleEntryClick("Contact")}
            />
            <MenuEntry
              label="Home"
              depth={0.1}
              onClick={() => handleEntryClick("Home")}
            />
            <MenuEntry
              label="About"
              depth={0.1}
              onClick={() => handleEntryClick("About")}
            />
            <MenuEntry
              label="Projects"
              depth={0.1}
              onClick={() => handleEntryClick("Projects")}
            />
            <MenuEntry
              label="Contact Us"
              depth={0.1}
              onClick={() => handleEntryClick("Contact")}
            />
            <MenuEntry
              label="Home"
              depth={0.1}
              onClick={() => handleEntryClick("Home")}
            />
            <MenuEntry
              label="About"
              depth={0.1}
              onClick={() => handleEntryClick("About")}
            />
            <MenuEntry
              label="Projects"
              depth={0.1}
              onClick={() => handleEntryClick("Projects")}
            />
            <MenuEntry
              label="Contact Us"
              depth={0.1}
              onClick={() => handleEntryClick("Contact")}
            />
            <MenuEntry
              label="Home"
              depth={0.1}
              onClick={() => handleEntryClick("Home")}
            />
            <MenuEntry
              label="About"
              depth={0.1}
              onClick={() => handleEntryClick("About")}
            />
            <MenuEntry
              label="Projects"
              depth={0.1}
              onClick={() => handleEntryClick("Projects")}
            />
            <MenuEntry
              label="Contact Us"
              depth={0.1}
              onClick={() => handleEntryClick("Contact")}
            />
          </MenuContainer>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
