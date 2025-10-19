// @ts-nocheck

import React, { useState } from "react";
import FormMessage from "./components/05-elements/FormMessage/FormMessage";

export default function App() {
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  return (
    <div className="app-wrapper">
      <h1>Form Message Demo</h1>

      <div className="form-message-demo">
        <FormMessage type={messageType}>
          {messageType === "success"
            ? "✅ Profile updated successfully!"
            : "⚠️ Something went wrong. Please try again."}
        </FormMessage>

        <div className="button-row">
          <button onClick={() => setMessageType("success")}>
            Show Success
          </button>
          <button onClick={() => setMessageType("error")}>Show Error</button>
        </div>
      </div>
    </div>
  );
}
