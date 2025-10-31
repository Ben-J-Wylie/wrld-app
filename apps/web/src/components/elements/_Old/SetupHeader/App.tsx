// @ts-nocheck

import React, { useState } from "react";
import SetupHeader from "./components/elements/SetupHeader/SetupHeader";
import ButtonGoLive from "./components/elements/ButtonGoLive/ButtonGoLive";

export default function App() {
  const [isLive, setIsLive] = useState(false);

  return (
    <div
      style={{
        background: "#0e0e0e",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "60px",
      }}
    >
      <SetupHeader
        title="Setup Your Stream"
        subtitle="Choose what you’ll share before going live."
      >
        <ButtonGoLive
          isLive={isLive}
          onClick={() => setIsLive((prev) => !prev)}
        />
      </SetupHeader>

      <p style={{ color: "#777", marginTop: "40px" }}>
        (More components would appear below here.)
      </p>
    </div>
  );
}
