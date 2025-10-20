// @ts-nocheck

import React, { useState } from "react";
import InputText from "./components/elements/InputText/InputText";

export default function App() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
    } else {
      setError("");
      alert(`Submitted: ${email}`);
    }
  }

  return (
    <div className="app-wrapper">
      <h1>InputText Demo</h1>

      <form className="input-demo" onSubmit={handleSubmit}>
        <InputText
          label="Email Address"
          placeholder="you@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />

        <InputText
          label="Username"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <button type="submit" className="demo-submit">
          Submit
        </button>
      </form>
    </div>
  );
}
