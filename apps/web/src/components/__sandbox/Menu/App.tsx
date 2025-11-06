// @ts-nocheck

import React, { useState } from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import Avatar from "./components/elements/Avatar/Avatar";
import Menu from "./components/elements/Menu/Menu";
import DebugOverlay from "./components/containers/DebugOverlay";
import WrldLogo from "./components/elements/Logo/Logo";
import "./components/_main/main.css";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSide, setMenuSide] = useState<
    "menu-left" | "menu-right" | "menu-top" | "menu-bottom"
  >("menu-right");
  const [showDebug, setShowDebug] = useState(false);

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          {/* 🔹 Avatar trigger (centered for demo) */}
          <div
            style={{
              height: "200vh", // gives us scroll
              width: "100vw",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <Avatar
              avatarUrl="https://api.dicebear.com/8.x/adventurer/svg?seed=ben"
              username="Ben"
              size={120}
              onClick={() => setMenuOpen((v) => !v)}
            />
          </div>

          {/* ─────────────────────────────── */}
          {/* 🔹 Depth-reactive Menu */}
          <Menu
            isOpen={menuOpen}
            side={menuSide}
            span="100%"
            offset="0%"
            depth={0.1}
            onClose={() => setMenuOpen(false)}
          >
            <div className="menu-item">Profile</div>
            <div className="menu-item">Settings</div>
            <div className="menu-item">Notifications</div>
            <div className="menu-item">Account</div>
            <div className="menu-item">Privacy</div>
            <div className="menu-item">Help</div>
            <div className="menu-item">Logout</div>
          </Menu>

          {/* ─────────────────────────────── */}
          {/* 🔹 Optional: centered logo showing parallax motion */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <DebugOverlay show={showDebug}>
              <WrldLogo
                layout="inline"
                size={150}
                iconDepth={0}
                textDepth={0}
              />
            </DebugOverlay>
          </div>

          {/* ─────────────────────────────── */}
          {/* 🔹 Optional debug buttons */}
          <div
            style={{
              position: "fixed",
              bottom: 16,
              left: 16,
              display: "flex",
              gap: "8px",
              zIndex: 2000,
            }}
          >
            <button onClick={() => setMenuSide("menu-left")}>Left</button>
            <button onClick={() => setMenuSide("menu-right")}>Right</button>
            <button onClick={() => setMenuSide("menu-top")}>Top</button>
            <button onClick={() => setMenuSide("menu-bottom")}>Bottom</button>
            <button onClick={() => setShowDebug((v) => !v)}>
              {showDebug ? "Hide Debug" : "Show Debug"}
            </button>
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
