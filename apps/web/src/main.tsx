// import React from "react";
// import ReactDOM from "react-dom/client";
// import App from "./App";
// import { AuthModalProvider } from "./context/AuthModalContext";
// import { BroadcastProvider } from "./context/BroadcastContext"; // 👈 new

// ReactDOM.createRoot(document.getElementById("root")!).render(
//   //<React.StrictMode>
//   <AuthModalProvider>
//     <BroadcastProvider>
//       <App />
//     </BroadcastProvider>
//   </AuthModalProvider>
//   //</React.StrictMode>
// );

// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <App />
);