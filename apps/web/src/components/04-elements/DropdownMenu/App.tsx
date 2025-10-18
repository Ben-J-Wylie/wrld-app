// @ts-nocheck

import React from "react";
import DropdownMenu from "./components/04-elements/DropdownMenu/DropdownMenu";
import { Settings, User, LogOut } from "lucide-react";

export default function App() {
  const items = [
    {
      label: "Setup",
      icon: <Settings size={18} />,
      onClick: () => alert("Navigating to setup..."),
    },
    {
      label: "Profile",
      icon: <User size={18} />,
      onClick: () => alert("Opening profile..."),
    },
    {
      label: "Sign Out",
      icon: <LogOut size={18} />,
      onClick: () => alert("Signing out..."),
    },
  ];

  return (
    <div className="app-container">
      <h1>Dropdown Menu Demo</h1>
      <DropdownMenu label="Actions" items={items} />
    </div>
  );
}
