// @ts-nocheck

import React, { useState } from "react";
import Header from "./components/sections/Header/Header";

export default function App() {
  const [user, setUser] = useState<any | null>({
    username: "BenWylie",
    email: "ben@example.com",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
  });

  function handleLogout() {
    alert("Logging out...");
    setUser(null);
  }

  function handleLogin() {
    alert("Logging in...");
    setUser({
      username: "BenWylie",
      email: "ben@example.com",
      avatarUrl: "https://i.pravatar.cc/150?img=12",
    });
  }

  return (
    <div className="app-container">
      <Header user={user} onLogout={handleLogout} />

      <main className="demo-main">
        <h1>Header Component Demo</h1>
        <p>
          This page shows your new <strong>Header</strong> built with
          <br /> <em>Logo, Avatar, DropdownMenu, and UserDropdown</em>.
        </p>

        <div className="demo-controls">
          {user ? (
            <button onClick={handleLogout}>Simulate Logout</button>
          ) : (
            <button onClick={handleLogin}>Simulate Login</button>
          )}
        </div>
      </main>
    </div>
  );
}
