// apps/web/src/App.tsx
import React, { useState, useEffect } from "react";
import "./App.css";
import Header from "./components/Header";
import AuthModal from "./components/AuthModal";
import { AuthModalProvider } from "./context/AuthModalContext";

export default function App() {
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("wrld_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  function handleLogout() {
    setUser(null);
  }

  return (
    <AuthModalProvider>
      <div className="app-container">
        <Header user={user} onLogout={handleLogout} />
        <main className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              Welcome to <span>WRLD</span>
            </h1>
            <p className="hero-subtitle">
              A new dimension of livestreaming, connection, and discovery.
            </p>
          </div>
        </main>
        <AuthModal onLogin={(u) => setUser(u)} />
        <div className="background-glow"></div>
      </div>
    </AuthModalProvider>
  );
}
