// @ts-nocheck

import React from "react";
import Avatar from "./components/elements/Avatar/Avatar"; // adjust path if needed

export default function App() {
  const mockUser = {
    username: "BenWylie",
    email: "ben@example.com",
    avatarUrl: "https://api.dicebear.com/8.x/adventurer/svg?seed=ben", // try replacing with a real image URL to test
  };

  return (
    <div className="app-container">
      <h1>Avatar Component Demo</h1>

      <div className="avatar-demo">
        <Avatar
          avatarUrl={mockUser.avatarUrl}
          username={mockUser.username}
          email={mockUser.email}
          size={40}
        />
        <Avatar username="Alice" size={60} />
        <Avatar email="charlie@example.com" size={80} />
        <Avatar
          avatarUrl="https://api.dicebear.com/8.x/adventurer/svg?seed=ben"
          size={100}
        />
      </div>
    </div>
  );
}
