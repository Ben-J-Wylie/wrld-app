// @ts-nocheck

import React from "react";
import FormFooter from "./components/elements/FormFooter/FormFooter";

export default function App() {
  function handleClick() {
    alert("Navigating to Sign Up...");
  }

  return (
    <div className="app-wrapper">
      <h1>Form Footer Demo</h1>

      <div className="footer-demo">
        <FormFooter>
          Don’t have an account?
          <button className="link-button" onClick={handleClick}>
            Sign Up
          </button>
        </FormFooter>

        <FormFooter>
          Remember your password?
          <button
            className="link-button"
            onClick={() => alert("Opening Login...")}
          >
            Log In
          </button>
        </FormFooter>

        <FormFooter>
          Need help?
          <button
            className="link-button"
            onClick={() => alert("Opening Support...")}
          >
            Contact Support
          </button>
        </FormFooter>
      </div>
    </div>
  );
}
