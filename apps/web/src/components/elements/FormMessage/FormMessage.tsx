import React from "react";
import "../../01-main/main.css";

export default function FormMessage({
  type,
  children,
}: {
  type: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      className={`form-message ${type}`}
      style={{
        color: type === "error" ? "tomato" : "#00ff99",
        fontSize: "0.9rem",
        textAlign: "center",
      }}
    >
      {children}
    </p>
  );
}
