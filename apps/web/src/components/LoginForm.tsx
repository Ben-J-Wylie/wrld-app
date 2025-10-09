// apps/web/src/components/LoginForm.tsx
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuthModal } from "../context/AuthModalContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:4000";

console.log("API_BASE_URL", API_BASE_URL);

export default function LoginForm({
  onLogin,
}: {
  onLogin: (user: any) => void;
}) {
  const [identifier, setIdentifier] = useState(""); // 👈 can be email OR username
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openSignup, close } = useAuthModal();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password }), // 👈 backend checks if it's an email or username
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      localStorage.setItem("wrld_token", data.token);
      localStorage.setItem("wrld_user", JSON.stringify(data.user));

      onLogin(data.user);
      close();

      // redirect new users to profile setup
      if (!data.user.username) {
        window.location.href = "/profile";
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-container" onSubmit={handleLogin}>
      <h2 className="form-title">Log In</h2>

      <input
        type="text" // 👈 changed from "email"
        placeholder="Email or username"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        className="form-input"
        required // only checks non-empty, not email format
      />

      <div className="password-wrapper">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="form-input password-input"
          required
        />
        <button
          type="button"
          className="eye-button"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error && <p style={{ color: "tomato", fontSize: "0.9rem" }}>{error}</p>}

      <button
        type="submit"
        className={`form-button ${loading ? "disabled" : ""}`}
        disabled={loading}
      >
        {loading ? "Logging in..." : "Log In"}
      </button>

      <p className="form-footer">
        Don’t have an account?{" "}
        <button onClick={openSignup} className="link-button" type="button">
          Sign Up
        </button>
      </p>
    </form>
  );
}
