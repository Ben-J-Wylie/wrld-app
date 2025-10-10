// apps/web/src/context/AuthModalContext.tsx
import React, { createContext, useContext, useState } from "react";

type View = "none" | "login" | "signup";

interface AuthModalContextType {
  view: View;
  openLogin: () => void;
  openSignup: () => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextType>({
  view: "none",
  openLogin: () => {},
  openSignup: () => {},
  close: () => {},
});

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<View>("none");

  const openLogin = () => setView("login");
  const openSignup = () => setView("signup");
  const close = () => setView("none");

  return (
    <AuthModalContext.Provider value={{ view, openLogin, openSignup, close }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  return useContext(AuthModalContext);
}
