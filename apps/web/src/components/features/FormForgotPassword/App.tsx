// @ts-nocheck

import React, { useState } from "react";
import ForgotPasswordForm from "./components/features/FormForgotPassword/FormForgotPassword";

// Mock AuthModalContext replacement for testing
const MockAuthModalContext = React.createContext({ openLogin: () => {} });

export default function App() {
  const [showLoginAlert, setShowLoginAlert] = useState(false);

  const mockAuthModal = {
    openLogin: () => setShowLoginAlert(true),
  };

  return (
    <MockAuthModalContext.Provider value={mockAuthModal}>
      <div className="app-wrapper">
        <h1>Forgot Password Form Demo</h1>

        <div className="form-demo">
          <ForgotPasswordForm />
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
