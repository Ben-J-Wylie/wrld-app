// apps/web/src/components/AuthModal.tsx
import React from "react";
import { useAuthModal } from "../../../context/AuthModalContext";
import SignupForm from "../../features/FormSignup/FormSignup";
import LoginForm from "../../features/FormLogin/FormLogin";

interface AuthModalProps {
  onLogin?: (user: any) => void;
}

export default function AuthModal({ onLogin }: AuthModalProps) {
  const { view, close } = useAuthModal();

  if (view === "none") return null;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={close}>
          ✕
        </button>

        {view === "signup" && <SignupForm />}
        {view === "login" && <LoginForm onLogin={onLogin || (() => {})} />}
      </div>
    </div>
  );
}
