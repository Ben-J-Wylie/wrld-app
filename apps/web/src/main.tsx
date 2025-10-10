import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthModalProvider } from "./context/AuthModalContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthModalProvider>
      <App />
    </AuthModalProvider>
  </React.StrictMode>
);
