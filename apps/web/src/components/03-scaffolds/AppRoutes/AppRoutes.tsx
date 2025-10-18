import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import HeroSection from "../../05-manifolds/HeroSection/HeroSection";
import ProfilePage from "../../07-pages/ProfilePage";
import SetupPage from "../../07-pages/SetupPage";

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
