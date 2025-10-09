// apps/web/src/pages/SetupPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function SetupPage() {
  const navigate = useNavigate();

  return (
    <div className="setup-container">
      <h2>Welcome to WRLD Setup</h2>
      <p className="setup-subtitle">
        Great — your profile is ready! Next, let’s configure your basic
        streaming preferences.
      </p>

      <div className="setup-actions">
        <button className="form-button" onClick={() => navigate("/")}>
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
