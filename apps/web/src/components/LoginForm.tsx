import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuthModal } from "../context/AuthModalContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:4000";

export default function LoginForm({
  onLogin,
}: {
  onLogin: (user: any) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { openSignup, close } = useAuthModal(); // 👈 include close()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      // ✅ Store token locally
      localStorage.setItem("wrld_token", data.token);
      localStorage.setItem("wrld_user", JSON.stringify(data.user));

      onLogin(data.user); // 👈 updates App state
      close(); // 👈 hides the modal
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
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="form-input"
      />

      <div className="password-wrapper">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="form-input password-input"
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
