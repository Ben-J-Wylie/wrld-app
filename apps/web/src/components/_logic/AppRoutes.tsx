import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HeroSection from "../Features/HeroSection/HeroSection";
import ProfilePage from "../pages/ProfilePage/ProfilePage";
import SetupPage from "../pages/SetupPage/SetupPage";

export default function AppRoutes({ user }: { user: any }) {
  return (
    <Routes>
      <Route path="/" element={<HeroSection />} />
      <Route
        path="/profile"
        element={user ? <ProfilePage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/setup"
        element={user ? <SetupPage /> : <Navigate to="/" replace />}
      />
    </Routes>
  );
}
