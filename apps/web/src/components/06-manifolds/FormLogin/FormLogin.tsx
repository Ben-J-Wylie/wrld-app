import React, { useState } from "react";
import { useAuthModal } from "../../../context/AuthModalContext";
import FormContainer from "../../05-elements/FormContainer/FormContainer";
import FormTitle from "../../05-elements/FormTitle/FormTitle";
import InputText from "../../05-elements/InputText/InputText";
import ButtonPrimary from "../../05-elements/ButtonPrimary/ButtonPrimary";
import FormFooter from "../../05-elements/FormFooter/FormFooter";
import InputPassword from "../../05-elements/InputPassword/InputPassword"; // ✅ corrected folder path + naming

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:4000";

export default function LoginForm({
  onLogin,
}: {
  onLogin: (user: any) => void;
}) {
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email: identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      localStorage.setItem("wrld_token", data.token);
      localStorage.setItem("wrld_user", JSON.stringify(data.user));

      onLogin(data.user);
      close();

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
    <FormContainer>
      <form onSubmit={handleLogin}>
        <FormTitle subtitle="Access your WRLD account.">Log In</FormTitle>

        <InputText
          label="Email or Username"
          type="text"
          placeholder="you@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        <InputPassword
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error-text">{error}</p>}

        <ButtonPrimary type="submit" loading={loading}>
          {loading ? "Logging in..." : "Log In"}
        </ButtonPrimary>

        <FormFooter>
          <div className="footer-links">
            <span>
              Don’t have an account?
              <button
                type="button"
                className="link-button"
                onClick={openSignup}
              >
                Sign Up
              </button>
            </span>

            <span>
              Forgot your password?
              <button
                type="button"
                className="link-button"
                onClick={() => alert("Open Forgot Password Form")}
              >
                Reset it
              </button>
            </span>
          </div>
        </FormFooter>
      </form>
    </FormContainer>
  );
}
