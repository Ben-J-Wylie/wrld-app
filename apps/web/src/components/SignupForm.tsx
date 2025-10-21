// apps/web/src/components/SignupForm.tsx
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuthModal } from "../context/_AuthModalContext";

// const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || "https://localhost:4000";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://10.0.0.197:4000";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checked, setChecked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false); // ✅ new

  const { openLogin } = useAuthModal();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Signup failed");

      console.log("✅ Signed up:", data);
      setSuccess(true); // ✅ show thank you message
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    // ✅ Thank you screen
    return (
      <div className="form-container">
        <h2 className="form-title">🎉 Thank You!</h2>
        <p style={{ textAlign: "center", color: "#cbd5e1", lineHeight: "1.6" }}>
          Your account has been created successfully.
          <br />
          Please check your email for a verification link to activate your
          account.
        </p>
        <p className="form-footer" style={{ marginTop: "1.5rem" }}>
          Already verified?{" "}
          <button onClick={openLogin} className="link-button" type="button">
            Log In
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="form-container" onSubmit={handleSignup}>
      <h2 className="form-title">Sign Up</h2>

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
          placeholder="Choose a password"
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

      <div className="checkbox-row">
        <input
          type="checkbox"
          id="robotCheck"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <label htmlFor="robotCheck">I’m not a robot</label>
      </div>

      {error && <p style={{ color: "tomato", fontSize: "0.9rem" }}>{error}</p>}

      <button
        type="submit"
        disabled={!checked || loading}
        className={`form-button ${!checked ? "disabled" : ""}`}
      >
        {loading ? "Signing Up..." : "Sign Up"}
      </button>

      <p className="form-footer">
        Already have an account?{" "}
        <button onClick={openLogin} className="link-button" type="button">
          Log In
        </button>
      </p>
    </form>
  );
}
