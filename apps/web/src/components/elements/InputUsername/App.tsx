// @ts-nocheck

import React, { useState, useEffect } from "react";
import InputUsername from "./components/05-elements/InputUsername/InputUsername";

export default function App() {
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // 🧠 Simulate an API check with 500ms delay
  useEffect(() => {
    if (!username) {
      setAvailable(null);
      return;
    }

    setChecking(true);
    const timer = setTimeout(() => {
      // Mock logic: "benwylie" is taken, others are available
      if (username.toLowerCase() === "benwylie") {
        setAvailable(false);
      } else {
        setAvailable(true);
      }
      setChecking(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  return (
    <div className="app-wrapper">
      <h1>Username Input Demo</h1>

      <div className="username-demo">
        <InputUsername
          value={username}
          onChange={setUsername}
          checking={checking}
          available={available}
        />

        {available === true && (
          <p className="message success">✅ Username available!</p>
        )}
        {available === false && (
          <p className="message error">❌ That username is taken.</p>
        )}
      </div>
    </div>
  );
}
