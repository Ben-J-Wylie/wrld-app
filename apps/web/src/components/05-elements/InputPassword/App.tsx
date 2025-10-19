// @ts-nocheck

import React, { useState } from "react";
import InputPassword from "./components/05-elements/InputPassword/InputPassword";
import "./App.css";

export default function App() {
  const [password, setPassword] = useState("");

  return (
    <div className="app-wrapper">
      <h1>Password Input Demo</h1>

      <div className="input-demo">
        <InputPassword
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </div>
  );
}
