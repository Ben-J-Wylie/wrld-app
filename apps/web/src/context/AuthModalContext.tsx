// apps/web/src/context/AuthModalContext.tsx
import React, { createContext, useContext, useState } from "react";

type View = "none" | "signup" | "login" | "forgot";

interface AuthModalContextType {
  view: View;
  openSignup: () => void;
  openLogin: () => void;
  openForgot: () => void;
  close: () => void;
}

// Create a context
const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined
);

// Provider component
export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>("none");

  const openSignup = () => setView("signup");
  const openLogin = () => setView("login");
  const openForgot = () => setView("forgot");
  const close = () => setView("none");

  return (
    <AuthModalContext.Provider
      value={{ view, openSignup, openLogin, openForgot, close }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

// Custom hook
export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context)
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  return context;
}
