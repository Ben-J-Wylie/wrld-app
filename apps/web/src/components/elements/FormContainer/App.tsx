// @ts-nocheck

import React from "react";
import FormContainer from "./components/05-elements/FormContainer/FormContainer";

export default function App() {
  return (
    <div className="app-wrapper">
      <FormContainer>
        <div className="placeholder-content">
          <input type="text" placeholder="Email" />
          <input type="password" placeholder="Password" />
          <button>Submit</button>
        </div>
      </FormContainer>
    </div>
  );
}
