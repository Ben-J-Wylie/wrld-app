// @ts-nocheck

import React, { useState } from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "../src/components/03-scaffolds/AppRoutes/AppRoutes";
import "./App.css";

export default function App() {
  // Simulate a logged-out user (set to {} or true if you want to test logged-in routes)
  const [user] = useState(null);

  return (
    <Router>
      <div className="app-container">
        <AppRoutes user={user} />
      </div>
    </Router>
  );
}
