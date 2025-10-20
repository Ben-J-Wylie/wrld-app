// @ts-nocheck

import React from "react";
import Logo from "./components/elements/Logo/Logo";

export default function App() {
  return (
    <div className="app-container">
      <h1>Logo Component Demo</h1>

      <div className="logo-demo">
        <Logo />
        <Logo text="WRLD" variant="accent" />
        <Logo text="WRLD" variant="dark" size={48} />
        <Logo
          text="WRLD"
          size={64}
          onClick={() => alert("Logo clicked!")}
          variant="accent"
        />
      </div>
    </div>
  );
}
