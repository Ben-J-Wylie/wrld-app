import React, { useState } from "react";
import { useAuthModal } from "../context/_AuthModalContext";
import "../styles/auth.css";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const { openLogin } = useAuthModal();

  return (
    <div className="form-container">
      <h2 className="form-title">Reset Password</h2>

      <input
        type="email"
        placeholder="Enter your email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="form-input"
      />

      <button className="form-button">Send Reset Link</button>

      <p className="form-footer">
        Remember your password?{" "}
        <button className="link-button" onClick={openLogin}>
          Log In
        </button>
      </p>
    </div>
  );
}
