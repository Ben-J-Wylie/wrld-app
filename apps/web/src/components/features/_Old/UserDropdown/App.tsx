// @ts-nocheck

import React from "react";
import Logo from "./components/elements/Logo/Logo";
import UserDropdown from "./components/features/UserDropdown/UserDropdown";

export default function App() {
  const mockUser = {
    username: "BenWylie",
    email: "ben@example.com",
    avatarUrl: "https://i.pravatar.cc/150?img=12",
  };

  function handleLogout() {
    alert("Signing out...");
  }

  function handleProfile() {
    alert("Opening profile...");
  }

  function handleSetup() {
    alert("Going to setup...");
  }

  return (
    <header className="app-header">
      <Logo text="WRLD" variant="accent" />
      <UserDropdown
        user={mockUser}
        onLogout={handleLogout}
        onProfile={handleProfile}
        onSetup={handleSetup}
      />
    </header>
  );
}
