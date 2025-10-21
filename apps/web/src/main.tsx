import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthModalProvider } from "./context/_AuthModalContext";
import { BroadcastProvider } from "./context/_BroadcastContext"; // 👈 new

ReactDOM.createRoot(document.getElementById("root")!).render(
  //<React.StrictMode>
  <AuthModalProvider>
    <BroadcastProvider>
      <App />
    </BroadcastProvider>
  </AuthModalProvider>
  //</React.StrictMode>
);
