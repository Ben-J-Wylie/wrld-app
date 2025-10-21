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
import BroadcastPage from "./pages/BroadcastPage";
import { AuthModalProvider } from "./context/AuthModalContext";
import GlobalRoom from "./components/GlobalRoom";
import BroadcastPresence from "./components/BroadcastPresence";

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  // ✅ Load user from localStorage and listen for updates
  useEffect(() => {
    const loadUser = () => {
      const stored = localStorage.getItem("wrld_user");
      setUser(stored ? JSON.parse(stored) : null);
    };

    loadUser();
    setCheckingUser(false);

    // ✅ Listen for profile updates
    window.addEventListener("userUpdated", loadUser);
    return () => window.removeEventListener("userUpdated", loadUser);
  }, []);

  function handleLogout() {
    setUser(null);
    localStorage.removeItem("wrld_user");
    localStorage.removeItem("wrld_token");
  }

  if (checkingUser) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <BroadcastPresence />
      <AuthModalProvider>
        <div className="app-container">
          <Header user={user} onLogout={handleLogout} />

          <Routes>
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
            <Route
              path="/profile"
              element={user ? <ProfilePage /> : <Navigate to="/" replace />}
            />
            <Route
              path="/setup"
              element={user ? <SetupPage /> : <Navigate to="/" replace />}
            />
            <Route path="/broadcast" element={<BroadcastPage />} />{" "}
            <Route path="/global-room" element={<GlobalRoom />} />
          </Routes>

          <AuthModal onLogin={(u) => setUser(u)} />
        </div>
      </AuthModalProvider>
    </Router>
  );
}
