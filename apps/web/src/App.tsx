// apps/web/src/App.tsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";
import Header from "./components/Header";
import AuthModal from "./components/AuthModal";
import ProfilePage from "./pages/ProfilePage";
import SetupPage from "./pages/SetupPage";
import { AuthModalProvider } from "./context/AuthModalContext";

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [checkingUser, setCheckingUser] = useState(true); // 👈 NEW

  useEffect(() => {
    const stored = localStorage.getItem("wrld_user");
    if (stored) setUser(JSON.parse(stored));
    setCheckingUser(false); // ✅ Done checking
  }, []);

  function handleLogout() {
    setUser(null);
  }

  if (checkingUser) {
    // 👀 optional loading screen
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#00e0ff",
          background: "#0f2027",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <AuthModalProvider>
        <div className="app-container">
          <Header user={user} onLogout={handleLogout} />
          <Routes>
            {/* Home */}
            <Route
              path="/"
              element={
                <main className="hero">
                  <div className="hero-content">
                    <h1 className="hero-title">
                      Welcome to <span>WRLD</span>
                    </h1>
                    <p className="hero-subtitle">
                      A new dimension of livestreaming, connection, and
                      discovery.
                    </p>
                  </div>
                </main>
              }
            />

            {/* Profile */}
            <Route
              path="/profile"
              element={user ? <ProfilePage /> : <Navigate to="/" replace />}
            />
            <Route
              path="/setup"
              element={user ? <SetupPage /> : <Navigate to="/" replace />}
            />
          </Routes>

          <AuthModal onLogin={(u) => setUser(u)} />
          <div className="background-glow"></div>
        </div>
      </AuthModalProvider>
    </Router>
  );
}
