// @ts-nocheck

import React, { useState } from "react";
import LoginForm from "./components/features/FormLogin/FormLogin";

// 🧩 Mock AuthModalContext Provider (so useAuthModal() won't break)
const MockAuthModalContext = React.createContext({
  openSignup: () => {},
  close: () => {},
});

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [showSignupAlert, setShowSignupAlert] = useState(false);

  // simulate the context values used by LoginForm
  const mockAuthModal = {
    openSignup: () => setShowSignupAlert(true),
    close: () => console.log("Modal closed."),
  };

  return (
    <MockAuthModalContext.Provider value={mockAuthModal}>
      <div className="app-wrapper">
        <h1>Login Form Demo</h1>

        <div className="form-demo">
          <LoginForm onLogin={(u) => setUser(u)} />
        </div>

        {user && (
          <div className="alert success">
            <p>✅ Logged in as {user.email || user.username}</p>
          </div>
        )}

        {showSignupAlert && (
          <div className="alert">
            <p>Sign-up form would open here.</p>
            <button onClick={() => setShowSignupAlert(false)}>Close</button>
          </div>
        )}
      </div>
    </MockAuthModalContext.Provider>
  );
}
