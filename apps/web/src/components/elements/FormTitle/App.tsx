// @ts-nocheck

import React from "react";
import FormContainer from "./components/elements/FormContainer/FormContainer";
import FormTitle from "./components/elements/FormTitle/FormTitle";

export default function App() {
  return (
    <div className="app-wrapper">
      <FormContainer>
        <FormTitle subtitle="Reusable form layout test">
          Sign In to WRLD
        </FormTitle>
      </FormContainer>
    </div>
  );
}
