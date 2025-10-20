// @ts-nocheck

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProfilePage from "./components/08-pages/ProfilePage/ProfilePage";

export default function App() {
  return (
    <Router>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          minHeight: "100vh",
          background: "#0e0e0e",
          color: "#fff",
          paddingTop: "40px",
        }}
      >
        <Routes>
          <Route path="/" element={<ProfilePage />} />
        </Routes>
      </div>
    </Router>
  );
}
