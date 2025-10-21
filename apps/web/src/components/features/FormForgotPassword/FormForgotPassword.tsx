import React, { useState } from "react";
import { useAuthModal } from "../../../context/_AuthModalContext";
import FormContainer from "../../elements/FormContainer/FormContainer";
import FormTitle from "../../elements/FormTitle/FormTitle";
import InputText from "../../elements/InputText/InputText";
import ButtonPrimary from "../../elements/ButtonPrimary/ButtonPrimary";
import FormFooter from "../../elements/FormFooter/FormFooter";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const { openLogin } = useAuthModal();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      alert("Please enter your email address.");
      return;
    }
    alert(`Reset link sent to ${email}`);
  }

  return (
    <FormContainer>
      <form onSubmit={handleSubmit}>
        <FormTitle subtitle="We'll send a password reset link to your inbox.">
          Reset Password
        </FormTitle>

        <InputText
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <ButtonPrimary type="submit">Send Reset Link</ButtonPrimary>

        <FormFooter>
          Remember your password?
          <button type="button" className="link-button" onClick={openLogin}>
            Log In
          </button>
        </FormFooter>
      </form>
    </FormContainer>
  );
}
