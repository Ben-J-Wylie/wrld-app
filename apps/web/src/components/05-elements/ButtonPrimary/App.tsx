// @ts-nocheck

import React, { useState } from "react";
import PrimaryButton from "./components/05-elements/ButtonPrimary/ButtonPrimary";

export default function App() {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500); // Simulate a short async action
  }

  return (
    <div className="app-wrapper">
      <h1>Primary Button Demo</h1>

      <div className="button-demo">
        <PrimaryButton onClick={handleClick} loading={loading}>
          Send Reset Link
        </PrimaryButton>

        <PrimaryButton disabled>Disabled Button</PrimaryButton>

        <PrimaryButton onClick={() => alert("Clicked!")}>
          Regular Button
        </PrimaryButton>
      </div>
    </div>
  );
}
