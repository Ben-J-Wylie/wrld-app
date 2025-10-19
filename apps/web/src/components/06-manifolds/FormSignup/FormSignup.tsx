import React, { useState } from "react";
import { useAuthModal } from "../../../context/AuthModalContext";
import FormContainer from "../../05-elements/FormContainer/FormContainer";
import FormTitle from "../../05-elements/FormTitle/FormTitle";
import InputText from "../../05-elements/InputText/InputText";
import InputPassword from "../../05-elements/InputPassword/InputPassword";
import ButtonPrimary from "../../05-elements/ButtonPrimary/ButtonPrimary";
import FormFooter from "../../05-elements/FormFooter/FormFooter";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:4000";

export default function FormSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Thank-you state
  if (success) {
    return (
      <FormContainer>
        <FormTitle>🎉 Thank You!</FormTitle>
        <p style={{ textAlign: "center", color: "#cbd5e1", lineHeight: "1.6" }}>
          Your account has been created successfully.
          <br />
          Please check your email for a verification link to activate your
          account.
        </p>

        <FormFooter>
          Already verified?
          <button onClick={openLogin} className="link-button" type="button">
            Log In
          </button>
        </FormFooter>
      </FormContainer>
    );
  }

  // ✅ Signup form
  return (
    <FormContainer>
      <form onSubmit={handleSignup}>
        <FormTitle subtitle="Create your WRLD account.">Sign Up</FormTitle>

        <InputText
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <InputPassword
          label="Password"
          placeholder="Choose a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="checkbox-row">
          <input
            type="checkbox"
            id="robotCheck"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <label htmlFor="robotCheck">I’m not a robot</label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <ButtonPrimary type="submit" disabled={!checked} loading={loading}>
          {loading ? "Signing Up..." : "Sign Up"}
        </ButtonPrimary>

        <FormFooter>
          Already have an account?
          <button type="button" className="link-button" onClick={openLogin}>
            Log In
          </button>
        </FormFooter>
      </form>
    </FormContainer>
  );
}
