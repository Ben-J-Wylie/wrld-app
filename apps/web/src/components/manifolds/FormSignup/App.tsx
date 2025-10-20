// @ts-nocheck

import React, { useState } from "react";
import FormSignup from "./components/manifolds/FormSignup/FormSignup";
import "./App.css";

// 🧩 Mock AuthModalContext so useAuthModal() won’t break
const MockAuthModalContext = React.createContext({
  openLogin: () => {},
});

export default function App() {
  const [showLoginAlert, setShowLoginAlert] = useState(false);

  const mockAuthModal = {
    openLogin: () => setShowLoginAlert(true),
  };

  return (
    <MockAuthModalContext.Provider value={mockAuthModal}>
      <div className="app-wrapper">
        <h1>Signup Form Demo</h1>

        <div className="form-demo">
          <FormSignup />
        </div>

        {showLoginAlert && (
          <div className="alert">
            <p>Login form would open here.</p>
            <button onClick={() => setShowLoginAlert(false)}>Close</button>
          </div>
        )}
      </div>
    </MockAuthModalContext.Provider>
  );
}
